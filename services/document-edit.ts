import {
  getToolName,
  isToolUIPart,
  type ModelMessage,
  type StopCondition,
  type ToolContent,
  type ToolSet,
  tool,
} from "ai"
import { z } from "zod"
import type { ChatUIMessage } from "@/db/schemas/chat-message"
import {
  ANSWER_QUESTION_TOOL,
  type AnswerQuestionInput,
  type AnswerQuote,
  answerCheckSchema,
  answerQuestionInputSchema,
} from "@/lib/answer-question"
import type { DocumentSnapshot, FocusRange, OutlineEntry, Section } from "@/lib/document-snapshot"
import {
  EDIT_DOCUMENT_TOOL,
  type EditOperation,
  editCheckSchema,
  editDocumentInputSchema,
  type ReplaceTextOperation,
} from "@/lib/edit-operations"
import { containsMatchingText, findMatchingSpan } from "@/lib/text-match"
import { detectWordLanguage, findWordForm, type WordLanguage } from "@/lib/word-forms"

export const READ_SECTION_TOOL = "read_section"
export const FIND_TEXT_TOOL = "find_text"

const EDIT_DOCUMENT_DESCRIPTION =
  "Change the document in the editor. Each operation targets one block by its node ID. replace_node swaps the block's whole text, replace_text swaps the first occurrence of find inside the block."
const READ_SECTION_DESCRIPTION =
  "Read sections of the current document that are not shown: each heading and every block under it, down to the next heading of the same or higher level, with each block's node ID in square brackets."
const FIND_TEXT_DESCRIPTION =
  "Find every block of the current document that contains any of the terms, ignoring case. Each matching block comes with its node ID in square brackets, under the outline line of the heading it sits in."
const ANSWER_QUESTION_DESCRIPTION = `Answer a question about the document's content. Quote the sentences that state the answer, copied exactly from their blocks with each block's node ID, and say only what they state. The quotes are checked against the document before the user sees the answer. If the document doesn't state the answer, send no quotes, and only after a ${FIND_TEXT_TOOL} search.`
const SEARCH_FIRST_HINT = `Search with ${FIND_TEXT_TOOL} first, then answer again with quotes copied exactly from the blocks.`
const UNSEARCHED_PROBLEM = `Search with ${FIND_TEXT_TOOL} before saying the document doesn't hold the answer.`
const NO_MATCH_MESSAGE = `No block contains any of these terms. If the document doesn't state the answer, call ${ANSWER_QUESTION_TOOL} with no quotes.`
const PARAGRAPH_TYPE = "paragraph"
const MAX_FOUND_BLOCKS = 30
const LINE_BREAK = "\n"
const MAX_HEADING_GROWTH = 2
const HEADING_LENGTH_ALLOWANCE = 20
const MAX_LISTED_BLOCKS = 3
const NOT_APPLIED = "Not applied."
const RESEND_HINT = `Send all changes again in one ${EDIT_DOCUMENT_TOOL} call.`
const ONE_EDIT_PER_MATCH_HINT = "Send one edit per occurrence, or add surrounding words if only some should change."
const EDITED_MARK = "\u{E000}"
const FIGURE = /(?<![\p{L}\p{N}_.,])\d+(?:[.,]\d+)*(?![\p{L}\p{N}_])/gu
const NON_DIGIT = /\D/gu
const MIN_FIGURE_DIGITS = 2
const MAX_FIGURE_MENTIONS = 6
const QUOTE_CONTEXT = 40
const FIGURE_MENTION_PHRASE = "also appears in"
const FIGURE_HINT =
  "Change each one that states the same fact or follows from your change, such as a total or a remaining count, and leave the ones that state something else."

type SnapshotDocument = DocumentSnapshot["document"]
type MessagePart = ChatUIMessage["parts"][number]
type FoundBlock = { block: Section; heading?: OutlineEntry }
type LeftoverCheck = { blocks: Section[]; textOperations: ReplaceTextOperation[]; language: WordLanguage }

