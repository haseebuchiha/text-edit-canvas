import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { LanguageModelV4StreamPart, LanguageModelV4Usage } from "@ai-sdk/provider"
import { generateUniqueIds } from "@tiptap/extension-unique-id"
import { Editor, type JSONContent } from "@tiptap/react"
import {
  type DynamicToolUIPart,
  getToolName,
  isToolUIPart,
  type LanguageModel,
  type LanguageModelMiddleware,
  readUIMessageStream,
  type ToolUIPart,
  wrapLanguageModel,
} from "ai"
import { isAnswerPart, readVerifiedAnswer } from "@/components/chat/tool-state"
import { applyAcceptedEdits } from "@/components/editor/apply-edits"
import { buildDocumentSnapshot } from "@/components/editor/document-snapshot"
import { createEditorExtensions } from "@/components/editor/editor-extensions"
import { contentStart, findTextBlock } from "@/components/editor/text-blocks"
import { readEvalsAllowPaid, readGatewayApiKey } from "@/config/env"
import type { ChatUIMessage } from "@/db/schemas/chat-message"
import type { ChatModelId } from "@/lib/chat-models"
import type { OutlineEntry, Section } from "@/lib/document-snapshot"
import { TRANSFORM_DOCUMENT_TOOL, transformProgressSchema } from "@/lib/transform-document"
import { type ChatTurn, streamChatTurn } from "@/services/chat"
import {
  createChatModel,
  createConfiguredCheckModel,
  createConfiguredModel,
  createModelOptions,
  type ModelSettings,
} from "@/services/llm"
import { type CheckResult, findBlockBySnippet } from "@/tests/evals/checks"
import type { Grade } from "@/tests/evals/grader"

export type Highlight = { blockContaining: string; text: string }

export type EvalCase = { id: string; document: string; instruction: string; why?: string; highlight?: Highlight }

export type Tokens = { input: number; cachedInput: number; output: number; reasoning: number }

export type Reply = {
  text: string
  answers: { answer: string; quotes: { nodeId: string; text: string }[] }[]
  answerAttempted: boolean
}

export type ToolCall = { name: string; input: unknown; output?: unknown; error?: string }

export type CaseOutcome = {
  outline: OutlineEntry[]
  originalBlocks: Section[]
  finalBlocks: Section[]
  reply: Reply
  toolCalls: ToolCall[]
  tokens: Tokens
  firstChangeMs?: number
  totalMs: number
  error?: string
}

export type CaseResult = {
  testCase: EvalCase
  outcome: CaseOutcome
  failedChecks: CheckResult[]
  grades: Grade[]
  error?: string
  passed: boolean
}

export type ScenarioRun = { model: string; startedAt: number; results: CaseResult[] }

export type StreamTurn = (modelSettings: ModelSettings, turn: ChatTurn) => ReturnType<typeof streamChatTurn>

export type Scenario<TestCase extends EvalCase> = {
  check: (testCase: TestCase, outcome: CaseOutcome) => CheckResult[]
  grade?: (testCase: TestCase, outcome: CaseOutcome) => Promise<Grade[]>
  streamTurn?: StreamTurn
}

export type ModelRecorder = { calls: Tokens[]; errors: string[] }

type Run = {
  editor: Editor
  original: { outline: OutlineEntry[]; blocks: Section[] }
  recorder: ModelRecorder
  abortSignal: AbortSignal
  startedAt: number
  firstChange: { ms?: number }
  chatErrors: string[]
}

type ToolPart = ToolUIPart | DynamicToolUIPart

type Judgement = { failedChecks: CheckResult[]; grades: Grade[]; error?: string }

const DOCUMENTS_FOLDER = join(process.cwd(), "tests", "evals", "documents")
const CASE_TIMEOUT_MS = 5 * 60_000
const LONGEST_CASE_MS = 2 * CASE_TIMEOUT_MS
const NOT_CONFIGURED = "Chat is not configured. Set LLM_BASE_URL and LLM_MODEL in .env.local, then retry."
const PAID_REFUSED =
  "The app is configured for the paid AI Gateway, so the evals didn't run. Set EVALS_ALLOW_PAID=1 to run them anyway."
const NO_VERIFIED_ANSWER = "(No verified answer. The chat shows: I couldn't find a verified answer in the document.)"
const NO_TEXT = "(No text in the reply.)"

