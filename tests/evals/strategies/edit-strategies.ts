import { randomUUID } from "node:crypto"
import {
  createUIMessageStream,
  generateText,
  type LanguageModel,
  type LanguageModelMiddleware,
  Output,
  streamText,
  type UIMessageStreamWriter,
  wrapLanguageModel,
} from "ai"
import { z } from "zod"
import type { ChatUIMessage } from "@/db/schemas/chat-message"
import type { DocumentSnapshot, FocusRange, Section } from "@/lib/document-snapshot"
import { EDIT_DOCUMENT_TOOL, type EditOperation } from "@/lib/edit-operations"
import { formatOutlineEntry, formatSection } from "@/services/document-edit"
import type { ModelSettings } from "@/services/llm"
import type { StreamTurn } from "@/tests/evals/run-case"
import {
  type BlockTexts,
  createBlockTextsSchema,
  listBlocksBeforeFirstHeading,
  listCompletedIds,
  selectContextBlocks,
  selectSectionBlocks,
  toReplaceOperations,
} from "@/tests/evals/strategies/block-texts"

type Writer = UIMessageStreamWriter<ChatUIMessage>

type SnapshotDocument = DocumentSnapshot["document"]

type BlockRequest = {
  modelSettings: ModelSettings
  instructions: string
  prompt: string
  targets: Section[]
  abortSignal?: AbortSignal
}

type SectionScopeJob = {
  modelSettings: ModelSettings
  instruction: string
  snapshot: DocumentSnapshot
  abortSignal?: AbortSignal
}

type Scope = { targets: Section[]; reply: string }

type QuotaReading = { at: number; header: string; value: string }

const EDIT_RULES = [
  "Every block comes with its node ID in square brackets and, unless it's a paragraph, its type in parentheses, such as a list item or a table cell.",
  "Return the complete new text of every block you are asked for, under its node ID: the text after the instruction is applied, or the text exactly as it is when the instruction doesn't change that block. Write plain text without node IDs or type labels.",
  "Change only what the instruction asks and leave everything else exactly as it is. When there is a focus, which is the text the user highlighted, change only the focused text unless the instruction clearly asks for more.",
  "When the instruction changes a number, date or other fact, also change every other mention of the same fact and every figure calculated from it, such as a remaining count or a total. Don't adjust any other figure, even one that seems to scale with the change, such as a deadline or a check-in date within a changed period.",
  "When you rewrite text, keep how strong each statement is: don't turn should into must or into a command, or a definite statement into one with can, may or helps, or any of these the other way round, and keep every word that limits or qualifies a statement, such as only, exclusively, most, always or without delay.",
  "Keep every placeholder such as [PERSON_1] exactly as written and add no new one. Keep every number, date, amount, name and fact the instruction doesn't change, and add nothing the document doesn't say.",
  "To shorten, cut filler, repetition and roundabout phrasing, but keep every word that carries meaning: who does what, when, how much, under which condition and for what purpose, and every word that narrows a noun or a verb. Body text stays in full sentences. Keep each heading a short title on one line.",
  "If the instruction names a part the document doesn't have, change nothing rather than editing a similar part: return every block unchanged, and in the summary say that part isn't there and ask what to change.",
]

const FULL_REWRITE_INSTRUCTIONS = [
  "You edit a business document. You get the user's instruction and every block of the document, and you return every block.",
  ...EDIT_RULES,
].join("\n")

const SECTION_SCOPE_INSTRUCTIONS = [
  "You edit part of a business document. You get the user's instruction, the document's outline, the blocks to edit and, for context only, the blocks next to them. You return only the blocks to edit and can't change anything else.",
  ...EDIT_RULES,
].join("\n")

const PICK_INSTRUCTIONS = [
  "You choose the parts of a business document that the user's instruction needs. You get the instruction, the document's outline, which lists each heading with its node ID and level, and the text before the first heading, with each block's node ID in square brackets.",
  "A section runs from its heading to the next heading of any level. A second request gets only the sections and blocks you pick and can change nothing else.",
  "Pick every section the instruction may change or that may hold the text it refers to, and every block before the first heading that it may change. For an instruction about the whole document, such as making it more formal or more concise or translating it, pick every heading and every block before the first heading. To change a word, name or fact wherever it appears, pick every section that may mention it.",
  "If the instruction names a part the document doesn't have, such as a section that isn't in the outline, pick nothing, and in the reply say that part isn't there and ask what to change. Otherwise leave the reply empty.",
].join("\n")

