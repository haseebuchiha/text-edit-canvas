import type { Section } from "@/lib/document-snapshot"
import {
  figuresKept,
  findBlockBySnippet,
  headingsKept,
  lengthInRange,
  listFigures,
  listFiguresGenerously,
  listPlaceholders,
  normaliseText,
  noUnintendedChanges,
  phrasesKept,
  placeholdersKept,
  somethingChanged,
  tableCellsKept,
} from "@/tests/evals/checks"

const paragraph = (nodeId: string, text: string): Section => ({ nodeId, type: "paragraph", text })

const heading = (nodeId: string, text: string): Section => ({ nodeId, type: "heading", text })

const tableCell = (nodeId: string, text: string, place: string): Section => ({
  nodeId,
  type: `table cell ${place}`,
  text,
  tableId: "table",
  rowId: place.replace(/c\d+$/u, ""),
})

const changeTexts = (blocks: Section[], texts: Record<string, string>) =>
  blocks.map((block) => (block.nodeId in texts ? { ...block, text: texts[block.nodeId] } : block))

describe("text facts", () => {
  it("lists placeholders", () => {
    expect(listPlaceholders("Prepared for [ORG_1], attention of [PERSON_1].")).toEqual(["[ORG_1]", "[PERSON_1]"])
  })

  it("reads figures the same way in English and German", () => {
    const figures = ["5250", "1400", "3", "4", "2"]
    expect(listFigures("EUR 5,250 for 1,400 employees in three weeks, version 4.2")).toEqual(figures)
    expect(listFigures("5.250 EUR für 1.400 Beschäftigte in drei Wochen, Version 4.2")).toEqual(figures)
  })

  it("reads 18:00 and 6:00 p.m. as the same time only when asked to be generous", () => {
    expect(listFigures("6:00 p.m.")).toEqual(["6"])
    expect(listFiguresGenerously("18:00 Uhr")).toEqual(["18", "6"])
  })

  it("doesn't read placeholder numbers as figures", () => {
    expect(listFigures("[ORG_1] and [PERSON_2]")).toEqual([])
  })

  it("normalises whitespace and curly quotes", () => {
    expect(normaliseText("  “Kick-off”   call ")).toBe('"Kick-off" call')
  })
})

describe("findBlockBySnippet", () => {
  const blocks = [paragraph("1", "The customer wants a workshop."), paragraph("2", "The customer service team.")]

  it("finds the one block that contains the snippet", () => {
    expect(findBlockBySnippet(blocks, "wants a workshop").nodeId).toBe("1")
  })

  it("rejects a snippet that matches no block", () => {
    expect(() => findBlockBySnippet(blocks, "appendix")).toThrow("matches no block")
  })

  it("rejects a snippet that matches several blocks", () => {
    expect(() => findBlockBySnippet(blocks, "The customer")).toThrow("matches 2 blocks")
  })
})

describe("noUnintendedChanges", () => {
  const original = [
    heading("1", "Pricing"),
    paragraph("2", "All prices are net."),
    heading("3", "Next steps"),
    paragraph("4", "Please confirm the offer."),
  ]

  it("passes when only an allowed block changed", () => {
    const final = changeTexts(original, { "2": "All prices are gross." })
    expect(noUnintendedChanges(original, final, ["2"]).passed).toBe(true)
  })

  it("fails and names the block that changed outside the allowed ones", () => {
    const final = changeTexts(original, { "2": "x", "4": "Please confirm the offer soon." })
    const result = noUnintendedChanges(original, final, ["2"])
    expect(result.passed).toBe(false)
    expect(result.evidence).toEqual([
      {
        where: "block 4 (paragraph)",
        expected: ["Please confirm the offer."],
        actual: "Please confirm the offer soon.",
      },
    ])
  })

  it("fails any change when no block may change", () => {
    expect(noUnintendedChanges(original, changeTexts(original, { "2": "" }), []).passed).toBe(false)
    expect(noUnintendedChanges(original, original, []).passed).toBe(true)
  })
})

