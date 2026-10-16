import type { Section } from "@/lib/document-snapshot"
import { type CaseOutcome, NO_TOKENS, readDocument } from "@/tests/evals/run-case"
import { REWRITE_SECTION_CASES } from "@/tests/evals/scenarios/rewrite-section/cases"
import { checkSectionRewrite, findSection } from "@/tests/evals/scenarios/rewrite-section/checks"

const changeTexts = (blocks: Section[], texts: Record<string, string>) =>
  blocks.map((block) => (block.nodeId in texts ? { ...block, text: texts[block.nodeId] } : block))

const outcomeWith = (document: string, texts: Record<string, string>): CaseOutcome => {
  const { outline, blocks } = readDocument(document)
  return {
    outline,
    originalBlocks: blocks,
    finalBlocks: changeTexts(blocks, texts),
    reply: { text: "", answers: [], answerAttempted: false },
    toolCalls: [],
    tokens: NO_TOKENS,
    totalMs: 0,
  }
}

const findCase = (id: string) => {
  const testCase = REWRITE_SECTION_CASES.find((candidate) => candidate.id === id)
  if (!testCase) throw new Error(`Case ${id} is missing.`)
  return testCase
}

const listFailedChecks = (id: string, texts: Record<string, string>) =>
  checkSectionRewrite(findCase(id), outcomeWith("sample-offer", texts))
    .filter(({ passed }) => !passed)
    .map(({ check }) => check)

describe("findSection", () => {
  const { outline, blocks } = readDocument("sample-offer")

  it("gives the heading and every block under it, up to the next heading of its level", () => {
    const section = findSection(outline, blocks, "Schedule and pricing")
    expect(section.at(0)?.nodeId).toBe("22")
    expect(section.at(-1)?.nodeId).toBe("44")
  })

  it("rejects a heading the document doesn't have", () => {
    expect(() => findSection(outline, blocks, "Appendix")).toThrow("matches no heading")
  })
})

describe("checkSectionRewrite", () => {
  it("passes S1 when a block inside the section changed", () => {
    expect(listFailedChecks("S1", { "23": "Here is our friendly schedule. All prices are net." })).toEqual([])
  })

  it("fails S1 when a block outside the section changed", () => {
    expect(listFailedChecks("S1", { "23": "Our schedule. All prices are net.", "4": "We met the customer." })).toEqual([
      "no-unintended-changes",
    ])
  })

  it("fails S1 when nothing changed", () => {
    expect(listFailedChecks("S1", {})).toEqual(["something-changed"])
  })

  it("fails S1 when the pricing table is emptied", () => {
    expect(listFailedChecks("S1", { "23": "Our schedule.", "32": "", "44": "" })).toEqual([
      "figures-kept",
      "table-cells-kept",
    ])
  })
})

describe("every rewrite-section case", () => {
  it.each(REWRITE_SECTION_CASES)("$id names a section and phrases its document has", (testCase) => {
    const { outline, blocks } = readDocument(testCase.document)
    const sectionText = findSection(outline, blocks, testCase.sectionHeading)
      .map(({ text }) => text.toLowerCase())
      .join("\n")
    expect((testCase.keepPhrases ?? []).filter((phrase) => !sectionText.includes(phrase.toLowerCase()))).toEqual([])
  })
})
