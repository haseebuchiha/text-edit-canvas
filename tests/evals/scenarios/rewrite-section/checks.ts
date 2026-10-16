import type { OutlineEntry, Section } from "@/lib/document-snapshot"
import {
  figuresKept,
  headingsKept,
  lengthInRange,
  noUnintendedChanges,
  phrasesKept,
  placeholdersKept,
  somethingChanged,
  tableCellsKept,
} from "@/tests/evals/checks"
import type { CaseOutcome } from "@/tests/evals/run-case"
import type { RewriteSectionCase } from "@/tests/evals/scenarios/rewrite-section/cases"

const describeMatches = (count: number) => (count === 0 ? "matches no heading" : `matches ${count} headings`)

const isHeadingAtOrAbove = (outline: OutlineEntry[], nodeId: string, level: number) =>
  outline.some((entry) => entry.nodeId === nodeId && entry.level <= level)

export const findSection = (outline: OutlineEntry[], blocks: Section[], headingText: string) => {
  const headings = outline.filter((entry) => entry.text === headingText)
  if (headings.length !== 1)
    throw new Error(`The section heading "${headingText}" ${describeMatches(headings.length)}.`)
  const start = blocks.findIndex((block) => block.nodeId === headings[0].nodeId)
  const end = blocks.findIndex(
    (block, index) => index > start && isHeadingAtOrAbove(outline, block.nodeId, headings[0].level),
  )
  return blocks.slice(start, end < 0 ? blocks.length : end)
}

export const checkSectionRewrite = (testCase: RewriteSectionCase, outcome: CaseOutcome) => {
  const { outline, originalBlocks, finalBlocks } = outcome
  const sectionIds = findSection(outline, originalBlocks, testCase.sectionHeading).map(({ nodeId }) => nodeId)
  const originalSection = originalBlocks.filter(({ nodeId }) => sectionIds.includes(nodeId))
  const finalSection = finalBlocks.filter(({ nodeId }) => sectionIds.includes(nodeId))
  return [
    somethingChanged(originalSection, finalBlocks),
    lengthInRange(originalSection, finalSection, testCase.lengthAsShareOfOriginal),
    noUnintendedChanges(originalBlocks, finalBlocks, sectionIds),
    placeholdersKept(originalBlocks, finalBlocks),
    figuresKept(originalBlocks, finalBlocks),
    headingsKept(originalBlocks, finalBlocks),
    tableCellsKept(originalBlocks, finalBlocks),
    phrasesKept(finalSection, testCase.keepPhrases ?? []),
  ]
}
