import { TextSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import {
  findNextSuggestion,
  findPreviousSuggestion,
  readReviewPosition,
  resolveCurrentSuggestion,
  revealFirstNewSuggestion,
  revealSuggestion,
} from "@/components/editor/review-navigation"
import {
  acceptSuggestion,
  findSuggestionAt,
  listSuggestionIds,
  rejectSuggestion,
  suggestOperation,
} from "@/components/editor/suggestions"
import type { EditOperation } from "@/lib/edit-operations"
import { createTestEditor, findBlockId, readText } from "@/tests/components/editor/test-editor"

const FIRST = { id: "first", from: 5 }
const SECOND = { id: "second", from: 20 }
const THIRD = { id: "third", from: 40 }
const STARTS = [FIRST, SECOND, THIRD]

const suggest = (editor: Editor, operations: EditOperation[]) => {
  editor.view.dispatch(operations.reduce(suggestOperation, editor.state.tr))
}

const reveal = (editor: Editor, suggestionId: string) => {
  editor.view.dispatch(revealSuggestion(editor.state.tr, suggestionId))
}

const suggestThreeChanges = (editor: Editor) =>
  suggest(editor, [
    { op: "replace_text", nodeId: findBlockId(editor, "We sat down"), find: "sat down", replace: "met" },
    { op: "replace_text", nodeId: findBlockId(editor, "The customer wants"), find: "customer", replace: "client" },
    { op: "replace_text", nodeId: findBlockId(editor, "customer service"), find: "customer", replace: "client" },
  ])

describe("finding the next and previous suggestion", () => {
  it("steps from the current suggestion and wraps around at both ends", () => {
    expect(findNextSuggestion(STARTS, { position: 20, currentId: "second" })).toBe(THIRD)
    expect(findNextSuggestion(STARTS, { position: 43, currentId: "third" })).toBe(FIRST)
    expect(findPreviousSuggestion(STARTS, { position: 25, currentId: "second" })).toBe(FIRST)
    expect(findPreviousSuggestion(STARTS, { position: 7, currentId: "first" })).toBe(THIRD)
  })

  it("steps from the cursor when it is not on a suggestion", () => {
    expect(findNextSuggestion(STARTS, { position: 25 })).toBe(THIRD)
    expect(findNextSuggestion(STARTS, { position: 50 })).toBe(FIRST)
    expect(findPreviousSuggestion(STARTS, { position: 25 })).toBe(SECOND)
    expect(findPreviousSuggestion(STARTS, { position: 1 })).toBe(THIRD)
  })

  it("finds nothing when there are no suggestions", () => {
    expect(findNextSuggestion([], { position: 1 })).toBeUndefined()
    expect(findPreviousSuggestion([], { position: 1 })).toBeUndefined()
  })
})

describe("review navigation", () => {
  const editors: Editor[] = []
  const openEditor = () => {
    const editor = createTestEditor()
    editors.push(editor)
    return editor
  }

  afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()))

  it("counts the position of the current suggestion", () => {
    const editor = openEditor()
    suggestThreeChanges(editor)
    const [, secondId] = listSuggestionIds(editor.state.doc)
    reveal(editor, secondId)
    expect(findSuggestionAt(editor.state)).toBe(secondId)
    expect(readReviewPosition(editor.state)).toEqual({ current: 2, count: 3 })
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1)))
    expect(readReviewPosition(editor.state)).toEqual({ current: 0, count: 3 })
  })

  it("moves to the next suggestion after an accept or a reject, wrapping to the first", () => {
    const editor = openEditor()
    suggestThreeChanges(editor)
    const [firstId, secondId, thirdId] = listSuggestionIds(editor.state.doc)
    reveal(editor, secondId)
    resolveCurrentSuggestion(editor, acceptSuggestion)
    expect(findSuggestionAt(editor.state)).toBe(thirdId)
    resolveCurrentSuggestion(editor, rejectSuggestion)
    expect(findSuggestionAt(editor.state)).toBe(firstId)
    expect(readReviewPosition(editor.state)).toEqual({ current: 1, count: 1 })
    resolveCurrentSuggestion(editor, acceptSuggestion)
    expect(listSuggestionIds(editor.state.doc)).toEqual([])
    expect(readText(editor, findBlockId(editor, "We met"))).toContain("We met with the customer")
    expect(readText(editor, findBlockId(editor, "The client wants"))).toBe("The client wants a workshop for 12 people.")
    expect(readText(editor, findBlockId(editor, "service."))).toContain("IT and customer service.")
  })

  it("keeps one undo step per accept or reject", () => {
    const editor = openEditor()
    suggestThreeChanges(editor)
    const [firstId, secondId] = listSuggestionIds(editor.state.doc)
    reveal(editor, firstId)
    const beforeAccept = editor.state.doc
    resolveCurrentSuggestion(editor, acceptSuggestion)
    expect(findSuggestionAt(editor.state)).toBe(secondId)
    editor.commands.undo()
    expect(editor.state.doc.eq(beforeAccept)).toBe(true)
    expect(listSuggestionIds(editor.state.doc)).toHaveLength(3)
  })

  it("makes the first new suggestion of an AI edit the current one", () => {
    const editor = openEditor()
    suggest(editor, [
      { op: "replace_text", nodeId: findBlockId(editor, "We sat down"), find: "sat down", replace: "met" },
    ])
    const transaction = suggestOperation(editor.state.tr, {
      op: "replace_text",
      nodeId: findBlockId(editor, "The customer wants"),
      find: "customer",
      replace: "client",
    })
    editor.view.dispatch(revealFirstNewSuggestion(transaction))
    const [, newId] = listSuggestionIds(editor.state.doc)
    expect(findSuggestionAt(editor.state)).toBe(newId)
  })
})
