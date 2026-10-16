import { z } from "zod"

export const EDIT_DOCUMENT_TOOL = "edit_document"

const nodeIdSchema = z.string().min(1).describe("The block's node ID, as shown in square brackets")

const replaceNodeSchema = z.object({
  op: z.literal("replace_node"),
  nodeId: nodeIdSchema,
  text: z.string().describe("The block's complete new text, as plain text"),
})

const replaceTextSchema = z.object({
  op: z.literal("replace_text"),
  nodeId: nodeIdSchema,
  find: z.string().min(1).describe("Text copied exactly from the block. Only its first occurrence is replaced"),
  replace: z.string().describe("The text that takes its place"),
})

export const editOperationSchema = z.union([replaceNodeSchema, replaceTextSchema])

export const editDocumentInputSchema = z.object({
  operations: z.array(editOperationSchema),
  summary: z.string().describe("One short sentence on what changed, in the user's language"),
})

export const editCheckSchema = z.object({ accepted: z.boolean() })

export type ReplaceNodeOperation = z.infer<typeof replaceNodeSchema>
export type ReplaceTextOperation = z.infer<typeof replaceTextSchema>
export type EditOperation = z.infer<typeof editOperationSchema>
