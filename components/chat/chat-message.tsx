import { getToolName, isToolUIPart } from "ai"
import AnswerPart from "@/components/chat/answer-part"
import ReasoningPart from "@/components/chat/reasoning-part"
import TextPart from "@/components/chat/text-part"
import ThinkingIndicator from "@/components/chat/thinking-indicator"
import ToolPart from "@/components/chat/tool-part"
import {
  isAnswerPart,
  isToolBusy,
  isTransformPart,
  readVerifiedAnswer,
  type ToolPartValue,
} from "@/components/chat/tool-state"
import TransformPart from "@/components/chat/transform-part"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import type { ChatUIMessage } from "@/db/schemas/chat-message"
import { ANSWER_QUESTION_TOOL } from "@/lib/answer-question"
import { EDIT_DOCUMENT_TOOL } from "@/lib/edit-operations"
import { TRANSFORM_DOCUMENT_TOOL } from "@/lib/transform-document"

type MessagePart = ChatUIMessage["parts"][number]

type ChatMessageProps = {
  message: ChatUIMessage
  isResponding: boolean
}

type MessagePartViewProps = {
  part: MessagePart
  isUser: boolean
  isResponding: boolean
}

const NO_VERIFIED_ANSWER_MESSAGE = "I couldn't find a verified answer in the document."
const NO_REPLY_MESSAGE = "No answer came back. Please try again."
const REPLY_TOOLS = [ANSWER_QUESTION_TOOL, EDIT_DOCUMENT_TOOL, TRANSFORM_DOCUMENT_TOOL]

const isAnswerAttempt = (part: MessagePart): part is ToolPartValue => isToolUIPart(part) && isAnswerPart(part)

const isTransform = (part: MessagePart): part is ToolPartValue => isToolUIPart(part) && isTransformPart(part)

const isVerifiedAnswer = (part: ToolPartValue) => readVerifiedAnswer(part) !== undefined

const isNotText = (part: MessagePart) => part.type !== "text"

const isReplyPart = (part: MessagePart) => {
  if (part.type === "text") return part.text.trim().length > 0
  return isToolUIPart(part) && REPLY_TOOLS.includes(getToolName(part))
}

const isMissingReply = ({ role, parts }: ChatUIMessage) => role === "assistant" && !parts.some(isReplyPart)

const showsOwnProgress = (part: MessagePart | undefined) => {
  if (part === undefined) return false
  if (part.type === "text") return part.text.length > 0
  if (part.type === "reasoning") return part.state === "streaming"
  return isToolUIPart(part) && isToolBusy(part)
}

const AnsweringModel = ({ metadata }: Pick<ChatUIMessage, "metadata">) => {
  if (!metadata?.modelId || !metadata.reasoningEffort) return null
  return <MessageFooter>{`${metadata.modelId} · ${metadata.reasoningEffort} thinking`}</MessageFooter>
}

const MessagePartView = ({ part, isUser, isResponding }: MessagePartViewProps) => {
  if (part.type === "text") return <TextPart text={part.text} isUser={isUser} />
  if (part.type === "reasoning")
    return <ReasoningPart text={part.text} isThinking={isResponding && part.state === "streaming"} />
  if (isAnswerAttempt(part)) return <AnswerPart part={part} isResponding={isResponding} />
  if (isTransform(part)) return <TransformPart part={part} isResponding={isResponding} />
  if (isToolUIPart(part)) return <ToolPart part={part} isResponding={isResponding} />
  return null
}

const ChatMessage = ({ message, isResponding }: ChatMessageProps) => {
  const isUser = message.role === "user"
  const answerAttempts = message.parts.filter(isAnswerAttempt)
  const hasAnswerAttempt = answerAttempts.length > 0
  const visibleParts = hasAnswerAttempt ? message.parts.filter(isNotText) : message.parts
  const lacksVerifiedAnswer = hasAnswerAttempt && !isResponding && !answerAttempts.some(isVerifiedAnswer)
  const lacksReply = !isResponding && isMissingReply(message)
  const isThinking = isResponding && !showsOwnProgress(visibleParts.at(-1))
  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageContent>
        {visibleParts.map((part, index) => (
          <MessagePartView key={`${message.id}-${index}`} part={part} isUser={isUser} isResponding={isResponding} />
        ))}
        {lacksVerifiedAnswer && <TextPart text={NO_VERIFIED_ANSWER_MESSAGE} isUser={false} />}
        {lacksReply && <TextPart text={NO_REPLY_MESSAGE} isUser={false} />}
        {isThinking && <ThinkingIndicator />}
        <AnsweringModel metadata={message.metadata} />
      </MessageContent>
    </Message>
  )
}

export default ChatMessage
