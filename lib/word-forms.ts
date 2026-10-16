import { stemmer as stemGermanWord } from "@orama/stemmers/german"

export type WordLanguage = "english" | "german"

type Word = { stem: string; from: number; to: number }

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu
const POSSESSIVE_ENDING = /['’]s$/u
const MIN_STEMMED_LENGTH = 4

const PLURAL_ENDINGS: [RegExp, string][] = [
  [/(?<![ae])ies$/u, "y"],
  [/(?<![aeo])es$/u, "e"],
  [/(?<![us])s$/u, ""],
]

const GERMAN_MARKERS = new Set(["der", "die", "das", "und", "nicht", "mit", "für", "von", "zu", "den", "dem", "des"])
const ENGLISH_MARKERS = new Set(["the", "and", "not", "with", "for", "of", "to", "is", "are", "be", "this", "that"])

const stemEnglishWord = (word: string) => {
  const withoutPossessive = word.replace(POSSESSIVE_ENDING, "")
  if (withoutPossessive.length < MIN_STEMMED_LENGTH) return withoutPossessive
  const ending = PLURAL_ENDINGS.find(([pattern]) => pattern.test(withoutPossessive))
  return ending ? withoutPossessive.replace(...ending) : withoutPossessive
}

const STEMMERS: Record<WordLanguage, (word: string) => string> = {
  english: stemEnglishWord,
  german: stemGermanWord,
}

const readWords = (text: string, language: WordLanguage): Word[] =>
  [...text.matchAll(WORD)].map(({ 0: word, index }) => ({
    stem: STEMMERS[language](word.toLowerCase()),
    from: index,
    to: index + word.length,
  }))

const startsStemRun = (words: Word[], stems: string[], start: number) =>
  stems.every((stem, offset) => words[start + offset]?.stem === stem)

const countMarkers = (words: string[], markers: Set<string>) => words.filter((word) => markers.has(word)).length

export const detectWordLanguage = (texts: string[]): WordLanguage => {
  const words = texts.flatMap((text) => text.toLowerCase().match(WORD) ?? [])
  return countMarkers(words, GERMAN_MARKERS) > countMarkers(words, ENGLISH_MARKERS) ? "german" : "english"
}

export const findWordForm = (text: string, phrase: string, language: WordLanguage) => {
  const stems = readWords(phrase, language).map(({ stem }) => stem)
  const words = readWords(text, language)
  const start = words.findIndex((_, index) => startsStemRun(words, stems, index))
  if (stems.length === 0 || start < 0) return undefined
  return text.slice(words[start].from, words[start + stems.length - 1].to)
}
