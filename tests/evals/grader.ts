import { randomUUID } from "node:crypto"
import { generateText, Output, wrapLanguageModel } from "ai"
import { z } from "zod"
import type { Section } from "@/lib/document-snapshot"
import { createModelOptions } from "@/services/llm"
import { type BlockPair, isChanged, isHeading } from "@/tests/evals/checks"
import {
  type CaseOutcome,
  createAppModel,
  createModelRecorder,
  describeShownReply,
  recordModelCalls,
  sumTokens,
  type Tokens,
} from "@/tests/evals/run-case"

export type RewriteGraderName = "tone" | "concision" | "translation"

export type GraderName = RewriteGraderName | "answer"

export type Grade = { grader: GraderName; verdict: "pass" | "fail" | "unknown"; reasoning: string; tokens: Tokens }

type AnswerBrief = { instruction: string; reference: string; criteria: string[] }

export const GRADER_EFFORT = "medium"
const GRADER_TIMEOUT_MS = 5 * 60_000

const GRADER_INSTRUCTIONS = [
  "You grade one aspect of an AI assistant's work on a business document, against the criteria you are given.",
  "Judge only those criteria. Other aspects are graded separately.",
  "Placeholders such as [ORG_1] or [PERSON_2] stand for real names. They are correct as written.",
  "Be strict. For a rewrite, go through every changed block one by one: quote the original sentence and the rewritten sentence, and test each criterion on that pair.",
  "Judge each pair on its own. Don't excuse a change because another sentence elsewhere seems to cover it.",
  "Write your reasoning first, as the full list of pairs and the words that decide each criterion. Give the verdict only after the full list.",
  "Answer pass when every criterion is met, fail when any is not, and unknown only when the material doesn't let you decide.",
].join("\n")

const verdictSchema = z.object({
  reasoning: z.string().describe("Your reasoning, criterion by criterion, written before the verdict"),
  verdict: z.enum(["pass", "fail", "unknown"]),
})

const TONE_CRITERIA = [
  "The rewritten text clearly moves in the direction the user asked for, compared with the original.",
  "The new tone is applied evenly: no block that needed the change is left in the old tone while others changed.",
  "It still reads as a natural, professional business document, without exaggeration or filler.",
]

const CONCISION_CRITERIA = [
  "The rewritten text is clearly tighter than the original: less repetition and fewer filler words.",
  "Body text still reads as natural business prose. Compact label-style lines are fine where a label fits, such as a lead-in before a list or table, or in headings, list items and table cells. A single clipped phrase or a dropped article is not enough to fail; fail only when body paragraphs read as clipped notes.",
  "Headings stay short titles, and list items and table cells keep their role.",
]

const TRANSLATION_CRITERIA = [
  "Every translated block is correct, fluent German in a business register.",
  "The translation is accurate: no mistranslation that changes the meaning, no omitted sentence and no added content.",
  "Key terms are translated the same way throughout, and the form of address (Sie or du) doesn't switch.",
  "Placeholders, numbers, product names and proper names are kept as they are.",
  "Blocks left in English are only names, codes or terms that German business texts normally keep in English.",
]

const ANSWERABLE_CRITERIA = [
  "The answer is correct: it agrees with the reference facts.",
  "The answer is supported: its claims are stated in the document text below, the quotes shown to the user back up its main claim, and it concludes nothing the text doesn't say.",
  "It answers the question that was asked, briefly, in English.",
]

const UNANSWERABLE_CRITERIA = [
  "The reply says clearly that the document doesn't state the answer.",
  "It invents nothing: no name, number or claim is presented as the answer.",
  "Related information from the document, if mentioned, is marked as related and not passed off as the answer.",
]

const NOT_STATED_REFERENCE = "Reference: the document doesn't state the answer. The case author checked this."

const formatCriteria = (criteria: string[]) =>
  `Criteria:\n${criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n")}`

const formatPair = ({ before, after }: BlockPair) =>
  isChanged({ before, after })
    ? `[${before.nodeId}] (${before.type})\nBEFORE: ${before.text}\nAFTER: ${after.text}`
    : `[${before.nodeId}] (${before.type}) UNCHANGED: ${before.text}`