describe("somethingChanged", () => {
  const original = [paragraph("1", "One."), paragraph("2", "Two.")]

  it("fails a rewrite that changed nothing", () => {
    expect(somethingChanged(original, original).passed).toBe(false)
  })

  it("passes a rewrite that changed a block", () => {
    expect(somethingChanged(original, changeTexts(original, { "2": "2." })).passed).toBe(true)
  })

  it("counts only changes inside the blocks in scope", () => {
    expect(somethingChanged([original[0]], changeTexts(original, { "2": "2." })).passed).toBe(false)
  })
})

describe("placeholdersKept", () => {
  const original = [
    paragraph("5", "The policy protects the information that [ORG_1] processes."),
    paragraph("180", "Email is the most common route for attacks on companies such as ours."),
  ]

  it("fails a run that drops [ORG_1]", () => {
    const result = placeholdersKept(
      original,
      changeTexts(original, { "5": "The policy protects company information." }),
    )
    expect(result.passed).toBe(false)
    expect(result.evidence[0].where).toBe("block 5 (paragraph): lost [ORG_1]")
  })

  it("fails a run that replaces 'ours' with [ORG_1]", () => {
    const final = changeTexts(original, {
      "180": "Email is the most common route for attacks on companies such as [ORG_1].",
    })
    expect(placeholdersKept(original, final).evidence[0].where).toBe("block 180 (paragraph): added [ORG_1]")
  })

  it("passes a rewrite that keeps every placeholder", () => {
    const final = changeTexts(original, { "5": "This policy protects [ORG_1]'s information." })
    expect(placeholdersKept(original, final).passed).toBe(true)
  })
})

describe("figuresKept", () => {
  const original = [
    tableCell("40", "EUR 1,200", "r4c3"),
    paragraph("42", "Workstations lock after ten minutes, and accounts unused for 60 days are deactivated."),
  ]

  const keepsFigures = (before: string, after: string) =>
    figuresKept([paragraph("1", before)], [paragraph("1", after)]).passed

  it("fails a run that writes 'In stock' into a price cell", () => {
    const result = figuresKept(original, changeTexts(original, { "40": "In stock" }))
    expect(result.passed).toBe(false)
    expect(result.evidence[0].where).toBe("block 40 (table cell r4c3): lost 1200")
  })

  it("treats number words and digits as the same figure", () => {
    const final = changeTexts(original, {
      "42": "Workstations lock after 10 minutes; accounts unused for 60 days are deactivated.",
    })
    expect(figuresKept(original, final).passed).toBe(true)
  })

  it("accepts German number formats", () => {
    const final = changeTexts(original, {
      "40": "1.200 EUR",
      "42": "Arbeitsplätze sperren nach zehn Minuten, Konten werden nach 60 Tagen deaktiviert.",
    })
    expect(figuresKept(original, final).passed).toBe(true)
  })

  it("accepts a 12-hour time written as a 24-hour time", () => {
    expect(keepsFigures("Monday to Friday, 7:00 a.m. to 5:00 p.m.", "Montag bis Freitag, 7 bis 17 Uhr")).toBe(true)
  })

  it("accepts a number inside a German compound such as zweitägig", () => {
    expect(keepsFigures("a two-day workshop in three shifts", "ein zweitägiger Workshop im Dreischichtbetrieb")).toBe(
      true,
    )
  })

  it("accepts a 12-hour time that a translation keeps in 12-hour form", () => {
    expect(keepsFigures("if received by 2:00 p.m.", "wenn sie bis 2:00 Uhr nachmittags eingeht")).toBe(true)
  })

  it("doesn't mistake the German word 'am' after a number for a time", () => {
    expect(
      keepsFigures(
        "about 520 of them at the headquarters, from 08:30",
        "davon etwa 520 am Hauptsitz, ab 08:30 am Empfang",
      ),
    ).toBe(true)
  })

  it("lets a count be dropped from a line that introduces a list, since the list shows it", () => {
    expect(keepsFigures("Three mounting options are available:", "Options:")).toBe(true)
  })

  it("still fails a count dropped from an ordinary sentence", () => {
    expect(keepsFigures("All four segments grew.", "All segments grew.")).toBe(false)
  })

  it("reads 'both' as two", () => {
    expect(keepsFigures("It supplies the two regional warehouses.", "It supplies both regional warehouses.")).toBe(true)
  })

  it("doesn't read 'ten' at the end of a German word as a number", () => {
    expect(keepsFigures("Repair of peripheral equipment", "Reparatur von Peripheriegeräten")).toBe(true)
  })

  it("fails a run that makes up a figure the document doesn't have", () => {
    const final = changeTexts(original, { "42": "Workstations lock after ten minutes and 99 seconds; 60 days." })
    expect(figuresKept(original, final).evidence[0].where).toBe("block 42 (paragraph): invented 99")
  })
})

