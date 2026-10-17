export const CHAT_MODELS = [
  { value: "gpt-6-luna", label: "gpt-6-luna · cheapest" },
  { value: "gpt-6.1-sol", label: "gpt-6.1-sol · about 19x the cost" },
] as const

export type ChatModelId = (typeof CHAT_MODELS)[number]["value"]

export const CHAT_MODEL_IDS = CHAT_MODELS.map(({ value }) => value)

export const DEFAULT_CHAT_MODEL_ID: ChatModelId = "gpt-6-luna"
