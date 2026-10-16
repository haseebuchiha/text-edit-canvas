import "server-only"
import { isObjectIdOrHexString, model } from "mongoose"
import { connectToDatabase, toRecord } from "@/db/client"
import type { NewChatMessage } from "@/db/schemas/chat-message"
import { type ChatSession, type ChatSessionSummary, chatSessionSchema } from "@/db/schemas/chat-session"

const ChatSessionModel = model("ChatSession", chatSessionSchema, undefined, { overwriteModels: true })

const sumTokens = (messages: NewChatMessage[], field: "inputTokens" | "outputTokens") =>
  messages.reduce((total, message) => total + (message[field] ?? 0), 0)

export const createChatSession = async (title?: string): Promise<ChatSession> => {
  await connectToDatabase()
  const session = await ChatSessionModel.create({ title })
  return toRecord(session.toObject())
}

export const findChatSessionById = async (id: string): Promise<ChatSession | null> => {
  if (!isObjectIdOrHexString(id)) return null
  await connectToDatabase()
  const session = await ChatSessionModel.findById(id).lean()
  return session ? toRecord(session) : null
}

export const listRecentChatSessions = async (limit: number): Promise<ChatSessionSummary[]> => {
  await connectToDatabase()
  const sessions = await ChatSessionModel.find({}, { messages: 0 }).sort({ updatedAt: -1 }).limit(limit).lean()
  return sessions.map(toRecord)
}

export const appendChatMessages = async (sessionId: string, messages: NewChatMessage[]): Promise<boolean> => {
  if (!isObjectIdOrHexString(sessionId)) return false
  await connectToDatabase()
  const update = await ChatSessionModel.updateOne(
    { _id: sessionId },
    {
      $push: { messages: { $each: messages } },
      $inc: {
        totalInputTokens: sumTokens(messages, "inputTokens"),
        totalOutputTokens: sumTokens(messages, "outputTokens"),
      },
    },
    { runValidators: true },
  )
  return update.matchedCount === 1
}
