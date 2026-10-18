import { CHAT_MODELS, describeRelativeCost, listProviderDefaults } from "@/lib/chat-models"

const MAX_MODELS_PER_PROVIDER = 4

const countProviderModels = (provider: string) => CHAT_MODELS.filter((model) => model.provider === provider).length

describe("chat models", () => {
  it("keeps each provider's cheap model as its default, first in its submenu", () => {
    const defaults = listProviderDefaults([...CHAT_MODELS]).map(({ provider, id }) => [provider, id])

    expect(defaults).toEqual([
      ["GPT", "gpt-6-luna"],
      ["Claude", "claude-haiku-5.5"],
      ["Gemini", "gemini-3.8-flash"],
      ["DeepSeek", "deepseek-v4.1-flash"],
      ["Grok", "grok-4.3"],
    ])
  })

  it("offers at most four models per provider", () => {
    const counts = listProviderDefaults([...CHAT_MODELS]).map(({ provider }) => countProviderModels(provider))

    expect(counts.every((count) => count <= MAX_MODELS_PER_PROVIDER)).toBe(true)
  })

  it("describes cost relative to gpt-6-luna for a million input and a million output tokens", () => {
    const hints = Object.fromEntries(CHAT_MODELS.map((model) => [model.id, describeRelativeCost(model)]))

    expect(hints).toMatchObject({
      "gpt-6-luna": "1×",
      "gpt-6.1-sol": "20×",
      "claude-opus-5.5": "40×",
      "grok-4.7": "13×",
      "gpt-5.6-luna": "2.3×",
      "deepseek-v4-flash": "0.65×",
    })
  })
})
