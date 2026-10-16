import {
  consumeStream,
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  isToolUIPart,
  type LanguageModel,
  type LanguageModelUsage,
  streamText,
  toUIMessageStream,
  type UIMessageStreamOnEndCallback,
  type UIMessageStreamOptions,
} from "ai"
import type { ChatMessage, ChatMessageMetadata, ChatUIMessage, NewChatMessage } from "@/db/schemas/chat-message"
import type { ChatSession } from "@/db/schemas/chat-session"
import { ANSWER_QUESTION_TOOL } from "@/lib/answer-question"
import type { DocumentSnapshot } from "@/lib/document-snapshot"
import { EDIT_DOCUMENT_TOOL } from "@/lib/edit-operations"
import { TRANSFORM_DOCUMENT_TOOL } from "@/lib/transform-document"
import { appendChatMessages, findChatSessionById } from "@/models/chat-sessions"
import {
  attachDocumentSnapshot,
  createDocumentEditTools,
  dropDocumentReads,
  FIND_TEXT_TOOL,
  hasAcceptedEdit,
  hasVerifiedAnswer,
  READ_SECTION_TOOL,
} from "@/services/document-edit"
import { createDocumentTransformTools, hasFinishedTransform } from "@/services/document-transform"
import { createConfiguredModel, createModelOptions, type ModelSettings } from "@/services/llm"

export { createChatSession } from "@/models/chat-sessions"

export type ChatReplyRequest = {
  sessionId: string
  message: ChatUIMessage
  snapshot?: DocumentSnapshot
  abortSignal?: AbortSignal
}

export type ChatTurn = {
  history: ChatUIMessage[]
  message: ChatUIMessage
  snapshot?: DocumentSnapshot
  abortSignal?: AbortSignal
}

type MessagePart = ChatUIMessage["parts"][number]

const SYSTEM_PROMPT = [
  "You edit business documents in the editor next to this chat.",
  "The user's latest message carries the instruction, the document outline, and sections with each block's node ID in square brackets (and its place, such as a list item or table cell, in parentheses): any text before the first heading, plus the sections around the focus, which is the text the user highlighted.",
  `The outline shows headings only, not the text under them. When the instruction refers to content that isn't shown, first call ${READ_SECTION_TOOL} once with every outline heading whose section may hold it.`,
  `To rewrite the whole document, for example to make it more formal or more concise or to translate it, call ${TRANSFORM_DOCUMENT_TOOL} instead: it rewrites every section itself.`,
  `Use ${FIND_TEXT_TOOL} when the outline doesn't show where something is, and to change a word or fact wherever it appears.`,
  "Change only what the instruction asks and leave everything else exactly as it is. When there is a focus, change only the focused text unless the instruction clearly asks for more.",
  "When you rewrite text, keep how strong each statement is: don't turn should into must or into a command, or a definite statement into one with can, may or helps, or any of these the other way round, and keep every word that limits or qualifies a statement, such as only, exclusively, most, always or without delay.",
  "If the instruction names a part the document doesn't have, such as a section that isn't in the outline, change nothing rather than editing a similar part: make no edit and no transform, say that part isn't there and ask what to change.",
  `Return every other change through the ${EDIT_DOCUMENT_TOOL} tool, in a single call, never as text in your reply. Prefer replace_text for changes inside a block: copy find exactly from the block's text, and send one operation per occurrence. Use replace_node only when most of a block changes, because it drops bold and links in that block.`,
  `Answer every question about the document's content through ${ANSWER_QUESTION_TOOL}, never as text in your reply. Search with ${FIND_TEXT_TOOL} before answering, even after reading sections, unless the sections in the user's message state the answer.`,
  "Reply to anything else, such as small talk, in plain text. Answer plainly and briefly in the user's language.",
].join("\n")
const NOT_CONFIGURED_MESSAGE =
  "Chat is not configured. Set AI_GATEWAY_API_KEY and AI_GATEWAY_MODEL, or LLM_BASE_URL and LLM_MODEL, then retry."
const SESSION_NOT_FOUND_MESSAGE = "This chat session does not exist."
const MODEL_FAILURE_MESSAGE = "The model request failed. Check the LLM settings and retry."
const MAX_MODEL_STEPS = 4
const SAVED_OUTCOMES = new Set(["completed", "aborted"])
const FINISHED_TOOL_STATES = new Set(["output-available", "output-error"])

