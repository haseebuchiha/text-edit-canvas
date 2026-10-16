import type { Section } from "@/lib/document-snapshot"
import { findBlock } from "@/tests/evals/checks"
import { type CaseOutcome, findHighlight, NO_TOKENS, readDocument } from "@/tests/evals/run-case"
import { CHANGE_TEXT_CASES } from "@/tests/evals/scenarios/change-text/cases"
import {
  checkChangeText,
  expectedChanges,
  findChangeTargets,
  highlightOnly,
  wordGone,
} from "@/tests/evals/scenarios/change-text/checks"

const paragraph = (nodeId: string, text: string): Section => ({ nodeId, type: "paragraph", text })

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
  const testCase = CHANGE_TEXT_CASES.find((candidate) => candidate.id === id)
  if (!testCase) throw new Error(`Case ${id} is missing.`)
  return testCase
}

describe("expectedChanges", () => {
  const original = [
    paragraph("1", "The customer wants a workshop for 12 people."),
    paragraph("2", "Prepared for [ORG_1]."),
  ]
  const targets = [
    { nodeId: "1", blockContaining: "workshop", becomesOneOf: ["The customer wants a workshop for 15 people."] },
  ]

  it("passes when the block has the expected text", () => {
    const final = changeTexts(original, { "1": "The customer wants a workshop for 15 people." })
    expect(expectedChanges(final, targets).passed).toBe(true)
  })

  it("ignores extra whitespace", () => {
    const final = changeTexts(original, { "1": "The customer  wants a workshop for 15 people. " })
    expect(expectedChanges(final, targets).passed).toBe(true)
  })

  it("fails and shows expected and actual text when the block differs", () => {
    const final = changeTexts(original, { "1": "The customer wants a workshop for 15 participants." })
    const result = expectedChanges(final, targets)
    expect(result.passed).toBe(false)
    expect(result.evidence).toEqual([
      {
        where: "block 1 (paragraph)",
        expected: ["The customer wants a workshop for 15 people."],
        actual: "The customer wants a workshop for 15 participants.",
      },
    ])
  })

  it("fails when the block wasn't changed at all", () => {
    expect(expectedChanges(original, targets).passed).toBe(false)
  })

  it("accepts any listed alternative, the original text too when it is listed", () => {
    const alternatives = [{ nodeId: "1", blockContaining: "workshop", becomesOneOf: ["A.", original[0].text] }]
    expect(expectedChanges(original, alternatives).passed).toBe(true)
  })

  it("checks phrases when the case lists what the new text includes", () => {
    const includes = [
      { nodeId: "2", blockContaining: "Prepared", newTextIncludes: ["Prepared for [ORG_1]", "30 days"] },
    ]
    const kept = changeTexts(original, { "2": "Prepared for [ORG_1]. Valid for 30 days." })
    const lost = changeTexts(original, { "2": "Valid for 30 days." })
    expect(expectedChanges(kept, includes).passed).toBe(true)
    expect(expectedChanges(lost, includes).passed).toBe(false)
  })
})

describe("wordGone", () => {
  const original = [
    paragraph("3", "Our customer contracts protect what our customers entrust to us."),
    paragraph("6", "The customer wants a workshop."),
  ]

  it("passes when the word is gone from every block", () => {
    const final = changeTexts(original, {
      "3": "Our client contracts protect what our clients entrust to us.",
      "6": "The client wants a workshop.",
    })
    expect(wordGone(final, ["customer"]).passed).toBe(true)
  })

  it("fails when a word that appears twice in one block was changed only once", () => {
    const final = changeTexts(original, {
      "3": "Our client contracts protect what our customers entrust to us.",
      "6": "The client wants a workshop.",
    })
    const result = wordGone(final, ["customer"])
    expect(result.passed).toBe(false)
    expect(result.evidence.map(({ where }) => where)).toEqual(["block 3 (paragraph)"])
  })

  it("ignores capitalisation", () => {
    expect(wordGone(changeTexts(original, { "3": "Customer", "6": "client" }), ["customer"]).passed).toBe(false)
  })
})

describe("highlightOnly", () => {
  const original = [paragraph("6", "The customer wants a workshop for 12 people.")]
  const highlight = { blockContaining: "The customer wants", text: "12 people" }

  it("passes when only the highlighted text changed", () => {
    const final = changeTexts(original, { "6": "The customer wants a workshop for 15 people." })
    expect(highlightOnly(original, final, highlight).passed).toBe(true)
  })

  it("fails when text outside the highlight changed too", () => {
    const final = changeTexts(original, { "6": "The client wants a workshop for 15 people." })
    expect(highlightOnly(original, final, highlight).passed).toBe(false)
  })

  it("passes when the case has no highlight", () => {
    expect(highlightOnly(original, changeTexts(original, { "6": "Anything." })).passed).toBe(true)
  })
})

describe("checkChangeText", () => {
  it("passes S4 when only the workshop paragraph has its new text", () => {
    const outcome = outcomeWith("sample-offer", { "6": "The customer wants a workshop for 15 people." })
    expect(checkChangeText(findCase("S4"), outcome).filter(({ passed }) => !passed)).toEqual([])
  })

  it("fails S4 when another paragraph changed too", () => {
    const outcome = outcomeWith("sample-offer", {
      "6": "The customer wants a workshop for 15 people.",
      "4": "We met the customer.",
    })
    const failed = checkChangeText(findCase("S4"), outcome).filter(({ passed }) => !passed)
    expect(failed.map(({ check }) => check)).toEqual(["no-unintended-changes"])
  })
})

describe("every change-text case", () => {
  it.each(CHANGE_TEXT_CASES)(
    "$id points at text in its document",
    ({ document, changes, highlight, goneEverywhere }) => {
      const { blocks } = readDocument(document)
      const documentText = blocks.map(({ text }) => text.toLowerCase()).join("\n")
      const onlyOriginal = findChangeTargets(blocks, changes).filter(
        (target) =>
          "becomesOneOf" in target &&
          target.becomesOneOf.every((text) => text === findBlock(blocks, target.nodeId).text),
      )
      expect(onlyOriginal).toEqual([])
      expect(() => highlight && findHighlight(blocks, highlight)).not.toThrow()
      expect((goneEverywhere ?? []).filter((word) => !documentText.includes(word.toLowerCase()))).toEqual([])
    },
  )
})
