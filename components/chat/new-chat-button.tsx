"use client"

import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { ChatSession } from "@/db/schemas/chat-session"

type NewChatButtonProps = {
  disabled: boolean
}

type CreatedChatSession = Pick<ChatSession, "id">

const CHAT_SESSIONS_API = "/api/chat/sessions"
const NEW_CHAT_FAILED_MESSAGE = "Couldn't start a new chat. Try again."

const readCreatedSession = async (response: Response): Promise<CreatedChatSession | undefined> =>
  response.ok ? response.json() : undefined

const requestNewChatSession = () =>
  fetch(CHAT_SESSIONS_API, { method: "POST" })
    .then(readCreatedSession)
    .catch(() => undefined)

const NewChatButton = ({ disabled }: NewChatButtonProps) => {
  const router = useRouter()
  const [isStarting, startTransition] = useTransition()
  const [hasFailed, setHasFailed] = useState(false)
  const openNewChat = async () => {
    const session = await requestNewChatSession()
    if (!session) {
      setHasFailed(true)
      return
    }
    router.push(`/chat/${session.id}`)
  }
  const startNewChat = () => {
    setHasFailed(false)
    startTransition(openNewChat)
  }
  return (
    <>
      <Button type="button" variant="ghost" size="sm" disabled={disabled || isStarting} onClick={startNewChat}>
        <PlusIcon data-icon="inline-start" />
        New chat
      </Button>
      {hasFailed && (
        <p role="alert" className="order-last basis-full text-xs text-destructive">
          {NEW_CHAT_FAILED_MESSAGE}
        </p>
      )}
    </>
  )
}

export default NewChatButton
