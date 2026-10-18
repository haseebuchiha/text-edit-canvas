import type { LanguageModel } from "ai"
import { CHAT_MODELS, type ChatModel } from "@/lib/chat-models"
import {
  createChatModel,
  createConfiguredCheckModel,
  createConfiguredModel,
  createModelOptions,
  describeModel,
  isChatModelAvailable,
  listAvailableChatModels,
} from "@/services/llm"

const GATEWAY_KEY = "test-gateway-key"
const GATEWAY_MODEL = "openai/gpt-5.6-luna"
const PROXY_URL = "http://127.0.0.1:10531/v1"
const PROXY_MODEL = "gpt-5.6-luna"
const SESSION_ID = "chat-session-1"

const UNSET_MODEL_ENVIRONMENT = {
  OPENAI_API_KEY: "",
  AI_GATEWAY_API_KEY: "",
  AI_GATEWAY_MODEL: "",
  LLM_BASE_URL: "",
  LLM_API_KEY: "",
  LLM_MODEL: "",
}

const PROXY_ENVIRONMENT = { LLM_BASE_URL: PROXY_URL, LLM_MODEL: PROXY_MODEL }

const GATEWAY_ENVIRONMENT = { AI_GATEWAY_API_KEY: GATEWAY_KEY, AI_GATEWAY_MODEL: GATEWAY_MODEL }

const PROXY_CHAT_MODEL_IDS = ["gpt-6-luna", "gpt-6.1-sol", "gpt-6-sol", "gpt-5.6-luna"] as const

const GATEWAY_CHAT_MODEL_IDS = [
  "openai/gpt-6-luna",
  "openai/gpt-6.1-sol",
  "openai/gpt-6-sol",
  "openai/gpt-5.6-luna",
  "anthropic/claude-haiku-5.5",
  "anthropic/claude-sonnet-5.5",
  "anthropic/claude-opus-5.5",
  "anthropic/claude-opus-5",
  "google/gemini-3.8-flash",
  "google/gemini-4-argon",
  "google/gemini-3.7-flash",
  "google/gemini-3.5-flash-lite",
  "deepseek/deepseek-v4.1-flash",
  "deepseek/deepseek-v4-flash-vision-exp",
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v3.1",
  "spacexai/grok-4.3",
  "spacexai/grok-4.7",
  "spacexai/grok-4.6",
  "spacexai/grok-4.5",
]

const isOpenAIChatModel = ({ gatewayModelId }: ChatModel) => gatewayModelId.startsWith("openai/")

const readChatModelIds = (models: ChatModel[]) => models.map(({ id }) => id)

const originalEnvironment = process.env

const useEnvironment = (settings: Record<string, string>) => {
  process.env = { ...originalEnvironment, ...UNSET_MODEL_ENVIRONMENT, ...settings }
}

const requireModel = (model: LanguageModel | undefined) => {
  if (!model || typeof model === "string") throw new Error("Expected a configured language model.")
  return model
}

const captureFirstRequest = async (model: LanguageModel | undefined) => {
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network in tests."))
  const prompt = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hi" }] }]
  const providerOptions = createModelOptions(SESSION_ID)
  await Promise.allSettled([requireModel(model).doStream({ prompt, providerOptions })])
  const [url, options] = fetchSpy.mock.calls[0]
  fetchSpy.mockRestore()
  return { url: String(url), headers: new Headers(options?.headers), body: JSON.parse(String(options?.body)) }
}

afterEach(() => {
  process.env = originalEnvironment
})

