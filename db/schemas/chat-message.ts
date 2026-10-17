import "server-only"
import type { UIMessage } from "ai"
import { type InferSchemaType, Schema } from "mongoose"

export const chatMessageSchema = Schema.create(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["system", "user", "assistant"] as const, required: true },
    parts: { type: Schema.Types.Mixed, required: true, __rawDocTypeHint: [] as UIMessage["parts"] },
    inputTokens: Number,
    outputTokens: Number,
    modelId: String,
    reasoningEffort: String,
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
)

export type ChatMessage = InferSchemaType<typeof chatMessageSchema>
export type NewChatMessage = Omit<ChatMessage, "createdAt">
export type ChatMessageMetadata = Pick<ChatMessage, "inputTokens" | "outputTokens" | "modelId" | "reasoningEffort">
export type ChatUIMessage = UIMessage<ChatMessageMetadata>
