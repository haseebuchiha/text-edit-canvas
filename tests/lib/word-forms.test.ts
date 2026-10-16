import { detectWordLanguage, findWordForm } from "@/lib/word-forms"

describe("findWordForm", () => {
  it("finds the singular of a plural", () => {
    expect(findWordForm("We sign our customer contracts.", "customers", "english")).toBe("customer")
  })

  it("finds a possessive", () => {
    expect(findWordForm("The customer's order is late.", "customers", "english")).toBe("customer's")
  })

  it("finds a plural ending in ies", () => {
    expect(findWordForm("Both policies apply.", "policy", "english")).toBe("policies")
  })

  it("finds every word of a phrase in another form", () => {
    expect(findWordForm("We met them at the Trade Fair in May.", "trade fairs", "english")).toBe("Trade Fair")
  })

  it("ignores a word that only shares the start of the other", () => {
    expect(findWordForm("Our clients use custom fields.", "customer", "english")).toBeUndefined()
  })

  it("ignores a phrase whose words are not next to each other", () => {
    expect(findWordForm("The trade show at the fair.", "trade fairs", "english")).toBeUndefined()
  })

  it("finds a German plural with an umlaut", () => {
    expect(findWordForm("Die Verträge liegen vor.", "Vertrag", "german")).toBe("Verträge")
  })

  it("finds a German form with a different ending", () => {
    expect(findWordForm("Der Kunde zahlt.", "Kunden", "german")).toBe("Kunde")
  })
})

describe("detectWordLanguage", () => {
  it("detects English text", () => {
    expect(detectWordLanguage(["The customer signs the contract and pays."])).toBe("english")
  })

  it("detects German text", () => {
    expect(detectWordLanguage(["Der Kunde unterschreibt den Vertrag und zahlt die Rechnung."])).toBe("german")
  })
})
