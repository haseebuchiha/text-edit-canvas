import type { OutlineEntry, Section } from "@/lib/document-snapshot"
import {
  createBlockTextsSchema,
  listBlocksBeforeFirstHeading,
  listCompletedIds,
  selectContextBlocks,
  selectSectionBlocks,
  toReplaceOperations,
} from "@/tests/evals/strategies/block-texts"

const paragraph = (nodeId: string, text: string): Section => ({ nodeId, type: "paragraph", text })

const heading = (nodeId: string, text: string): Section => ({ nodeId, type: "heading", text })

const outlineOf = (blocks: Section[], levels: Record<string, number>): OutlineEntry[] =>
  blocks
    .filter(({ type }) => type === "heading")
    .map(({ nodeId, text }) => ({ nodeId, level: levels[nodeId] ?? 2, text }))

const listIds = (blocks: Section[]) => blocks.map(({ nodeId }) => nodeId)

const DOCUMENT = [
  paragraph("1", "Draft, not for distribution"),
  paragraph("2", "Prepared for [ORG_1]"),
  heading("3", "Offer"),
  heading("4", "Background"),
  paragraph("5", "The customer wants a workshop for 12 people."),
  paragraph("6", "The workshop takes one day."),
  heading("7", "Services"),
  paragraph("8", "We run the workshop on site."),
  heading("9", "Pricing"),
  paragraph("10", "EUR 3,600 in total."),
]

const OUTLINE = outlineOf(DOCUMENT, { "3": 1 })

describe("toReplaceOperations", () => {
  it("turns each changed block into a replace_node operation", () => {
    const texts = { "5": "The client wants a workshop for 12 people.", "6": "The workshop takes one day." }
    expect(toReplaceOperations(DOCUMENT, texts)).toEqual([
      { op: "replace_node", nodeId: "5", text: "The client wants a workshop for 12 people." },
    ])
  })

  it("leaves out blocks that came back unchanged, apart from surrounding whitespace", () => {
    expect(toReplaceOperations(DOCUMENT, { "8": " We run the workshop on site.\n" })).toEqual([])
  })

  it("leaves out blocks the model didn't return and IDs that aren't blocks", () => {
    expect(toReplaceOperations(DOCUMENT, { "99": "Invented block" })).toEqual([])
  })

  it("drops a type label the model copied in front of the text", () => {
    expect(toReplaceOperations(DOCUMENT, { "4": "(heading) Project background" })).toEqual([
      { op: "replace_node", nodeId: "4", text: "Project background" },
    ])
  })

  it("keeps the document's order whatever order the texts came in", () => {
    const texts = { "10": "EUR 4,000 in total.", "2": "Prepared for [ORG_1] and [ORG_2]" }
    expect(toReplaceOperations(DOCUMENT, texts).map(({ nodeId }) => nodeId)).toEqual(["2", "10"])
  })
})

describe("listCompletedIds", () => {
  const nodeIds = ["5", "6", "8"]

  it("holds back the block that is still streaming", () => {
    expect(listCompletedIds(nodeIds, { "5": "The client wants", "6": "The work" }, false)).toEqual(["5"])
  })

  it("returns every block once the output is finished", () => {
    expect(listCompletedIds(nodeIds, { "5": "A", "6": "B", "8": "C" }, true)).toEqual(["5", "6", "8"])
  })

  it("returns nothing before the first block is complete", () => {
    expect(listCompletedIds(nodeIds, { "5": "The cli" }, false)).toEqual([])
    expect(listCompletedIds(nodeIds, {}, false)).toEqual([])
  })
})

describe("createBlockTextsSchema", () => {
  it("requires a text for every block it was given", () => {
    const schema = createBlockTextsSchema(["5", "6"])
    expect(schema.safeParse({ blocks: { "5": "A", "6": "B" }, summary: "Done." }).success).toBe(true)
    expect(schema.safeParse({ blocks: { "5": "A" }, summary: "Done." }).success).toBe(false)
  })
})

describe("selectContextBlocks", () => {
  it("adds the block before and after a run of targets", () => {
    expect(listIds(selectContextBlocks(DOCUMENT, new Set(["5", "6"])))).toEqual(["4", "7"])
  })

  it("adds neighbours around each separate run without repeating targets", () => {
    expect(listIds(selectContextBlocks(DOCUMENT, new Set(["5", "8"])))).toEqual(["4", "6", "7", "9"])
  })

  it("stops at the edges of the document", () => {
    expect(listIds(selectContextBlocks(DOCUMENT, new Set(["1", "10"])))).toEqual(["2", "9"])
  })
})

describe("selectSectionBlocks", () => {
  it("takes a section from its heading to the next heading of any level", () => {
    expect(listIds(selectSectionBlocks(DOCUMENT, OUTLINE, ["4"]))).toEqual(["4", "5", "6"])
  })

  it("takes only the title when the H1 is picked, not the sections under it", () => {
    expect(listIds(selectSectionBlocks(DOCUMENT, OUTLINE, ["3"]))).toEqual(["3"])
  })

  it("takes a block before the first heading on its own", () => {
    expect(listIds(selectSectionBlocks(DOCUMENT, OUTLINE, ["2", "9"]))).toEqual(["2", "9", "10"])
  })

  it("ignores IDs that start no section", () => {
    expect(listIds(selectSectionBlocks(DOCUMENT, OUTLINE, ["5", "unknown"]))).toEqual([])
  })

  it("treats every block of a document without headings as its own section", () => {
    const blocks = [paragraph("1", "One"), paragraph("2", "Two")]
    expect(listIds(selectSectionBlocks(blocks, [], ["2"]))).toEqual(["2"])
  })
})

describe("listBlocksBeforeFirstHeading", () => {
  it("lists the blocks above the first heading", () => {
    expect(listIds(listBlocksBeforeFirstHeading(DOCUMENT, OUTLINE))).toEqual(["1", "2"])
  })

  it("lists every block when there is no heading", () => {
    expect(listIds(listBlocksBeforeFirstHeading(DOCUMENT.slice(0, 2), []))).toEqual(["1", "2"])
  })
})
