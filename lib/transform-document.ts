import { z } from "zod"
import { editOperationSchema } from "@/lib/edit-operations"

export const TRANSFORM_DOCUMENT_TOOL = "transform_document"

const countSchema = z.number().int().nonnegative()

export const transformDocumentInputSchema = z.object({
  instruction: z.string().min(1).describe("The user's instruction for the whole document, in their words"),
})

export const transformProgressSchema = z.object({
  status: z.enum(["running", "done"]),
  sectionCount: countSchema,
  finishedCount: countSchema,
  failedSections: z.array(z.string()),
  editedBlockCount: countSchema,
  rejectedEditCount: countSchema,
  operations: z.array(editOperationSchema),
})

export type TransformProgress = z.infer<typeof transformProgressSchema>
