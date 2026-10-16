import { type DynamicToolUIPart, getToolName, type ToolUIPart } from "ai"
import { ANSWER_QUESTION_TOOL, answerCheckSchema, answerQuestionInputSchema } from "@/lib/answer-question"
import { TRANSFORM_DOCUMENT_TOOL } from "@/lib/transform-document"

export type ToolPartValue = ToolUIPart | DynamicToolUIPart

type ToolState = ToolPartValue["state"]

const RUNNING_STATES = new Set<ToolState>(["input-streaming", "input-available"])

const isPreliminary = (part: ToolPartValue) => part.state === "output-available" && part.preliminary === true

export const isToolBusy = (part: ToolPartValue) => RUNNING_STATES.has(part.state) || isPreliminary(part)

const describeApproval = (toolName: string, part: ToolPartValue) =>
  part.approval?.approved ? `${toolName} approved` : `${toolName} rejected`

const describeOutput = (toolName: string, part: ToolPartValue) =>
  isPreliminary(part) ? `Running ${toolName}…` : `${toolName} done`

const toolStateLabels: Record<ToolState, (toolName: string, part: ToolPartValue) => string> = {
  "input-streaming": (toolName) => `Preparing ${toolName}…`,
  "input-available": (toolName) => `Running ${toolName}…`,
  "approval-requested": (toolName) => `${toolName} is waiting for approval`,
  "approval-responded": describeApproval,
  "output-available": describeOutput,
  "output-error": (toolName) => `${toolName} failed`,
  "output-denied": (toolName) => `${toolName} was denied`,
}

export const describeToolState = (toolName: string, part: ToolPartValue) => toolStateLabels[part.state](toolName, part)

export const formatToolValue = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value, null, 2))

export const isAnswerPart = (part: ToolPartValue) => getToolName(part) === ANSWER_QUESTION_TOOL

export const isTransformPart = (part: ToolPartValue) => getToolName(part) === TRANSFORM_DOCUMENT_TOOL

const isVerifiedOutput = (output: unknown) => answerCheckSchema.safeParse(output).data?.verified === true

export const readVerifiedAnswer = (part: ToolPartValue) =>
  part.state === "output-available" && isVerifiedOutput(part.output)
    ? answerQuestionInputSchema.safeParse(part.input).data
    : undefined