const EMPTY_DOCUMENT: SnapshotDocument = { outline: [], sections: [], blocks: [] }
const VERIFIED_ANSWER = { verified: true }
const ACCEPTED_EDIT = { accepted: true }
const DOCUMENT_READ_TOOLS = [READ_SECTION_TOOL, FIND_TEXT_TOOL]

const readSectionInputSchema = z.object({
  nodeIds: z
    .array(z.string().min(1))
    .min(1)
    .describe("The headings' node IDs: the number that starts each outline line"),
})

const findTextInputSchema = z.object({
  terms: z
    .array(z.string().min(1))
    .min(1)
    .describe("Words or short phrases to look for, with every likely variant in this one call"),
})

export const formatOutlineEntry = ({ nodeId, level, text }: OutlineEntry) => `${nodeId} H${level} ${text}`

export const formatSection = ({ nodeId, type, text }: Section) =>
  type === PARAGRAPH_TYPE ? `[${nodeId}] ${text}` : `[${nodeId}] (${type}) ${text}`

const listSectionBlocks = ({ outline, blocks }: SnapshotDocument, heading: OutlineEntry) => {
  const start = blocks.findIndex(({ nodeId }) => nodeId === heading.nodeId)
  const isHeadingAtOrAbove = ({ nodeId }: Section) =>
    outline.some((entry) => entry.nodeId === nodeId && entry.level <= heading.level)
  const end = blocks.findIndex((block, index) => index > start && isHeadingAtOrAbove(block))
  return blocks.slice(start, end < 0 ? blocks.length : end)
}

const describeUnknownHeading = (nodeId: string) => `${nodeId} is not a heading in the outline.`

const readSections = (fullDocument: SnapshotDocument, nodeIds: string[]) => {
  const headings = fullDocument.outline.filter(({ nodeId }) => nodeIds.includes(nodeId))
  const unknownIds = nodeIds.filter((nodeId) => !headings.some((heading) => heading.nodeId === nodeId))
  const sectionBlocks = headings.flatMap((heading) => listSectionBlocks(fullDocument, heading))
  const shownIds = new Set(sectionBlocks.map(({ nodeId }) => nodeId))
  const shownBlocks = fullDocument.blocks.filter(({ nodeId }) => shownIds.has(nodeId))
  return [...unknownIds.map(describeUnknownHeading), ...shownBlocks.map(formatSection)].join("\n")
}

const containsAnyTerm = (text: string, terms: string[]) => terms.some((term) => containsMatchingText(text, term))

const isOutlineEntry = (entry?: OutlineEntry) => entry !== undefined

const listFoundBlocks = ({ outline, blocks }: SnapshotDocument, terms: string[]): FoundBlock[] => {
  const blockHeadings = blocks.map((block) => outline.find((entry) => entry.nodeId === block.nodeId))
  return blocks.flatMap((block, index) =>
    containsAnyTerm(block.text, terms)
      ? [{ block, heading: blockHeadings.slice(0, index).findLast(isOutlineEntry) }]
      : [],
  )
}

const formatHeadingLine = (heading?: OutlineEntry) => (heading ? [`Under ${formatOutlineEntry(heading)}:`] : [])

const formatTableRow = (blocks: Section[], rowId: string) =>
  blocks.filter((block) => block.rowId === rowId).map(formatSection)

const findHeaderRowId = (blocks: Section[], tableId: string) => blocks.find((block) => block.tableId === tableId)?.rowId

const formatRowWithHeader = (blocks: Section[], tableId: string, rowId: string) => {
  const headerRowId = findHeaderRowId(blocks, tableId)
  const shownRowIds = headerRowId && headerRowId !== rowId ? [headerRowId, rowId] : [rowId]
  return shownRowIds.flatMap((shownRowId) => formatTableRow(blocks, shownRowId))
}

const formatFoundBlock = (blocks: Section[], block: Section) => {
  const { tableId, rowId } = block
  if (!tableId || !rowId) return [formatSection(block)]
  return formatRowWithHeader(blocks, tableId, rowId)
}

