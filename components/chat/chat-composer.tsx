"use client"

import { type ChangeEvent, type KeyboardEvent, type SubmitEvent, useState } from "react"
import ModelMenu from "@/components/chat/model-menu"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ChatModel, ChatModelId } from "@/lib/chat-models"

type ChatComposerProps = {
  canSend: boolean
  isResponding: boolean
  models: ChatModel[]
  modelId: ChatModelId
  onModelChange: (modelId: ChatModelId) => void
  onSend: (text: string) => void
  onStop: () => void
}

const isPlainEnter = (event: KeyboardEvent<HTMLTextAreaElement>) =>
  event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing

const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (!isPlainEnter(event)) return
  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

const ChatComposer = ({ canSend, isResponding, models, modelId, onModelChange, onSend, onStop }: ChatComposerProps) => {
  const [draft, setDraft] = useState("")
  const trimmedDraft = draft.trim()
  const isSendable = canSend && trimmedDraft.length > 0
  const updateDraft = (event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)
  const sendDraft = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isSendable) return
    onSend(trimmedDraft)
    setDraft("")
  }
  return (
    <form onSubmit={sendDraft} className="flex flex-col gap-2 border-t p-4">
      <Textarea
        value={draft}
        onChange={updateDraft}
        onKeyDown={submitOnEnter}
        placeholder="Describe the change you want…"
        aria-label="Message"
        className="max-h-40"
      />
      <div className="flex items-center justify-end gap-2">
        <ModelMenu models={models} modelId={modelId} onModelChange={onModelChange} />
        {isResponding && (
          <Button type="button" variant="outline" onClick={onStop}>
            Stop
          </Button>
        )}
        <Button type="submit" disabled={!isSendable}>
          Send
        </Button>
      </div>
    </form>
  )
}

export default ChatComposer
