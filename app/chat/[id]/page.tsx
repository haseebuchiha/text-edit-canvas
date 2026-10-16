import { io } from "next/cache"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import EditCanvas from "@/components/edit-canvas"
import { findChatMessages } from "@/services/chat"

const ChatSessionCanvas = async ({ params }: PageProps<"/chat/[id]">) => {
  const { id } = await params
  await io()
  const messages = await findChatMessages(id)
  if (!messages) notFound()
  return <EditCanvas sessionId={id} initialMessages={messages} />
}

const ChatPage = (props: PageProps<"/chat/[id]">) => (
  <Suspense fallback={<p className="m-auto text-sm text-muted-foreground">Loading chat…</p>}>
    <ChatSessionCanvas {...props} />
  </Suspense>
)

export default ChatPage
