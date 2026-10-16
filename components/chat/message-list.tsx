import type { ChatStatus } from "ai"
import ChatMessage from "@/components/chat/chat-message"
import ThinkingIndicator from "@/components/chat/thinking-indicator"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { ChatUIMessage } from "@/db/schemas/chat-message"

type MessageListProps = {
  messages: ChatUIMessage[]
  status: ChatStatus
}

const PendingReply = () => (
  <MessageScrollerItem>
    <Message align="start">
      <MessageContent>
        <ThinkingIndicator />
      </MessageContent>
    </Message>
  </MessageScrollerItem>
)

const MessageList = ({ messages, status }: MessageListProps) => {
  if (messages.length === 0) return <p className="m-auto text-sm text-muted-foreground">Ask for a change…</p>
  const isResponding = status === "submitted" || status === "streaming"
  const isReplying = isResponding && messages.at(-1)?.role === "assistant"
  const lastIndex = messages.length - 1
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-4" aria-busy={isResponding}>
            {messages.map((message, index) => (
              <MessageScrollerItem key={message.id} messageId={message.id}>
                <ChatMessage message={message} isResponding={isReplying && index === lastIndex} />
              </MessageScrollerItem>
            ))}
            {isResponding && !isReplying && <PendingReply />}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

export default MessageList
