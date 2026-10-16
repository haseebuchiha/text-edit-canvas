import { type ArrayChange, diffArrays } from "diff"

export type KeptPiece = { kind: "kept"; text: string }

export type ChangedPiece = { kind: "changed"; removed: string; added: string }

export type DiffPiece = KeptPiece | ChangedPiece

const WORD_OR_SPACE = /[\p{L}\p{N}_]+(?:[.,'’-][\p{L}\p{N}_]+)*|\s+|[^\s\p{L}\p{N}_]/gu
const SPACE_ONLY = /^\s+$/u
const MAX_BRIDGED_WORDS = 1

export const WHOLE_BLOCK_KEPT_SHARE = 0.5

const splitTokens = (text: string) => text.match(WORD_OR_SPACE) ?? []

const countWords = (text: string) => splitTokens(text).filter((token) => !SPACE_ONLY.test(token)).length

const toPiece = ({ value, added, removed }: ArrayChange<string>): DiffPiece => {
  const text = value.join("")
  if (added) return { kind: "changed", removed: "", added: text }
  if (removed) return { kind: "changed", removed: text, added: "" }
  return { kind: "kept", text }
}

const joinChanges = (first: ChangedPiece, second: ChangedPiece): ChangedPiece => ({
  kind: "changed",
  removed: first.removed + second.removed,
  added: first.added + second.added,
})

const readLastChange = (pieces: DiffPiece[]) => {
  const previous = pieces.at(-1)
  return previous?.kind === "changed" ? previous : undefined
}

const appendPiece = (pieces: DiffPiece[], piece: DiffPiece) => {
  const previous = readLastChange(pieces)
  if (piece.kind === "kept" || !previous) return [...pieces, piece]
  return [...pieces.slice(0, -1), joinChanges(previous, piece)]
}

const isChangedAt = (pieces: DiffPiece[], index: number) => pieces[index]?.kind === "changed"

const isShortGap = (piece: DiffPiece): piece is KeptPiece =>
  piece.kind === "kept" && countWords(piece.text) <= MAX_BRIDGED_WORDS

const isBetweenChanges = (pieces: DiffPiece[], index: number) =>
  isChangedAt(pieces, index - 1) && isChangedAt(pieces, index + 1)

const bridgeShortGaps = (piece: DiffPiece, index: number, pieces: DiffPiece[]): DiffPiece => {
  if (!isShortGap(piece) || !isBetweenChanges(pieces, index)) return piece
  return { kind: "changed", removed: piece.text, added: piece.text }
}

const countKeptWords = (pieces: DiffPiece[]) =>
  pieces.reduce((total, piece) => total + (piece.kind === "kept" ? countWords(piece.text) : 0), 0)

const keptShare = (pieces: DiffPiece[], oldText: string, newText: string) =>
  (2 * countKeptWords(pieces)) / Math.max(countWords(oldText) + countWords(newText), 1)

const countChanges = (pieces: DiffPiece[]) => pieces.filter((piece) => piece.kind === "changed").length

const isConfetti = (pieces: DiffPiece[], oldText: string, newText: string) =>
  countChanges(pieces) > 1 && keptShare(pieces, oldText, newText) <= WHOLE_BLOCK_KEPT_SHARE

export const diffForReview = (oldText: string, newText: string): DiffPiece[] => {
  if (oldText === newText) return [{ kind: "kept", text: oldText }]
  const pieces = diffArrays(splitTokens(oldText), splitTokens(newText))
    .map(toPiece)
    .reduce(appendPiece, [])
    .map(bridgeShortGaps)
    .reduce(appendPiece, [])
  if (isConfetti(pieces, oldText, newText)) return [{ kind: "changed", removed: oldText, added: newText }]
  return pieces
}
