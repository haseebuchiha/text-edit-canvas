import type { LanguageModel } from "ai"
import { createChatModel, createConfiguredModel, createModelOptions, describeModel } from "@/services/llm"

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

  it("uses the chosen model, as the bare id on the proxy and as openai/<id> on the gateway", () => {
    useEnvironment(PROXY_ENVIRONMENT)
    const proxyModel = createChatModel("gpt-6-luna")
    useEnvironment({ AI_GATEWAY_API_KEY: GATEWAY_KEY, AI_GATEWAY_MODEL: GATEWAY_MODEL })
    const gatewayModel = createChatModel("gpt-6-luna")

    expect(proxyModel).toMatchObject({ provider: "llm.responses", modelId: "gpt-6-luna" })
    expect(gatewayModel).toMatchObject({ provider: "gateway", modelId: "openai/gpt-6-luna" })
  })

  it("falls back to the configured model when no model is chosen", () => {
    useEnvironment(PROXY_ENVIRONMENT)

    expect(createChatModel()).toMatchObject({ provider: "llm.responses", modelId: PROXY_MODEL })
  })

  it("describes a model by its id and the fixed medium reasoning effort", () => {
    useEnvironment(PROXY_ENVIRONMENT)

    expect(describeModel(requireModel(createChatModel("gpt-6-luna")))).toEqual({
      modelId: "gpt-6-luna",
      reasoningEffort: "medium",
    })
  })

  it("is not configured when the proxy URL is not a URL", () => {
    useEnvironment({ LLM_BASE_URL: "not a url", LLM_MODEL: PROXY_MODEL })

    expect(createConfiguredModel()).toBeUndefined()
  })
})
