import mongoose from "mongoose"
import type { NewChatMessage } from "@/db/schemas/chat-message"
import {
  appendChatMessages,
  createChatSession,
  findChatSessionById,
  listRecentChatSessions,
} from "@/models/chat-sessions"

const TEST_DATABASE_NAME = "pryvet-test"
const INVALID_ID = "not-an-object-id"
const MISSING_ID = new mongoose.Types.ObjectId().toHexString()

const userMessage: NewChatMessage = {
  id: "message-user-1",
  role: "user",
  parts: [{ type: "text", text: "Plan a weekend in Lisbon" }],
  inputTokens: 12,
}

const assistantMessage: NewChatMessage = {
  id: "message-assistant-1",
  role: "assistant",
  parts: [{ type: "text", text: "Here is a two-day plan." }],
  inputTokens: 30,
  outputTokens: 8,
  modelId: "gpt-6-luna",
  reasoningEffort: "medium",
}

const followUpMessage: NewChatMessage = {
  id: "message-assistant-2",
  role: "assistant",
  parts: [{ type: "text", text: "Want restaurant ideas too?" }],
  outputTokens: 5,
}

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

describe("chat sessions model", () => {
  it("creates a session with defaults and returns a plain record", async () => {
    const session = await createChatSession()

    expect(session.id).toMatch(/^[\da-f]{24}$/u)
    expect(session).not.toHaveProperty("_id")
    expect(session).toMatchObject({ title: "Untitled", messages: [], totalInputTokens: 0, totalOutputTokens: 0 })
    expect(session.createdAt).toBeInstanceOf(Date)
    expect(await createChatSession("Lisbon trip")).toMatchObject({ title: "Lisbon trip" })
  })

  it("appends messages, stamps their createdAt and increments the token totals", async () => {
    const { id } = await createChatSession()

    expect(await appendChatMessages(id, [userMessage, assistantMessage])).toBe(true)
    expect(await appendChatMessages(id, [followUpMessage])).toBe(true)

    const session = await findChatSessionById(id)

    expect(session).toMatchObject({ totalInputTokens: 42, totalOutputTokens: 13 })
    expect(session?.messages).toMatchObject([userMessage, assistantMessage, followUpMessage])
    expect(session?.messages.map((message) => message.createdAt)).toEqual([
      expect.any(Date),
      expect.any(Date),
      expect.any(Date),
    ])
  })

  it("finds a session with its messages", async () => {
    const { id } = await createChatSession("With messages")
    await appendChatMessages(id, [userMessage])

    const session = await findChatSessionById(id)

    expect(session).toMatchObject({ id, title: "With messages", messages: [userMessage] })
  })

  it("lists recent sessions newest first, without messages", async () => {
    const { id } = await createChatSession("Listed")
    await appendChatMessages(id, [userMessage])

    const sessions = await listRecentChatSessions(50)
    const updatedTimes = sessions.map((session) => session.updatedAt.getTime())

    expect(sessions.map((session) => session.id)).toContain(id)
    expect(sessions.some((session) => "messages" in session)).toBe(false)
    expect(updatedTimes).toEqual(updatedTimes.toSorted((left, right) => right - left))
    expect(await listRecentChatSessions(1)).toHaveLength(1)
  })

  it("returns null or false for an invalid or unknown id instead of throwing", async () => {
    expect(await findChatSessionById(INVALID_ID)).toBeNull()
    expect(await appendChatMessages(INVALID_ID, [userMessage])).toBe(false)
    expect(await findChatSessionById(MISSING_ID)).toBeNull()
    expect(await appendChatMessages(MISSING_ID, [userMessage])).toBe(false)
  })
})
