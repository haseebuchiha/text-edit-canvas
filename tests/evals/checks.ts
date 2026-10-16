import type { Section } from "@/lib/document-snapshot"

export type Evidence = { where: string; expected: string[]; actual: string }

export type CheckResult = { check: string; passed: boolean; explanation: string; evidence: Evidence[] }

export type BlockPair = { before: Section; after: Section }

export type LengthRange = { min?: number; max?: number }

const MISSING_BLOCK: Section = { nodeId: "", type: "missing", text: "" }

const PLACEHOLDER = /\[[A-Z]+_\d+\]/gu
const WHITESPACE_RUN = /\s+/gu
const PERCENT_WORD = /\s?per ?cent(?![\p{L}])/giu
const TYPOGRAPHIC_DOUBLE_QUOTE = /[“”„‟«»]/gu
const TYPOGRAPHIC_SINGLE_QUOTE = /[‘’‚‛]/gu
const DIGIT_RUN = /\d+/gu
const THOUSANDS_SEPARATOR = /(\d)[,.'’  ](?=\d{3}\b)/gu
const LIST_INTRODUCTION = /:\s*$/u

const NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  twice: 2,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  zweimal: 2,
}

const GERMAN_NUMBER_WORDS = ["zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"]

const NUMBER_WORD = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(${Object.keys(NUMBER_WORDS).join("|")})(?![\p{L}\p{N}])`,
  "giu",
)

const WORD_FOR_TWO = /(?<![\p{L}\p{N}])(both|beide|beiden)(?![\p{L}\p{N}])/giu

const GERMAN_COMPOUND_NUMBER = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(${GERMAN_NUMBER_WORDS.join("|")})(?=\p{Ll})`,
  "giu",
)

const CLOCK_HOUR = /(?<!\d)(\d{1,2})(?=:\d{2}|\s?(?:[ap]\.m\.|uhr))/giu
const FULL_HOUR = /(?<!\d)(\d{1,2}):00(?!\d)/gu
const HOURS_PER_HALF_DAY = 12
const LAST_HOUR = 23

const MAX_HEADING_GROWTH = 2
const MIN_ALLOWED_HEADING_LENGTH = 40
const NO_LIMIT = { min: 0, max: Number.POSITIVE_INFINITY }
const NOTHING_CHANGED = { where: "the document", expected: ["at least one changed block"], actual: "no block changed" }

export const toCheckResult = (check: string, evidence: Evidence[], explanation: string): CheckResult => ({
  check,
  passed: evidence.length === 0,
  explanation,
  evidence,
})

export const describeBlock = ({ nodeId, type }: Section) => `block ${nodeId} (${type})`

export const findBlock = (blocks: Section[], nodeId: string) =>
  blocks.find((block) => block.nodeId === nodeId) ?? { ...MISSING_BLOCK, nodeId }

export const pairBlocks = (originalBlocks: Section[], finalBlocks: Section[]): BlockPair[] =>
  originalBlocks.map((before) => ({ before, after: findBlock(finalBlocks, before.nodeId) }))

export const isChanged = ({ before, after }: BlockPair) => before.text !== after.text

const listChangedPairs = (originalBlocks: Section[], finalBlocks: Section[]) =>
  pairBlocks(originalBlocks, finalBlocks).filter(isChanged)

export const isHeading = ({ type }: Section) => type === "heading"

const isTableCell = ({ tableId }: Section) => tableId !== undefined

const joinBlockTexts = (blocks: Section[]) => blocks.map((block) => block.text).join("\n")

const countCharacters = (blocks: Section[]) => blocks.reduce((total, block) => total + block.text.length, 0)

const describeMatches = (count: number) => (count === 0 ? "matches no block" : `matches ${count} blocks`)

export const findBlockBySnippet = (blocks: Section[], snippet: string) => {
  const matches = blocks.filter((block) => block.text.includes(snippet))
  if (matches.length !== 1) throw new Error(`"${snippet}" ${describeMatches(matches.length)}, but must match one.`)
  return matches[0]
}

export const normaliseText = (text: string) =>
  text
    .replaceAll(PERCENT_WORD, "%")
    .replaceAll(TYPOGRAPHIC_DOUBLE_QUOTE, '"')
    .replaceAll(TYPOGRAPHIC_SINGLE_QUOTE, "'")
    .replaceAll(WHITESPACE_RUN, " ")
    .trim()

