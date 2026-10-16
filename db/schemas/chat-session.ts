import "server-only"
import { type InferSchemaType, Schema } from "mongoose"
import type { DatabaseRecord } from "@/db/client"
import { chatMessageSchema } from "@/db/schemas/chat-message"

export const chatSessionSchema = Schema.create(
  {
    title: { type: String, default: "Untitled" },
    messages: { type: [chatMessageSchema], default: [] },
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

chatSessionSchema.index({ updatedAt: -1 })

export type ChatSession = DatabaseRecord<InferSchemaType<typeof chatSessionSchema>>
export type ChatSessionSummary = Omit<ChatSession, "messages">
