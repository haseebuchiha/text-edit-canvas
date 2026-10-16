import { closeHistory } from "@tiptap/pm/history"
import type { Fragment, Mark, Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { Transaction } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import type { UIMessageChunk } from "ai"
import { flashChanges } from "@/components/editor/change-flash"
import { acceptSuggestionsInBlock, suggestOperation } from "@/components/editor/suggestions"
import {
  contentEnd,
  contentStart,
  findTextBlock,
  listTextBlocks,
  readBlockId,
  readBlockText,
  type TextBlock,
} from "@/components/editor/text-blocks"
import {
  EDIT_DOCUMENT_TOOL,
  type EditOperation,
  editCheckSchema,
  editDocumentInputSchema,
  type ReplaceNodeOperation,
  type ReplaceTextOperation,
} from "@/lib/edit-operations"
import { findMatchingSpan } from "@/lib/text-match"
import { TRANSFORM_DOCUMENT_TOOL, transformProgressSchema } from "@/lib/transform-document"

export type EditMode = "apply" | "suggest"

type EditToolCall = { toolCallId: string; toolName: string; input: unknown }

type ToolOutput = { toolCallId: string; output: unknown; preliminary?: boolean }

type PendingEdits = Map<string, EditOperation[]>

type OriginalContents = Map<string, Fragment>

type EditStreamState = { mode: EditMode; pendingEdits: PendingEdits; openTransforms: Map<string, OriginalContents> }

type TransformRun = { mode: EditMode; originals: OriginalContents }

type OperationEditor = (transaction: Transaction, operation: EditOperation) => Transaction

type BlockChange = { nodeId: string; original: Fragment; edited: Fragment }

type TextRange = { from: number; to: number; marks: readonly Mark[] }

const ADD_TO_HISTORY = "addToHistory"

const writeText = (transaction: Transaction, { from, to, marks }: TextRange, text: string) => {
  if (text.length === 0) return transaction.delete(from, to)
  return transaction.replaceWith(from, to, transaction.doc.type.schema.text(text, marks))
}

const replaceNode = (transaction: Transaction, { nodeId, text }: ReplaceNodeOperation) => {
  const block = findTextBlock(transaction.doc, nodeId)
  if (!block || readBlockText(block) === text) return transaction
  return writeText(transaction, { from: contentStart(block), to: contentEnd(block), marks: [] }, text)
}

const locateText = (transaction: Transaction, block: TextBlock, find: string): TextRange | undefined => {
  const span = findMatchingSpan(readBlockText(block), find)
  if (!span) return undefined
  const start = transaction.doc.resolve(contentStart(block) + span.from)
  const end = transaction.doc.resolve(contentStart(block) + span.to)
  return { from: start.pos, to: end.pos, marks: start.marksAcross(end) ?? [] }
}

const replaceText = (transaction: Transaction, { nodeId, find, replace }: ReplaceTextOperation) => {
  const block = findTextBlock(transaction.doc, nodeId)
  const range = block && locateText(transaction, block, find)
  if (!range) return transaction
  return writeText(transaction, range, replace)
}

const applyOperationDirectly = (transaction: Transaction, operation: EditOperation) =>
  operation.op === "replace_node" ? replaceNode(transaction, operation) : replaceText(transaction, operation)

const applyOperation = (transaction: Transaction, operation: EditOperation) =>
  applyOperationDirectly(acceptSuggestionsInBlock(transaction, operation.nodeId), operation)

const operationEditors: Record<EditMode, OperationEditor> = { apply: applyOperation, suggest: suggestOperation }

const markAiEdit = (transaction: Transaction, mode: EditMode) =>
  mode === "apply" ? flashChanges(transaction) : transaction

const readEditOperations = ({ toolName, input }: EditToolCall) =>
  toolName === EDIT_DOCUMENT_TOOL ? editDocumentInputSchema.safeParse(input).data?.operations : undefined

const applyEditOperations = (editor: Editor, operations: EditOperation[], mode: EditMode) => {
  const transaction = operations.reduce(operationEditors[mode], editor.state.tr)
  if (transaction.docChanged) editor.view.dispatch(markAiEdit(closeHistory(transaction), mode))
}

const isAcceptedEdit = (output: unknown) => editCheckSchema.safeParse(output).data?.accepted === true

const rememberToolCall = ({ pendingEdits, openTransforms }: EditStreamState, toolCall: EditToolCall) => {
  if (toolCall.toolName === TRANSFORM_DOCUMENT_TOOL) openTransforms.set(toolCall.toolCallId, new Map())
  const operations = readEditOperations(toolCall)
  if (operations) pendingEdits.set(toolCall.toolCallId, operations)
}

const applyAcceptedEdit = (
  editor: Editor,
  { mode, pendingEdits }: EditStreamState,
  { toolCallId, output }: ToolOutput,
) => {
  const operations = pendingEdits.get(toolCallId)
  if (operations && isAcceptedEdit(output)) applyEditOperations(editor, operations, mode)
}

const rememberOriginalContent = (editor: Editor, originals: OriginalContents, { nodeId }: EditOperation) => {
  const block = originals.has(nodeId) ? undefined : findTextBlock(editor.state.doc, nodeId)
  if (block) originals.set(nodeId, block.node.content)
}

const readTransformOperations = (output: unknown) => transformProgressSchema.safeParse(output).data?.operations ?? []

const applyTransformProgress = (editor: Editor, { mode, originals }: TransformRun, output: unknown) => {
  const operations = readTransformOperations(output)
  operations.forEach((operation) => rememberOriginalContent(editor, originals, operation))
  const transaction = operations.reduce(operationEditors[mode], editor.state.tr).setMeta(ADD_TO_HISTORY, false)
  if (transaction.docChanged) editor.view.dispatch(markAiEdit(transaction, mode))
}

const indexTextBlocks = (documentNode: ProseMirrorNode) =>
  new Map(listTextBlocks(documentNode).map((block) => [readBlockId(block), block]))

const readIndexedContent = (blocks: Map<string, TextBlock>, nodeId: string) => blocks.get(nodeId)?.node.content

const readBlockChange = (blocks: Map<string, TextBlock>, [nodeId, original]: [string, Fragment]): BlockChange[] => {
  const edited = readIndexedContent(blocks, nodeId)
  return edited && !edited.eq(original) ? [{ nodeId, original, edited }] : []
}

const replaceIndexedBlock = (transaction: Transaction, block: TextBlock | undefined, content: Fragment) => {
  if (!block) return transaction
  const { mapping } = transaction
  return transaction.replaceWith(mapping.map(contentStart(block)), mapping.map(contentEnd(block)), content)
}

const replaceBlockContents = (transaction: Transaction, contents: [string, Fragment][]) => {
  const blocks = indexTextBlocks(transaction.doc)
  return contents.reduce(
    (current, [nodeId, content]) => replaceIndexedBlock(current, blocks.get(nodeId), content),
    transaction,
  )
}

const commitTransform = (editor: Editor, { mode, originals }: TransformRun) => {
  const blocks = indexTextBlocks(editor.state.doc)
  const changes = [...originals].flatMap((entry) => readBlockChange(blocks, entry))
  originals.clear()
  if (changes.length === 0) return
  const restore = replaceBlockContents(
    editor.state.tr,
    changes.map(({ nodeId, original }) => [nodeId, original]),
  )
  editor.view.dispatch(restore.setMeta(ADD_TO_HISTORY, false))
  const edit = replaceBlockContents(
    closeHistory(editor.state.tr),
    changes.map(({ nodeId, edited }) => [nodeId, edited]),
  )
  editor.view.dispatch(markAiEdit(edit, mode))
}

const applyToolOutput = (editor: Editor, state: EditStreamState, toolOutput: ToolOutput) => {
  const originals = state.openTransforms.get(toolOutput.toolCallId)
  if (!originals) return applyAcceptedEdit(editor, state, toolOutput)
  if (toolOutput.preliminary) return applyTransformProgress(editor, { mode: state.mode, originals }, toolOutput.output)
  commitTransform(editor, { mode: state.mode, originals })
}

const followEditChunk = (editor: Editor, state: EditStreamState, chunk: UIMessageChunk) => {
  if (chunk.type === "tool-input-available") rememberToolCall(state, chunk)
  if (chunk.type === "tool-output-available") applyToolOutput(editor, state, chunk)
}

const commitOpenTransforms = (editor: Editor, { mode, openTransforms }: EditStreamState) =>
  openTransforms.forEach((originals) => commitTransform(editor, { mode, originals }))

export const applyAcceptedEdits = (
  editor: Editor | null,
  chunks: ReadableStream<UIMessageChunk>,
  mode: EditMode = "apply",
) => {
  if (!editor) return chunks
  const state: EditStreamState = { mode, pendingEdits: new Map(), openTransforms: new Map() }
  const edits = new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform: (chunk, controller) => {
      followEditChunk(editor, state, chunk)
      controller.enqueue(chunk)
    },
  })
  const finishTransforms = () => commitOpenTransforms(editor, state)
  chunks.pipeTo(edits.writable).then(finishTransforms, finishTransforms)
  return edits.readable
}
