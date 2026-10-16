import { generateUniqueIds } from "@tiptap/extension-unique-id"
import { Editor } from "@tiptap/react"
import { createEditorExtensions } from "@/components/editor/editor-extensions"
import { findTextBlock, listTextBlocks, readBlockId, readBlockText } from "@/components/editor/text-blocks"
import sampleDocument from "@/lib/sample-document"

export const createTestEditor = () => {
  const extensions = createEditorExtensions()
  const editor = new Editor({ element: null, extensions, content: generateUniqueIds(sampleDocument, extensions) })
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }))
  return editor
}

export const findBlockId = (editor: Editor, snippet: string) => {
  const block = listTextBlocks(editor.state.doc).find((candidate) => readBlockText(candidate).includes(snippet))
  if (!block) throw new Error(`No block contains "${snippet}".`)
  return readBlockId(block)
}

export const readText = (editor: Editor, nodeId: string) => {
  const block = findTextBlock(editor.state.doc, nodeId)
  return block ? readBlockText(block) : undefined
}

export const readMarkedText = (editor: Editor, nodeId: string, markName: string) => {
  const block = findTextBlock(editor.state.doc, nodeId)
  const pieces: string[] = []
  block?.node.forEach((child) => {
    if (child.marks.some((mark) => mark.type.name === markName)) pieces.push(child.textContent)
  })
  return pieces
}
