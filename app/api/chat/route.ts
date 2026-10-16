import { safeValidateUIMessages } from "ai"
import { z } from "zod"
import type { ChatUIMessage } from "@/db/schemas/chat-message"
import { documentSnapshotSchema } from "@/lib/document-snapshot"
import { streamChatReply } from "@/services/chat"

const INVALID_REQUEST_MESSAGE = "Invalid chat request."

const chatRequestSchema = z.object({
  id: z.string().min(1),
  message: z.looseObject({ role: z.literal("user") }),
  snapshot: documentSnapshotSchema.optional(),
})

const readChatRequest = async (request: Request) => {
  const body = chatRequestSchema.safeParse(await request.json().catch(() => undefined))
  if (!body.success) return undefined
  const validation = await safeValidateUIMessages<ChatUIMessage>({ messages: [body.data.message] })
  if (!validation.success) return undefined
  const [message] = validation.data
  return { sessionId: body.data.id, message, snapshot: body.data.snapshot, abortSignal: request.signal }
}

export const POST = async (request: Request) => {
  const chatRequest = await readChatRequest(request)
  if (!chatRequest) return new Response(INVALID_REQUEST_MESSAGE, { status: 400 })
  return streamChatReply(chatRequest)
}
