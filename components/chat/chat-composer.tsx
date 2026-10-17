"use client"

import { type ChangeEvent, type KeyboardEvent, type SubmitEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CHAT_MODELS, type ChatModelId } from "@/lib/chat-models"

type ChatComposerProps = {
  canSend: boolean
  isResponding: boolean
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

const ChatComposer = ({ canSend, isResponding, modelId, onModelChange, onSend, onStop }: ChatComposerProps) => {
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
  const changeModel = (chosenModelId: ChatModelId | null) => {
    if (chosenModelId) onModelChange(chosenModelId)
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
        <Select items={CHAT_MODELS} value={modelId} onValueChange={changeModel}>
          <SelectTrigger size="sm" aria-label="Model" className="mr-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top" align="start" alignItemWithTrigger={false} className="w-auto">
            {CHAT_MODELS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