const NO_SNAPSHOT = "The strategy needs the document snapshot."
const QUOTA_HEADER = /-(?:used-percent|window-minutes)$/u

const sectionPickSchema = z.object({
  nodeIds: z
    .array(z.string())
    .describe("Node IDs of the headings, and of the blocks before the first heading, to send"),
  reply: z.string().describe("Only when you pick nothing: say what's missing and ask what to change"),
})

export const QUOTA_READINGS: QuotaReading[] = []

const recordQuota = (headers?: Record<string, string | undefined>) =>
  Object.entries(headers ?? {})
    .filter(([header]) => QUOTA_HEADER.test(header))
    .forEach(([header, value]) => QUOTA_READINGS.push({ at: Date.now(), header, value: String(value) }))

const quotaMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v4",
  wrapGenerate: async ({ doGenerate }) => {
    const generated = await doGenerate()
    recordQuota(generated.response?.headers)
    return generated
  },
  wrapStream: async ({ doStream }) => {
    const streamed = await doStream()
    recordQuota(streamed.response?.headers)
    return streamed
  },
}

const withQuotaReadings = (model: LanguageModel) =>
  typeof model === "string" ? model : wrapLanguageModel({ model, middleware: quotaMiddleware })

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

const requireSnapshot = (snapshot?: DocumentSnapshot) => {
  if (!snapshot) throw new Error(NO_SNAPSHOT)
  return snapshot
}

const readInstruction = ({ parts }: ChatUIMessage) =>
  parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")

const formatList = (title: string, lines: string[]) => (lines.length > 0 ? `${title}:\n${lines.join("\n")}` : "")

const formatFocus = (blocks: Section[], { nodeId, from, to }: FocusRange) => {
  const blockText = blocks.find((block) => block.nodeId === nodeId)?.text ?? ""
  return `Focus: ${nodeId}, characters ${from} to ${to}: "${blockText.slice(from, to)}"`
}

const formatFocusLines = ({ document, focus }: DocumentSnapshot) =>
  focus.map((range) => formatFocus(document.blocks, range)).join("\n")

const joinParagraphs = (paragraphs: string[]) => paragraphs.filter((paragraph) => paragraph.length > 0).join("\n\n")

const writeEdits = (writer: Writer, operations: EditOperation[]) => {
  if (operations.length === 0) return
  const toolCallId = randomUUID()
  const input = { operations, summary: "" }
  writer.write({ type: "tool-input-available", toolCallId, toolName: EDIT_DOCUMENT_TOOL, input })
  writer.write({ type: "tool-output-available", toolCallId, output: { accepted: true } })
}

const writeReply = (writer: Writer, text: string) => {
  const id = randomUUID()
  writer.write({ type: "text-start", id })
  writer.write({ type: "text-delta", id, delta: text })
  writer.write({ type: "text-end", id })
}

const createEditSender = ({ targets }: BlockRequest, writer: Writer) => {
  const nodeIds = targets.map(({ nodeId }) => nodeId)
  const sentIds = new Set<string>()
  return (texts: BlockTexts, isFinished: boolean) => {
    const newIds = new Set(listCompletedIds(nodeIds, texts, isFinished).filter((nodeId) => !sentIds.has(nodeId)))
    newIds.forEach((nodeId) => sentIds.add(nodeId))
    writeEdits(
      writer,
      toReplaceOperations(
        targets.filter(({ nodeId }) => newIds.has(nodeId)),
        texts,
      ),
    )
  }
}

const streamBlockTexts = async (request: BlockRequest, writer: Writer) => {
  const sendCompleted = createEditSender(request, writer)
  const generation = streamText({
    model: withQuotaReadings(request.modelSettings.model),
    providerOptions: request.modelSettings.providerOptions,
    instructions: request.instructions,
    prompt: request.prompt,
    output: Output.object({ schema: createBlockTextsSchema(request.targets.map(({ nodeId }) => nodeId)) }),
    abortSignal: request.abortSignal,
  })
  const followPartial = new WritableStream<{ blocks?: BlockTexts; summary?: string }>({
    write: ({ blocks, summary }) => sendCompleted(blocks ?? {}, summary !== undefined),
  })
  await generation.partialOutputStream.pipeTo(followPartial)
  const { blocks, summary } = await generation.output
  sendCompleted(blocks, true)
  writeReply(writer, summary)
}

