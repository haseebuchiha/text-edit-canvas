import type { Section } from "@/lib/document-snapshot"
import { readDocument } from "@/tests/evals/run-case"
import { REWRITE_DOCUMENT_CASES } from "@/tests/evals/scenarios/rewrite-document/cases"
import { allTranslated, looksEnglish, termsConsistent } from "@/tests/evals/scenarios/rewrite-document/checks"

const paragraph = (nodeId: string, text: string): Section => ({ nodeId, type: "paragraph", text })

const heading = (nodeId: string, text: string): Section => ({ nodeId, type: "heading", text })

const changeTexts = (blocks: Section[], texts: Record<string, string>) =>
  blocks.map((block) => (block.nodeId in texts ? { ...block, text: texts[block.nodeId] } : block))

describe("looksEnglish", () => {
  it("tells English sentences from German ones", () => {
    expect(looksEnglish("The customer wants a workshop for 12 people.")).toBe(true)
    expect(looksEnglish("Der Kunde wünscht einen Workshop für 12 Personen.")).toBe(false)
    expect(looksEnglish("Chief Information Security Officer")).toBe(false)
  })
})

describe("allTranslated", () => {
  const original = [
    paragraph("1", "Draft for internal review only. Do not forward."),
    heading("2", "Chief Information Security Officer"),
    paragraph("3", "The customer wants a workshop for 12 people."),
  ]

  it("fails when the text before the first heading stays in English", () => {
    const final = changeTexts(original, { "3": "Der Kunde wünscht einen Workshop für 12 Personen." })
    const result = allTranslated(original, final, "German")
    expect(result.passed).toBe(false)
    expect(result.evidence.map(({ where }) => where)).toEqual(["block 1 (paragraph)"])
  })

  it("passes when every English sentence is translated and a job title stays English", () => {
    const final = changeTexts(original, {
      "1": "Entwurf nur für die interne Prüfung. Nicht weiterleiten.",
      "3": "Der Kunde wünscht einen Workshop für 12 Personen.",
    })
    expect(allTranslated(original, final, "German").passed).toBe(true)
  })

  it("passes a rewrite that isn't a translation", () => {
    expect(allTranslated(original, original).passed).toBe(true)
  })
})

describe("termsConsistent", () => {
  const employees = [["Beschäftigte", "Mitarbeitende", "Mitarbeiter"]]

  it("fails a translation that mixes Beschäftigte and Mitarbeitende", () => {
    const final = [
      paragraph("3", "Alle Beschäftigten kennen diese Richtlinie."),
      paragraph("42", "Mitarbeitende melden Vorfälle sofort."),
    ]
    const result = termsConsistent(final, employees)
    expect(result.passed).toBe(false)
    expect(result.evidence[0].actual).toBe(
      '"Beschäftigte" in 1 blocks (such as 3); "Mitarbeitende" in 1 blocks (such as 42)',
    )
  })

  it("passes a translation that sticks to one word, including its inflected forms", () => {
    const final = [
      paragraph("3", "Alle Beschäftigten kennen diese Richtlinie."),
      paragraph("42", "Beschäftigte melden Vorfälle sofort."),
    ]
    expect(termsConsistent(final, employees).passed).toBe(true)
  })

  it("counts a word that only appears inside another word as not used", () => {
    expect(termsConsistent([paragraph("3", "Die Beschäftigten und die Neumitarbeiter.")], employees).passed).toBe(true)
  })

  it("ignores compounds such as Mitarbeiterzeitung and IT-Mitarbeiter, which translate other words", () => {
    const final = [
      paragraph("3", "Alle Beschäftigten lesen die Mitarbeiterzeitung."),
      paragraph("42", "Die IT-Mitarbeiter und der Mitarbeiter-Newsletter."),
    ]
    expect(termsConsistent(final, employees).passed).toBe(true)
  })

  it("still fails a plural of the other word", () => {
    const final = [
      paragraph("3", "Alle Beschäftigten kennen diese Richtlinie."),
      paragraph("42", "Die Mitarbeiterinnen und Mitarbeitern melden Vorfälle."),
    ]
    expect(termsConsistent(final, employees).passed).toBe(false)
  })
})

describe("every rewrite-document case", () => {
  it.each(REWRITE_DOCUMENT_CASES)("$id keeps phrases its document has", ({ document, keepPhrases }) => {
    const documentText = readDocument(document)
      .blocks.map(({ text }) => text.toLowerCase())
      .join("\n")
    expect((keepPhrases ?? []).filter((phrase) => !documentText.includes(phrase.toLowerCase()))).toEqual([])
  })
})