export const containsLoosely = (text: string, phrase: string) =>
  normaliseText(text).toLowerCase().includes(normaliseText(phrase).toLowerCase())

export const listPlaceholders = (text: string) => text.match(PLACEHOLDER) ?? []

const spellOutNumberWord = (word: string) => ` ${NUMBER_WORDS[word.toLowerCase()]} `

const dropLeadingZeros = (digits: string) => String(Number(digits))

const listFiguresInDigits = (text: string) =>
  (
    text
      .replaceAll(PLACEHOLDER, " ")
      .replaceAll(FULL_HOUR, "$1")
      .replaceAll(THOUSANDS_SEPARATOR, "$1")
      .match(DIGIT_RUN) ?? []
  ).map(dropLeadingZeros)

export const listFigures = (text: string) => listFiguresInDigits(text.replaceAll(NUMBER_WORD, spellOutNumberWord))

const isClockHour = (hour: number) => hour > 0 && hour <= LAST_HOUR && hour !== HOURS_PER_HALF_DAY

const toOtherHalfOfDay = (hour: number) =>
  String(hour > HOURS_PER_HALF_DAY ? hour - HOURS_PER_HALF_DAY : hour + HOURS_PER_HALF_DAY)

const listClockAlternatives = (text: string) =>
  [...text.matchAll(CLOCK_HOUR)]
    .map(([hour]) => Number(hour))
    .filter(isClockHour)
    .map(toOtherHalfOfDay)

export const listFiguresGenerously = (text: string) => [
  ...listFigures(text.replaceAll(GERMAN_COMPOUND_NUMBER, spellOutNumberWord).replaceAll(WORD_FOR_TWO, " 2 ")),
  ...listClockAlternatives(text),
]

const listMissing = (expected: string[], actual: string[]) => [
  ...new Set(expected.filter((entry) => !actual.includes(entry))),
]

const describeDifference = (lost: string[], gained: string[], gainedLabel: string) => [
  ...(lost.length > 0 ? [`lost ${lost.join(", ")}`] : []),
  ...(gained.length > 0 ? [`${gainedLabel} ${gained.join(", ")}`] : []),
]

export const noUnintendedChanges = (originalBlocks: Section[], finalBlocks: Section[], allowedIds: string[]) => {
  const evidence = listChangedPairs(originalBlocks, finalBlocks)
    .filter(({ before }) => !allowedIds.includes(before.nodeId))
    .map(({ before, after }) => ({ where: describeBlock(before), expected: [before.text], actual: after.text }))
  return toCheckResult(
    "no-unintended-changes",
    evidence,
    `Blocks that changed although the instruction didn't ask for it: ${evidence.length}.`,
  )
}

export const somethingChanged = (scopeBlocks: Section[], finalBlocks: Section[]) => {
  const changedCount = listChangedPairs(scopeBlocks, finalBlocks).length
  return toCheckResult("something-changed", changedCount > 0 ? [] : [NOTHING_CHANGED], "Nothing was rewritten.")
}

const findPlaceholderChange = ({ before, after }: BlockPair) => {
  const lost = listMissing(listPlaceholders(before.text), listPlaceholders(after.text))
  const added = listMissing(listPlaceholders(after.text), listPlaceholders(before.text))
  if (lost.length === 0 && added.length === 0) return []
  const where = `${describeBlock(before)}: ${describeDifference(lost, added, "added").join("; ")}`
  return [{ where, expected: [before.text], actual: after.text }]
}

export const placeholdersKept = (originalBlocks: Section[], finalBlocks: Section[]) => {
  const evidence = listChangedPairs(originalBlocks, finalBlocks).flatMap(findPlaceholderChange)
  return toCheckResult(
    "placeholders-kept",
    evidence,
    `Blocks that lost or gained a placeholder such as [ORG_1]: ${evidence.length}.`,
  )
}

const listFiguresToKeep = (text: string) =>
  LIST_INTRODUCTION.test(text) ? listFiguresInDigits(text) : listFigures(text)

const findFigureChange = (documentFigures: string[], { before, after }: BlockPair) => {
  const lost = listMissing(listFiguresToKeep(before.text), listFiguresGenerously(after.text))
  const added = listMissing(listFigures(after.text), listFiguresGenerously(before.text))
  const invented = listMissing(added, documentFigures)
  if (lost.length === 0 && invented.length === 0) return []
  const where = `${describeBlock(before)}: ${describeDifference(lost, invented, "invented").join("; ")}`
  return [{ where, expected: [before.text], actual: after.text }]
}