describe("headingsKept", () => {
  const original = [
    heading("4", "1. Purpose and Scope"),
    paragraph("5", "The purpose of this policy."),
    heading("9", "Scope"),
  ]

  it("fails a run that replaces a heading with a made-up summary", () => {
    const final = changeTexts(original, {
      "4": "This section explains why the policy exists and which sites, people and systems it covers.",
    })
    expect(headingsKept(original, final).passed).toBe(false)
  })

  it("fails a heading that was emptied or broken over two lines", () => {
    expect(headingsKept(original, changeTexts(original, { "9": "" })).passed).toBe(false)
    expect(headingsKept(original, changeTexts(original, { "9": "Scope\nDetails" })).passed).toBe(false)
  })

  it("allows a translated heading that is longer than the original", () => {
    const final = changeTexts(original, { "4": "1. Zweck und Geltungsbereich", "9": "Geltungsbereich" })
    expect(headingsKept(original, final).passed).toBe(true)
  })
})

describe("tableCellsKept", () => {
  const original = [
    paragraph("23", "We propose the following schedule. All prices are net."),
    tableCell("26", "Phase", "r1c1"),
    tableCell("28", "Price", "r1c2"),
    tableCell("30", "Workshop", "r2c1"),
    tableCell("32", "EUR 3,600", "r2c2"),
    tableCell("42", "Total", "r3c1"),
    tableCell("44", "EUR 5,250", "r3c2"),
  ]

  it("fails a run that empties the pricing table", () => {
    const final = changeTexts(original, {
      "23": "Workshop EUR 3,600; total EUR 5,250, net.",
      "26": "",
      "28": "",
      "30": "",
      "32": "",
      "42": "",
      "44": "",
    })
    const result = tableCellsKept(original, final)
    expect(result.passed).toBe(false)
    expect(result.evidence).toHaveLength(6)
  })

  it("passes a run that shortens text but keeps every filled cell", () => {
    const final = changeTexts(original, { "23": "Schedule (net prices):", "30": "Workshop day" })
    expect(tableCellsKept(original, final).passed).toBe(true)
  })

  it("fails when a table loses a row", () => {
    const final = original.filter(({ nodeId }) => nodeId !== "42" && nodeId !== "44")
    expect(tableCellsKept(original, final).evidence[0].where).toBe("table shapes")
  })
})

describe("phrasesKept", () => {
  it("fails a rewrite that weakens 'the most common route' to 'a common vector'", () => {
    const final = [paragraph("180", "Email is a common vector for attacks on such companies.")]
    expect(phrasesKept(final, ["most common"]).passed).toBe(false)
  })

  it("passes a rewrite that keeps the phrase", () => {
    const final = [paragraph("180", "Email is the most common attack route for companies like ours.")]
    expect(phrasesKept(final, ["most common"]).passed).toBe(true)
  })
})

describe("lengthInRange", () => {
  const original = [paragraph("1", "a".repeat(100)), paragraph("2", "b".repeat(100))]
  const conciseRange = { min: 0.4, max: 0.95 }

  it("passes a concise rewrite that lands in the range", () => {
    const final = changeTexts(original, { "1": "a".repeat(60), "2": "b".repeat(80) })
    expect(lengthInRange(original, final, conciseRange).passed).toBe(true)
  })

  it("fails a 'concise' rewrite that is barely shorter", () => {
    const final = changeTexts(original, { "1": "a".repeat(98) })
    expect(lengthInRange(original, final, conciseRange).evidence[0].actual).toBe("99%")
  })

  it("fails a rewrite that cut too much", () => {
    expect(lengthInRange(original, changeTexts(original, { "1": "a", "2": "b" }), conciseRange).passed).toBe(false)
  })

  it("passes any length when the case sets no range", () => {
    expect(lengthInRange(original, changeTexts(original, { "1": "a" })).passed).toBe(true)
  })
})
