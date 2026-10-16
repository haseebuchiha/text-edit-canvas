import type { LanguageModelUsage } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import type { DocumentSnapshot } from "@/lib/document-snapshot"
import type { EditOperation } from "@/lib/edit-operations"
import { TRANSFORM_DOCUMENT_TOOL, type TransformProgress } from "@/lib/transform-document"
import { createDocumentTransformTools } from "@/services/document-transform"
import { createModelOptions } from "@/services/llm"

const INSTRUCTION = "make the whole document more concise"
const BRIEF_INPUT_TOKENS = 20
const BRIEF_OUTPUT_TOKENS = 5
const PART_INPUT_TOKENS = 30
const PART_OUTPUT_TOKENS = 7
const CHECK_INPUT_TOKENS = 50
const CHECK_OUTPUT_TOKENS = 11
const REPAIR_INPUT_TOKENS = 40
const REPAIR_OUTPUT_TOKENS = 9

type ModelAnswers = {
  rewrite: EditOperation[]
  answerCheck: () => object
  answerRepair: () => object
}

const document: DocumentSnapshot["document"] = {
  outline: [{ nodeId: "h1", level: 2, text: "Visitors" }],
  sections: [],
  blocks: [
    { nodeId: "h1", type: "heading", text: "Visitors" },
    { nodeId: "p1", type: "paragraph", text: "Visitors should register at the front desk before they enter the hall." },
    { nodeId: "p2", type: "paragraph", text: "Badges are handed back at the exit when visitors leave the building." },
    { nodeId: "p3", type: "paragraph", text: "A lost badge costs 25 euros." },
  ],
}

const brief = {
  terms: [
    { term: "badge", wording: "badge" },
    { term: "loading dock", wording: "loading dock" },
  ],
  notes: ["Keep a neutral register."],
}

const rewrite: EditOperation[] = [
  { op: "replace_node", nodeId: "p1", text: "Visitors register at the front desk before they enter the hall." },
  { op: "replace_text", nodeId: "p2", find: "when visitors leave the building", replace: "on leaving" },
]

const REPAIRED_FIRST_PARAGRAPH = "Visitors should register at the front desk before entering the hall."

const flagFirstParagraph = () => ({
  issues: [
    {
      nodeId: "p1",
      problem: "The original says visitors should register; the rewrite makes it a plain statement.",
      find: "Visitors register",
      replace: "Visitors should register",
    },
  ],
})

const findNothing = () => ({ issues: [] })

const repairFirstParagraph = () => ({ corrections: [{ nodeId: "p1", text: REPAIRED_FIRST_PARAGRAPH }] })

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

const failRequest = () => {
  throw new Error("The request failed.")
}

const isProgressStream = (value: unknown): value is AsyncIterable<TransformProgress> =>
  typeof value === "object" && value !== null && Symbol.asyncIterator in value

const promptOf = ({ prompt }: { prompt: unknown }) => JSON.stringify(prompt)

const isCall = (call: { prompt: unknown }, opening: string) => promptOf(call).includes(opening)

const findCall = (model: MockLanguageModelV4, opening: string) =>
  model.doGenerateCalls.find((call) => isCall(call, opening))

const listResponders = ({ rewrite: operations, answerCheck, answerRepair }: ModelAnswers) => [
  { opening: "You prepare a rewrite", respond: () => generatedJson(brief, BRIEF_INPUT_TOKENS, BRIEF_OUTPUT_TOKENS) },
  {
    opening: "You check a rewrite",
    respond: () => generatedJson(answerCheck(), CHECK_INPUT_TOKENS, CHECK_OUTPUT_TOKENS),
  },
  {
    opening: "You fix a rewrite",
    respond: () => generatedJson(answerRepair(), REPAIR_INPUT_TOKENS, REPAIR_OUTPUT_TOKENS),
  },
  {
    opening: "You apply the user's instruction",
    respond: () => generatedJson({ operations, summary: "Shortened." }, PART_INPUT_TOKENS, PART_OUTPUT_TOKENS),
  },
]

const respondTo = (responders: ReturnType<typeof listResponders>, call: { prompt: unknown }) => {
  const responder = responders.find(({ opening }) => isCall(call, opening))
  if (!responder) return failRequest()
  return responder.respond()
}

