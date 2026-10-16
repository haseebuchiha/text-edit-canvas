import type { DocumentSnapshot } from "@/lib/document-snapshot"
import { EDIT_DOCUMENT_TOOL, type EditOperation } from "@/lib/edit-operations"
import { createDocumentEditTools, editBlockText, FIND_TEXT_TOOL } from "@/services/document-edit"

const TOOL_OPTIONS = { toolCallId: "test-call", messages: [], context: {} }

const classificationDocument: DocumentSnapshot["document"] = {
  outline: [{ nodeId: "1", level: 2, text: "Classification" }],
  sections: [],
  blocks: [
    { nodeId: "1", type: "heading", text: "Classification" },
    { nodeId: "2", type: "paragraph", text: "Our customers share their kick-off call notes with us." },
    { nodeId: "3", type: "table header r1c1", text: "Class", tableId: "table-1", rowId: "row-1" },
    { nodeId: "4", type: "table header r1c2", text: "Description", tableId: "table-1", rowId: "row-1" },
    { nodeId: "5", type: "table cell r2c1", text: "Public", tableId: "table-1", rowId: "row-2" },
    { nodeId: "6", type: "table cell r2c2", text: "Free to share", tableId: "table-1", rowId: "row-2" },
    { nodeId: "7", type: "table cell r3c1", text: "Confidential", tableId: "table-1", rowId: "row-3" },
    {
      nodeId: "8",
      type: "table cell r3c2",
      text: "Could harm us or our customers",
      tableId: "table-1",
      rowId: "row-3",
    },
  ],
}

const customerParagraphs: DocumentSnapshot["document"] = {
  outline: [],
  sections: [],
  blocks: [
    { nodeId: "1", type: "paragraph", text: "We thank our customers." },
    { nodeId: "2", type: "paragraph", text: "We thank our customers." },
    { nodeId: "3", type: "paragraph", text: "Nothing to change here." },
    { nodeId: "4", type: "paragraph", text: "We thank our customers." },
    { nodeId: "5", type: "paragraph", text: "We thank our customers." },
    { nodeId: "6", type: "paragraph", text: "We thank our customers." },
  ],
}

const REPEATED_WORD_TEXT = "Incidents that affect customer information are reported to the customer without delay."

const repeatedWordDocument: DocumentSnapshot["document"] = {
  outline: [],
  sections: [],
  blocks: [{ nodeId: "3", type: "paragraph", text: REPEATED_WORD_TEXT }],
}

const replaceInBlock = (find: string, replace: string): EditOperation => ({
  op: "replace_text",
  nodeId: "3",
  find,
  replace,
})

const findText = (fullDocument: DocumentSnapshot["document"], terms: string[]) =>
  createDocumentEditTools(fullDocument)[FIND_TEXT_TOOL].execute?.({ terms }, TOOL_OPTIONS)

const editDocument = (fullDocument: DocumentSnapshot["document"], operations: EditOperation[]) =>
  createDocumentEditTools(fullDocument)[EDIT_DOCUMENT_TOOL].execute?.({ operations, summary: "Test." }, TOOL_OPTIONS)

describe("document edit tools", () => {
  it("lists a table hit's header row and own row with every cell on its own line", async () => {
    const found = await findText(classificationDocument, ["customers"])

    expect(found).toBe(
      [
        "Under 1 H2 Classification:",
        "[2] Our customers share their kick-off call notes with us.",
        "[3] (table header r1c1) Class",
        "[4] (table header r1c2) Description",
        "[7] (table cell r3c1) Confidential",
        "[8] (table cell r3c2) Could harm us or our customers",
      ].join("\n"),
    )
  })

  it("rejects a replace_text whose text is not in its block and names the nearest blocks that hold it", async () => {
    const operations: EditOperation[] = [
      { op: "replace_text", nodeId: "2", find: "customers", replace: "clients" },
      { op: "replace_text", nodeId: "7", find: "customers", replace: "clients" },
    ]

    const checked = await editDocument(classificationDocument, operations)

    expect(checked).toEqual({
      accepted: false,
      problem:
        'Not applied. "customers" is not in block 7. It appears in blocks 8, 2. Send all changes again in one edit_document call.',
    })
  })

  it("names at most three blocks that hold the missing text", async () => {
    const operation: EditOperation = { op: "replace_text", nodeId: "3", find: "customers", replace: "clients" }

    const checked = await editDocument(customerParagraphs, [operation])

    expect(checked).toEqual({
      accepted: false,
      problem:
        'Not applied. "customers" is not in block 3. It appears in blocks 2, 4, 1. Send all changes again in one edit_document call.',
    })
  })

  it("rejects an edit to a block that is not in the document", async () => {
    const checked = await editDocument(classificationDocument, [{ op: "replace_node", nodeId: "99", text: "New text" }])

    expect(checked).toEqual({
      accepted: false,
      problem: "Not applied. Block 99 is not in the document. Send all changes again in one edit_document call.",
    })
  })

  it("accepts a heading edit up to twice the heading's length plus 20 characters", async () => {
    const checked = await editDocument(classificationDocument, [
      { op: "replace_node", nodeId: "1", text: "Einstufung von Informationen und Daten" },
    ])

    expect(checked).toEqual({ accepted: true })
  })

  it("rejects a heading edit that turns the heading into a sentence", async () => {
    const checked = await editDocument(classificationDocument, [
      {
        op: "replace_node",
        nodeId: "1",
        text: "How we classify every piece of information, from public to confidential",
      },
    ])

    expect(checked).toMatchObject({ accepted: false })
  })

  it("accepts a replace_text that the forgiving matcher finds in its block", async () => {
    const operations: EditOperation[] = [
      { op: "replace_text", nodeId: "2", find: "Kick off call", replace: "first meeting" },
      { op: "replace_node", nodeId: "8", text: "Could harm us or our clients" },
    ]

    const checked = await editDocument(classificationDocument, operations)

    expect(checked).toEqual({ accepted: true })
  })

  it("rejects one replace_text for a find text that appears twice in its block", async () => {
    const checked = await editDocument(repeatedWordDocument, [replaceInBlock("customer", "client")])

    expect(checked).toEqual({
      accepted: false,
      problem:
        'Not applied. "customer" appears 2 times in block 3, you sent 1 edit. Send one edit per occurrence, or add surrounding words if only some should change. Send all changes again in one edit_document call.',
    })
  })

  it("accepts one replace_text per occurrence, and applied in order they change both", async () => {
    const operations = [replaceInBlock("customer", "client"), replaceInBlock("customer", "client")]

    const checked = await editDocument(repeatedWordDocument, operations)

    expect(checked).toEqual({ accepted: true })
    expect(operations.reduce(editBlockText, REPEATED_WORD_TEXT)).toBe(
      "Incidents that affect client information are reported to the client without delay.",
    )
  })

  it("accepts a replace_text whose find text appears once in its block", async () => {
    const checked = await editDocument(repeatedWordDocument, [replaceInBlock("information", "data")])

    expect(checked).toEqual({ accepted: true })
  })

  it("accepts a replace_text whose surrounding words make the find text appear once", async () => {
    const checked = await editDocument(repeatedWordDocument, [replaceInBlock("to the customer", "to the client")])

    expect(checked).toEqual({ accepted: true })
  })

  it("accepts replace_text operations whose different find texts together cover every occurrence", async () => {
    const operations = [
      replaceInBlock("customer information", "client information"),
      replaceInBlock("customer", "client"),
    ]

    const checked = await editDocument(repeatedWordDocument, operations)

    expect(checked).toEqual({ accepted: true })
  })
})