export const NO_TOKENS: Tokens = { input: 0, cachedInput: 0, output: 0, reasoning: 0 }

const EMPTY_REPLY: Reply = { text: "", answers: [], answerAttempted: false }

const EMPTY_OUTCOME: CaseOutcome = {
  outline: [],
  originalBlocks: [],
  finalBlocks: [],
  reply: EMPTY_REPLY,
  toolCalls: [],
  tokens: NO_TOKENS,
  totalMs: 0,
}

const describeError = (error: unknown) => {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : JSON.stringify(error)
}

export const addTokens = (left: Tokens, right: Tokens): Tokens => ({
  input: left.input + right.input,
  cachedInput: left.cachedInput + right.cachedInput,
  output: left.output + right.output,
  reasoning: left.reasoning + right.reasoning,
})

const countTokens = (count?: number) => count ?? 0

const toTokens = ({ inputTokens, outputTokens }: LanguageModelV4Usage): Tokens => ({
  input: countTokens(inputTokens.total),
  cachedInput: countTokens(inputTokens.cacheRead),
  output: countTokens(outputTokens.total),
  reasoning: countTokens(outputTokens.reasoning),
})

export const createModelRecorder = (): ModelRecorder => ({ calls: [], errors: [] })

const recordFailure =
  ({ errors }: ModelRecorder) =>
  (error: unknown): never => {
    errors.push(`Model request failed: ${describeError(error)}`)
    throw error
  }

const recordStreamPart = (recorder: ModelRecorder, part: LanguageModelV4StreamPart) => {
  if (part.type === "finish") recorder.calls.push(toTokens(part.usage))
  if (part.type === "error") recorder.errors.push(`Stream error: ${describeError(part.error)}`)
}

const recordStreamParts = (recorder: ModelRecorder) =>
  new TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart>({
    transform: (part, controller) => {
      recordStreamPart(recorder, part)
      controller.enqueue(part)
    },
  })

export const recordModelCalls = (recorder: ModelRecorder): LanguageModelMiddleware => ({
  specificationVersion: "v4",
  wrapGenerate: async ({ doGenerate }) => {
    const generated = await Promise.resolve(doGenerate()).catch(recordFailure(recorder))
    recorder.calls.push(toTokens(generated.usage))
    return generated
  },
  wrapStream: async ({ doStream }) => {
    const streamed = await Promise.resolve(doStream()).catch(recordFailure(recorder))
    return { ...streamed, stream: streamed.stream.pipeThrough(recordStreamParts(recorder)) }
  },
})

export const sumTokens = (calls: Tokens[]) => calls.reduce(addTokens, NO_TOKENS)

const requireModel = (model?: LanguageModel) => {
  if (!model || typeof model === "string") throw new Error(NOT_CONFIGURED)
  return model
}

export const createAppModel = () => requireModel(createConfiguredModel())

export const createNamedModel = (chatModelId: ChatModelId) => requireModel(createChatModel(chatModelId))

const createCheckModel = () => requireModel(createConfiguredCheckModel() ?? createConfiguredModel())

const createAppModelSettings = (recorder: ModelRecorder): ModelSettings => ({
  model: wrapLanguageModel({ model: createAppModel(), middleware: recordModelCalls(recorder) }),
  checkModel: wrapLanguageModel({
    model: createCheckModel(),
    middleware: recordModelCalls(recorder),
  }),
  providerOptions: createModelOptions(randomUUID()),
})

const loadDocument = (document: string): JSONContent =>
  JSON.parse(readFileSync(join(DOCUMENTS_FOLDER, `${document}.json`), "utf8")).content

const createEditor = (document: string) => {
  const extensions = createEditorExtensions()
  return new Editor({ element: null, extensions, content: generateUniqueIds(loadDocument(document), extensions) })
}

const readStructure = (editor: Editor) => {
  const { outline, blocks } = buildDocumentSnapshot(editor).document
  return { outline, blocks }
}

export const readDocument = (document: string) => {
  const editor = createEditor(document)
  const structure = readStructure(editor)
  editor.destroy()
  return structure
}

export const findHighlight = (blocks: Section[], { blockContaining, text }: Highlight) => {
  const block = findBlockBySnippet(blocks, blockContaining)
  const from = block.text.indexOf(text)
  if (from < 0 || block.text.lastIndexOf(text) !== from)
    throw new Error(`The highlight "${text}" must appear exactly once in block ${block.nodeId}.`)
  return { block, from, to: from + text.length }
}

