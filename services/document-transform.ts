import { ReadableStream, type ReadableStreamDefaultController } from "node:stream/web"
import { generateText, type LanguageModelUsage, Output, type StopCondition, type ToolSet, tool } from "ai"
import { z } from "zod"
import type { DocumentSnapshot, OutlineEntry, Section } from "@/lib/document-snapshot"
import { EDIT_DOCUMENT_TOOL, type EditOperation, editDocumentInputSchema } from "@/lib/edit-operations"
import { TRANSFORM_DOCUMENT_TOOL, type TransformProgress, transformDocumentInputSchema } from "@/lib/transform-document"
import {
  editBlockText,
  FIND_TEXT_TOOL,
  formatOutlineEntry,
  formatSection,
  isBrokenHeadingEdit,
} from "@/services/document-edit"
import type { ModelSettings } from "@/services/llm"

const TRANSFORM_DOCUMENT_DESCRIPTION = `Rewrite every section of the document to follow one instruction about the whole document's style, tone, length or language, such as "make the document more formal", "make it more concise" or "translate it to German". The tool reads every section itself, so don't read sections first. Not for an instruction about one section, and not for replacing a word, name or figure, even everywhere: use ${FIND_TEXT_TOOL} and ${EDIT_DOCUMENT_TOOL} for those.`
const SECTION_INSTRUCTIONS = [
  "You apply the user's instruction to one part of a business document. The other parts get the same instruction in separate requests.",
  "Every block comes with its node ID in square brackets and, unless it's a paragraph, its type in parentheses.",
  'Change only the blocks listed under "Blocks to rewrite", and return a change for every one of them that the instruction affects.',
  "Keep every placeholder such as [PERSON_1] exactly as written, and keep every number, date, amount and fact. Add nothing the document doesn't say.",
  "Keep how strong each statement is: don't turn should into must or into a command, or a definite statement into one with can, may or helps, or any of these the other way round, and keep every word that limits or qualifies a statement, such as only, exclusively, most, always or without delay.",
  "Keep each heading a short title on one line.",
  "Write plain text without node IDs. For a change to a few words inside a block, you may send replace_text instead of replace_node.",
].join("\n")
const MEANING_CHECK_INSTRUCTIONS = [
  "You check a rewrite of one part of a business document. The rewrite followed the user's instruction, so its wording, length or language may differ from the original.",
  "Every block comes with its node ID in square brackets and, unless it's a paragraph, its type in parentheses. Blocks missing from the rewritten blocks were not changed.",
  "Compare the rewritten blocks with the original blocks, and find every sentence whose meaning changed: a fact, number, date, name, condition, limit or scope that was lost, added or changed, or a statement that became stronger or weaker, such as should turned into must or into a command, may into will, a definite statement into one with can, may or helps, or a lost word that limits or qualifies it, such as only or exclusively.",
  "A fact may move to another block of the part. A change of wording, tone or length that keeps the meaning is fine.",
  "For every block with such a change, return its node ID and its whole corrected text: the rewritten text with the original meaning restored, still following the instruction's style, length and language.",
  "Leave out every block whose meaning stayed the same, and return an empty list when no meaning changed.",
  "Keep every placeholder such as [PERSON_1] exactly as written, keep each heading a short title on one line, and write plain text without node IDs.",
].join("\n")
const DOCUMENT_START_LABEL = "Start of the document"
const CHARACTERS_PER_TOKEN = 4
const MIN_SECTION_TOKENS = 250
const MAX_SECTION_TOKENS = 1000
const MAX_PARALLEL_SECTIONS = 6
const SECTION_TIMEOUT_MS = 60_000
const MEANING_CHECK_TIMEOUT_MS = 30_000

const meaningCorrectionsSchema = z.object({
  corrections: z.array(
    z.object({
      nodeId: z.string().min(1).describe("The rewritten block's node ID, as shown in square brackets"),
      text: z.string().describe("The block's complete corrected text, as plain text"),
    }),
  ),
})

type SnapshotDocument = DocumentSnapshot["document"]
type DocumentPart = { label: string; blocks: Section[]; tokens: number }
type PartOutcome = { label: string; operations: EditOperation[]; rejectedCount: number; hasFailed: boolean }
type MeaningCorrection = z.infer<typeof meaningCorrectionsSchema>["corrections"][number]
type TransformJob = ModelSettings & {
  fullDocument: SnapshotDocument
  instruction: string
  abortSignal?: AbortSignal
  sectionUsage: LanguageModelUsage[]
}

const EMPTY_DOCUMENT: SnapshotDocument = { outline: [], sections: [], blocks: [] }

const addUp = (counts: number[]) => counts.reduce((total, count) => total + count, 0)

const estimateTokens = (block: Section) => Math.ceil(formatSection(block).length / CHARACTERS_PER_TOKEN)

const toPart = (label: string, blocks: Section[]): DocumentPart => ({
  label,
  blocks,
  tokens: addUp(blocks.map(estimateTokens)),
})