const formatFoundBlocks = (blocks: Section[], foundBlocks: FoundBlock[]) => {
  const lines = foundBlocks.flatMap(({ block, heading }, index) => [
    ...(heading === foundBlocks[index - 1]?.heading ? [] : formatHeadingLine(heading)),
    ...formatFoundBlock(blocks, block),
  ])
  return [...new Set(lines)]
}

const describeCutResults = (foundCount: number) =>
  `Only the first ${MAX_FOUND_BLOCKS} of ${foundCount} matching blocks are shown.`

const findText = (fullDocument: SnapshotDocument, terms: string[]) => {
  const foundBlocks = listFoundBlocks(fullDocument, terms)
  if (foundBlocks.length === 0) return NO_MATCH_MESSAGE
  const cutNotice = foundBlocks.length > MAX_FOUND_BLOCKS ? [describeCutResults(foundBlocks.length)] : []
  return [...cutNotice, ...formatFoundBlocks(fullDocument.blocks, foundBlocks.slice(0, MAX_FOUND_BLOCKS))].join("\n")
}

const readBlockText = (blocks: Section[], nodeId: string) => blocks.find((block) => block.nodeId === nodeId)?.text ?? ""

const isQuoteInBlock = (blocks: Section[], { nodeId, text }: AnswerQuote) => {
  const quote = text.trim()
  return quote.length > 0 && containsMatchingText(readBlockText(blocks, nodeId), quote)
}

const describeMissingQuote = ({ nodeId, text }: AnswerQuote) => `Quote "${text}" was not found in block ${nodeId}.`

const rejectAnswer = (problems: string[]) => ({ verified: false, problem: problems.join("\n") })

const checkQuotes = (blocks: Section[], quotes: AnswerQuote[]) => {
  const missingQuotes = quotes.filter((quote) => !isQuoteInBlock(blocks, quote))
  if (missingQuotes.length > 0) return rejectAnswer([...missingQuotes.map(describeMissingQuote), SEARCH_FIRST_HINT])
  return VERIFIED_ANSWER
}

const isFindTextResult = (part: ToolContent[number]) => part.type === "tool-result" && part.toolName === FIND_TEXT_TOOL

const hasToolResultThisRequest = (messages: ModelMessage[], isWanted: (part: ToolContent[number]) => boolean) =>
  messages
    .slice(messages.findLastIndex(({ role }) => role === "user"))
    .some((message) => message.role === "tool" && message.content.some(isWanted))

const hasSearchedThisRequest = (messages: ModelMessage[]) => hasToolResultThisRequest(messages, isFindTextResult)

const quotesOnlyShownBlocks = (sections: Section[], quotes: AnswerQuote[]) =>
  quotes.every(({ nodeId }) => sections.some((section) => section.nodeId === nodeId))

const checkQuotedAnswer = ({ blocks, sections }: SnapshotDocument, quotes: AnswerQuote[], messages: ModelMessage[]) => {
  const isSearchedOrShown = hasSearchedThisRequest(messages) || quotesOnlyShownBlocks(sections, quotes)
  if (!isSearchedOrShown) return rejectAnswer([SEARCH_FIRST_HINT])
  return checkQuotes(blocks, quotes)
}

const checkAnswer = (fullDocument: SnapshotDocument, { quotes }: AnswerQuestionInput, messages: ModelMessage[]) => {
  if (quotes.length > 0) return checkQuotedAnswer(fullDocument, quotes, messages)
  return hasSearchedThisRequest(messages) ? VERIFIED_ANSWER : rejectAnswer([UNSEARCHED_PROBLEM])
}

const describeBrokenHeadings = (nodeIds: string[]) =>
  `Not applied. Blocks ${nodeIds.join(", ")} are headings: keep each a short title on one line. To change the text under a heading, read its section with ${READ_SECTION_TOOL} and edit the blocks under it, then send all changes again in one ${EDIT_DOCUMENT_TOOL} call.`

const replaceFirstMatch = (text: string, { find, replace }: ReplaceTextOperation) => {
  const span = findMatchingSpan(text, find)
  if (!span) return text
  return `${text.slice(0, span.from)}${replace}${text.slice(span.to)}`
}

