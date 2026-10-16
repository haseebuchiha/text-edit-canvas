import { ReadableStream, type ReadableStreamDefaultController } from "node:stream/web"
import {
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  Output,
  type StopCondition,
  type ToolSet,
  tool,
} from "ai"
import { type Change, diffWords } from "diff"
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
import { createConfiguredCheckModel, type ModelSettings } from "@/services/llm"

const TRANSFORM_DOCUMENT_DESCRIPTION = `Rewrite every section of the document to follow one instruction about the whole document's style, tone, length or language, such as "make the document more formal", "make it more concise" or "translate it to German". The tool reads every section itself, so don't read sections first. Not for an instruction about one section, and not for replacing a word, name or figure, even everywhere: use ${FIND_TEXT_TOOL} and ${EDIT_DOCUMENT_TOOL} for those.`
const SECTION_INSTRUCTIONS = [
  "You apply the user's instruction to one part of a business document. The other parts get the same instruction in separate requests, and the shared wording keeps all parts consistent.",
  "Every block comes with its node ID in square brackets and, unless it's a paragraph, its type in parentheses.",
  'Change only the blocks listed under "Blocks to rewrite", and return a change for every one of them that the instruction affects.',
  "Use the shared wording for every term it lists, and follow its notes.",
  "Keep every placeholder such as [PERSON_1] exactly as written and add no new one, and keep every number, date, amount, name and fact. Add nothing the document doesn't say.",
  "Keep how strong each statement is: don't turn should into must or into a command, or a definite statement into one with can, may or helps, or any of these the other way round, and keep every word that limits or qualifies a statement, such as only, exclusively, most, always or without delay.",
  "Apply the instruction evenly to every block that needs it, headings included.",
  "To shorten, cut filler, repetition and roundabout phrasing, but keep every word that carries meaning: who does what, when, how much, under which condition and for what purpose, and every word that narrows a noun or a verb. Body text stays in full sentences.",
  "Keep each heading a short title on one line.",
  "Write plain text without node IDs. For a change to a few words inside a block, you may send replace_text instead of replace_node.",
].join("\n")
const MEANING_CHECK_INSTRUCTIONS = [
  "You check a rewrite of one part of a business document. The rewrite followed the user's instruction, so its wording, length or language may differ from the original.",
  "Every block of the part comes with its node ID in square brackets. A changed block shows its rewrite and its changes against the original: [-words-] were removed and {+words+} were added. A block rewritten into another language shows its original and its rewrite instead. A Check line lists strength words, numbers and placeholders whose count changed; look at each, and treat it as a problem unless the meaning stayed the same.",
  "Go through every change, one by one, and ask whether a reader would now understand or do something differently. It's a problem when a fact, number, date, name, actor, condition, purpose, limit or scope was lost, added or changed; when a statement became stronger or weaker, such as should turned into must or into a command, a command into should, may into will, an option into a rule, or a definite statement into one with can, may or helps; when a word that narrows a noun or a statement was dropped, such as signed in signed contract, only, all, each or first; or when a defined term or a fixed name was replaced by other words.",
  "A fact may move to another block of the part. A change of wording, tone or length that keeps the meaning is fine.",
  "In a block rewritten into another language, it's also a problem when a sentence has a grammar error, when words are left in the original language that a business text would translate, or when a term doesn't follow the shared wording.",
  "For every problem, return the block's node ID, the problem, and a fix: words copied exactly from the block's rewrite, and the words that replace them to restore the original meaning, in the rewrite's style, length and language. Fix only the problem, keep the rest of the rewrite, and make sure the fixed sentence reads correctly.",
  "Return an empty list when no meaning changed.",
].join("\n")
const REPAIR_INSTRUCTIONS = [
  "You fix a rewrite of blocks of a business document. A check found that the rewrite changed what these blocks mean.",
  "Each block comes with its node ID in square brackets, its original text, the rewrite, and the problems the check found.",
  "Write each block again so that it follows the user's instruction as well as the rewrite did, and means exactly what the original means: keep every fact, actor, condition, purpose, limit and scope, and keep how strong each statement is. Solve every problem listed.",
  "Keep every placeholder such as [PERSON_1] exactly as written and add no new one, keep each heading a short title on one line, and write plain text without node IDs.",
].join("\n")
const BRIEF_INSTRUCTIONS = [
  "You prepare a rewrite of a whole business document. Its parts are rewritten in separate requests that each see only one part and the shared wording you write, so your list keeps them consistent.",
  "List every term that appears in more than one place and must be worded the same way in every part, above all words with several common translations or synonyms: everyday words for people and things, such as staff, customers or users, as well as roles, teams, committees, documents, tools, systems, processes, technical terms, part names, recurring headings and labels, and terms the document defines. Give each term once, as its core noun in the singular, without words such as all, our or the, with the one wording the rewrite uses. Leave out placeholders such as [PERSON_1].",
  "When the instruction translates the document, give each term's translation, and keep product names and codes as they are. Otherwise give each term unchanged.",
  "Add short notes on choices every part must share, such as the form of address and the register.",
].join("\n")
const DOCUMENT_START_LABEL = "Start of the document"
const CHARACTERS_PER_TOKEN = 4
const MIN_SECTION_TOKENS = 250
const MAX_SECTION_TOKENS = 1000
const MAX_PARALLEL_SECTIONS = 6
const SECTION_TIMEOUT_MS = 60_000
const MEANING_CHECK_TIMEOUT_MS = 30_000
const BRIEF_TIMEOUT_MS = 60_000
const MIN_SHARED_TEXT_FOR_MARKS = 0.4
const STRENGTH_WORDS = [
  "must",
  "shall",
  "should",
  "may",
  "might",
  "can",
  "cannot",
  "could",
  "will",
  "need",
  "required",
  "mandatory",
  "recommended",
  "only",
  "exclusively",
  "all",
  "every",
  "each",
  "always",
  "never",
  "least",
  "most",
  "immediately",
]
const NUMBER_PATTERN = /\d+/g
const PLACEHOLDER_PATTERN = /\[[A-Z]+_\d+\]/g

