import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import mongoose from "mongoose"
import type { ChatUIMessage } from "@/db/schemas/chat-message"
import type { ChatSession } from "@/db/schemas/chat-session"
import type { DocumentSnapshot } from "@/lib/document-snapshot"
import { createChatSession, findChatSessionById } from "@/models/chat-sessions"
import { streamChatReply } from "@/services/chat"
import { createModelOptions } from "@/services/llm"

const TEST_DATABASE_NAME = "pryvet-test-chat-service"
const MISSING_ID = new mongoose.Types.ObjectId().toHexString()
const REPLY_TEXT = "Shorter intro, done."
const INPUT_TOKENS = 30
const OUTPUT_TOKENS = 7
const SECTION_COUNT = 10
const SECTION_TEXT = "Every employee locks the screen before leaving the desk. ".repeat(20)
const QUICK_SECTION_MS = 10
const SLOW_SECTION_MS = 5000

const userMessage = (id: string, text: string): ChatUIMessage => ({ id, role: "user", parts: [{ type: "text", text }] })

const createMockModel = (chunkDelayInMs?: number) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunkDelayInMs,
        chunks: [
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Shorter intro, " },
          { type: "text-delta", id: "text-1", delta: "done." },
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: { total: INPUT_TOKENS, noCache: INPUT_TOKENS, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: OUTPUT_TOKENS, text: OUTPUT_TOKENS, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  })

const usage = {
  inputTokens: { total: INPUT_TOKENS, noCache: INPUT_TOKENS, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: OUTPUT_TOKENS, text: OUTPUT_TOKENS, reasoning: undefined },
}

const transformSnapshot = (): DocumentSnapshot => {
  const outline = Array.from({ length: SECTION_COUNT }, (_, index) => ({
    nodeId: `h${index}`,
    level: 2,
    text: `Section ${index}`,
  }))
  const blocks = outline.flatMap(({ nodeId, text }, index) => [
    { nodeId, type: "heading", text },
    { nodeId: `p${index}`, type: "paragraph", text: SECTION_TEXT },
  ])
  return { document: { outline, sections: [], blocks }, focus: [] }
}

const waitUnlessAborted = (milliseconds: number, abortSignal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    const stopWaiting = () => {
      clearTimeout(timer)
      reject(abortSignal.reason)
    }
    if (abortSignal.aborted) stopWaiting()
    abortSignal.addEventListener("abort", stopWaiting)
  })

const readParagraphToRewrite = ({ prompt }: { prompt: unknown }) =>
  JSON.stringify(prompt).match(/Blocks to rewrite:.*?\[(p\d+)\]/u)?.[1] ?? "p0"

const sectionDelay = (callCount: number) => (callCount === 1 ? QUICK_SECTION_MS : SLOW_SECTION_MS)

const isMeaningCheck = ({ prompt }: { prompt: unknown }) => JSON.stringify(prompt).includes("You check a rewrite")

const isBrief = ({ prompt }: { prompt: unknown }) => JSON.stringify(prompt).includes("You prepare a rewrite")

const SIDE_CALL_ANSWERS = [
  { matches: isBrief, output: { terms: [], notes: [] } },
  { matches: isMeaningCheck, output: { issues: [] } },
]

const answerSideCall = (call: { prompt: unknown }) => SIDE_CALL_ANSWERS.find(({ matches }) => matches(call))?.output

const generatedJson = (output: object) => ({
  content: [{ type: "text" as const, text: JSON.stringify(output) }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage,
  warnings: [],
})

const createTransformModel = (sectionCalls: string[]) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          {
            type: "tool-call",
            toolCallId: "transform-1",
            toolName: "transform_document",
            input: JSON.stringify({ instruction: "make it shorter" }),
          },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ],
      }),
    }),
    doGenerate: async (options) => {
      const sideAnswer = answerSideCall(options)
      if (sideAnswer) return generatedJson(sideAnswer)
      const nodeId = readParagraphToRewrite(options)
      sectionCalls.push(nodeId)
      await waitUnlessAborted(sectionDelay(sectionCalls.length), options.abortSignal ?? new AbortController().signal)
      return generatedJson({ operations: [{ op: "replace_node", nodeId, text: "Shorter." }], summary: "Shortened." })
    },
  })

const readUntilMatch = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pattern: RegExp,
  received: string,
): Promise<string> => {
  const { done, value } = await reader.read()
  const text = received + new TextDecoder().decode(value)
  if (done || pattern.test(text)) return text
  return readUntilMatch(reader, pattern, text)
}