export const editBlockText = (text: string, operation: EditOperation) =>
  operation.op === "replace_node" ? operation.text : replaceFirstMatch(text, operation)

const addsLineBreak = (before: string, after: string) => after.includes(LINE_BREAK) && !before.includes(LINE_BREAK)

const breaksHeading = (heading: OutlineEntry, operation: EditOperation) => {
  const editedText = editBlockText(heading.text, operation)
  const lengthLimit = MAX_HEADING_GROWTH * heading.text.length + HEADING_LENGTH_ALLOWANCE
  return addsLineBreak(heading.text, editedText) || editedText.length > lengthLimit
}

export const isBrokenHeadingEdit = (outline: OutlineEntry[], operation: EditOperation) => {
  const heading = outline.find(({ nodeId }) => nodeId === operation.nodeId)
  return heading !== undefined && breaksHeading(heading, operation)
}

const hasBlock = (blocks: Section[], nodeId: string) => blocks.some((block) => block.nodeId === nodeId)

const listNearestBlocksWith = (blocks: Section[], { nodeId, find }: ReplaceTextOperation) => {
  const targetIndex = blocks.findIndex((block) => block.nodeId === nodeId)
  return blocks
    .map((block, index) => ({ block, distance: Math.abs(index - targetIndex) }))
    .filter(({ block }) => containsMatchingText(block.text, find))
    .toSorted((left, right) => left.distance - right.distance)
    .slice(0, MAX_LISTED_BLOCKS)
    .map(({ block }) => block.nodeId)
}

const describeOtherBlocks = (nodeIds: string[]) => {
  if (nodeIds.length === 0) return []
  return [`It appears in ${nodeIds.length === 1 ? "block" : "blocks"} ${nodeIds.join(", ")}.`]
}

const describeMissingText = (blocks: Section[], operation: ReplaceTextOperation) => {
  if (containsMatchingText(readBlockText(blocks, operation.nodeId), operation.find)) return []
  const otherBlocks = describeOtherBlocks(listNearestBlocksWith(blocks, operation))
  return [`"${operation.find}" is not in block ${operation.nodeId}.`, ...otherBlocks]
}

const describeUnknownBlock = (blocks: Section[], { nodeId }: EditOperation) =>
  hasBlock(blocks, nodeId) ? [] : [`Block ${nodeId} is not in the document.`]

const describeMissingTarget = (blocks: Section[], operation: EditOperation) =>
  operation.op === "replace_text" ? describeMissingText(blocks, operation) : describeUnknownBlock(blocks, operation)

const isReplaceText = (operation: EditOperation): operation is ReplaceTextOperation => operation.op === "replace_text"

const markFirstMatch = (text: string, operation: ReplaceTextOperation) =>
  replaceFirstMatch(text, { ...operation, replace: EDITED_MARK })

const countMatches = (text: string, operation: ReplaceTextOperation): number => {
  const markedText = markFirstMatch(text, operation)
  return markedText === text ? 0 : 1 + countMatches(markedText, operation)
}

const describeEditCount = (count: number) => (count === 1 ? "1 edit" : `${count} edits`)

const markBlockEdits = ({ blocks, textOperations }: LeftoverCheck, nodeId: string) =>
  textOperations
    .filter((operation) => operation.nodeId === nodeId)
    .reduce(markFirstMatch, readBlockText(blocks, nodeId))

const describeRepeatedMatch = ({ blocks, textOperations }: LeftoverCheck, operation: ReplaceTextOperation) => {
  const blockText = readBlockText(blocks, operation.nodeId)
  const isSameEdit = ({ nodeId, find }: ReplaceTextOperation) => nodeId === operation.nodeId && find === operation.find
  const sentCount = textOperations.filter(isSameEdit).length
  return [
    `"${operation.find}" appears ${countMatches(blockText, operation)} times in block ${operation.nodeId}, you sent ${describeEditCount(sentCount)}.`,
  ]
}

