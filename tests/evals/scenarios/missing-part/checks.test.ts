import type { Section } from "@/lib/document-snapshot"
import { type CaseOutcome, NO_TOKENS, type Reply, readDocument } from "@/tests/evals/run-case"
import { MISSING_PART_CASES } from "@/tests/evals/scenarios/missing-part/cases"
import { checkMissingPart, replyMentions } from "@/tests/evals/scenarios/missing-part/checks"

const EMPTY_REPLY: Reply = { text: "", answers: [], answerAttempted: false }

const changeTexts = (blocks: Section[], texts: Record<string, string>) =>
  blocks.map((block) => (block.nodeId in texts ? { ...block, text: texts[block.nodeId] } : block))

const outcomeWith = (document: string, texts: Record<string, string>, reply: Reply): CaseOutcome => {
  const { outline, blocks } = readDocument(document)
  return {
    outline,
    originalBlocks: blocks,
    finalBlocks: changeTexts(blocks, texts),
    reply,
    toolCalls: [],
    tokens: NO_TOKENS,
    totalMs: 0,
  }
}

const findCase = (id: string) => {
  const testCase = MISSING_PART_CASES.find((candidate) => candidate.id === id)
  if (!testCase) throw new Error(`Case ${id} is missing.`)
  return testCase
}

describe("replyMentions", () => {
  it("passes a reply that says there is no appendix", () => {
    const reply = { ...EMPTY_REPLY, text: "This document has no Appendix. Which part should I edit?" }
    expect(replyMentions(reply, ["appendix"]).passed).toBe(true)
  })

  it("fails a reply that ignores the request", () => {
    expect(replyMentions({ ...EMPTY_REPLY, text: "Done." }, ["appendix"]).passed).toBe(false)
  })
})

describe("checkMissingPart", () => {
  const noAppendix = { ...EMPTY_REPLY, text: "There is no appendix. Which part should I edit?" }

  it("passes S9 when the reply says there is no appendix and nothing changed", () => {
    const failed = checkMissingPart(findCase("S9"), outcomeWith("sample-offer", {}, noAppendix))
    expect(failed.filter(({ passed }) => !passed)).toEqual([])
  })

  it("fails S9 when the model edited another part instead", () => {
    const outcome = outcomeWith("sample-offer", { "6": "The customer wants a short workshop." }, noAppendix)
    const failed = checkMissingPart(findCase("S9"), outcome).filter(({ passed }) => !passed)
    expect(failed.map(({ check }) => check)).toEqual(["no-unintended-changes"])
  })
})

describe("every missing-part case", () => {
  it.each(MISSING_PART_CASES)("$id has a document", ({ document }) => {
    expect(readDocument(document).blocks.length).toBeGreaterThan(0)
  })
})