const splitAtHeadings = ({ outline, blocks }: SnapshotDocument) => {
  const headingTexts = new Map(outline.map(({ nodeId, text }) => [nodeId, text]))
  const starts = blocks.flatMap(({ nodeId }, index) => (index === 0 || headingTexts.has(nodeId) ? [index] : []))
  return starts.map((start, position) =>
    toPart(headingTexts.get(blocks[start].nodeId) ?? DOCUMENT_START_LABEL, blocks.slice(start, starts[position + 1])),
  )
}

const tokensBefore = (counts: number[]) => counts.map((_, index) => addUp(counts.slice(0, index)))

const splitOversizedPart = (part: DocumentPart) => {
  if (part.tokens <= MAX_SECTION_TOKENS) return [part]
  const pieceCount = Math.ceil(part.tokens / MAX_SECTION_TOKENS)
  const pieceTokens = part.tokens / pieceCount
  const pieceIndexes = tokensBefore(part.blocks.map(estimateTokens)).map((offset) =>
    Math.min(pieceCount - 1, Math.floor(offset / pieceTokens)),
  )
  const pieces = Array.from({ length: pieceCount }, (_, piece) =>
    part.blocks.filter((_block, index) => pieceIndexes[index] === piece),
  )
  return pieces.filter((blocks) => blocks.length > 0).map((blocks) => toPart(part.label, blocks))
}

const canMerge = (previous: DocumentPart, next: DocumentPart) =>
  (previous.tokens < MIN_SECTION_TOKENS || next.tokens < MIN_SECTION_TOKENS) &&
  previous.tokens + next.tokens <= MAX_SECTION_TOKENS

const appendPart = (parts: DocumentPart[], part: DocumentPart) => {
  const previous = parts.at(-1)
  if (!previous || !canMerge(previous, part)) return [...parts, part]
  return [...parts.slice(0, -1), toPart(previous.label, [...previous.blocks, ...part.blocks])]
}

const splitIntoParts = (fullDocument: SnapshotDocument) =>
  splitAtHeadings(fullDocument).flatMap(splitOversizedPart).reduce<DocumentPart[]>(appendPart, [])

const formatOutline = ({ outline }: SnapshotDocument) =>
  `Outline of the document:\n${outline.map(formatOutlineEntry).join("\n")}`

const formatPartPrompt = (outline: string, instruction: string, { blocks }: DocumentPart) =>
  [outline, `Instruction: ${instruction}`, `Blocks to rewrite:\n${blocks.map(formatSection).join("\n")}`].join("\n\n")

const isAcceptedPartEdit = (outline: OutlineEntry[], blockTexts: Map<string, string>, operation: EditOperation) =>
  blockTexts.has(operation.nodeId) && !isBrokenHeadingEdit(outline, operation)

const changesBlock = (blockTexts: Map<string, string>, operation: EditOperation) => {
  const text = blockTexts.get(operation.nodeId) ?? ""
  return editBlockText(text, operation) !== text
}

const checkPartEdits = (outline: OutlineEntry[], part: DocumentPart, operations: EditOperation[]): PartOutcome => {
  const blockTexts = new Map(part.blocks.map(({ nodeId, text }) => [nodeId, text]))
  const accepted = operations.filter((operation) => isAcceptedPartEdit(outline, blockTexts, operation))
  return {
    label: part.label,
    operations: accepted.filter((operation) => changesBlock(blockTexts, operation)),
    rejectedCount: operations.length - accepted.length,
    hasFailed: false,
  }
}

const failPart = ({ label }: DocumentPart): PartOutcome => ({
  label,
  operations: [],
  rejectedCount: 0,
  hasFailed: true,
})

const requestPartEdits = async (job: TransformJob, outline: string, part: DocumentPart) => {
  job.abortSignal?.throwIfAborted()
  const { output, usage } = await generateText({
    model: job.model,
    providerOptions: job.providerOptions,
    instructions: SECTION_INSTRUCTIONS,
    prompt: formatPartPrompt(outline, job.instruction, part),
    output: Output.object({ schema: editDocumentInputSchema }),
    timeout: SECTION_TIMEOUT_MS,
    abortSignal: job.abortSignal,
  })
  job.sectionUsage.push(usage)
  return checkPartEdits(job.fullDocument.outline, part, output.operations)
}

const rewriteBlock = (block: Section, operations: EditOperation[]): Section => ({
  ...block,
  text: operations.filter(({ nodeId }) => nodeId === block.nodeId).reduce(editBlockText, block.text),
})

const listRewrittenBlocks = ({ blocks }: DocumentPart, operations: EditOperation[]) =>
  blocks
    .filter((block) => operations.some(({ nodeId }) => nodeId === block.nodeId))
    .map((block) => rewriteBlock(block, operations))

const formatMeaningCheckPrompt = (instruction: string, part: DocumentPart, operations: EditOperation[]) =>
  [
    `Instruction: ${instruction}`,
    `Original blocks:\n${part.blocks.map(formatSection).join("\n")}`,
    `Rewritten blocks:\n${listRewrittenBlocks(part, operations).map(formatSection).join("\n")}`,
  ].join("\n\n")

const toCorrectionEdit = ({ nodeId, text }: MeaningCorrection): EditOperation => ({ op: "replace_node", nodeId, text })