const selectHighlight = (editor: Editor, blocks: Section[], highlight: Highlight) => {
  const { block, from, to } = findHighlight(blocks, highlight)
  const textBlock = findTextBlock(editor.state.doc, block.nodeId)
  if (!textBlock) throw new Error(`Block ${block.nodeId} is not in the document.`)
  editor.commands.setTextSelection({ from: contentStart(textBlock) + from, to: contentStart(textBlock) + to })
}

const startRun = ({ document, highlight }: EvalCase): Run => {
  const editor = createEditor(document)
  const original = readStructure(editor)
  if (highlight) selectHighlight(editor, original.blocks, highlight)
  const startedAt = Date.now()
  const firstChange: Run["firstChange"] = {}
  editor.once("update", () => Object.assign(firstChange, { ms: Date.now() - startedAt }))
  const abortSignal = AbortSignal.timeout(CASE_TIMEOUT_MS)
  return { editor, original, recorder: createModelRecorder(), abortSignal, startedAt, firstChange, chatErrors: [] }
}

const toUserMessage = (text: string): ChatUIMessage => ({
  id: randomUUID(),
  role: "user",
  parts: [{ type: "text", text }],
})

const waitForPendingCommits = () => new Promise((resolve) => setImmediate(resolve))

const streamReply = async ({ instruction }: EvalCase, run: Run, streamTurn: StreamTurn) => {
  const turn = {
    history: [],
    message: toUserMessage(instruction),
    snapshot: buildDocumentSnapshot(run.editor),
    abortSignal: run.abortSignal,
  }
  const stream = await streamTurn(createAppModelSettings(run.recorder), turn)
  const recordChatError = (error: unknown) => run.chatErrors.push(describeError(error))
  const messages = await Array.fromAsync(
    readUIMessageStream<ChatUIMessage>({ stream: applyAcceptedEdits(run.editor, stream), onError: recordChatError }),
  )
  await waitForPendingCommits()
  return messages.at(-1)
}

const toToolCall = (part: ToolPart): ToolCall => ({
  name: getToolName(part),
  input: part.input,
  output: part.state === "output-available" ? part.output : undefined,
  error: part.state === "output-error" ? part.errorText : undefined,
})

const listToolParts = (message?: ChatUIMessage) => (message?.parts ?? []).filter(isToolUIPart)

const readText = (message?: ChatUIMessage) =>
  (message?.parts ?? [])
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim()

const listVerifiedAnswers = (toolParts: ToolPart[]) =>
  toolParts.flatMap((part) => readVerifiedAnswer(part) ?? []).map(({ answer, quotes }) => ({ answer, quotes }))

const readReply = (message?: ChatUIMessage): Reply => {
  const toolParts = listToolParts(message)
  return {
    text: readText(message),
    answers: listVerifiedAnswers(toolParts),
    answerAttempted: toolParts.some(isAnswerPart),
  }
}

const formatAnswer = ({ answer, quotes }: Reply["answers"][number]) =>
  [answer, ...quotes.map(({ nodeId, text }) => `> "${text}" [block ${nodeId}]`)].join("\n")

const describeAnswers = (answers: Reply["answers"]) =>
  answers.length === 0 ? NO_VERIFIED_ANSWER : answers.map(formatAnswer).join("\n\n")

export const describeShownReply = ({ text, answers, answerAttempted }: Reply) => {
  if (answerAttempted) return describeAnswers(answers)
  return text.length > 0 ? text : NO_TEXT
}

const listFailedParts = (toolCalls: ToolCall[]) =>
  toolCalls
    .filter(({ name }) => name === TRANSFORM_DOCUMENT_TOOL)
    .flatMap(({ output }) => transformProgressSchema.safeParse(output).data?.failedSections ?? [])

const listProblems = (run: Run, toolCalls: ToolCall[]) => [
  ...(run.abortSignal.aborted ? ["The case hit its time limit."] : []),
  ...run.chatErrors.map((error) => `The chat showed an error: ${error}`),
  ...listFailedParts(toolCalls).map((label) => `Part "${label}" of the whole-document rewrite failed.`),
]

