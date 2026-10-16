import { createChatSession } from "@/services/chat"

export const POST = async () => {
  const { id } = await createChatSession()
  return Response.json({ id }, { status: 201 })
}
