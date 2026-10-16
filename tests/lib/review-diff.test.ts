import { diffForReview, WHOLE_BLOCK_KEPT_SHARE } from "@/lib/review-diff"

const readOld = (pieces: ReturnType<typeof diffForReview>) =>
  pieces.map((piece) => (piece.kind === "kept" ? piece.text : piece.removed)).join("")

const readNew = (pieces: ReturnType<typeof diffForReview>) =>
  pieces.map((piece) => (piece.kind === "kept" ? piece.text : piece.added)).join("")

describe("diffForReview", () => {
  it("marks only the word that changed", () => {
    expect(diffForReview("The customer wants a workshop.", "The client wants a workshop.")).toEqual([
      { kind: "kept", text: "The " },
      { kind: "changed", removed: "customer", added: "client" },
      { kind: "kept", text: " wants a workshop." },
    ])
  })

  it("keeps a number with its separators as one word", () => {
    expect(diffForReview("EUR 3,600", "EUR 4,000")).toEqual([
      { kind: "kept", text: "EUR " },
      { kind: "changed", removed: "3,600", added: "4,000" },
    ])
  })

  it("joins changes that only one word or a space separates", () => {
    expect(diffForReview("We met the customer and supplier today.", "We met the client and vendor today.")).toEqual([
      { kind: "kept", text: "We met the " },
      { kind: "changed", removed: "customer and supplier", added: "client and vendor" },
      { kind: "kept", text: " today." },
    ])
  })

  it("replaces the whole block when half or less of the words stay and the changes are scattered", () => {
    const oldText = "We sat down with the customer and noticed there is still a lot to do, especially around AI."
    const newText = "Our meeting with the customer identified a lot of further work, especially on AI."
    expect(diffForReview(oldText, newText)).toEqual([{ kind: "changed", removed: oldText, added: newText }])
    expect(WHOLE_BLOCK_KEPT_SHARE).toBe(0.5)
  })

  it("keeps a single change in place even when most of the words change", () => {
    const oldText = "We sat down with the customer and noticed there is still a lot to do, especially around AI."
    const newText = "In a joint meeting, the client identified a clear need for action, particularly in the use of AI."
    expect(diffForReview(oldText, newText)).toEqual([
      { kind: "changed", removed: oldText.slice(0, -" AI.".length), added: newText.slice(0, -" AI.".length) },
      { kind: "kept", text: " AI." },
    ])
  })

  it("keeps word-level marks when more than half of the words stay", () => {
    expect(diffForReview("The offer covers the following services:", "The offer includes:")).toEqual([
      { kind: "kept", text: "The offer " },
      { kind: "changed", removed: "covers the following services", added: "includes" },
      { kind: "kept", text: ":" },
    ])
  })

  it("keeps the exact old and new text, whitespace included", () => {
    const oldText = "Termination must be made in writing.  Upon termination of the contract,\nthe Contractor shall act."
    const newText = "Termination must be in writing. Upon termination, the Contractor shall act."
    const pieces = diffForReview(oldText, newText)
    expect(readOld(pieces)).toBe(oldText)
    expect(readNew(pieces)).toBe(newText)
  })

  it("returns one kept piece when nothing changed", () => {
    expect(diffForReview("Week 1", "Week 1")).toEqual([{ kind: "kept", text: "Week 1" }])
  })

  it("shows text added to an empty block as one change", () => {
    expect(diffForReview("", "EUR 450")).toEqual([{ kind: "changed", removed: "", added: "EUR 450" }])
  })
})
