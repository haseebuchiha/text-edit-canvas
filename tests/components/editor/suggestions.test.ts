import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { Editor } from "@tiptap/react"
import { DELETED_MARK, INSERTED_MARK } from "@/components/editor/suggestion-marks"
import {
  acceptAllSuggestions,
  acceptSuggestion,
  acceptSuggestionsInBlock,
  findSuggestionAt,
  listSuggestionIds,
  rejectAllSuggestions,
  rejectSuggestion,
  suggestOperation,
} from "@/components/editor/suggestions"
import { contentStart, findTextBlock } from "@/components/editor/text-blocks"
import type { EditOperation } from "@/lib/edit-operations"
import { createTestEditor, findBlockId, readMarkedText, readText } from "@/tests/components/editor/test-editor"

const suggest = (editor: Editor, operations: EditOperation[]) => {
  editor.view.dispatch(operations.reduce(suggestOperation, editor.state.tr))
}

const readMarkNames = (node: ProseMirrorNode) => node.marks.map((mark) => mark.type.name)

describe("suggestions", () => {
  const editors: Editor[] = []
  const openEditor = () => {
    const editor = createTestEditor()
    editors.push(editor)
    return editor
  }

  afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()))

  it("marks only the changed word of a small edit", () => {
    const editor = openEditor()
    const nodeId = findBlockId(editor, "The customer wants")
    suggest(editor, [{ op: "replace_text", nodeId, find: "The customer", replace: "The client" }])
    expect(readMarkedText(editor, nodeId, DELETED_MARK)).toEqual(["customer"])
    expect(readMarkedText(editor, nodeId, INSERTED_MARK)).toEqual(["client"])
    expect(readText(editor, nodeId)).toBe("The client wants a workshop for 12 people.")
    expect(listSuggestionIds(editor.state.doc)).toHaveLength(1)
  })

  it("adds text at the end of a block and in an empty table cell", () => {
    const editor = openEditor()
    const nodeId = findBlockId(editor, "Week 1")
    const emptyCellId = findBlockId(editor, "Total")
    suggest(editor, [
      { op: "replace_node", nodeId, text: "Week 1 onwards" },
      { op: "replace_node", nodeId: String(Number(emptyCellId) + 1), text: "Weeks 1 to 5" },
    ])
    expect(readMarkedText(editor, nodeId, INSERTED_MARK)).toEqual([" onwards"])
    expect(readText(editor, String(Number(emptyCellId) + 1))).toBe("Weeks 1 to 5")
  })

  it("shows a mostly rewritten block as one whole replacement", () => {
    const editor = openEditor()
    const nodeId = findBlockId(editor, "We sat down")
    const text = "Our meeting with the customer identified a lot of further work, especially on AI."
    suggest(editor, [{ op: "replace_node", nodeId, text }])
    expect(readMarkedText(editor, nodeId, DELETED_MARK)).toEqual([
      "We sat down with the customer and noticed there is still a lot to do, especially around AI.",
    ])
    expect(readMarkedText(editor, nodeId, INSERTED_MARK)).toEqual([text])
    expect(listSuggestionIds(editor.state.doc)).toHaveLength(1)
  })

  it("accepts and rejects each suggestion on its own", () => {
    const editor = openEditor()
    const offerId = findBlockId(editor, "The customer wants")
    const participantsId = findBlockId(editor, "customer service")
    suggest(editor, [
      { op: "replace_text", nodeId: offerId, find: "customer", replace: "client" },
      { op: "replace_text", nodeId: participantsId, find: "customer service", replace: "client service" },
    ])
    const [offerSuggestion, participantsSuggestion] = listSuggestionIds(editor.state.doc)
    acceptSuggestion(editor, offerSuggestion)
    rejectSuggestion(editor, participantsSuggestion)
    expect(readText(editor, offerId)).toBe("The client wants a workshop for 12 people.")
    expect(readText(editor, participantsId)).toContain("HR, IT and customer service.")
    expect(listSuggestionIds(editor.state.doc)).toEqual([])
  })

  it("restores the exact original document, bold and links included, when everything is rejected", () => {
    const editor = openEditor()
    const original = editor.state.doc
    suggest(editor, [
      {
        op: "replace_node",
        nodeId: findBlockId(editor, "fixed price"),
        text: "Every service has a flat fee covering preparation, travel and follow-up, under the GDPR.",
      },
      { op: "replace_text", nodeId: findBlockId(editor, "EUR 3,600"), find: "3,600", replace: "4,000" },
      { op: "replace_text", nodeId: findBlockId(editor, "Kick-off call to"), find: "goals", replace: "aims" },
      { op: "replace_node", nodeId: findBlockId(editor, "Schedule and pricing"), text: "Timeline and costs" },
    ])
    expect(listSuggestionIds(editor.state.doc).length).toBeGreaterThan(3)
    rejectAllSuggestions(editor)
    expect(editor.state.doc.eq(original)).toBe(true)
  })

  it("keeps the new text and the surrounding formatting when everything is accepted", () => {
    const editor = openEditor()
    const nodeId = findBlockId(editor, "fixed price")
    suggest(editor, [{ op: "replace_text", nodeId, find: "fixed price", replace: "flat fee" }])
    acceptAllSuggestions(editor)
    const block = findTextBlock(editor.state.doc, nodeId)
    const formatted = block?.node.content.content.map((child) => [child.textContent, readMarkNames(child)])
    expect(formatted).toEqual([
      ["All services are offered at a ", []],
      ["flat fee", ["bold"]],
      [" that includes preparation, travel and follow-up. The legal background is the ", []],
      ["General Data Protection Regulation", ["link"]],
      [".", []],
    ])
  })

  it("builds a second edit of the same block on the proposed text and still rejects back to the original", () => {
    const editor = openEditor()
    const original = editor.state.doc
    const nodeId = findBlockId(editor, "The customer wants")
    suggest(editor, [{ op: "replace_text", nodeId, find: "customer", replace: "client" }])
    suggest(editor, [{ op: "replace_text", nodeId, find: "12 people", replace: "15 people" }])
    expect(readText(editor, nodeId)).toBe("The client wants a workshop for 15 people.")
    expect(readMarkedText(editor, nodeId, DELETED_MARK)).toEqual(["customer", "12"])
    rejectAllSuggestions(editor)
    expect(editor.state.doc.eq(original)).toBe(true)
  })

  it("undoes and redoes proposing, accepting and rejecting one step at a time", () => {
    const editor = openEditor()
    const original = editor.state.doc
    const nodeId = findBlockId(editor, "The customer wants")
    editor.view.dispatch(
      suggestOperation(editor.state.tr, { op: "replace_text", nodeId, find: "customer", replace: "client" }),
    )
    const proposed = editor.state.doc
    acceptAllSuggestions(editor)
    expect(readMarkedText(editor, nodeId, DELETED_MARK)).toEqual([])
    editor.commands.undo()
    expect(editor.state.doc.eq(proposed)).toBe(true)
    editor.commands.undo()
    expect(editor.state.doc.eq(original)).toBe(true)
    editor.commands.redo()
    expect(editor.state.doc.eq(proposed)).toBe(true)
    rejectAllSuggestions(editor)
    expect(editor.state.doc.eq(original)).toBe(true)
    editor.commands.undo()
    expect(editor.state.doc.eq(proposed)).toBe(true)
  })

  it("finds the suggestion under the cursor", () => {
    const editor = openEditor()
    const nodeId = findBlockId(editor, "The customer wants")
    suggest(editor, [{ op: "replace_text", nodeId, find: "customer", replace: "client" }])
    const block = findTextBlock(editor.state.doc, nodeId)
    if (!block) throw new Error("The block is missing.")
    editor.commands.setTextSelection(contentStart(block) + "The cus".length)
    expect(findSuggestionAt(editor.state)).toBe(listSuggestionIds(editor.state.doc)[0])
    editor.commands.setTextSelection(contentStart(block) + 1)
    expect(findSuggestionAt(editor.state)).toBeUndefined()
  })

  it("accepts the pending suggestions of one block only", () => {
    const editor = openEditor()
    const offerId = findBlockId(editor, "The customer wants")
    const participantsId = findBlockId(editor, "customer service")
    suggest(editor, [
      { op: "replace_text", nodeId: offerId, find: "customer", replace: "client" },
      { op: "replace_text", nodeId: participantsId, find: "customer service", replace: "client service" },
    ])
    editor.view.dispatch(acceptSuggestionsInBlock(editor.state.tr, offerId))
    expect(readMarkedText(editor, offerId, DELETED_MARK)).toEqual([])
    expect(readMarkedText(editor, participantsId, DELETED_MARK)).toEqual(["customer"])
  })
})