const formatScope = (scope: BlockPair[]) => scope.map(formatPair).join("\n\n")

const REWRITE_PROMPTS: Record<RewriteGraderName, (instruction: string, scope: BlockPair[]) => string[]> = {
  tone: (instruction, scope) => [
    `The user asked: "${instruction}"`,
    "Judge only the tone. Whether facts were kept is graded separately.",
    formatCriteria(TONE_CRITERIA),
    `The blocks in scope, before and after:\n\n${formatScope(scope)}`,
  ],
  concision: (instruction, scope) => [
    `The user asked: "${instruction}"`,
    "Judge only how concise and readable the result is. Whether facts were kept is graded separately.",
    formatCriteria(CONCISION_CRITERIA),
    `The blocks in scope, before and after:\n\n${formatScope(scope)}`,
  ],
  translation: (instruction, scope) => [
    `The user asked: "${instruction}"`,
    "Judge the quality of the translation. Fail on any major error.",
    formatCriteria(TRANSLATION_CRITERIA),
    `Every block, before and after:\n\n${formatScope(scope)}`,
  ],
}

const startsSection = (blocks: Section[], index: number) => index === 0 || isHeading(blocks[index])

const findSectionStart = (blocks: Section[], index: number) =>
  blocks.findLastIndex((_block, position) => position <= index && startsSection(blocks, position))

const listSectionsAround = (blocks: Section[], isWanted: (block: Section) => boolean) => {
  const sectionStarts = new Set(
    blocks.flatMap((block, index) => (isWanted(block) ? [findSectionStart(blocks, index)] : [])),
  )
  return blocks.filter((_block, index) => sectionStarts.has(findSectionStart(blocks, index)))
}

const formatQuotedSections = ({ originalBlocks, reply }: CaseOutcome) => {
  const quotedIds = new Set(reply.answers.flatMap(({ quotes }) => quotes.map(({ nodeId }) => nodeId)))
  const sections = listSectionsAround(originalBlocks, (block) => quotedIds.has(block.nodeId))
  return sections.map(({ nodeId, text }) => `[${nodeId}] ${text}`).join("\n") || "(no block was quoted)"
}

const buildAnswerPrompt = ({ instruction, reference, criteria }: AnswerBrief, outcome: CaseOutcome) =>
  [
    `The user asked about the document: "${instruction}"`,
    reference,
    formatCriteria(criteria),
    `The reply the user saw:\n${describeShownReply(outcome.reply)}`,
    `The document sections the answer quotes from:\n${formatQuotedSections(outcome)}`,
  ].join("\n\n")

const createGraderOptions = () => {
  const options = createModelOptions(randomUUID())
  return { ...options, openai: { ...options.openai, reasoningEffort: GRADER_EFFORT } }
}

const askGrader = async (grader: GraderName, prompt: string): Promise<Grade> => {
  const recorder = createModelRecorder()
  const { output } = await generateText({
    model: wrapLanguageModel({ model: createAppModel(), middleware: recordModelCalls(recorder) }),
    providerOptions: createGraderOptions(),
    instructions: GRADER_INSTRUCTIONS,
    prompt,
    output: Output.object({ schema: verdictSchema }),
    abortSignal: AbortSignal.timeout(GRADER_TIMEOUT_MS),
  })
  return { grader, ...output, tokens: sumTokens(recorder.calls) }
}

export const gradeRewrite = (graders: RewriteGraderName[], instruction: string, scope: BlockPair[]) =>
  Promise.all(graders.map((grader) => askGrader(grader, REWRITE_PROMPTS[grader](instruction, scope).join("\n\n"))))

export const gradeQuestion = async (instruction: string, facts: string[], outcome: CaseOutcome) => [
  await askGrader(
    "answer",
    buildAnswerPrompt(
      {
        instruction,
        reference: `Reference facts the answer must state: ${facts.join("; ")}`,
        criteria: ANSWERABLE_CRITERIA,
      },
      outcome,
    ),
  ),
]

export const gradeUnanswerable = async (instruction: string, outcome: CaseOutcome) => [
  await askGrader(
    "answer",
    buildAnswerPrompt({ instruction, reference: NOT_STATED_REFERENCE, criteria: UNANSWERABLE_CRITERIA }, outcome),
  ),
]
