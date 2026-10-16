"use client"

import { useChat } from "@ai-sdk/react"
import type { Editor } from "@tiptap/react"
import { type ChatRequestOptions, type ChatTransport, DefaultChatTransport, type PrepareSendMessagesRequest } from "ai"
import ChatComposer from "@/components/chat/chat-composer"
import MessageList from "@/components/chat/message-list"
import NewChatButton from "@/components/chat/new-chat-button"
import { applyAcceptedEdits, type EditMode } from "@/components/editor/apply-edits"
import { buildDocumentSnapshot } from "@/components/editor/document-snapshot"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ChatUIMessage } from "@/db/schemas/chat-message"

type ChatPanelProps = {
  sessionId: string
  initialMessages: ChatUIMessage[]
  editor: Editor | null
  autoAccept: boolean
  onAutoAcceptChange: (checked: boolean) => void
}

const sendLatestMessageOnly: PrepareSendMessagesRequest<ChatUIMessage> = ({ id, messages, body }) => ({
  body: { id, message: messages.at(-1), snapshot: body?.snapshot },
})

const chatTransport = new DefaultChatTransport<ChatUIMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: sendLatestMessageOnly,
})

const withEditsApplied = (editor: Editor | null, mode: EditMode): ChatTransport<ChatUIMessage> => ({
  sendMessages: async (options) => applyAcceptedEdits(editor, await chatTransport.sendMessages(options), mode),
  reconnectToStream: (options) => chatTransport.reconnectToStream(options),
})

const withDocumentSnapshot = (editor: Editor | null): ChatRequestOptions => ({
  body: { snapshot: editor ? buildDocumentSnapshot(editor) : undefined },
})

const ChatPanel = ({ sessionId, initialMessages, editor, autoAccept, onAutoAcceptChange }: ChatPanelProps) => {
  const { messages, sendMessage, regenerate, stop, status, error } = useChat<ChatUIMessage>({
    id: sessionId,
    messages: initialMessages,
    transport: withEditsApplied(editor, autoAccept ? "apply" : "suggest"),
  })
  const isResponding = status === "submitted" || status === "streaming"
  const sendText = (text: string) => sendMessage({ text }, withDocumentSnapshot(editor))
  const retry = () => regenerate(withDocumentSnapshot(editor))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3">
        <h2 className="flex-1 text-sm font-medium">Chat</h2>
        <NewChatButton disabled={isResponding} />
        <Label>
          Auto-accept
          <Switch checked={autoAccept} onCheckedChange={onAutoAcceptChange} />
        </Label>
      </header>
      <div className="flex min-h-0 flex-1 flex-col py-4">
        <MessageList messages={messages} status={status} />
      </div>
      {error && (
        <div role="alert" className="flex items-center gap-2 border-t px-4 py-2 text-sm">
          <p className="flex-1 text-destructive">{error.message}</p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      )}
      <ChatComposer canSend={status === "ready"} isResponding={isResponding} onSend={sendText} onStop={stop} />
    </div>
  )
}

export default ChatPanel
