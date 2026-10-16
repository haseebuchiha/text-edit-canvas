import mongoose from "mongoose"
import { POST } from "@/app/api/chat/sessions/route"
import { createChatSession, findChatSessionById } from "@/models/chat-sessions"

const TEST_DATABASE_NAME = "pryvet-test-chat-sessions-route"

const dropTestDatabase = async () => {
  const database = mongoose.connection.db
  if (database?.databaseName !== TEST_DATABASE_NAME) return
  await database.dropDatabase()
}

beforeAll(() => {
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${TEST_DATABASE_NAME}`
})

afterAll(async () => {
  await dropTestDatabase()
  await mongoose.disconnect()
})

describe("POST /api/chat/sessions", () => {
  it("creates an empty chat session and returns its id", async () => {
    const response = await POST()
    const body = await response.json()
    const session = await findChatSessionById(body.id)

    expect(response.status).toBe(201)
    expect(body).toEqual({ id: expect.stringMatching(/^[\da-f]{24}$/u) })
    expect(session).toMatchObject({ id: body.id, messages: [] })
  })

  it("creates a new session on every call and leaves earlier sessions as they were", async () => {
    const earlier = await createChatSession("Earlier chat")

    const first = await (await POST()).json()
    const second = await (await POST()).json()

    expect(first.id).not.toBe(second.id)
    expect(first.id).not.toBe(earlier.id)
    expect(await findChatSessionById(earlier.id)).toEqual(earlier)
  })
})