const meaningCorrectionsSchema = z.object({
  corrections: z.array(
    z.object({
      nodeId: z.string().min(1).describe("The block's node ID, as shown in square brackets"),
      text: z.string().describe("The block's complete new text, as plain text"),
    }),
  ),
})

const meaningIssuesSchema = z.object({
  issues: z.array(
    z.object({
      nodeId: z.string().min(1).describe("The changed block's node ID, as shown in square brackets"),
      problem: z
        .string()
        .describe("What a reader would now understand or do differently, quoting the original and the rewrite"),
      find: z.string().min(1).describe("Words copied exactly from the block's rewrite, around the problem"),
      replace: z.string().describe("The words that take their place and restore the original meaning"),
    }),
  ),
})

const rewriteBriefSchema = z.object({
  terms: z.array(
    z.object({
      term: z.string().describe("The term as the document writes it"),
      wording: z.string().describe("The one wording every part of the rewrite uses for it"),
    }),
  ),
  notes: z.array(z.string()).describe("Short choices every part must share"),
})

type SnapshotDocument = DocumentSnapshot["document"]
type RewriteBrief = z.infer<typeof rewriteBriefSchema>
type DocumentPart = { label: string; blocks: Section[]; tokens: number }
type PartOutcome = { label: string; operations: EditOperation[]; rejectedCount: number; hasFailed: boolean }
type MeaningIssue = z.infer<typeof meaningIssuesSchema>["issues"][number]
type MeaningCorrection = z.infer<typeof meaningCorrectionsSchema>["corrections"][number]
type FlaggedBlock = { original: Section; rewritten: Section; issues: MeaningIssue[] }
type TransformJob = ModelSettings & {
  fullDocument: SnapshotDocument
  instruction: string
  abortSignal?: AbortSignal
  sectionUsage: LanguageModelUsage[]
}
type PartJob = TransformJob & { checkModel: LanguageModel; outline: string; brief: RewriteBrief }