const assistantReply = {
  role: "assistant",
  parts: expect.arrayContaining([expect.objectContaining({ type: "text", text: REPLY_TEXT })]),
  inputTokens: INPUT_TOKENS,
  outputTokens: OUTPUT_TOKENS,
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const readSession = async (id: string) => {
  const session = await findChatSessionById(id)
  if (!session) throw new Error(`Chat session ${id} is missing.`)
  return session
}

const waitForMessageCount = async (id: string, count: number, attemptsLeft: number): Promise<ChatSession> => {
  const session = await readSession(id)
  if (session.messages.length >= count || attemptsLeft === 0) return session
  await pause(20)
  return waitForMessageCount(id, count, attemptsLeft - 1)
}

const disconnectAfterFirstChunk = async (body: ReadableStream<Uint8Array> | null) => {
  if (!body) throw new Error("The response has no body.")
  const reader = body.getReader()
  await reader.read()
  await reader.cancel()
}

const dropTestDatabase = async () => {
  const database = mongoose.connection.db
  if (database?.databaseName !== TEST_DATABASE_NAME) return
  await database.dropDatabase()
}

beforeAll(() => {
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${TEST_DATABASE_NAME}`
})

afterAll(async () => {
  await dropTestDatabase()
  await mongoose.disconnect()
})

describe("chat service", () => {
  it("streams the reply, then saves the user and assistant messages and adds the token usage", async () => {
    const { id } = await createChatSession()
    const question = userMessage("user-message-1", "Make the intro shorter")

    const response = await streamChatReply({ sessionId: id, message: question }, createMockModel())
    const body = await response.text()
    const session = await readSession(id)

    expect(response.status).toBe(200)
    expect(body).toContain('"delta":"Shorter intro, "')
    expect(body).toContain(`"messageMetadata":{"inputTokens":${INPUT_TOKENS},"outputTokens":${OUTPUT_TOKENS}}`)
    expect(session).toMatchObject({ totalInputTokens: INPUT_TOKENS, totalOutputTokens: OUTPUT_TOKENS })
    expect(session.messages).toMatchObject([question, assistantReply])
    expect(session.messages[1].id).toMatch(/^msg-/u)
  })

  it("sends the saved history to the model and keeps adding to the session totals", async () => {
    const { id } = await createChatSession()
    const model = createMockModel()
    await (await streamChatReply({ sessionId: id, message: userMessage("turn-1", "First") }, model)).text()

    await (await streamChatReply({ sessionId: id, message: userMessage("turn-2", "Second") }, model)).text()
    const session = await readSession(id)
    const secondPrompt = model.doStreamCalls[1].prompt

    expect(secondPrompt.map((message) => message.role)).toEqual(["system", "user", "assistant", "user"])
    expect(session.messages.map((message) => message.id)).toEqual([
      "turn-1",
      expect.any(String),
      "turn-2",
      expect.any(String),
    ])
    expect(session).toMatchObject({ totalInputTokens: 2 * INPUT_TOKENS, totalOutputTokens: 2 * OUTPUT_TOKENS })
  })

  it("still saves the full reply when the client disconnects mid-stream", async () => {
    const { id } = await createChatSession()
    const question = userMessage("user-message-gone", "Fix the typo")

    const response = await streamChatReply({ sessionId: id, message: question }, createMockModel(30))
    await disconnectAfterFirstChunk(response.body)
    const session = await waitForMessageCount(id, 2, 100)

    expect(session.messages).toMatchObject([question, assistantReply])
    expect(session).toMatchObject({ totalInputTokens: INPUT_TOKENS, totalOutputTokens: OUTPUT_TOKENS })
  })

  it("stops the section calls on abort and saves only the sections that streamed", async () => {
    const { id } = await createChatSession()
    const question = userMessage("user-message-stopped", "Make the whole document shorter")
    const sectionCalls: string[] = []
    const abortController = new AbortController()
    const model = createTransformModel(sectionCalls)

    const response = await streamChatReply(
      { sessionId: id, message: question, snapshot: transformSnapshot(), abortSignal: abortController.signal },
      model,
    )
    if (!response.body) throw new Error("The response has no body.")
    const reader = response.body.getReader()
    const streamed = await readUntilMatch(reader, /"finishedCount":1/u, "")
    abortController.abort()
    await reader.cancel()
    const session = await waitForMessageCount(id, 2, 100)
    const callsAfterAbort = sectionCalls.length
    await pause(200)
    const transformPart = session.messages[1].parts.find((part) => part.type === "tool-transform_document")

    expect(streamed).not.toContain('"status":"done"')
    expect(session.messages[0]).toMatchObject(question)
    expect(transformPart).toMatchObject({
      state: "output-available",
      output: { status: "running", sectionCount: SECTION_COUNT, finishedCount: 1, editedBlockCount: 1 },
    })
    expect(callsAfterAbort).toBeLessThan(SECTION_COUNT)
    expect(sectionCalls).toHaveLength(callsAfterAbort)
    expect(model.doStreamCalls[0].providerOptions).toEqual(createModelOptions(id))
    expect(model.doGenerateCalls.filter((call) => !isMeaningCheck(call) && !isBrief(call))).toHaveLength(
      sectionCalls.length,
    )
    expect(model.doGenerateCalls.map(({ providerOptions }) => providerOptions)).toEqual(
      model.doGenerateCalls.map(() => createModelOptions(id)),
    )
  })

  it("answers 404 for an unknown session without calling the model", async () => {
    const model = createMockModel()

    const response = await streamChatReply({ sessionId: MISSING_ID, message: userMessage("lost", "Hello?") }, model)

    expect(response.status).toBe(404)
    expect(model.doStreamCalls).toHaveLength(0)
  })

  it("answers 503 with a readable message when the LLM settings are missing", async () => {
    const { id } = await createChatSession()
    const originalEnvironment = process.env
    process.env = { ...originalEnvironment, AI_GATEWAY_API_KEY: "", LLM_BASE_URL: "", LLM_MODEL: "" }

    const response = await streamChatReply({ sessionId: id, message: userMessage("unconfigured", "Hi") })
    process.env = originalEnvironment

    expect(response.status).toBe(503)
    expect(await response.text()).toMatch(/AI_GATEWAY_API_KEY and AI_GATEWAY_MODEL, or LLM_BASE_URL and LLM_MODEL/u)
    expect((await readSession(id)).messages).toEqual([])
  })
})
