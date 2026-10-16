import type { Section } from "@/lib/document-snapshot"
import { containsLoosely, describeBlock, findBlock, noUnintendedChanges, toCheckResult } from "@/tests/evals/checks"
import { type CaseOutcome, describeShownReply, type Reply, type ToolCall } from "@/tests/evals/run-case"
import type { AnswerQuestionCase } from "@/tests/evals/scenarios/answer-question/cases"

type Quote = { nodeId: string; text: string }

const NEGATION = /\b(not|no|none|neither|nor|without)\b|n['’]t\b/iu
const NOT_STATED_EXPECTED = ["a checked answer saying that the document doesn't state this"]
const NO_REPLY = { where: "the reply", expected: ["a short text reply"], actual: "" }

export const answerShown = (reply: Reply) => {
  const evidence =
    reply.answers.length > 0
      ? []
      : [{ where: "the reply", expected: ["an answer checked by answer_question"], actual: describeShownReply(reply) }]
  return toCheckResult(
    "answer-shown",
    evidence,
    "The user saw no checked answer: the model skipped answer_question or every answer was rejected.",
  )
}

export const answerMentions = (reply: Reply, facts: string[]) => {
  const shownAnswer = reply.answers.length > 0 ? describeShownReply(reply) : ""
  const evidence = facts
    .filter((fact) => !containsLoosely(shownAnswer, fact))
    .map((fact) => ({ where: "the answer", expected: [`names "${fact}"`], actual: describeShownReply(reply) }))
  return toCheckResult(
    "answer-mentions",
    evidence,
    `Expected facts the checked answer doesn't name: ${evidence.length}.`,
  )
}

export const saysNotStated = (reply: Reply) => {
  const hasNotStatedAnswer = reply.answers.some(({ answer }) => NEGATION.test(answer))
  const evidence = hasNotStatedAnswer
    ? []
    : [{ where: "the reply", expected: NOT_STATED_EXPECTED, actual: describeShownReply(reply) }]
  return toCheckResult("says-not-stated", evidence, "No checked answer says that the document doesn't state this.")
}

export const replyGiven = (reply: Reply) =>
  toCheckResult("reply-given", reply.text.length > 0 ? [] : [NO_REPLY], "The model sent no text reply.")

export const noToolCalls = (toolCalls: ToolCall[]) => {
  const evidence = toolCalls.map(({ name }) => ({ where: "the tools", expected: ["no tool call"], actual: name }))
  return toCheckResult("no-tool-calls", evidence, `Tool calls for small talk: ${evidence.length}.`)
}

const readClaims = ({ text, answers, answerAttempted }: Reply) =>
  answerAttempted ? answers.map(({ answer }) => answer).join("\n") : text

export const neverSaid = (reply: Reply, forbiddenClaims: string[]) => {
  const claims = readClaims(reply)
  const evidence = forbiddenClaims
    .filter((claim) => containsLoosely(claims, claim))
    .map((claim) => ({ where: "the reply", expected: [`never says "${claim}"`], actual: describeShownReply(reply) }))
  return toCheckResult("never-said", evidence, "The reply makes a claim the document doesn't support.")
}

const findFakeQuote = (originalBlocks: Section[], quote: Quote) => {
  const block = findBlock(originalBlocks, quote.nodeId)
  if (containsLoosely(block.text, quote.text)) return []
  return [{ where: `quote from ${describeBlock(block)}`, expected: [block.text], actual: quote.text }]
}

export const quotesReal = (originalBlocks: Section[], reply: Reply) => {
  const quotes = reply.answers.flatMap((answer) => answer.quotes)
  const evidence = quotes.flatMap((quote) => findFakeQuote(originalBlocks, quote))
  return toCheckResult(
    "quotes-real",
    evidence,
    `Quotes not found in the block they cite: ${evidence.length} of ${quotes.length}.`,
  )
}

const checkByKind = (testCase: AnswerQuestionCase, { reply, toolCalls }: CaseOutcome) => {
  if (testCase.kind === "question") return [answerShown(reply), answerMentions(reply, testCase.answerMentions)]
  if (testCase.kind === "unanswerable") return [saysNotStated(reply)]
  return [replyGiven(reply), noToolCalls(toolCalls)]
}

const listForbiddenClaims = (testCase: AnswerQuestionCase) =>
  testCase.kind === "small-talk" ? [] : (testCase.neverSays ?? [])

export const checkAnswerQuestion = (testCase: AnswerQuestionCase, outcome: CaseOutcome) => [
  ...checkByKind(testCase, outcome),
  noUnintendedChanges(outcome.originalBlocks, outcome.finalBlocks, []),
  neverSaid(outcome.reply, listForbiddenClaims(testCase)),
  quotesReal(outcome.originalBlocks, outcome.reply),
]
