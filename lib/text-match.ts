export type TextSpan = { from: number; to: number }

type FoldedPiece = { folded: string; from: number; to: number }

const CHARACTER_OR_WHITESPACE_RUN = /\s+|\S/gu
const WHITESPACE_RUN = /\s+/u
const DASH = /[-‐-—−]/u
const TYPOGRAPHIC_DOUBLE_QUOTE = /[“”„‟«»]/u
const TYPOGRAPHIC_SINGLE_QUOTE = /[‘’‚‛]/u
const LETTER = /^\p{L}/u
const PATTERN_SYNTAX = /[$()*+.?[\\\]^{|}]/gu
const OPTIONAL_HYPHEN = "-?"

const SEPARATOR_PATTERNS: Partial<Record<string, string>> = { "-": "[- ]?", " ": "[- ]" }

const foldPiece = (piece: string) =>
  piece
    .replace(WHITESPACE_RUN, " ")
    .replace(DASH, "-")
    .replace(TYPOGRAPHIC_DOUBLE_QUOTE, '"')
    .replace(TYPOGRAPHIC_SINGLE_QUOTE, "'")
    .toLowerCase()

const foldText = (text: string): FoldedPiece[] =>
  [...text.matchAll(CHARACTER_OR_WHITESPACE_RUN)].map(({ 0: piece, index }) => ({
    folded: foldPiece(piece),
    from: index,
    to: index + piece.length,
  }))

const joinFolded = (pieces: FoldedPiece[]) => pieces.map(({ folded }) => folded).join("")

const spreadOverUnits = (piece: FoldedPiece) => Array.from({ length: piece.folded.length }, () => piece)

const isLetter = (piece = "") => LETTER.test(piece)

const escapePattern = (piece: string) => piece.replaceAll(PATTERN_SYNTAX, String.raw`\$&`)

const isBetweenLetters = (pieces: string[], index: number) => isLetter(pieces[index - 1]) && isLetter(pieces[index + 1])

const toSeparatorPattern = (pieces: string[], index: number) =>
  isBetweenLetters(pieces, index) ? SEPARATOR_PATTERNS[pieces[index]] : undefined

const toCharacterPattern = (pieces: string[], index: number) =>
  isLetter(pieces[index]) && isLetter(pieces[index + 1])
    ? `${pieces[index]}${OPTIONAL_HYPHEN}`
    : escapePattern(pieces[index])

const toPatternPiece = (_: string, index: number, pieces: string[]) =>
  toSeparatorPattern(pieces, index) ?? toCharacterPattern(pieces, index)

const buildPattern = (query: string) => {
  const pieces = foldText(query).map(({ folded }) => folded)
  return new RegExp(pieces.map(toPatternPiece).join(""), "u")
}

const findExactSpan = (text: string, query: string): TextSpan | undefined => {
  const offset = text.indexOf(query)
  return offset < 0 ? undefined : { from: offset, to: offset + query.length }
}

const findFoldedSpan = (text: string, query: string): TextSpan | undefined => {
  const pieces = foldText(text)
  const units = pieces.flatMap(spreadOverUnits)
  const match = buildPattern(query).exec(joinFolded(pieces))
  if (!match) return undefined
  return { from: units[match.index].from, to: units[match.index + match[0].length - 1].to }
}

export const findMatchingSpan = (text: string, query: string) => {
  if (query.length === 0) return undefined
  return findExactSpan(text, query) ?? findFoldedSpan(text, query)
}

export const containsMatchingText = (text: string, query: string) => findMatchingSpan(text, query) !== undefined
