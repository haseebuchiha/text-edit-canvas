import type { Section } from "@/lib/document-snapshot"
import { type CaseOutcome, findHighlight, NO_TOKENS, type Reply, readDocument } from "@/tests/evals/run-case"
import { ANSWER_QUESTION_CASES } from "@/tests/evals/scenarios/answer-question/cases"
import {
  answerMentions,
  answerShown,
  checkAnswerQuestion,
  neverSaid,
  noToolCalls,
  quotesReal,
  replyGiven,
  saysNotStated,
} from "@/tests/evals/scenarios/answer-question/checks"

const EMPTY_REPLY: Reply = { text: "", answers: [], answerAttempted: false }

const paragraph = (nodeId: string, text: string): Section => ({ nodeId, type: "paragraph", text })

const answered = (answer: string, quotes: { nodeId: string; text: string }[] = []): Reply => ({
  text: "",
  answerAttempted: true,
  answers: [{ answer, quotes }],
})

const outcomeWith = (document: string, fields: Partial<CaseOutcome>): CaseOutcome => {
  const { outline, blocks } = readDocument(document)
  return {
    outline,
    originalBlocks: blocks,
    finalBlocks: blocks,
    reply: EMPTY_REPLY,
    toolCalls: [],
    tokens: NO_TOKENS,
    totalMs: 0,
    ...fields,
  }
}

const findCase = (id: string) => {
  const testCase = ANSWER_QUESTION_CASES.find((candidate) => candidate.id === id)
  if (!testCase) throw new Error(`Case ${id} is missing.`)
  return testCase
}

describe("answerShown", () => {
  it("passes when a checked answer reached the user", () => {
    expect(answerShown(answered("EUR 5,250.")).passed).toBe(true)
  })

  it("fails when every answer was rejected", () => {
    const result = answerShown({ ...EMPTY_REPLY, answerAttempted: true })
    expect(result.passed).toBe(false)
    expect(result.evidence[0].actual).toContain("No verified answer")
  })

  it("fails a question answered in plain text instead of through the answer tool", () => {
    expect(answerShown({ ...EMPTY_REPLY, text: "The total is EUR 5,250." }).passed).toBe(false)
  })
})

describe("answerMentions", () => {
  it("passes when the checked answer names the expected fact", () => {
    const reply = answered("[PERSON_2] coordinates the dates.", [
      { nodeId: "7", text: "[PERSON_2] coordinates the dates" },
    ])
    expect(answerMentions(reply, ["[PERSON_2]"]).passed).toBe(true)
  })

  it("fails a made-up answer that names someone else", () => {
    expect(answerMentions(answered("[ORG_2] coordinates the dates."), ["[PERSON_2]"]).passed).toBe(false)
  })

  it("treats '2%' and '2 percent' as the same fact", () => {
    expect(answerMentions(answered("Yes, 2% for payment within 10 days."), ["2 percent"]).passed).toBe(true)
  })

  it("ignores plain text that skipped the answer tool", () => {
    const reply = { ...EMPTY_REPLY, text: "[PERSON_2] coordinates the dates." }
    expect(answerMentions(reply, ["[PERSON_2]"]).passed).toBe(false)
  })
})

describe("saysNotStated", () => {
  it("passes a checked answer that says the document doesn't state it", () => {
    expect(saysNotStated(answered("The document doesn’t say who signed the contract.")).passed).toBe(true)
  })

  it("passes such an answer when it quotes the related sentence it checked", () => {
    const quotes = [{ nodeId: "58", text: "a named service manager from [ORG_1] holds a short weekly call" }]
    expect(saysNotStated(answered("The document does not name the service manager.", quotes)).passed).toBe(true)
  })

  it("fails an answer that quotes an unrelated sentence as proof", () => {
    const quotes = [{ nodeId: "47", text: "Kind regards, [PERSON_3]" }]
    expect(saysNotStated(answered("[PERSON_3] signed it.", quotes)).passed).toBe(false)
  })

  it("fails a plain-text reply that skipped the answer tool", () => {
    expect(saysNotStated({ ...EMPTY_REPLY, text: "That is not stated." }).passed).toBe(false)
  })
})