const describeProblems = (problems: string[], { errors }: ModelRecorder) =>
  problems.length > 0 ? [...problems, ...errors].join(" ") : undefined

const collectOutcome = (run: Run, message?: ChatUIMessage): CaseOutcome => {
  const toolCalls = listToolParts(message).map(toToolCall)
  return {
    outline: run.original.outline,
    originalBlocks: run.original.blocks,
    finalBlocks: readStructure(run.editor).blocks,
    reply: readReply(message),
    toolCalls,
    tokens: sumTokens(run.recorder.calls),
    firstChangeMs: run.firstChange.ms,
    totalMs: Date.now() - run.startedAt,
    error: describeProblems(listProblems(run, toolCalls), run.recorder),
  }
}

const isInfrastructureFailure = (run: Run, { error }: CaseOutcome) =>
  error !== undefined && run.recorder.errors.length > 0 && !run.abortSignal.aborted

const runAttempt = (testCase: EvalCase, streamTurn: StreamTurn) => {
  const run = startRun(testCase)
  return streamReply(testCase, run, streamTurn)
    .then((message) => collectOutcome(run, message))
    .then((outcome) => ({ outcome, failedOnInfrastructure: isInfrastructureFailure(run, outcome) }))
    .finally(() => run.editor.destroy())
}

export const runCase = async (testCase: EvalCase, streamTurn: StreamTurn = streamChatTurn) => {
  const { outcome, failedOnInfrastructure } = await runAttempt(testCase, streamTurn)
  return failedOnInfrastructure ? (await runAttempt(testCase, streamTurn)).outcome : outcome
}

const NO_FINDINGS = { failedChecks: [], grades: [] }

const hasFailedGrade = (grades: Grade[]) => grades.some(({ verdict }) => verdict === "fail")

const isPassed = ({ failedChecks, grades, error }: Judgement) =>
  error === undefined && failedChecks.length === 0 && !hasFailedGrade(grades)

const toResult = (testCase: EvalCase, outcome: CaseOutcome, judgement: Judgement): CaseResult => ({
  testCase,
  outcome,
  ...judgement,
  passed: isPassed(judgement),
})

const NO_GRADING = async () => []

const gradeCase = <TestCase extends EvalCase>(testCase: TestCase, outcome: CaseOutcome, scenario: Scenario<TestCase>) =>
  (scenario.grade ?? NO_GRADING)(testCase, outcome)
    .then((grades) => toResult(testCase, outcome, { ...NO_FINDINGS, grades }))
    .catch((error: unknown) =>
      toResult(testCase, outcome, { ...NO_FINDINGS, error: `The grader failed: ${describeError(error)}` }),
    )

const runAndGrade = async <TestCase extends EvalCase>(testCase: TestCase, scenario: Scenario<TestCase>) => {
  const outcome = await runCase(testCase, scenario.streamTurn)
  if (outcome.error) return toResult(testCase, outcome, { ...NO_FINDINGS, error: outcome.error })
  const failedChecks = scenario.check(testCase, outcome).filter(({ passed }) => !passed)
  if (failedChecks.length > 0) return toResult(testCase, outcome, { ...NO_FINDINGS, failedChecks })
  return gradeCase(testCase, outcome, scenario)
}

const evaluateCase = <TestCase extends EvalCase>(testCase: TestCase, scenario: Scenario<TestCase>) =>
  runAndGrade(testCase, scenario).catch((error: unknown) =>
    toResult(testCase, EMPTY_OUTCOME, { ...NO_FINDINGS, error: `The case crashed: ${describeError(error)}` }),
  )

const refuseUnallowedPaidRun = () => {
  if (readGatewayApiKey() && !readEvalsAllowPaid()) throw new Error(PAID_REFUSED)
}

export const runScenario = async <TestCase extends EvalCase>(
  cases: TestCase[],
  scenario: Scenario<TestCase>,
): Promise<ScenarioRun> => {
  refuseUnallowedPaidRun()
  const model = createAppModel().modelId
  const startedAt = Date.now()
  const results = await cases.reduce<Promise<CaseResult[]>>(
    async (previous, testCase) => [...(await previous), await evaluateCase(testCase, scenario)],
    Promise.resolve([]),
  )
  return { model, startedAt, results }
}

export const scenarioTimeout = (cases: EvalCase[]) => cases.length * LONGEST_CASE_MS