export const figuresKept = (originalBlocks: Section[], finalBlocks: Section[]) => {
  const documentFigures = listFiguresGenerously(joinBlockTexts(originalBlocks))
  const evidence = listChangedPairs(originalBlocks, finalBlocks).flatMap((pair) =>
    findFigureChange(documentFigures, pair),
  )
  return toCheckResult(
    "figures-kept",
    evidence,
    `Blocks that lost a number, date or amount, or gained one the document doesn't have: ${evidence.length}.`,
  )
}

const isShortTitle = ({ before, after }: BlockPair) =>
  after.text.trim().length > 0 &&
  !after.text.includes("\n") &&
  after.text.length <= Math.max(MAX_HEADING_GROWTH * before.text.length, MIN_ALLOWED_HEADING_LENGTH)

export const headingsKept = (originalBlocks: Section[], finalBlocks: Section[]) => {
  const evidence = pairBlocks(originalBlocks.filter(isHeading), finalBlocks)
    .filter((pair) => !isShortTitle(pair))
    .map(({ before, after }) => ({
      where: describeBlock(before),
      expected: ["a short title on one line"],
      actual: after.text,
    }))
  return toCheckResult(
    "headings-kept",
    evidence,
    `Headings that are empty, longer than a title or broken over several lines: ${evidence.length}.`,
  )
}

const describeTableShapes = (blocks: Section[]) => {
  const rowsByTable = Map.groupBy(blocks.filter(isTableCell), (block) => block.tableId)
  return [...rowsByTable].map(
    ([tableId, cells]) =>
      `table ${tableId}: ${new Set(cells.map(({ rowId }) => rowId)).size} rows, ${cells.length} cells`,
  )
}

const findShapeChange = (originalBlocks: Section[], finalBlocks: Section[]) => {
  const expected = describeTableShapes(originalBlocks)
  const actual = describeTableShapes(finalBlocks)
  if (expected.join("\n") === actual.join("\n")) return []
  return [{ where: "table shapes", expected, actual: actual.join("\n") }]
}

const findEmptiedCells = (originalBlocks: Section[], finalBlocks: Section[]) =>
  pairBlocks(originalBlocks.filter(isTableCell), finalBlocks)
    .filter(({ before, after }) => before.text.trim().length > 0 && after.text.trim().length === 0)
    .map(({ before, after }) => ({ where: describeBlock(before), expected: [before.text], actual: after.text }))

export const tableCellsKept = (originalBlocks: Section[], finalBlocks: Section[]) => {
  const evidence = [...findShapeChange(originalBlocks, finalBlocks), ...findEmptiedCells(originalBlocks, finalBlocks)]
  return toCheckResult(
    "table-cells-kept",
    evidence,
    `Table problems (a changed table shape or an emptied cell): ${evidence.length}.`,
  )
}

export const phrasesKept = (scopeBlocks: Section[], phrases: string[]) => {
  const scopeText = joinBlockTexts(scopeBlocks)
  const evidence = phrases
    .filter((phrase) => !containsLoosely(scopeText, phrase))
    .map((phrase) => ({
      where: "the rewritten text",
      expected: [`contains "${phrase}"`],
      actual: `"${phrase}" is gone`,
    }))
  return toCheckResult("phrases-kept", evidence, `Phrases that carry a fact and are gone: ${evidence.length}.`)
}

const formatShare = (share: number) => `${Math.round(share * 100)}%`

const describeRange = ({ min, max }: typeof NO_LIMIT) =>
  `between ${formatShare(min)} and ${formatShare(max)} of the original length`

const findOutOfRange = (share: number, limits: typeof NO_LIMIT) => {
  if (share >= limits.min && share <= limits.max) return []
  return [{ where: "the rewritten text", expected: [describeRange(limits)], actual: formatShare(share) }]
}

export const lengthInRange = (scopeBlocks: Section[], finalScopeBlocks: Section[], range?: LengthRange) => {
  const share = countCharacters(finalScopeBlocks) / countCharacters(scopeBlocks)
  return toCheckResult(
    "length-in-range",
    findOutOfRange(share, { ...NO_LIMIT, ...range }),
    `The text is ${formatShare(share)} of its original length, outside the expected range.`,
  )
}