const createRewriteModel = (answers: Partial<ModelAnswers>) => {
  const responders = listResponders({ rewrite, answerCheck: findNothing, answerRepair: failRequest, ...answers })
  return new MockLanguageModelV4({
    doGenerate: async (options) => respondTo(responders, options),
  })
}

const readProgress = async (
  iterator: AsyncIterator<TransformProgress>,
  received: TransformProgress[],
): Promise<TransformProgress[]> => {
  const { done, value } = await iterator.next()
  if (done) return received
  return readProgress(iterator, [...received, value])
}

const createSettings = (model: MockLanguageModelV4, checkModel = model) => ({
  model,
  checkModel,
  providerOptions: createModelOptions("transform-test"),
})

const runTransform = async (model: MockLanguageModelV4, checkModel?: MockLanguageModelV4) => {
  const sectionUsage: LanguageModelUsage[] = []
  const modelSettings = createSettings(model, checkModel)
  const tools = createDocumentTransformTools(modelSettings, sectionUsage, document)
  const stream = await tools[TRANSFORM_DOCUMENT_TOOL].execute?.(
    { instruction: INSTRUCTION },
    { toolCallId: "transform-1", messages: [], context: {} },
  )
  if (!isProgressStream(stream)) throw new Error("The transform returned no progress stream.")
  const progress = await readProgress(stream[Symbol.asyncIterator](), [])
  return { operations: progress.flatMap((update) => update.operations), progress, sectionUsage }
}

