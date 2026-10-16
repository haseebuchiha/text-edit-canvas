import { z } from "zod"

export const ANSWER_QUESTION_TOOL = "answer_question"

const answerQuoteSchema = z.object({
  nodeId: z.string().min(1).describe("The node ID of the block the quote comes from"),
  text: z.string().min(1).describe("The sentence that states the fact, copied exactly from that block"),
})

export const answerQuestionInputSchema = z.object({
  quotes: z
    .array(answerQuoteSchema)
    .describe("Exact excerpts from the document that state the answer. Empty only when the document doesn't hold it"),
  answer: z.string().min(1).describe("The answer, briefly, saying only what the quotes state"),
})

export const answerCheckSchema = z.object({ verified: z.boolean() })

export type AnswerQuote = z.infer<typeof answerQuoteSchema>
export type AnswerQuestionInput = z.infer<typeof answerQuestionInputSchema>
