import type { Section } from "@/lib/document-snapshot"
import {
  describeBlock,
  figuresKept,
  headingsKept,
  lengthInRange,
  pairBlocks,
  phrasesKept,
  placeholdersKept,
  somethingChanged,
  tableCellsKept,
  toCheckResult,
} from "@/tests/evals/checks"
import type { CaseOutcome } from "@/tests/evals/run-case"
import type { RewriteDocumentCase } from "@/tests/evals/scenarios/rewrite-document/cases"

type TermUse = { term: string; blocks: Section[] }

const WORD = /[a-zäöüß]+/gu
const MIN_ENGLISH_WORDS = 2
const MAX_EXAMPLES = 3
const PATTERN_SYNTAX = /[$()*+.?[\\\]^{|}]/gu
const GERMAN_ENDINGS = "(?:n|s|e|en|es|in|innen|nen)?"

const ENGLISH_WORDS = new Set(
  "the and of to is are for with must be will all this that or by on at from an as not their our we you it in if".split(
    " ",
  ),
)

const GERMAN_WORDS = new Set(
  "der die das und ist sind für mit muss müssen werden wird alle diese dieser von zu ein eine einen dem den des nicht oder auf im bei wir sie es wenn als nur durch".split(
    " ",
  ),
)

const countWordsIn = (words: Set<string>, text: string) =>
  (text.toLowerCase().match(WORD) ?? []).filter((word) => words.has(word)).length

export const looksEnglish = (text: string) =>
  countWordsIn(ENGLISH_WORDS, text) >= MIN_ENGLISH_WORDS && countWordsIn(GERMAN_WORDS, text) === 0

const escapePattern = (text: string) => text.replaceAll(PATTERN_SYNTAX, String.raw`\$&`)

const hasWordForm = (text: string, word: string) =>
  new RegExp(String.raw`(?<![\p{L}-])${escapePattern(word)}${GERMAN_ENDINGS}(?![\p{L}-])`, "iu").test(text)

const findBlocksStillInEnglish = (englishBlocks: Section[], finalBlocks: Section[], language: string) =>
  pairBlocks(englishBlocks, finalBlocks)
    .filter(({ after }) => looksEnglish(after.text))
    .map(({ before, after }) => ({ where: describeBlock(before), expected: [`in ${language}`], actual: after.text }))

export const allTranslated = (originalBlocks: Section[], finalBlocks: Section[], language?: string) => {
  const englishBlocks = originalBlocks.filter((block) => looksEnglish(block.text))
  const evidence = language ? findBlocksStillInEnglish(englishBlocks, finalBlocks, language) : []
  return toCheckResult(
    "all-translated",
    evidence,
    `English blocks still in English: ${evidence.length} of ${englishBlocks.length}.`,
  )
}

const findTermUse = (finalBlocks: Section[], term: string): TermUse => ({
  term,
  blocks: finalBlocks.filter((block) => hasWordForm(block.text, term)),
})

const describeUse = ({ term, blocks }: TermUse) => {
  const examples = blocks.slice(0, MAX_EXAMPLES).map(({ nodeId }) => nodeId)
  return `"${term}" in ${blocks.length} blocks (such as ${examples.join(", ")})`
}

const findMixedTerms = (finalBlocks: Section[], terms: string[]) => {
  const usedTerms = terms.map((term) => findTermUse(finalBlocks, term)).filter(({ blocks }) => blocks.length > 0)
  if (usedTerms.length <= 1) return []
  const actual = usedTerms.map(describeUse).join("; ")
  return [{ where: `the words ${terms.join(" / ")}`, expected: ["only one of them throughout"], actual }]
}

export const termsConsistent = (finalBlocks: Section[], termGroups: string[][]) => {
  const evidence = termGroups.flatMap((terms) => findMixedTerms(finalBlocks, terms))
  return toCheckResult("terms-consistent", evidence, `Terms translated with more than one word: ${evidence.length}.`)
}

export const checkDocumentRewrite = (testCase: RewriteDocumentCase, { originalBlocks, finalBlocks }: CaseOutcome) => [
  somethingChanged(originalBlocks, finalBlocks),
  allTranslated(originalBlocks, finalBlocks, testCase.translatedTo),
  lengthInRange(originalBlocks, finalBlocks, testCase.lengthAsShareOfOriginal),
  placeholdersKept(originalBlocks, finalBlocks),
  figuresKept(originalBlocks, finalBlocks),
  headingsKept(originalBlocks, finalBlocks),
  tableCellsKept(originalBlocks, finalBlocks),
  phrasesKept(finalBlocks, testCase.keepPhrases ?? []),
  termsConsistent(finalBlocks, testCase.useOnlyOneOf ?? []),
]