describe("document transform", () => {
  it("shares the brief's wording for the part's terms with the part and its check", async () => {
    const model = createRewriteModel({})

    await runTransform(model)
    const partPrompt = promptOf(findCall(model, "You apply the user's instruction") ?? { prompt: "" })
    const checkPrompt = promptOf(findCall(model, "You check a rewrite") ?? { prompt: "" })

    expect(partPrompt).toContain("- badge: badge")
    expect(partPrompt).toContain("- Keep a neutral register.")
    expect(partPrompt).not.toContain("loading dock")
    expect(checkPrompt).toContain("- badge: badge")
  })

  it("shows the check each change and the strength words that changed", async () => {
    const model = createRewriteModel({})

    await runTransform(model)
    const checkPrompt = promptOf(findCall(model, "You check a rewrite") ?? { prompt: "" })

    expect(checkPrompt).toContain(INSTRUCTION)
    expect(checkPrompt).toContain("[p1] Rewrite: Visitors register at the front desk before they enter the hall.")
    expect(checkPrompt).toContain("[p1] Changes: Visitors [-should -]register")
    expect(checkPrompt).toContain('[p1] Check: \\"should\\" 1 times in the original, 0 in the rewrite')
    expect(checkPrompt).toContain("[p3] A lost badge costs 25 euros.")
  })

  it("repairs the blocks the check flags before they stream", async () => {
    const model = createRewriteModel({ answerCheck: flagFirstParagraph, answerRepair: repairFirstParagraph })

    const { operations, progress } = await runTransform(model)
    const repairPrompt = promptOf(findCall(model, "You fix a rewrite") ?? { prompt: "" })

    expect(repairPrompt).toContain(
      "[p1] Original: Visitors should register at the front desk before they enter the hall.",
    )
    expect(repairPrompt).toContain("[p1] Problem: The original says visitors should register")
    expect(operations).toEqual([rewrite[1], { op: "replace_node", nodeId: "p1", text: REPAIRED_FIRST_PARAGRAPH }])
    expect(progress.at(-1)).toMatchObject({ status: "done", editedBlockCount: 2, failedSections: [] })
  })

  it("restores a flagged block when its repair fails", async () => {
    const { operations } = await runTransform(createRewriteModel({ answerCheck: flagFirstParagraph }))

    expect(operations).toEqual([rewrite[1]])
  })

  it("leaves the rewrite unchanged when the check finds nothing", async () => {
    const { operations } = await runTransform(createRewriteModel({}))

    expect(operations).toEqual(rewrite)
  })

  it("keeps the rewrite when the check call fails", async () => {
    const { operations, progress } = await runTransform(createRewriteModel({ answerCheck: failRequest }))

    expect(operations).toEqual(rewrite)
    expect(progress.at(-1)).toMatchObject({ status: "done", failedSections: [] })
  })

  it("repairs a lost number even when the check finds nothing", async () => {
    const lostNumber: EditOperation = { op: "replace_node", nodeId: "p3", text: "A lost badge costs a fee." }
    const model = createRewriteModel({
      rewrite: [lostNumber],
      answerRepair: () => ({ corrections: [{ nodeId: "p3", text: "A lost badge costs a 25-euro fee." }] }),
    })

    const { operations } = await runTransform(model)
    const repairPrompt = promptOf(findCall(model, "You fix a rewrite") ?? { prompt: "" })

    expect(repairPrompt).toContain("[p3] Problem: Code check: lost 25")
    expect(operations).toEqual([{ op: "replace_node", nodeId: "p3", text: "A lost badge costs a 25-euro fee." }])
  })

  it("drops a block's edit that still adds a placeholder after the repair", async () => {
    const addedPlaceholder: EditOperation = {
      op: "replace_node",
      nodeId: "p3",
      text: "A lost badge costs [ORG_1] 25 euros.",
    }
    const model = createRewriteModel({
      rewrite: [addedPlaceholder],
      answerRepair: () => ({ corrections: [{ nodeId: "p3", text: addedPlaceholder.text }] }),
    })

    const { operations } = await runTransform(model)

    expect(promptOf(findCall(model, "You fix a rewrite") ?? { prompt: "" })).toContain("Code check: added [ORG_1]")
    expect(operations).toEqual([])
  })

  it("applies the check's fix to a block translated into another language", async () => {
    const translated: EditOperation = {
      op: "replace_node",
      nodeId: "p1",
      text: "Besucher melden sich am Empfang an, bevor sie die Halle betreten.",
    }
    const fix = { nodeId: "p1", problem: "should is lost.", find: "Besucher melden", replace: "Besucher sollten" }
    const model = createRewriteModel({ rewrite: [translated], answerCheck: () => ({ issues: [fix] }) })

    const { operations } = await runTransform(model)

    expect(findCall(model, "You fix a rewrite")).toBeUndefined()
    expect(operations).toEqual([
      { op: "replace_node", nodeId: "p1", text: "Besucher sollten sich am Empfang an, bevor sie die Halle betreten." },
    ])
  })

  it("strips a block type label the model copied into its text", async () => {
    const labelled: EditOperation = { op: "replace_node", nodeId: "h1", text: "(heading) Guests" }

    const { operations } = await runTransform(createRewriteModel({ rewrite: [labelled] }))

    expect(operations).toEqual([{ op: "replace_node", nodeId: "h1", text: "Guests" }])
  })

  it("runs the check and the repair on the check model", async () => {
    const model = createRewriteModel({})
    const checkModel = createRewriteModel({ answerCheck: flagFirstParagraph, answerRepair: repairFirstParagraph })

    await runTransform(model, checkModel)

    expect(model.doGenerateCalls.map(promptOf).filter((prompt) => prompt.includes("You check a rewrite"))).toEqual([])
    expect(checkModel.doGenerateCalls.map(promptOf).map((prompt) => prompt.includes("You check a rewrite"))).toEqual([
      true,
      false,
    ])
    expect(findCall(checkModel, "You fix a rewrite")?.providerOptions).toEqual(createModelOptions("transform-test"))
  })

  it("counts the tokens of every call with the part calls", async () => {
    const model = createRewriteModel({ answerCheck: flagFirstParagraph, answerRepair: repairFirstParagraph })

    const { sectionUsage } = await runTransform(model)

    expect(sectionUsage.map(({ inputTokens, outputTokens }) => ({ inputTokens, outputTokens }))).toEqual([
      { inputTokens: BRIEF_INPUT_TOKENS, outputTokens: BRIEF_OUTPUT_TOKENS },
      { inputTokens: PART_INPUT_TOKENS, outputTokens: PART_OUTPUT_TOKENS },
      { inputTokens: CHECK_INPUT_TOKENS, outputTokens: CHECK_OUTPUT_TOKENS },
      { inputTokens: REPAIR_INPUT_TOKENS, outputTokens: REPAIR_OUTPUT_TOKENS },
    ])
  })

  it("rewrites without the brief when the brief call fails", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        if (isCall(options, "You prepare a rewrite")) return failRequest()
        if (isCall(options, "You check a rewrite")) return generatedJson(findNothing(), 1, 1)
        return generatedJson({ operations: rewrite, summary: "Shortened." }, 1, 1)
      },
    })

    const { operations } = await runTransform(model)

    expect(operations).toEqual(rewrite)
  })
})
