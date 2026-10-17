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

  it("sends the chosen model to the provider", async () => {
    const { id } = await createChatSession()
    const fetchSpy = blockNetwork()

    await (await postChat(chatRequest(id, "gpt-6-luna"))).text()

    expect(readRequestedModel(fetchSpy)).toBe("gpt-6-luna")
  })

  it("falls back to the configured model when the request names none", async () => {
    const { id } = await createChatSession()
    const fetchSpy = blockNetwork()

    await (await postChat(chatRequest(id))).text()

    expect(readRequestedModel(fetchSpy)).toBe(CONFIGURED_MODEL)
  })
})
