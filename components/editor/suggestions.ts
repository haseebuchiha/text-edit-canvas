import { closeHistory } from "@tiptap/pm/history"
import { Fragment, type Mark, type Node as ProseMirrorNode, type Schema } from "@tiptap/pm/model"
import type { EditorState, Transaction } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import { DELETED_MARK, INSERTED_MARK } from "@/components/editor/suggestion-marks"
import {
  contentEnd,
  contentStart,
  findTextBlock,
  hasMarkNamed,
  readBlockText,
  readFragmentText,
  type TextBlock,
} from "@/components/editor/text-blocks"
import type { EditOperation } from "@/lib/edit-operations"
import { type ChangedPiece, type DiffPiece, diffForReview } from "@/lib/review-diff"
import { findMatchingSpan } from "@/lib/text-match"

type MarkFilter = (mark: Mark) => boolean

type Resolution = { keep: string; drop: string }

type NodeRange = { from: number; to: number }

type BuiltContent = { nodes: ProseMirrorNode[]; offset: number }

type SuggestionContext = { schema: Schema; original: Fragment }

type IdentifiedChange = ChangedPiece & { id: string }

type SuggestionQuery = { matches: MarkFilter; scope?: NodeRange }

const SUGGESTION_ID_RADIX = 36
const SUGGESTION_ID_LENGTH = 10

const ACCEPT: Resolution = { keep: INSERTED_MARK, drop: DELETED_MARK }
const REJECT: Resolution = { keep: DELETED_MARK, drop: INSERTED_MARK }

const createSuggestionId = () =>
  Math.random()
    .toString(SUGGESTION_ID_RADIX)
    .slice(2, 2 + SUGGESTION_ID_LENGTH)

const isSuggestionMark = (mark: Mark) => mark.type.name === INSERTED_MARK || mark.type.name === DELETED_MARK

const matchesAnySuggestion: MarkFilter = () => true

const matchesSuggestion =
  (suggestionId: string): MarkFilter =>
  (mark) =>
    mark.attrs.id === suggestionId

const withoutMarkNamed = (node: ProseMirrorNode, markName: string) =>
  node.mark(node.marks.filter((mark) => mark.type.name !== markName))

export const readOriginalContent = (fragment: Fragment) =>
  Fragment.fromArray(
    fragment.content
      .filter((node) => !hasMarkNamed(node, INSERTED_MARK))
      .map((node) => withoutMarkNamed(node, DELETED_MARK)),
  )

const sharedMarks = (nodes: readonly ProseMirrorNode[]): readonly Mark[] =>
  nodes.reduce<readonly Mark[]>(
    (marks, node) => marks.filter((mark) => mark.isInSet(node.marks)),
    nodes[0]?.marks ?? [],
  )

const marksAround = (original: Fragment, offset: number) => {
  const before = original.cut(Math.max(offset - 1, 0), offset).content
  const after = original.cut(offset, Math.min(offset + 1, original.size)).content
  const neighbours = [...before, ...after]
  return neighbours.length === 2 ? sharedMarks(neighbours) : []
}

const markNodes = (nodes: readonly ProseMirrorNode[], mark: Mark) =>
  nodes.map((node) => node.mark(mark.addToSet(node.marks)))

const createAddedNodes = ({ schema, original }: SuggestionContext, piece: IdentifiedChange, offset: number) => {
  if (piece.added.length === 0) return []
  const removedNodes = original.cut(offset, offset + piece.removed.length).content
  const marks = removedNodes.length > 0 ? sharedMarks(removedNodes) : marksAround(original, offset)
  return markNodes([schema.text(piece.added, marks)], schema.marks[INSERTED_MARK].create({ id: piece.id }))
}

const appendChange = (context: SuggestionContext, built: BuiltContent, piece: IdentifiedChange) => {
  const end = built.offset + piece.removed.length
  const removedNodes = context.original.cut(built.offset, end).content
  const deleted = markNodes(removedNodes, context.schema.marks[DELETED_MARK].create({ id: piece.id }))
  return { nodes: [...built.nodes, ...deleted, ...createAddedNodes(context, piece, built.offset)], offset: end }
}

const appendKept = ({ original }: SuggestionContext, built: BuiltContent, text: string) => {
  const end = built.offset + text.length
  return { nodes: [...built.nodes, ...original.cut(built.offset, end).content], offset: end }
}

const appendDiffPiece = (context: SuggestionContext) => (built: BuiltContent, piece: DiffPiece) =>
  piece.kind === "kept"
    ? appendKept(context, built, piece.text)
    : appendChange(context, built, { ...piece, id: createSuggestionId() })

