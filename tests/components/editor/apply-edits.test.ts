import { undoDepth } from "@tiptap/pm/history"
import type { Editor } from "@tiptap/react"
import type { UIMessageChunk } from "ai"
import { applyAcceptedEdits, type EditMode } from "@/components/editor/apply-edits"
import { DELETED_MARK, INSERTED_MARK } from "@/components/editor/suggestion-marks"
import { findSuggestionAt, listSuggestionIds, suggestOperation } from "@/components/editor/suggestions"
import { EDIT_DOCUMENT_TOOL, type EditOperation } from "@/lib/edit-operations"
import { TRANSFORM_DOCUMENT_TOOL, type TransformProgress } from "@/lib/transform-document"
import { createTestEditor, findBlockId, readMarkedText, readText } from "@/tests/components/editor/test-editor"

const EDIT_CALL = "edit-call"
const TRANSFORM_CALL = "transform-call"

const editChunks = (operations: EditOperation[]): UIMessageChunk[] => [
  {
    type: "tool-input-available",
    toolCallId: EDIT_CALL,
    toolName: EDIT_DOCUMENT_TOOL,
    input: { operations, summary: "Changed it." },
  },
  { type: "tool-output-available", toolCallId: EDIT_CALL, output: { accepted: true } },
]

const progress = (operations: EditOperation[], status: TransformProgress["status"] = "running"): TransformProgress => ({
  status,
  sectionCount: 2,
  finishedCount: 1,
  failedSections: [],
  editedBlockCount: operations.length,
  rejectedEditCount: 0,
  operations,
})

const transformStart: UIMessageChunk = {
  type: "tool-input-available",
  toolCallId: TRANSFORM_CALL,
  toolName: TRANSFORM_DOCUMENT_TOOL,
  input: { instruction: "Make it formal." },
}

const sectionChunk = (operations: EditOperation[]): UIMessageChunk => ({
  type: "tool-output-available",
  toolCallId: TRANSFORM_CALL,
  output: progress(operations),
  preliminary: true,
})

const transformEnd: UIMessageChunk = {
  type: "tool-output-available",
  toolCallId: TRANSFORM_CALL,
  output: progress([], "done"),
}

const waitForPendingCommits = () => new Promise((resolve) => setImmediate(resolve))

const streamOf = (chunks: UIMessageChunk[], stopAtEnd = false) => {
  const queue = [...chunks]
  return new ReadableStream<UIMessageChunk>({
    pull: (controller) => {
      const chunk = queue.shift()
      if (chunk) return controller.enqueue(chunk)
      if (stopAtEnd) return controller.error(new Error("The user stopped the reply."))
      controller.close()
    },
  })
}

type StreamOptions = { mode: EditMode; stopAtEnd?: boolean }

const runStream = async (editor: Editor, chunks: UIMessageChunk[], { mode, stopAtEnd }: StreamOptions) => {
  const edits = applyAcceptedEdits(editor, streamOf(chunks, stopAtEnd), mode)
  await edits.pipeTo(new WritableStream()).catch(() => undefined)
  await waitForPendingCommits()
}

describe("applyAcceptedEdits", () => {
  const editors: Editor[] = []
  const openEditor = () => {
    const editor = createTestEditor()
    editors.push(editor)
    return editor
  }

  afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()))

  it("applies an accepted edit directly in apply mode, as one undo step", async () => {
    const editor = openEditor()
    const original = editor.state.doc
    const nodeId = findBlockId(editor, "The customer wants")
    await runStream(editor, editChunks([{ op: "replace_text", nodeId, find: "customer", replace: "client" }]), {
      mode: "apply",
    })
    expect(readText(editor, nodeId)).toBe("The client wants a workshop for 12 people.")
    expect(listSuggestionIds(editor.state.doc)).toEqual([])
    editor.commands.undo()
    expect(editor.state.doc.eq(original)).toBe(true)
  })

  it("shows an accepted edit as suggestions in suggest mode, as one undo step", async () => {
    const editor = openEditor()
    const original = editor.state.doc
    const nodeId = findBlockId(editor, "The customer wants")
    await runStream(editor, editChunks([{ op: "replace_text", nodeId, find: "customer", replace: "client" }]), {
      mode: "suggest",
    })
    expect(readMarkedText(editor, nodeId, DELETED_MARK)).toEqual(["customer"])
    expect(readMarkedText(editor, nodeId, INSERTED_MARK)).toEqual(["client"])
    expect(findSuggestionAt(editor.state)).toBe(listSuggestionIds(editor.state.doc)[0])
    editor.commands.undo()
    expect(editor.state.doc.eq(original)).toBe(true)
  })

  it("streams a whole-document rewrite as suggestions and undoes it in one step", async () => {
    const editor = openEditor()
    const original = editor.state.doc
    const headingId = findBlockId(editor, "Schedule and pricing")
    const priceId = findBlockId(editor, "EUR 3,600")
    await runStream(
      editor,
      [
        transformStart,
        sectionChunk([{ op: "replace_node", nodeId: headingId, text: "Schedule and fees" }]),
        sectionChunk([{ op: "replace_text", nodeId: priceId, find: "3,600", replace: "3,800" }]),
        transformEnd,
      ],
      { mode: "suggest" },
    )
    expect(readMarkedText(editor, headingId, INSERTED_MARK)).toEqual(["fees"])
    expect(readMarkedText(editor, priceId, DELETED_MARK)).toEqual(["3,600"])
    expect(findSuggestionAt(editor.state)).toBe(listSuggestionIds(editor.state.doc)[0])
    expect(undoDepth(editor.state)).toBe(1)
    editor.commands.undo()
    expect(editor.state.doc.eq(original)).toBe(true)
  })

  it("keeps the suggestions that arrived before the user stopped the reply", async () => {
    const editor = openEditor()
    const original = editor.state.doc
    const headingId = findBlockId(editor, "Schedule and pricing")
    await runStream(
      editor,
      [transformStart, sectionChunk([{ op: "replace_node", nodeId: headingId, text: "Schedule and fees" }])],
      { mode: "suggest", stopAtEnd: true },
    )
    expect(readText(editor, headingId)).toBe("Schedule and fees")
    expect(listSuggestionIds(editor.state.doc)).toHaveLength(1)
    editor.commands.undo()
    expect(editor.state.doc.eq(original)).toBe(true)
  })

  it("accepts the pending suggestions of a block before applying a new edit to it directly", async () => {
    const editor = openEditor()
    const nodeId = findBlockId(editor, "The customer wants")
    editor.view.dispatch(
      suggestOperation(editor.state.tr, { op: "replace_text", nodeId, find: "customer", replace: "client" }),
    )
    await runStream(editor, editChunks([{ op: "replace_text", nodeId, find: "12 people", replace: "15 people" }]), {
      mode: "apply",
    })
    expect(readText(editor, nodeId)).toBe("The client wants a workshop for 15 people.")
    expect(listSuggestionIds(editor.state.doc)).toEqual([])
  })
})
