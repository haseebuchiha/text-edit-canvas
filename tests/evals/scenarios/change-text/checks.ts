import type { Section } from "@/lib/document-snapshot"
import {
  containsLoosely,
  describeBlock,
  findBlock,
  findBlockBySnippet,
  normaliseText,
  noUnintendedChanges,
  toCheckResult,
} from "@/tests/evals/checks"
import { type CaseOutcome, findHighlight, type Highlight } from "@/tests/evals/run-case"
import type { ChangeTextCase } from "@/tests/evals/scenarios/change-text/cases"

type Change = ChangeTextCase["changes"][number]

type ChangeTarget = Change & { nodeId: string }

const isExpectedText = (text: string, target: ChangeTarget) => {
  if ("becomesOneOf" in target)
    return target.becomesOneOf.some((expected) => normaliseText(expected) === normaliseText(text))
  return target.newTextIncludes.every((phrase) => containsLoosely(text, phrase))
}

const describeExpectation = (target: ChangeTarget) =>
  "becomesOneOf" in target ? target.becomesOneOf : target.newTextIncludes.map((phrase) => `contains "${phrase}"`)

const findMismatch = (finalBlocks: Section[], target: ChangeTarget) => {
  const block = findBlock(finalBlocks, target.nodeId)
  if (isExpectedText(block.text, target)) return []
  return [{ where: describeBlock(block), expected: describeExpectation(target), actual: block.text }]
}

export const expectedChanges = (finalBlocks: Section[], targets: ChangeTarget[]) => {
  const evidence = targets.flatMap((target) => findMismatch(finalBlocks, target))
  return toCheckResult(
    "expected-changes",
    evidence,
    `Blocks without their expected text: ${evidence.length} of ${targets.length}.`,
  )
}

const findWord = (finalBlocks: Section[], word: string) =>
  finalBlocks
    .filter((block) => block.text.toLowerCase().includes(word.toLowerCase()))
    .map((block) => ({ where: describeBlock(block), expected: [`no "${word}"`], actual: block.text }))

export const wordGone = (finalBlocks: Section[], words: string[]) => {
  const evidence = words.flatMap((word) => findWord(finalBlocks, word))
  return toCheckResult("word-gone", evidence, `Blocks that still contain "${words.join('", "')}": ${evidence.length}.`)
}

const findChangeAroundHighlight = (originalBlocks: Section[], finalBlocks: Section[], highlight: Highlight) => {
  const { block, from, to } = findHighlight(originalBlocks, highlight)
  const textBefore = block.text.slice(0, from)
  const textAfter = block.text.slice(to)
  const finalBlock = findBlock(finalBlocks, block.nodeId)
  if (finalBlock.text.startsWith(textBefore) && finalBlock.text.endsWith(textAfter)) return []
  const expected = [`starts with "${textBefore}" and ends with "${textAfter}"`]
  return [{ where: describeBlock(finalBlock), expected, actual: finalBlock.text }]
}

export const highlightOnly = (originalBlocks: Section[], finalBlocks: Section[], highlight?: Highlight) => {
  const evidence = highlight ? findChangeAroundHighlight(originalBlocks, finalBlocks, highlight) : []
  return toCheckResult(
    "highlight-only",
    evidence,
    "The text around the highlight changed, but only the highlighted text may change.",
  )
}

export const findChangeTargets = (originalBlocks: Section[], changes: Change[]): ChangeTarget[] =>
  changes.map((change) => ({ ...change, nodeId: findBlockBySnippet(originalBlocks, change.blockContaining).nodeId }))

export const checkChangeText = (testCase: ChangeTextCase, { originalBlocks, finalBlocks }: CaseOutcome) => {
  const targets = findChangeTargets(originalBlocks, testCase.changes)
  return [
    expectedChanges(finalBlocks, targets),
    wordGone(finalBlocks, testCase.goneEverywhere ?? []),
    noUnintendedChanges(
      originalBlocks,
      finalBlocks,
      targets.map(({ nodeId }) => nodeId),
    ),
    highlightOnly(originalBlocks, finalBlocks, testCase.highlight),
  ]
}
