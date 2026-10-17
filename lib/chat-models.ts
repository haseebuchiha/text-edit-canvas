import { CLAUDE_LOGO, DEEPSEEK_LOGO, GEMINI_LOGO, GROK_LOGO, OPENAI_LOGO } from "@/lib/provider-logos"

const COST_SIGNIFICANT_DIGITS = 2

export const CHAT_MODELS = [
  {
    id: "gpt-6-luna",
    provider: "GPT",
    name: "6 luna",
    logo: OPENAI_LOGO,
    gatewayModelId: "openai/gpt-6-luna",
    pricePerMillionTokens: { input: 0.1, output: 0.5 },
  },
  {
    id: "gpt-6.1-sol",
    provider: "GPT",
    name: "6.1 sol",
    logo: OPENAI_LOGO,
    gatewayModelId: "openai/gpt-6.1-sol",
    pricePerMillionTokens: { input: 2, output: 10 },
  },
  {
    id: "gpt-6-sol",
    provider: "GPT",
    name: "6 sol",
    logo: OPENAI_LOGO,
    gatewayModelId: "openai/gpt-6-sol",
    pricePerMillionTokens: { input: 2, output: 10 },
  },
  {
    id: "gpt-5.6-luna",
    provider: "GPT",
    name: "5.6 luna",
    logo: OPENAI_LOGO,
    gatewayModelId: "openai/gpt-5.6-luna",
    pricePerMillionTokens: { input: 0.2, output: 1.2 },
  },
  {
    id: "claude-haiku-5.5",
    provider: "Claude",
    name: "haiku 5.5",
    logo: CLAUDE_LOGO,
    gatewayModelId: "anthropic/claude-haiku-5.5",
    pricePerMillionTokens: { input: 0.1, output: 0.5 },
  },
  {
    id: "claude-sonnet-5.5",
    provider: "Claude",
    name: "sonnet 5.5",
    logo: CLAUDE_LOGO,
    gatewayModelId: "anthropic/claude-sonnet-5.5",
    pricePerMillionTokens: { input: 2, output: 10 },
  },
  {
    id: "claude-opus-5.5",
    provider: "Claude",
    name: "opus 5.5",
    logo: CLAUDE_LOGO,
    gatewayModelId: "anthropic/claude-opus-5.5",
    pricePerMillionTokens: { input: 4, output: 20 },
  },
  {
    id: "claude-opus-5",
    provider: "Claude",
    name: "opus 5",
    logo: CLAUDE_LOGO,
    gatewayModelId: "anthropic/claude-opus-5",
    pricePerMillionTokens: { input: 5, output: 25 },
  },
  {
    id: "gemini-3.8-flash",
    provider: "Gemini",
    name: "3.8 flash",
    logo: GEMINI_LOGO,
    gatewayModelId: "google/gemini-3.8-flash",
    pricePerMillionTokens: { input: 0.75, output: 3.75 },
  },
  {
    id: "gemini-4-argon",
    provider: "Gemini",
    name: "4 argon",
    logo: GEMINI_LOGO,
    gatewayModelId: "google/gemini-4-argon",
    pricePerMillionTokens: { input: 2, output: 10 },
  },
  {
    id: "gemini-3.7-flash",
    provider: "Gemini",
    name: "3.7 flash",
    logo: GEMINI_LOGO,
    gatewayModelId: "google/gemini-3.7-flash",
    pricePerMillionTokens: { input: 0.75, output: 3.75 },
  },
  {
    id: "gemini-3.5-flash-lite",
    provider: "Gemini",
    name: "3.5 flash lite",
    logo: GEMINI_LOGO,
    gatewayModelId: "google/gemini-3.5-flash-lite",
    pricePerMillionTokens: { input: 0.3, output: 2.5 },
  },
  {
    id: "deepseek-v4.1-flash",
    provider: "DeepSeek",
    name: "v4.1 flash",
    logo: DEEPSEEK_LOGO,
    gatewayModelId: "deepseek/deepseek-v4.1-flash",
    pricePerMillionTokens: { input: 0.3, output: 1.2 },
  },
  {
    id: "deepseek-v4-flash-vision-exp",
    provider: "DeepSeek",
    name: "v4 flash vision exp",
    logo: DEEPSEEK_LOGO,
    gatewayModelId: "deepseek/deepseek-v4-flash-vision-exp",
    pricePerMillionTokens: { input: 0.2156, output: 0.6468 },
  },
  {
    id: "deepseek-v4-flash",
    provider: "DeepSeek",
    name: "v4 flash",
    logo: DEEPSEEK_LOGO,
    gatewayModelId: "deepseek/deepseek-v4-flash",
    pricePerMillionTokens: { input: 0.13, output: 0.26 },
  },
  {
    id: "deepseek-v3.1",
    provider: "DeepSeek",
    name: "v3.1",
    logo: DEEPSEEK_LOGO,
    gatewayModelId: "deepseek/deepseek-v3.1",
    pricePerMillionTokens: { input: 0.25, output: 0.95 },
  },
  {
    id: "grok-4.1-fast-reasoning",
    provider: "Grok",
    name: "4.1 fast reasoning",
    logo: GROK_LOGO,
    gatewayModelId: "spacexai/grok-4.1-fast-reasoning",
    pricePerMillionTokens: { input: 0.2, output: 0.5 },
  },
  {
    id: "grok-4.7",
    provider: "Grok",
    name: "4.7",
    logo: GROK_LOGO,
    gatewayModelId: "spacexai/grok-4.7",
    pricePerMillionTokens: { input: 2, output: 6 },
  },
  {
    id: "grok-4.6",
    provider: "Grok",
    name: "4.6",
    logo: GROK_LOGO,
    gatewayModelId: "spacexai/grok-4.6",
    pricePerMillionTokens: { input: 2, output: 6 },
  },
  {
    id: "grok-4.5",
    provider: "Grok",
    name: "4.5",
    logo: GROK_LOGO,
    gatewayModelId: "spacexai/grok-4.5",
    pricePerMillionTokens: { input: 2, output: 6 },
  },
] as const

export type ChatModel = (typeof CHAT_MODELS)[number]

export type ChatModelId = ChatModel["id"]

export const CHAT_MODEL_IDS = CHAT_MODELS.map(({ id }) => id)

const [DEFAULT_CHAT_MODEL] = CHAT_MODELS

export const DEFAULT_CHAT_MODEL_ID: ChatModelId = DEFAULT_CHAT_MODEL.id

const isFirstOfProvider = (model: ChatModel, index: number, models: ChatModel[]) =>
  models.findIndex(({ provider }) => provider === model.provider) === index

export const listProviderDefaults = (models: ChatModel[]) => models.filter(isFirstOfProvider)

const sumPricePerMillionTokens = ({ pricePerMillionTokens: { input, output } }: ChatModel) => input + output

export const describeRelativeCost = (model: ChatModel) => {
  const relativeCost = sumPricePerMillionTokens(model) / sumPricePerMillionTokens(DEFAULT_CHAT_MODEL)
  return `${Number(relativeCost.toPrecision(COST_SIGNIFICANT_DIGITS))}×`
}
