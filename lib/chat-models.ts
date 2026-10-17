import { CLAUDE_LOGO, DEEPSEEK_LOGO, GEMINI_LOGO, GROK_LOGO, OPENAI_LOGO } from "@/lib/provider-logos"

export const CHAT_MODELS = [
  { id: "gpt-6-luna", name: "GPT", logo: OPENAI_LOGO, gatewayModelId: "openai/gpt-6-luna" },
  { id: "claude-haiku-5.5", name: "Claude", logo: CLAUDE_LOGO, gatewayModelId: "anthropic/claude-haiku-5.5" },
  { id: "gemini-3.8-flash", name: "Gemini", logo: GEMINI_LOGO, gatewayModelId: "google/gemini-3.8-flash" },
  { id: "deepseek-v4.1-flash", name: "DeepSeek", logo: DEEPSEEK_LOGO, gatewayModelId: "deepseek/deepseek-v4.1-flash" },
  { id: "grok-4.1-fast-reasoning", name: "Grok", logo: GROK_LOGO, gatewayModelId: "spacexai/grok-4.1-fast-reasoning" },
] as const

export type ChatModel = (typeof CHAT_MODELS)[number]

export type ChatModelId = ChatModel["id"]

export const CHAT_MODEL_IDS = CHAT_MODELS.map(({ id }) => id)

export const DEFAULT_CHAT_MODEL_ID: ChatModelId = "gpt-6-luna"
