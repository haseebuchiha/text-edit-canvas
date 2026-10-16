import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai"
import { createGateway, type LanguageModel } from "ai"
import { readGatewayApiKey, readGatewayEnvironment, readProxyEnvironment } from "@/config/env"

const PROXY_PROVIDER_NAME = "llm"
const NO_API_KEY = ""
const REASONING_EFFORT = "medium"
const TEXT_VERBOSITY = "medium"

const createGatewayModel = (): LanguageModel | undefined => {
  const environment = readGatewayEnvironment()
  if (!environment) return undefined
  const provider = createGateway({ apiKey: environment.AI_GATEWAY_API_KEY })
  return provider.languageModel(environment.AI_GATEWAY_MODEL)
}

const createProxyModel = (): LanguageModel | undefined => {
  const environment = readProxyEnvironment()
  if (!environment) return undefined
  const provider = createOpenAI({
    name: PROXY_PROVIDER_NAME,
    baseURL: environment.LLM_BASE_URL,
    apiKey: environment.LLM_API_KEY ?? NO_API_KEY,
  })
  return provider.responses(environment.LLM_MODEL)
}

export const createConfiguredModel = () => (readGatewayApiKey() ? createGatewayModel() : createProxyModel())

export const createModelOptions = (cacheKey: string) => ({
  openai: {
    reasoningEffort: REASONING_EFFORT,
    textVerbosity: TEXT_VERBOSITY,
    store: false,
    promptCacheKey: cacheKey,
    parallelToolCalls: true,
  } satisfies OpenAILanguageModelResponsesOptions,
})

export type ModelSettings = {
  model: LanguageModel
  providerOptions: ReturnType<typeof createModelOptions>
}