const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 })

const toChatUIMessage = ({ id, role, parts, inputTokens, outputTokens }: ChatMessage): ChatUIMessage => ({
  id,
  role,
  parts,
  metadata: { inputTokens, outputTokens },
})

const toNewChatMessage = ({ id, role, parts }: ChatUIMessage, usage?: ChatMessageMetadata): NewChatMessage => ({
  id,
  role,
  parts,
  ...usage,
})

const sumUsage = (usages: LanguageModelUsage[]): ChatMessageMetadata => ({
  inputTokens: usages.reduce((total, { inputTokens }) => total + (inputTokens ?? 0), 0),
  outputTokens: usages.reduce((total, { outputTokens }) => total + (outputTokens ?? 0), 0),
})

const reportUsageOnFinish =
  (sectionUsage: LanguageModelUsage[]): UIMessageStreamOptions<ChatUIMessage>["messageMetadata"] =>
  ({ part }) =>
    part.type === "finish" ? sumUsage([part.totalUsage, ...sectionUsage]) : undefined

const describeModelFailure = () => MODEL_FAILURE_MESSAGE

const isDeliveredPart = (part: MessagePart) => !isToolUIPart(part) || FINISHED_TOOL_STATES.has(part.state)

const keepDeliveredParts = (message: ChatUIMessage): ChatUIMessage => ({
  ...message,
  parts: message.parts.filter(isDeliveredPart),
})

const saveExchange =
  (sessionId: string, userMessage: ChatUIMessage): UIMessageStreamOnEndCallback<ChatUIMessage> =>
  async ({ outcome, responseMessage }) => {
    if (!SAVED_OUTCOMES.has(outcome.status)) return
    await appendChatMessages(sessionId, [
      toNewChatMessage(userMessage),
      toNewChatMessage(keepDeliveredParts(responseMessage), responseMessage.metadata),
    ])
  }

export const streamChatTurn = async (
  modelSettings: ModelSettings,
  { history, message, snapshot, abortSignal }: ChatTurn,
  onEnd?: UIMessageStreamOnEndCallback<ChatUIMessage>,
) => {
  const sectionUsage: LanguageModelUsage[] = []
  const generation = streamText({
    ...modelSettings,
    instructions: SYSTEM_PROMPT,
    tools: {
      ...createDocumentEditTools(snapshot?.document),
      ...createDocumentTransformTools(modelSettings, sectionUsage, snapshot?.document),
    },
    stopWhen: [isStepCount(MAX_MODEL_STEPS), hasAcceptedEdit, hasVerifiedAnswer, hasFinishedTransform],
    abortSignal,
    messages: await convertToModelMessages([
      ...history.map(dropDocumentReads),
      attachDocumentSnapshot(message, snapshot),
    ]),
  })
  return toUIMessageStream({
    stream: generation.stream,
    originalMessages: [...history, message],
    generateMessageId,
    messageMetadata: reportUsageOnFinish(sectionUsage),
    onError: describeModelFailure,
    onEnd,
  })
}

const streamModelReply = async (
  model: LanguageModel,
  session: ChatSession,
  { message, snapshot, abortSignal }: ChatReplyRequest,
) => {
  const modelSettings = { model, providerOptions: createModelOptions(session.id) }
  const history = session.messages.map(toChatUIMessage)
  const turn = { history, message, snapshot, abortSignal }
  const stream = await streamChatTurn(modelSettings, turn, saveExchange(session.id, message))
  return createUIMessageStreamResponse({ stream, consumeSseStream: consumeStream })
}

export const findChatMessages = async (sessionId: string) => {
  const session = await findChatSessionById(sessionId)
  return session?.messages.map(toChatUIMessage)
}

const replyInSession = async (request: ChatReplyRequest, model: LanguageModel) => {
  const session = await findChatSessionById(request.sessionId)
  if (!session) return new Response(SESSION_NOT_FOUND_MESSAGE, { status: 404 })
  return streamModelReply(model, session, request)
}

export const streamChatReply = async (request: ChatReplyRequest, model = createConfiguredModel()) => {
  if (!model) return new Response(NOT_CONFIGURED_MESSAGE, { status: 503 })
  return replyInSession(request, model)
}