const EMPTY_DOCUMENT: SnapshotDocument = { outline: [], sections: [], blocks: [] }
const NO_BRIEF: RewriteBrief = { terms: [], notes: [] }

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

const formatTerm = ({ term, wording }: RewriteBrief["terms"][number]) => `- ${term}: ${wording}`

const formatNote = (note: string) => `- ${note}`

const formatBrief = ({ terms, notes }: RewriteBrief) =>
  [`Shared wording:\n${terms.map(formatTerm).join("\n")}`, `Shared notes:\n${notes.map(formatNote).join("\n")}`].join(
    "\n\n",
  )

const appearsInPart = ({ blocks }: DocumentPart, { term }: RewriteBrief["terms"][number]) =>
  blocks.some(({ text }) => text.toLowerCase().includes(term.toLowerCase()))

const formatPartBrief = ({ brief }: PartJob, part: DocumentPart) =>
  formatBrief({ ...brief, terms: brief.terms.filter((term) => appearsInPart(part, term)) })

const formatBriefPrompt = ({ instruction, fullDocument }: TransformJob) =>
  [`Instruction: ${instruction}`, `Document:\n${fullDocument.blocks.map(({ text }) => text).join("\n")}`].join("\n\n")

const requestBrief = async (job: TransformJob) => {
  const { output, usage } = await generateText({
    model: job.model,
    providerOptions: job.providerOptions,
    instructions: BRIEF_INSTRUCTIONS,
    prompt: formatBriefPrompt(job),
    output: Output.object({ schema: rewriteBriefSchema }),
    timeout: BRIEF_TIMEOUT_MS,
    abortSignal: job.abortSignal,
  })
  job.sectionUsage.push(usage)
  return output
}

const skipBrief = () => NO_BRIEF

const preparePartJob = async (job: TransformJob): Promise<PartJob> => ({
  ...job,
  checkModel: job.checkModel ?? createConfiguredCheckModel() ?? job.model,
  outline: formatOutline(job.fullDocument),
  brief: await requestBrief(job).catch(skipBrief),
})

const formatPartPrompt = (job: PartJob, part: DocumentPart) =>
  [
    job.outline,
    formatPartBrief(job, part),
    `Instruction: ${job.instruction}`,
    `Blocks to rewrite:\n${part.blocks.map(formatSection).join("\n")}`,
  ].join("\n\n")

const listPlaceholders = (text: string) => [...new Set(text.match(PLACEHOLDER_PATTERN))].toSorted().join(" ")

const keepsPlaceholders = (blockTexts: Map<string, string>, operation: EditOperation) => {
  const text = blockTexts.get(operation.nodeId) ?? ""
  return listPlaceholders(editBlockText(text, operation)) === listPlaceholders(text)
}

const isAcceptedPartEdit = (outline: OutlineEntry[], blockTexts: Map<string, string>, operation: EditOperation) =>
  blockTexts.has(operation.nodeId) && !isBrokenHeadingEdit(outline, operation)

const formatTypeLabel = (blocks: Section[], { nodeId }: EditOperation) =>
  `(${blocks.find((block) => block.nodeId === nodeId)?.type}) `

const stripTypeLabel = (blocks: Section[], operation: EditOperation): EditOperation => {
  const label = formatTypeLabel(blocks, operation)
  if (operation.op !== "replace_node" || !operation.text.startsWith(label)) return operation
  return { ...operation, text: operation.text.slice(label.length) }
}

const changesBlock = (blockTexts: Map<string, string>, operation: EditOperation) => {
  const text = blockTexts.get(operation.nodeId) ?? ""
  return editBlockText(text, operation) !== text
}