const requestMeaningCorrections = async (job: TransformJob, part: DocumentPart, operations: EditOperation[]) => {
  job.abortSignal?.throwIfAborted()
  const { output, usage } = await generateText({
    model: job.model,
    providerOptions: job.providerOptions,
    instructions: MEANING_CHECK_INSTRUCTIONS,
    prompt: formatMeaningCheckPrompt(job.instruction, part, operations),
    output: Output.object({ schema: meaningCorrectionsSchema }),
    timeout: MEANING_CHECK_TIMEOUT_MS,
    abortSignal: job.abortSignal,
  })
  job.sectionUsage.push(usage)
  return output.corrections.map(toCorrectionEdit)
}

const correctsEditedBlock = (outline: OutlineEntry[], operations: EditOperation[], correction: EditOperation) =>
  operations.some(({ nodeId }) => nodeId === correction.nodeId) && !isBrokenHeadingEdit(outline, correction)

const replaceCorrectedBlocks = (operations: EditOperation[], corrections: EditOperation[]) => {
  const correctedIds = new Set(corrections.map(({ nodeId }) => nodeId))
  return [...operations.filter(({ nodeId }) => !correctedIds.has(nodeId)), ...corrections]
}

const keepRewrite = (): EditOperation[] => []

const correctPartMeaning = async (job: TransformJob, part: DocumentPart, outcome: PartOutcome) => {
  if (outcome.operations.length === 0) return outcome
  const { outline } = job.fullDocument
  const corrections = await requestMeaningCorrections(job, part, outcome.operations).catch(keepRewrite)
  const usable = corrections.filter((correction) => correctsEditedBlock(outline, outcome.operations, correction))
  const { operations } = checkPartEdits(outline, part, replaceCorrectedBlocks(outcome.operations, usable))
  return { ...outcome, operations }
}

const transformPart = (job: TransformJob, outline: string, part: DocumentPart) =>
  requestPartEdits(job, outline, part)
    .catch(() => requestPartEdits(job, outline, part))
    .then((outcome) => correctPartMeaning(job, part, outcome))
    .catch(() => failPart(part))

const countEditedBlocks = (outcomes: PartOutcome[]) =>
  new Set(outcomes.flatMap(({ operations }) => operations.map(({ nodeId }) => nodeId))).size

const describeProgress = (
  parts: DocumentPart[],
  outcomes: PartOutcome[],
  operations: EditOperation[],
): TransformProgress => ({
  status: "running",
  sectionCount: parts.length,
  finishedCount: outcomes.length,
  failedSections: outcomes.filter(({ hasFailed }) => hasFailed).map(({ label }) => label),
  editedBlockCount: countEditedBlocks(outcomes),
  rejectedEditCount: addUp(outcomes.map(({ rejectedCount }) => rejectedCount)),
  operations,
})

const takeNextPart = (queue: DocumentPart[], abortSignal?: AbortSignal) =>
  abortSignal?.aborted ? undefined : queue.shift()

const runInParallel = async (
  parts: DocumentPart[],
  run: (part: DocumentPart) => Promise<void>,
  abortSignal?: AbortSignal,
) => {
  const queue = [...parts]
  const runNext = async (): Promise<void> => {
    const part = takeNextPart(queue, abortSignal)
    if (!part) return
    await run(part)
    return runNext()
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_SECTIONS, parts.length) }, runNext))
}

const runTransform = async (job: TransformJob, controller: ReadableStreamDefaultController<TransformProgress>) => {
  const parts = splitIntoParts(job.fullDocument)
  const outline = formatOutline(job.fullDocument)
  const outcomes: PartOutcome[] = []
  const reportOutcome = (outcome: PartOutcome) => {
    outcomes.push(outcome)
    controller.enqueue(describeProgress(parts, outcomes, outcome.operations))
  }
  controller.enqueue(describeProgress(parts, outcomes, []))
  await runInParallel(parts, (part) => transformPart(job, outline, part).then(reportOutcome), job.abortSignal)
  controller.enqueue({ ...describeProgress(parts, outcomes, []), status: "done" })
  controller.close()
}

export const createDocumentTransformTools = (
  modelSettings: ModelSettings,
  sectionUsage: LanguageModelUsage[],
  fullDocument: SnapshotDocument = EMPTY_DOCUMENT,
) => ({
  [TRANSFORM_DOCUMENT_TOOL]: tool({
    description: TRANSFORM_DOCUMENT_DESCRIPTION,
    inputSchema: transformDocumentInputSchema,
    execute: ({ instruction }, { abortSignal }) =>
      new ReadableStream<TransformProgress>({
        start: (controller) =>
          runTransform({ ...modelSettings, fullDocument, instruction, abortSignal, sectionUsage }, controller),
      }),
  }),
})

const isTransformResult = ({ toolName }: { toolName: string }) => toolName === TRANSFORM_DOCUMENT_TOOL

export const hasFinishedTransform: StopCondition<ToolSet> = ({ steps }) =>
  steps.at(-1)?.toolResults.some(isTransformResult) ?? false