const buildSuggestedContent = (schema: Schema, block: TextBlock, newText: string) => {
  const original = readOriginalContent(block.node.content)
  const pieces = diffForReview(readFragmentText(original), newText)
  const built = pieces.reduce(appendDiffPiece({ schema, original }), { nodes: [], offset: 0 })
  return Fragment.fromArray(built.nodes)
}

const replaceFirstMatch = (text: string, find: string, replace: string) => {
  const span = findMatchingSpan(text, find)
  if (!span) return text
  return `${text.slice(0, span.from)}${replace}${text.slice(span.to)}`
}

const editText = (text: string, operation: EditOperation) =>
  operation.op === "replace_node" ? operation.text : replaceFirstMatch(text, operation.find, operation.replace)

export const suggestOperation = (transaction: Transaction, operation: EditOperation) => {
  const block = findTextBlock(transaction.doc, operation.nodeId)
  if (!block) return transaction
  const proposedText = readBlockText(block)
  const newText = editText(proposedText, operation)
  if (newText === proposedText) return transaction
  const content = buildSuggestedContent(transaction.doc.type.schema, block, newText)
  return transaction.replaceWith(contentStart(block), contentEnd(block), content)
}

const wholeDocument = (documentNode: ProseMirrorNode): NodeRange => ({ from: 0, to: documentNode.content.size })

const listMarkedRanges = (documentNode: ProseMirrorNode, markName: string, { matches, scope }: SuggestionQuery) => {
  const { from, to } = scope ?? wholeDocument(documentNode)
  const ranges: NodeRange[] = []
  const isMatchingMark = (mark: Mark) => mark.type.name === markName && matches(mark)
  const collectRange = (node: ProseMirrorNode, position: number) => {
    if (node.isInline && node.marks.some(isMatchingMark)) ranges.push({ from: position, to: position + node.nodeSize })
  }
  documentNode.nodesBetween(from, to, collectRange)
  return ranges
}

const resolveSuggestions = (transaction: Transaction, { keep, drop }: Resolution, query: SuggestionQuery) => {
  const kept = listMarkedRanges(transaction.doc, keep, query)
  const dropped = listMarkedRanges(transaction.doc, drop, query)
  const keepType = transaction.doc.type.schema.marks[keep]
  const unmarked = kept.reduce((current, { from, to }) => current.removeMark(from, to, keepType), transaction)
  return dropped.toReversed().reduce((current, { from, to }) => current.delete(from, to), unmarked)
}

export const acceptSuggestionsInBlock = (transaction: Transaction, nodeId: string) => {
  const block = findTextBlock(transaction.doc, nodeId)
  if (!block) return transaction
  const scope = { from: contentStart(block), to: contentEnd(block) }
  return resolveSuggestions(transaction, ACCEPT, { matches: matchesAnySuggestion, scope })
}

const dispatchResolution = (editor: Editor, resolution: Resolution, matches: MarkFilter) => {
  const transaction = resolveSuggestions(editor.state.tr, resolution, { matches })
  if (transaction.docChanged) editor.view.dispatch(closeHistory(transaction))
}

export const acceptSuggestion = (editor: Editor, suggestionId: string) =>
  dispatchResolution(editor, ACCEPT, matchesSuggestion(suggestionId))

export const rejectSuggestion = (editor: Editor, suggestionId: string) =>
  dispatchResolution(editor, REJECT, matchesSuggestion(suggestionId))

export const acceptAllSuggestions = (editor: Editor) => dispatchResolution(editor, ACCEPT, matchesAnySuggestion)

export const rejectAllSuggestions = (editor: Editor) => dispatchResolution(editor, REJECT, matchesAnySuggestion)

const readSuggestionId = (node?: ProseMirrorNode | null): string | undefined =>
  node?.marks.find(isSuggestionMark)?.attrs.id

export const findSuggestionAt = ({ selection }: EditorState) =>
  readSuggestionId(selection.$from.nodeAfter) ?? readSuggestionId(selection.$from.nodeBefore)

export const findSuggestionRange = (documentNode: ProseMirrorNode, suggestionId: string): NodeRange | undefined => {
  const query = { matches: matchesSuggestion(suggestionId) }
  const ranges = [INSERTED_MARK, DELETED_MARK].flatMap((markName) => listMarkedRanges(documentNode, markName, query))
  if (ranges.length === 0) return undefined
  return { from: Math.min(...ranges.map((range) => range.from)), to: Math.max(...ranges.map((range) => range.to)) }
}

export const listSuggestionIds = (documentNode: ProseMirrorNode) => {
  const suggestionIds = new Set<string>()
  const collectSuggestionId = (node: ProseMirrorNode) => {
    const suggestionId = readSuggestionId(node)
    if (suggestionId) suggestionIds.add(suggestionId)
  }
  documentNode.descendants(collectSuggestionId)
  return [...suggestionIds]
}
