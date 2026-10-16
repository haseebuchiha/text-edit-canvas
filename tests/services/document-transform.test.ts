import type { LanguageModelUsage } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import type { DocumentSnapshot } from "@/lib/document-snapshot"
import type { EditOperation } from "@/lib/edit-operations"
import { TRANSFORM_DOCUMENT_TOOL, type TransformProgress } from "@/lib/transform-document"
import { createDocumentTransformTools } from "@/services/document-transform"
import { createModelOptions } from "@/services/llm"

const INSTRUCTION = "make the whole document more concise"
const PART_INPUT_TOKENS = 30
const PART_OUTPUT_TOKENS = 7
const CHECK_INPUT_TOKENS = 50
const CHECK_OUTPUT_TOKENS = 11

const document: DocumentSnapshot["document"] = {
  outline: [{ nodeId: "h1", level: 2, text: "Visitors" }],
  sections: [],
  blocks: [
    { nodeId: "h1", type: "heading", text: "Visitors" },
    { nodeId: "p1", type: "paragraph", text: "Visitors should register at the front desk before they enter the hall." },
    { nodeId: "p2", type: "paragraph", text: "Badges are handed back at the exit when visitors leave the building." },
  ],
}

const rewrite: EditOperation[] = [
  { op: "replace_node", nodeId: "p1", text: "Register at the front desk before entering." },
  { op: "replace_text", nodeId: "p2", find: "when visitors leave the building", replace: "on leaving" },
]

const CORRECTED_FIRST_PARAGRAPH = "Visitors should register at the front desk before entering."

const createUsage = (inputTokens: number, outputTokens: number) => ({
  inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
})

const generatedJson = (output: object, inputTokens: number, outputTokens: number) => ({
  content: [{ type: "text" as const, text: JSON.stringify(output) }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: createUsage(inputTokens, outputTokens),
  warnings: [],
})

const failCheck = () => {
  throw new Error("The check request failed.")
}

const isProgressStream = (value: unknown): value is AsyncIterable<TransformProgress> =>
  typeof value === "object" && value !== null && Symbol.asyncIterator in value

const isMeaningCheck = ({ prompt }: { prompt: unknown }) => JSON.stringify(prompt).includes("Rewritten blocks:")

const createRewriteModel = (answerCheck: () => object) =>
  new MockLanguageModelV4({
    doGenerate: async (options) => {
      if (isMeaningCheck(options)) return generatedJson(answerCheck(), CHECK_INPUT_TOKENS, CHECK_OUTPUT_TOKENS)
      return generatedJson({ operations: rewrite, summary: "Shortened." }, PART_INPUT_TOKENS, PART_OUTPUT_TOKENS)
    },
  })

const readProgress = async (
  iterator: AsyncIterator<TransformProgress>,
  received: TransformProgress[],
): Promise<TransformProgress[]> => {
  const { done, value } = await iterator.next()
  if (done) return received
  return readProgress(iterator, [...received, value])
}

const runTransform = async (model: MockLanguageModelV4) => {
  const sectionUsage: LanguageModelUsage[] = []
  const modelSettings = { model, providerOptions: createModelOptions("transform-test") }
  const tools = createDocumentTransformTools(modelSettings, sectionUsage, document)
  const stream = await tools[TRANSFORM_DOCUMENT_TOOL].execute?.(
    { instruction: INSTRUCTION },
    { toolCallId: "transform-1", messages: [], context: {} },
  )
  if (!isProgressStream(stream)) throw new Error("The transform returned no progress stream.")
  const progress = await readProgress(stream[Symbol.asyncIterator](), [])
  return { operations: progress.flatMap((update) => update.operations), progress, sectionUsage }
}

describe("document transform meaning check", () => {
  it("applies the corrections to the section's changes before they stream", async () => {
    const model = createRewriteModel(() => ({ corrections: [{ nodeId: "p1", text: CORRECTED_FIRST_PARAGRAPH }] }))

    const { operations, progress } = await runTransform(model)
    const checkPrompt = JSON.stringify(model.doGenerateCalls[1].prompt)

    expect(model.doGenerateCalls).toHaveLength(2)
    expect(checkPrompt).toContain(INSTRUCTION)
    expect(checkPrompt).toContain("[p1] Visitors should register at the front desk before they enter the hall.")
    expect(checkPrompt).toContain("[p1] Register at the front desk before entering.")
    expect(checkPrompt).toContain("[p2] Badges are handed back at the exit on leaving.")
    expect(model.doGenerateCalls[1].providerOptions).toEqual(createModelOptions("transform-test"))
    expect(operations).toEqual([rewrite[1], { op: "replace_node", nodeId: "p1", text: CORRECTED_FIRST_PARAGRAPH }])
    expect(progress.at(-1)).toMatchObject({ status: "done", editedBlockCount: 2, failedSections: [] })
  })

  it("leaves the rewrite unchanged when the check finds nothing", async () => {
    const { operations } = await runTransform(createRewriteModel(() => ({ corrections: [] })))

    expect(operations).toEqual(rewrite)
  })

  it("keeps the rewrite when the check call fails", async () => {
    const { operations, progress } = await runTransform(createRewriteModel(failCheck))

    expect(operations).toEqual(rewrite)
    expect(progress.at(-1)).toMatchObject({ status: "done", failedSections: [] })
  })

  it("ignores a correction for a block the rewrite didn't change", async () => {
    const { operations } = await runTransform(
      createRewriteModel(() => ({ corrections: [{ nodeId: "h1", text: "Guests" }] })),
    )

    expect(operations).toEqual(rewrite)
  })

  it("counts the check's tokens with the part calls", async () => {
    const { sectionUsage } = await runTransform(createRewriteModel(() => ({ corrections: [] })))

    expect(sectionUsage.map(({ inputTokens, outputTokens }) => ({ inputTokens, outputTokens }))).toEqual([
      { inputTokens: PART_INPUT_TOKENS, outputTokens: PART_OUTPUT_TOKENS },
      { inputTokens: CHECK_INPUT_TOKENS, outputTokens: CHECK_OUTPUT_TOKENS },
    ])
  })
})
