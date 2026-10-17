import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai"
import { createGateway, type LanguageModel } from "ai"
import { readGatewayApiKey, readGatewayEnvironment, readProxyEnvironment } from "@/config/env"
import type { ChatModelId } from "@/lib/chat-models"

const PROXY_PROVIDER_NAME = "llm"
const NO_API_KEY = ""
const DEFAULT_PROXY_CHECK_MODEL = "gpt-6-luna"
const DEFAULT_GATEWAY_CHECK_MODEL = "openai/gpt-6-luna"
const GATEWAY_MODEL_PROVIDER = "openai"
const REASONING_EFFORT = "medium"
const TEXT_VERBOSITY = "medium"

type GatewayEnvironment = NonNullable<ReturnType<typeof readGatewayEnvironment>>
type ProxyEnvironment = NonNullable<ReturnType<typeof readProxyEnvironment>>

const pickMainGatewayModel = ({ AI_GATEWAY_MODEL }: GatewayEnvironment) => AI_GATEWAY_MODEL

const pickCheckGatewayModel = ({ AI_GATEWAY_CHECK_MODEL }: GatewayEnvironment) =>
  AI_GATEWAY_CHECK_MODEL ?? DEFAULT_GATEWAY_CHECK_MODEL

const pickMainProxyModel = ({ LLM_MODEL }: ProxyEnvironment) => LLM_MODEL

const pickCheckProxyModel = ({ LLM_CHECK_MODEL }: ProxyEnvironment) => LLM_CHECK_MODEL ?? DEFAULT_PROXY_CHECK_MODEL

const createGatewayModel = (pickModel: (environment: GatewayEnvironment) => string): LanguageModel | undefined => {
  const environment = readGatewayEnvironment()
  if (!environment) return undefined
  const provider = createGateway({ apiKey: environment.AI_GATEWAY_API_KEY })
  return provider.languageModel(pickModel(environment))
}

const createProxyModel = (pickModel: (environment: ProxyEnvironment) => string): LanguageModel | undefined => {
  const environment = readProxyEnvironment()
  if (!environment) return undefined
  const provider = createOpenAI({
    name: PROXY_PROVIDER_NAME,
    baseURL: environment.LLM_BASE_URL,
    apiKey: environment.LLM_API_KEY ?? NO_API_KEY,
  })
  return provider.responses(pickModel(environment))
}

export const createConfiguredModel = () =>
  readGatewayApiKey() ? createGatewayModel(pickMainGatewayModel) : createProxyModel(pickMainProxyModel)

export const createConfiguredCheckModel = () =>
  readGatewayApiKey() ? createGatewayModel(pickCheckGatewayModel) : createProxyModel(pickCheckProxyModel)

const toGatewayModelId = (modelId: ChatModelId) => `${GATEWAY_MODEL_PROVIDER}/${modelId}`

export const createChatModel = (modelId?: ChatModelId) => {
  if (!modelId) return createConfiguredModel()
  if (readGatewayApiKey()) return createGatewayModel(() => toGatewayModelId(modelId))
  return createProxyModel(() => modelId)
}

export const describeModel = (model: LanguageModel) => ({
  modelId: typeof model === "string" ? model : model.modelId,
  reasoningEffort: REASONING_EFFORT,
})

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
  checkModel?: LanguageModel
  providerOptions: ReturnType<typeof createModelOptions>
}
