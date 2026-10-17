import mongoose from "mongoose"
import { POST } from "@/app/api/chat/route"
import { createChatSession, findChatSessionById } from "@/models/chat-sessions"

const TEST_DATABASE_NAME = "pryvet-test-chat-route"
const CONFIGURED_MODEL = "configured-env-model"

const PROXY_ENVIRONMENT = {
  AI_GATEWAY_API_KEY: "",
  LLM_BASE_URL: "http://127.0.0.1:1/v1",
  LLM_API_KEY: "",
  LLM_MODEL: CONFIGURED_MODEL,
}

const GATEWAY_ENVIRONMENT = {
  AI_GATEWAY_API_KEY: "test-gateway-key",
  AI_GATEWAY_MODEL: "openai/gpt-6-luna",
  LLM_BASE_URL: "",
  LLM_MODEL: "",
}

const originalEnvironment = process.env

const postChat = (body: object) =>
  POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }))

const chatRequest = (sessionId: string, model?: string) => ({
  id: sessionId,
  message: { id: "user-message-1", role: "user", parts: [{ type: "text", text: "Hi" }] },
  model,
})

const blockNetwork = () => jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network in tests."))

const readRequestedModel = (fetchSpy: ReturnType<typeof blockNetwork>) =>
  JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)).model

const refuseAtGateway = () =>
  jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({ error: "No network in tests." }, { status: 400 }))

const readRequestedGatewayModel = (fetchSpy: ReturnType<typeof refuseAtGateway>) =>
  new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get("ai-language-model-id")

const useGateway = () => {
  process.env = { ...process.env, ...GATEWAY_ENVIRONMENT }
}

const dropTestDatabase = async () => {
  const database = mongoose.connection.db
  if (database?.databaseName !== TEST_DATABASE_NAME) return
  await database.dropDatabase()
}

beforeAll(() => {
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${TEST_DATABASE_NAME}`
})

beforeEach(() => {
  process.env = { ...originalEnvironment, MONGODB_URI: process.env.MONGODB_URI, ...PROXY_ENVIRONMENT }
})

afterEach(() => {
  jest.restoreAllMocks()
})

afterAll(async () => {
  process.env = originalEnvironment
  await dropTestDatabase()
  await mongoose.disconnect()
})

describe("POST /api/chat", () => {
  it("answers 400 for a model outside the allowed list, without calling the provider or saving", async () => {
    const { id } = await createChatSession()
    const fetchSpy = blockNetwork()

    const response = await postChat(chatRequest(id, "gpt-6-astra"))

    expect(response.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect((await findChatSessionById(id))?.messages).toEqual([])
  })

  it("answers 400 for a model the proxy does not serve, without calling the provider or saving", async () => {
    const { id } = await createChatSession()
    const fetchSpy = blockNetwork()

    const responses = await Promise.all([
      postChat(chatRequest(id, "claude-haiku-5.5")),
      postChat(chatRequest(id, "gemini-4-argon")),
    ])

    expect(responses.map(({ status }) => status)).toEqual([400, 400])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect((await findChatSessionById(id))?.messages).toEqual([])
  })

  it("answers 400 on the gateway for a model left out of the menu, without calling the provider", async () => {
    useGateway()
    const { id } = await createChatSession()
    const fetchSpy = refuseAtGateway()

    const responses = await Promise.all([
      postChat(chatRequest(id, "claude-fable-5.1")),
      postChat(chatRequest(id, "gpt-6-astra-fast")),
    ])

    expect(responses.map(({ status }) => status)).toEqual([400, 400])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("sends a submenu model to the gateway under its gateway id and labels it with default thinking", async () => {
    useGateway()
    const { id } = await createChatSession()
    const fetchSpy = refuseAtGateway()

    const body = await (await postChat(chatRequest(id, "gemini-4-argon"))).text()

    expect(readRequestedGatewayModel(fetchSpy)).toBe("google/gemini-4-argon")
    expect(body).toContain('"messageMetadata":{"modelId":"google/gemini-4-argon","reasoningEffort":"default"}')
  })

  it("sends gpt-6.1-sol to the gateway as openai/gpt-6.1-sol and labels it with medium thinking", async () => {
    useGateway()
    const { id } = await createChatSession()
    const fetchSpy = refuseAtGateway()

    const body = await (await postChat(chatRequest(id, "gpt-6.1-sol"))).text()

    expect(readRequestedGatewayModel(fetchSpy)).toBe("openai/gpt-6.1-sol")
    expect(body).toContain('"messageMetadata":{"modelId":"openai/gpt-6.1-sol","reasoningEffort":"medium"}')
  })

  it("sends a non-OpenAI model to the gateway under its gateway id and labels it with default thinking", async () => {
    useGateway()
    const { id } = await createChatSession()
    const fetchSpy = refuseAtGateway()

    const body = await (await postChat(chatRequest(id, "claude-haiku-5.5"))).text()

    expect(readRequestedGatewayModel(fetchSpy)).toBe("anthropic/claude-haiku-5.5")
    expect(body).toContain('"messageMetadata":{"modelId":"anthropic/claude-haiku-5.5","reasoningEffort":"default"}')
  })

  it("sends GPT to the gateway as openai/<id> and labels it with medium thinking", async () => {
    useGateway()
    const { id } = await createChatSession()
    const fetchSpy = refuseAtGateway()

    const body = await (await postChat(chatRequest(id, "gpt-6-luna"))).text()

    expect(readRequestedGatewayModel(fetchSpy)).toBe("openai/gpt-6-luna")
    expect(body).toContain('"messageMetadata":{"modelId":"openai/gpt-6-luna","reasoningEffort":"medium"}')
  })

  it("sends the chosen model to the provider", async () => {
    const { id } = await createChatSession()
    const fetchSpy = blockNetwork()

    await (await postChat(chatRequest(id, "gpt-6-luna"))).text()

    expect(readRequestedModel(fetchSpy)).toBe("gpt-6-luna")
  })

  it("sends a GPT submenu model to the proxy under its bare id", async () => {
    const { id } = await createChatSession()
    const fetchSpy = blockNetwork()

    await (await postChat(chatRequest(id, "gpt-6.1-sol"))).text()

    expect(readRequestedModel(fetchSpy)).toBe("gpt-6.1-sol")
  })

  it("falls back to the configured model when the request names none", async () => {
    const { id } = await createChatSession()
    const fetchSpy = blockNetwork()

    await (await postChat(chatRequest(id))).text()

    expect(readRequestedModel(fetchSpy)).toBe(CONFIGURED_MODEL)
  })
})