const checkPartEdits = (outline: OutlineEntry[], part: DocumentPart, operations: EditOperation[]): PartOutcome => {
  const blockTexts = new Map(part.blocks.map(({ nodeId, text }) => [nodeId, text]))
  const accepted = operations
    .map((operation) => stripTypeLabel(part.blocks, operation))
    .filter((operation) => isAcceptedPartEdit(outline, blockTexts, operation))
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

const requestPartEdits = async (job: PartJob, part: DocumentPart) => {
  job.abortSignal?.throwIfAborted()
  const { output, usage } = await generateText({
    model: job.model,
    providerOptions: job.providerOptions,
    instructions: SECTION_INSTRUCTIONS,
    prompt: formatPartPrompt(job, part),
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

const markChange = ({ added, removed, value }: Change) => {
  if (added) return `{+${value}+}`
  if (removed) return `[-${value}-]`
  return value
}

const measureText = (changes: Change[]) => addUp(changes.map(({ value }) => value.length))

const shareOfTextKept = (changes: Change[]) =>
  measureText(changes.filter(({ added, removed }) => !added && !removed)) /
  Math.max(1, measureText(changes.filter(({ added }) => !added)))

const countWord = (text: string, word: string) => text.match(new RegExp(String.raw`\b${word}\b`, "giu"))?.length ?? 0

const describeStrengthChange = (original: string, rewritten: string, word: string) => {
  const [before, after] = [countWord(original, word), countWord(rewritten, word)]
  return before === after ? [] : [`"${word}" ${before} times in the original, ${after} in the rewrite`]
}

const describeLostNumbers = (original: string, rewritten: string) => {
  const kept = new Set(rewritten.match(NUMBER_PATTERN))
  return [...new Set(original.match(NUMBER_PATTERN))]
    .filter((number) => !kept.has(number))
    .map((number) => `lost ${number}`)
}

const describePlaceholderChange = (original: string, rewritten: string) => {
  const [before, after] = [listPlaceholders(original).split(" "), listPlaceholders(rewritten).split(" ")]
  return [
    ...before
      .filter((placeholder) => placeholder && !after.includes(placeholder))
      .map((placeholder) => `lost ${placeholder}`),
    ...after
      .filter((placeholder) => placeholder && !before.includes(placeholder))
      .map((placeholder) => `added ${placeholder}`),
  ]
}

const formatCheckLine = (nodeId: string, findings: string[]) =>
  findings.length > 0 ? [`[${nodeId}] Check: ${findings.join("; ")}`] : []

const formatTranslatedBlock = (block: Section, rewritten: Section) =>
  [
    `[${block.nodeId}] Original: ${block.text}`,
    `[${block.nodeId}] Rewrite: ${rewritten.text}`,
    ...formatCheckLine(block.nodeId, [
      ...describeLostNumbers(block.text, rewritten.text),
      ...describePlaceholderChange(block.text, rewritten.text),
    ]),
  ].join("\n")

const formatBlockChange = (block: Section, rewritten: Section) => {
  const changes = diffWords(block.text, rewritten.text)
  if (shareOfTextKept(changes) < MIN_SHARED_TEXT_FOR_MARKS) return formatTranslatedBlock(block, rewritten)
  const findings = [
    ...STRENGTH_WORDS.flatMap((word) => describeStrengthChange(block.text, rewritten.text, word)),
    ...describeLostNumbers(block.text, rewritten.text),
    ...describePlaceholderChange(block.text, rewritten.text),
  ]
  return [
    `[${block.nodeId}] Rewrite: ${rewritten.text}`,
    `[${block.nodeId}] Changes: ${changes.map(markChange).join("")}`,
    ...formatCheckLine(block.nodeId, findings),
  ].join("\n")
}

const formatCheckedBlock = (block: Section, rewrittenBlocks: Section[]) => {
  const rewritten = rewrittenBlocks.find(({ nodeId }) => nodeId === block.nodeId)
  return rewritten ? formatBlockChange(block, rewritten) : formatSection(block)
}

const formatMeaningCheckPrompt = (job: PartJob, part: DocumentPart, rewrittenBlocks: Section[]) =>
  [
    formatPartBrief(job, part),
    `Instruction: ${job.instruction}`,
    `Blocks of the part, with the rewrite's changes:\n${part.blocks.map((block) => formatCheckedBlock(block, rewrittenBlocks)).join("\n")}`,
  ].join("\n\n")

const applyIssue = (text: string, { nodeId, find, replace }: MeaningIssue) =>
  editBlockText(text, { op: "replace_text", nodeId, find, replace })

const fixRewrittenBlock = (rewritten: Section, issues: MeaningIssue[]): EditOperation => ({
  op: "replace_node",
  nodeId: rewritten.nodeId,
  text: issues.filter(({ nodeId }) => nodeId === rewritten.nodeId).reduce(applyIssue, rewritten.text),
})

const isTranslatedBlock = (original: Section, rewritten: Section) =>
  shareOfTextKept(diffWords(original.text, rewritten.text)) < MIN_SHARED_TEXT_FOR_MARKS

const findOriginalBlock = ({ blocks }: DocumentPart, rewritten: Section) =>
  blocks.find(({ nodeId }) => nodeId === rewritten.nodeId) ?? rewritten

const toCodeIssue =
  (nodeId: string) =>
  (finding: string): MeaningIssue => ({ nodeId, problem: `Code check: ${finding}`, find: "", replace: "" })

const findCodeIssues = (original: Section, rewritten: Section) => {
  if (isTranslatedBlock(original, rewritten)) return []
  const findings = [
    ...describeLostNumbers(original.text, rewritten.text),
    ...describePlaceholderChange(original.text, rewritten.text),
  ]
  return findings.map(toCodeIssue(original.nodeId))
}

const flagBlock = (part: DocumentPart, rewritten: Section, issues: MeaningIssue[]): FlaggedBlock => {
  const original = findOriginalBlock(part, rewritten)
  const modelIssues = issues.filter(({ nodeId }) => nodeId === rewritten.nodeId)
  return { original, rewritten, issues: [...modelIssues, ...findCodeIssues(original, rewritten)] }
}

const listFlaggedBlocks = (part: DocumentPart, rewrittenBlocks: Section[], issues: MeaningIssue[]) =>
  rewrittenBlocks.map((rewritten) => flagBlock(part, rewritten, issues)).filter((flagged) => flagged.issues.length > 0)

const formatProblem = ({ nodeId, problem }: MeaningIssue) => `[${nodeId}] Problem: ${problem}`

const formatRepairBlock = ({ original, rewritten, issues }: FlaggedBlock) =>
  [
    `[${original.nodeId}] Original: ${original.text}`,
    `[${original.nodeId}] Rewrite: ${rewritten.text}`,
    ...issues.map(formatProblem),
  ].join("\n")

const formatRepairPrompt = (job: PartJob, part: DocumentPart, flagged: FlaggedBlock[]) =>
  [
    formatPartBrief(job, part),
    `Instruction: ${job.instruction}`,
    `Blocks to fix:\n${flagged.map(formatRepairBlock).join("\n\n")}`,
  ].join("\n\n")

const restoreBlock = ({ nodeId, text }: Section): EditOperation => ({ op: "replace_node", nodeId, text })

const findRepair = (repairs: EditOperation[], { original }: FlaggedBlock) =>
  repairs.find(({ nodeId }) => nodeId === original.nodeId) ?? restoreBlock(original)

const toCorrectionEdit = ({ nodeId, text }: MeaningCorrection): EditOperation => ({ op: "replace_node", nodeId, text })

const requestRepairs = async (job: PartJob, part: DocumentPart, flagged: FlaggedBlock[]) => {
  if (flagged.length === 0) return []
  const { output, usage } = await generateText({
    model: job.checkModel,
    providerOptions: job.providerOptions,
    instructions: REPAIR_INSTRUCTIONS,
    prompt: formatRepairPrompt(job, part, flagged),
    output: Output.object({ schema: meaningCorrectionsSchema }),
    timeout: MEANING_CHECK_TIMEOUT_MS,
    abortSignal: job.abortSignal,
  })
  job.sectionUsage.push(usage)
  const repairs = output.corrections.map(toCorrectionEdit)
  return flagged.map((block) => findRepair(repairs, block))
}

const restoreFlaggedBlocks = (flagged: FlaggedBlock[]) => () => flagged.map(({ original }) => restoreBlock(original))

const correctFlaggedBlocks = (job: PartJob, part: DocumentPart, flagged: FlaggedBlock[]) => {
  const translated = flagged.filter(({ original, rewritten }) => isTranslatedBlock(original, rewritten))
  const sameLanguage = flagged.filter((block) => !translated.includes(block))
  const translationFixes = translated.map(({ rewritten, issues }) => fixRewrittenBlock(rewritten, issues))
  return requestRepairs(job, part, sameLanguage)
    .catch(restoreFlaggedBlocks(sameLanguage))
    .then((repairs) => [...translationFixes, ...repairs])
}

const requestMeaningCorrections = async (job: PartJob, part: DocumentPart, operations: EditOperation[]) => {
  job.abortSignal?.throwIfAborted()
  const rewrittenBlocks = listRewrittenBlocks(part, operations)
  const { output, usage } = await generateText({
    model: job.checkModel,
    providerOptions: job.providerOptions,
    instructions: MEANING_CHECK_INSTRUCTIONS,
    prompt: formatMeaningCheckPrompt(job, part, rewrittenBlocks),
    output: Output.object({ schema: meaningIssuesSchema }),
    timeout: MEANING_CHECK_TIMEOUT_MS,
    abortSignal: job.abortSignal,
  })
  job.sectionUsage.push(usage)
  return correctFlaggedBlocks(job, part, listFlaggedBlocks(part, rewrittenBlocks, output.issues))
}

const keepsNumbers = (block: Section, operation: EditOperation) => {
  const rewritten = { ...block, text: editBlockText(block.text, operation) }
  return isTranslatedBlock(block, rewritten) || describeLostNumbers(block.text, rewritten.text).length === 0
}

const keepsFacts = (blocks: Section[], operation: EditOperation) => {
  const block = blocks.find(({ nodeId }) => nodeId === operation.nodeId)
  return block !== undefined && keepsNumbers(block, operation)
}

const keepSafeEdits = ({ blocks }: DocumentPart, operations: EditOperation[]) => {
  const blockTexts = new Map(blocks.map(({ nodeId, text }) => [nodeId, text]))
  return operations.filter((operation) => keepsPlaceholders(blockTexts, operation) && keepsFacts(blocks, operation))
}

const correctsEditedBlock = (outline: OutlineEntry[], operations: EditOperation[], correction: EditOperation) =>
  operations.some(({ nodeId }) => nodeId === correction.nodeId) && !isBrokenHeadingEdit(outline, correction)

const replaceCorrectedBlocks = (operations: EditOperation[], corrections: EditOperation[]) => {
  const correctedIds = new Set(corrections.map(({ nodeId }) => nodeId))
  return [...operations.filter(({ nodeId }) => !correctedIds.has(nodeId)), ...corrections]
}

const keepRewrite = (): EditOperation[] => []

const correctPartMeaning = async (job: PartJob, part: DocumentPart, outcome: PartOutcome) => {
  if (outcome.operations.length === 0) return outcome
  const { outline } = job.fullDocument
  const corrections = await requestMeaningCorrections(job, part, outcome.operations).catch(keepRewrite)
  const usable = corrections.filter((correction) => correctsEditedBlock(outline, outcome.operations, correction))
  const { operations } = checkPartEdits(outline, part, replaceCorrectedBlocks(outcome.operations, usable))
  return { ...outcome, operations: keepSafeEdits(part, operations) }
}

const transformPart = (job: PartJob, part: DocumentPart) =>
  requestPartEdits(job, part)
    .catch(() => requestPartEdits(job, part))
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
  const outcomes: PartOutcome[] = []
  const reportOutcome = (outcome: PartOutcome) => {
    outcomes.push(outcome)
    controller.enqueue(describeProgress(parts, outcomes, outcome.operations))
  }
  controller.enqueue(describeProgress(parts, outcomes, []))
  const partJob = await preparePartJob(job)
  await runInParallel(parts, (part) => transformPart(partJob, part).then(reportOutcome), job.abortSignal)
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