describe("llm service", () => {
  it("uses the AI Gateway when AI_GATEWAY_API_KEY is set, even with the proxy configured", async () => {
    useEnvironment({ AI_GATEWAY_API_KEY: GATEWAY_KEY, AI_GATEWAY_MODEL: GATEWAY_MODEL, ...PROXY_ENVIRONMENT })

    const model = requireModel(createConfiguredModel())
    const request = await captureFirstRequest(model)

    expect(model).toMatchObject({ provider: "gateway", modelId: GATEWAY_MODEL })
    expect(request.url).toMatch(/^https:\/\/ai-gateway\.vercel\.sh\//u)
    expect(request.headers.get("authorization")).toBe(`Bearer ${GATEWAY_KEY}`)
    expect(request.body).toMatchObject({ providerOptions: createModelOptions(SESSION_ID) })
    expect(request.body.providerOptions.gateway).toEqual({ caching: "auto" })
  })

  it("uses the proxy's Responses endpoint when AI_GATEWAY_API_KEY is blank, sending no API key", async () => {
    useEnvironment({
      AI_GATEWAY_API_KEY: "  ",
      AI_GATEWAY_MODEL: GATEWAY_MODEL,
      OPENAI_API_KEY: "unrelated-key",
      ...PROXY_ENVIRONMENT,
    })

    const model = requireModel(createConfiguredModel())
    const request = await captureFirstRequest(model)

    expect(model).toMatchObject({ provider: "llm.responses", modelId: PROXY_MODEL })
    expect(request.url).toBe(`${PROXY_URL}/responses`)
    expect(request.headers.get("authorization")).toBe("Bearer")
    expect(request.body).toMatchObject({ model: PROXY_MODEL, stream: true })
  })

  it("asks for medium effort and verbosity, no storage, the session's cache key and parallel tool calls", async () => {
    useEnvironment(PROXY_ENVIRONMENT)

    const request = await captureFirstRequest(createConfiguredModel())

    expect(request.body).toMatchObject({
      reasoning: { effort: "medium" },
      text: { verbosity: "medium" },
      store: false,
      include: ["reasoning.encrypted_content"],
      prompt_cache_key: SESSION_ID,
      parallel_tool_calls: true,
    })
  })

  it("sends LLM_API_KEY to the proxy when it is set", async () => {
    useEnvironment({ ...PROXY_ENVIRONMENT, LLM_API_KEY: "proxy-key" })

    const request = await captureFirstRequest(createConfiguredModel())

    expect(request.headers.get("authorization")).toBe("Bearer proxy-key")
  })

  it("is not configured when neither the gateway nor the proxy is set", () => {
    useEnvironment({})

    expect(createConfiguredModel()).toBeUndefined()
  })

  it("is not configured, rather than falling back to the proxy, when the gateway key has no valid model", () => {
    useEnvironment({ AI_GATEWAY_API_KEY: GATEWAY_KEY, ...PROXY_ENVIRONMENT })
    const withoutModel = createConfiguredModel()
    useEnvironment({ AI_GATEWAY_API_KEY: GATEWAY_KEY, AI_GATEWAY_MODEL: PROXY_MODEL, ...PROXY_ENVIRONMENT })
    const withBareModel = createConfiguredModel()

    expect(withoutModel).toBeUndefined()
    expect(withBareModel).toBeUndefined()
  })

  it("uses the chosen model, as the bare id on the proxy and as its gateway model id on the gateway", () => {
    useEnvironment(PROXY_ENVIRONMENT)
    const proxyModels = PROXY_CHAT_MODEL_IDS.map((id) => requireModel(createChatModel(id)))
    useEnvironment(GATEWAY_ENVIRONMENT)
    const gatewayModel = createChatModel("gpt-6.1-sol")

    expect(proxyModels.map(({ provider }) => provider)).toEqual(PROXY_CHAT_MODEL_IDS.map(() => "llm.responses"))
    expect(proxyModels.map(({ modelId }) => modelId)).toEqual(PROXY_CHAT_MODEL_IDS)
    expect(gatewayModel).toMatchObject({ provider: "gateway", modelId: "openai/gpt-6.1-sol" })
  })

  it("creates every chat model on the gateway under its gateway model id", () => {
    useEnvironment(GATEWAY_ENVIRONMENT)

    const gatewayModelIds = CHAT_MODELS.map(({ id }) => requireModel(createChatModel(id)).modelId)

    expect(gatewayModelIds).toEqual(GATEWAY_CHAT_MODEL_IDS)
  })

  it("offers every chat model on the gateway and only the OpenAI ones the proxy serves on the proxy", () => {
    useEnvironment(GATEWAY_ENVIRONMENT)
    const onGateway = readChatModelIds(listAvailableChatModels())
    useEnvironment(PROXY_ENVIRONMENT)
    const onProxy = readChatModelIds(listAvailableChatModels())

    expect(onGateway).toEqual(GATEWAY_CHAT_MODEL_IDS.map((gatewayModelId) => gatewayModelId.split("/")[1]))
    expect(onProxy).toEqual(PROXY_CHAT_MODEL_IDS)
  })

  it("treats a model as available only on a path that serves it, and no chosen model as always available", () => {
    useEnvironment(PROXY_ENVIRONMENT)
    const claudeOnProxy = isChatModelAvailable("claude-sonnet-5.5")
    const gptOnProxy = PROXY_CHAT_MODEL_IDS.map((id) => isChatModelAvailable(id))
    const noneOnProxy = isChatModelAvailable()
    useEnvironment(GATEWAY_ENVIRONMENT)
    const claudeOnGateway = isChatModelAvailable("claude-sonnet-5.5")

    expect(claudeOnProxy).toBe(false)
    expect(gptOnProxy).toEqual([true, true, true, true])
    expect(noneOnProxy).toBe(true)
    expect(claudeOnGateway).toBe(true)
  })

  it("has no separate check model unless one is set, so rewrites check on the chat's own model", () => {
    useEnvironment(GATEWAY_ENVIRONMENT)
    const unset = createConfiguredCheckModel()
    useEnvironment({ ...GATEWAY_ENVIRONMENT, AI_GATEWAY_CHECK_MODEL: "openai/gpt-6.1-sol" })
    const gatewayCheck = createConfiguredCheckModel()
    useEnvironment({ ...PROXY_ENVIRONMENT, LLM_CHECK_MODEL: "gpt-6.1-sol" })
    const proxyCheck = createConfiguredCheckModel()

    expect(unset).toBeUndefined()
    expect(gatewayCheck).toMatchObject({ provider: "gateway", modelId: "openai/gpt-6.1-sol" })
    expect(proxyCheck).toMatchObject({ provider: "llm.responses", modelId: "gpt-6.1-sol" })
  })

  it("falls back to the configured model when no model is chosen", () => {
    useEnvironment(PROXY_ENVIRONMENT)

    expect(createChatModel()).toMatchObject({ provider: "llm.responses", modelId: PROXY_MODEL })
  })

  it("describes OpenAI models with the medium effort they are sent and other models with default thinking", () => {
    useEnvironment(PROXY_ENVIRONMENT)
    const gptOnProxy = describeModel(requireModel(createChatModel("gpt-6.1-sol")))
    useEnvironment(GATEWAY_ENVIRONMENT)
    const describeChatModel = ({ id }: ChatModel) => describeModel(requireModel(createChatModel(id)))
    const gptEfforts = CHAT_MODELS.filter(isOpenAIChatModel).map((model) => describeChatModel(model).reasoningEffort)
    const otherEfforts = CHAT_MODELS.filter((model) => !isOpenAIChatModel(model)).map(
      (model) => describeChatModel(model).reasoningEffort,
    )

    expect(gptOnProxy).toEqual({ modelId: "gpt-6.1-sol", reasoningEffort: "medium" })
    expect(describeModel(requireModel(createChatModel("gpt-6.1-sol")))).toEqual({
      modelId: "openai/gpt-6.1-sol",
      reasoningEffort: "medium",
    })
    expect(describeModel(requireModel(createChatModel("gemini-4-argon")))).toEqual({
      modelId: "google/gemini-4-argon",
      reasoningEffort: "default",
    })
    expect(gptEfforts).toEqual(["medium", "medium", "medium", "medium"])
    expect(otherEfforts).toEqual(Array.from({ length: 16 }, () => "default"))
  })

  it("is not configured when the proxy URL is not a URL", () => {
    useEnvironment({ LLM_BASE_URL: "not a url", LLM_MODEL: PROXY_MODEL })

    expect(createConfiguredModel()).toBeUndefined()
  })
})