describe("neverSaid", () => {
  it("fails a reply that makes the known false claim", () => {
    expect(neverSaid(answered("[PERSON_3] signed the contract."), ["[PERSON_3] signed"]).passed).toBe(false)
  })

  it("passes a reply that says the document doesn't state it", () => {
    const reply = answered("The document doesn't say who signed the contract.")
    expect(neverSaid(reply, ["[PERSON_3] signed"]).passed).toBe(true)
  })

  it("ignores a forbidden phrase that only appears in a quote copied from the document", () => {
    const reply = answered("The maintenance team has 22 colleagues.", [{ nodeId: "4", text: "around 480 employees" }])
    expect(neverSaid(reply, ["480"]).passed).toBe(true)
  })

  it("checks the plain text when the model answered without the answer tool", () => {
    expect(neverSaid({ ...EMPTY_REPLY, text: "[PERSON_3] signed it." }, ["[PERSON_3] signed"]).passed).toBe(false)
  })
})

describe("quotesReal", () => {
  const original = [paragraph("7", "[PERSON_2] coordinates the dates on the side of [ORG_1].")]

  it("passes a quote copied from the cited block, ignoring curly quotes and case", () => {
    const reply = answered("x", [{ nodeId: "7", text: "[person_2] coordinates the dates" }])
    expect(quotesReal(original, reply).passed).toBe(true)
  })

  it("fails a quote the cited block doesn't contain", () => {
    const reply = answered("x", [{ nodeId: "7", text: "[ORG_2] coordinates the dates" }])
    expect(quotesReal(original, reply).passed).toBe(false)
  })

  it("fails a real sentence cited from the wrong block", () => {
    const reply = answered("x", [{ nodeId: "8", text: "[PERSON_2] coordinates the dates" }])
    expect(quotesReal(original, reply).passed).toBe(false)
  })
})

describe("replyGiven and noToolCalls", () => {
  it("passes a plain greeting", () => {
    expect(replyGiven({ ...EMPTY_REPLY, text: "Hi!" }).passed).toBe(true)
  })

  it("fails an empty reply", () => {
    expect(replyGiven(EMPTY_REPLY).passed).toBe(false)
  })

  it("passes when no tool ran and fails when one did", () => {
    expect(noToolCalls([]).passed).toBe(true)
    expect(noToolCalls([{ name: "find_text", input: { terms: ["hi"] } }]).evidence[0].actual).toBe("find_text")
  })
})

describe("checkAnswerQuestion", () => {
  it("passes H1 when the checked answer names the workshop", () => {
    const reply = answered("It is the price of the workshop.", [{ nodeId: "36", text: "EUR 3,600" }])
    const failed = checkAnswerQuestion(findCase("H1"), outcomeWith("sample-offer", { reply }))
    expect(failed.filter(({ passed }) => !passed)).toEqual([])
  })

  it("fails small talk G1 when the model called a tool", () => {
    const outcome = outcomeWith("sample-offer", {
      reply: { ...EMPTY_REPLY, text: "Hi!" },
      toolCalls: [{ name: "find_text", input: { terms: ["hi"] } }],
    })
    const failed = checkAnswerQuestion(findCase("G1"), outcome).filter(({ passed }) => !passed)
    expect(failed.map(({ check }) => check)).toEqual(["no-tool-calls"])
  })
})

describe("every answer-question case", () => {
  it.each(ANSWER_QUESTION_CASES)("$id points at text in its document", ({ document, highlight }) => {
    const { blocks } = readDocument(document)
    expect(blocks.length).toBeGreaterThan(0)
    expect(() => highlight && findHighlight(blocks, highlight)).not.toThrow()
  })
})