const streamStrategy = (run: (writer: Writer) => Promise<void>) =>
  createUIMessageStream<ChatUIMessage>({ execute: ({ writer }) => run(writer), onError: describeError })

const formatFullRewritePrompt = (instruction: string, snapshot: DocumentSnapshot) =>
  joinParagraphs([
    `Instruction: ${instruction}`,
    formatList("Blocks", snapshot.document.blocks.map(formatSection)),
    formatFocusLines(snapshot),
  ])

export const streamFullRewrite: StreamTurn = async (modelSettings, { message, snapshot, abortSignal }) => {
  const fullSnapshot = requireSnapshot(snapshot)
  const request = {
    modelSettings,
    instructions: FULL_REWRITE_INSTRUCTIONS,
    prompt: formatFullRewritePrompt(readInstruction(message), fullSnapshot),
    targets: fullSnapshot.document.blocks,
    abortSignal,
  }
  return streamStrategy((writer) => streamBlockTexts(request, writer))
}

const scopeToFocus = ({ document, focus }: DocumentSnapshot): Scope => {
  const focusedIds = new Set(focus.map(({ nodeId }) => nodeId))
  return { targets: document.blocks.filter(({ nodeId }) => focusedIds.has(nodeId)), reply: "" }
}

const formatPickPrompt = (instruction: string, { outline, blocks }: SnapshotDocument) =>
  joinParagraphs([
    `Instruction: ${instruction}`,
    formatList("Outline", outline.map(formatOutlineEntry)),
    formatList("Text before the first heading", listBlocksBeforeFirstHeading(blocks, outline).map(formatSection)),
  ])

const pickSections = async ({ modelSettings, instruction, snapshot, abortSignal }: SectionScopeJob): Promise<Scope> => {
  const { outline, blocks } = snapshot.document
  const { output } = await generateText({
    model: withQuotaReadings(modelSettings.model),
    providerOptions: modelSettings.providerOptions,
    instructions: PICK_INSTRUCTIONS,
    prompt: formatPickPrompt(instruction, snapshot.document),
    output: Output.object({ schema: sectionPickSchema }),
    abortSignal,
  })
  return { targets: selectSectionBlocks(blocks, outline, output.nodeIds), reply: output.reply }
}

const findScope = async (job: SectionScopeJob) =>
  job.snapshot.focus.length > 0 ? scopeToFocus(job.snapshot) : pickSections(job)

const formatSectionScopePrompt = ({ instruction, snapshot }: SectionScopeJob, targets: Section[]) => {
  const { outline, blocks } = snapshot.document
  const contextBlocks = selectContextBlocks(blocks, new Set(targets.map(({ nodeId }) => nodeId)))
  return joinParagraphs([
    `Instruction: ${instruction}`,
    formatList("Outline", outline.map(formatOutlineEntry)),
    formatList("Blocks to edit", targets.map(formatSection)),
    formatList("Neighbouring blocks, for context only", contextBlocks.map(formatSection)),
    formatFocusLines(snapshot),
  ])
}

const runSectionScope = async (job: SectionScopeJob, writer: Writer) => {
  const { targets, reply } = await findScope(job)
  if (targets.length === 0) return writeReply(writer, reply)
  const request = {
    modelSettings: job.modelSettings,
    instructions: SECTION_SCOPE_INSTRUCTIONS,
    prompt: formatSectionScopePrompt(job, targets),
    targets,
    abortSignal: job.abortSignal,
  }
  return streamBlockTexts(request, writer)
}

export const streamSectionScope: StreamTurn = async (modelSettings, { message, snapshot, abortSignal }) => {
  const job = { modelSettings, instruction: readInstruction(message), snapshot: requireSnapshot(snapshot), abortSignal }
  return streamStrategy((writer) => runSectionScope(job, writer))
}