const describeOtherWordForm = (editedText: string, { nodeId, find }: ReplaceTextOperation, language: WordLanguage) => {
  const wordForm = findWordForm(editedText, find, language)
  if (wordForm === undefined) return []
  return [`Block ${nodeId} still has "${wordForm}", another form of "${find}".`]
}

const describeLeftover = (check: LeftoverCheck, operation: ReplaceTextOperation) => {
  const editedText = markBlockEdits(check, operation.nodeId)
  if (containsMatchingText(editedText, operation.find)) return describeRepeatedMatch(check, operation)
  return describeOtherWordForm(editedText, operation, check.language)
}

const describeLeftovers = (blocks: Section[], operations: EditOperation[]) => {
  const language = detectWordLanguage(blocks.map(({ text }) => text))
  const check = { blocks, textOperations: operations.filter(isReplaceText), language }
  const problems = new Set(check.textOperations.flatMap((operation) => describeLeftover(check, operation)))
  return problems.size > 0 ? [...problems, ONE_EDIT_PER_MATCH_HINT] : []
}

const describeTargetProblems = (problems: string[]) => [NOT_APPLIED, ...problems, RESEND_HINT].join(" ")

const listFigures = (text: string) =>
  new Set((text.match(FIGURE) ?? []).filter((figure) => figure.replaceAll(NON_DIGIT, "").length >= MIN_FIGURE_DIGITS))

const applyBlockEdits = (operations: EditOperation[], block: Section): Section => ({
  ...block,
  text: operations.filter(({ nodeId }) => nodeId === block.nodeId).reduce(editBlockText, block.text),
})

const quoteFigure = ({ nodeId, text }: Section, figure: string) => {
  const match = [...text.matchAll(FIGURE)].find(({ 0: found }) => found === figure)
  if (!match) return []
  const quote = text.slice(Math.max(0, match.index - QUOTE_CONTEXT), match.index + figure.length + QUOTE_CONTEXT)
  return [`block ${nodeId}: "…${quote}…"`]
}

const describeFigureMentions = (editedBlocks: Section[], nodeId: string, figure: string) => {
  const mentions = editedBlocks.flatMap((block) => quoteFigure(block, figure)).slice(0, MAX_FIGURE_MENTIONS)
  if (mentions.length === 0) return []
  return [`You changed ${figure} in block ${nodeId}. ${figure} ${FIGURE_MENTION_PHRASE} ${mentions.join("; ")}.`]
}

const describeFigureChange = (blocks: Section[], editedBlocks: Section[], nodeId: string) => {
  const keptFigures = listFigures(readBlockText(editedBlocks, nodeId))
  const changedFigures = [...listFigures(readBlockText(blocks, nodeId))].filter((figure) => !keptFigures.has(figure))
  return changedFigures.flatMap((figure) => describeFigureMentions(editedBlocks, nodeId, figure))
}

const describeChangedFigures = (blocks: Section[], operations: EditOperation[]) => {
  const editedBlocks = blocks.map((block) => applyBlockEdits(operations, block))
  const editedIds = [...new Set(operations.map(({ nodeId }) => nodeId))]
  return editedIds.flatMap((nodeId) => describeFigureChange(blocks, editedBlocks, nodeId))
}

const isFigureNotice = (part: ToolContent[number]) =>
  part.type === "tool-result" &&
  part.toolName === EDIT_DOCUMENT_TOOL &&
  JSON.stringify(part.output).includes(FIGURE_MENTION_PHRASE)

const checkFigures = (blocks: Section[], operations: EditOperation[], messages: ModelMessage[]) => {
  if (hasToolResultThisRequest(messages, isFigureNotice)) return ACCEPTED_EDIT
  const notices = describeChangedFigures(blocks, operations)
  if (notices.length === 0) return ACCEPTED_EDIT
  return { accepted: false, problem: [NOT_APPLIED, ...notices, FIGURE_HINT, RESEND_HINT].join(" ") }
}

const checkEdit = ({ outline, blocks }: SnapshotDocument, operations: EditOperation[], messages: ModelMessage[]) => {
  const targetProblems = [
    ...operations.flatMap((operation) => describeMissingTarget(blocks, operation)),
    ...describeLeftovers(blocks, operations),
  ]
  if (targetProblems.length > 0) return { accepted: false, problem: describeTargetProblems(targetProblems) }
  const brokenIds = operations
    .filter((operation) => isBrokenHeadingEdit(outline, operation))
    .map(({ nodeId }) => nodeId)
  if (brokenIds.length > 0) return { accepted: false, problem: describeBrokenHeadings([...new Set(brokenIds)]) }
  return checkFigures(blocks, operations, messages)
}

export const createDocumentEditTools = (fullDocument: SnapshotDocument = EMPTY_DOCUMENT) => ({
  [EDIT_DOCUMENT_TOOL]: tool({
    description: EDIT_DOCUMENT_DESCRIPTION,
    inputSchema: editDocumentInputSchema,
    execute: ({ operations }, { messages }) => checkEdit(fullDocument, operations, messages),
  }),
  [READ_SECTION_TOOL]: tool({
    description: READ_SECTION_DESCRIPTION,
    inputSchema: readSectionInputSchema,
    execute: ({ nodeIds }) => readSections(fullDocument, nodeIds),
  }),
  [FIND_TEXT_TOOL]: tool({
    description: FIND_TEXT_DESCRIPTION,
    inputSchema: findTextInputSchema,
    execute: ({ terms }) => findText(fullDocument, terms),
  }),
  [ANSWER_QUESTION_TOOL]: tool({
    description: ANSWER_QUESTION_DESCRIPTION,
    inputSchema: answerQuestionInputSchema,
    execute: (input, { messages }) => checkAnswer(fullDocument, input, messages),
  }),
})

const isVerifiedAnswer = ({ toolName, output }: { toolName: string; output: unknown }) =>
  toolName === ANSWER_QUESTION_TOOL && answerCheckSchema.safeParse(output).data?.verified === true

export const hasVerifiedAnswer: StopCondition<ToolSet> = ({ steps }) =>
  steps.at(-1)?.toolResults.some(isVerifiedAnswer) ?? false

const isAcceptedEdit = ({ toolName, output }: { toolName: string; output: unknown }) =>
  toolName === EDIT_DOCUMENT_TOOL && editCheckSchema.safeParse(output).data?.accepted === true

export const hasAcceptedEdit: StopCondition<ToolSet> = ({ steps }) =>
  steps.at(-1)?.toolResults.some(isAcceptedEdit) ?? false

const isDocumentRead = (part: MessagePart) => isToolUIPart(part) && DOCUMENT_READ_TOOLS.includes(getToolName(part))

export const dropDocumentReads = (message: ChatUIMessage): ChatUIMessage => ({
  ...message,
  parts: message.parts.filter((part) => !isDocumentRead(part)),
})

const formatFocus = (sections: Section[], { nodeId, from, to }: FocusRange) => {
  const blockText = sections.find((section) => section.nodeId === nodeId)?.text ?? ""
  return `Focus: ${nodeId}, characters ${from} to ${to}: "${blockText.slice(from, to)}"`
}

const formatList = (title: string, lines: string[]) => (lines.length > 0 ? `${title}:\n${lines.join("\n")}` : "")

const formatEditPrompt = (instruction: string, { document: { outline, sections }, focus }: DocumentSnapshot) =>
  [
    `Instruction: ${instruction}`,
    formatList("Outline", outline.map(formatOutlineEntry)),
    formatList("Sections", sections.map(formatSection)),
    focus.map((range) => formatFocus(sections, range)).join("\n"),
  ]
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n")

const readMessageText = ({ parts }: ChatUIMessage) =>
  parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")

export const attachDocumentSnapshot = (message: ChatUIMessage, snapshot?: DocumentSnapshot): ChatUIMessage => {
  if (!snapshot) return message
  const prompt = formatEditPrompt(readMessageText(message), snapshot)
  return {
    ...message,
    parts: [{ type: "text", text: prompt }, ...message.parts.filter((part) => part.type !== "text")],
  }
}
