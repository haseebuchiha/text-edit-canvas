import { z } from "zod"

const nodeIdSchema = z.string().min(1)
const characterOffsetSchema = z.number().int().nonnegative()

const outlineEntrySchema = z.object({ nodeId: nodeIdSchema, level: z.number().int().min(1).max(6), text: z.string() })

const sectionSchema = z.object({
  nodeId: nodeIdSchema,
  type: z.string().min(1),
  text: z.string(),
  tableId: nodeIdSchema.optional(),
  rowId: nodeIdSchema.optional(),
})

const focusRangeSchema = z.object({ nodeId: nodeIdSchema, from: characterOffsetSchema, to: characterOffsetSchema })

export const documentSnapshotSchema = z.object({
  document: z.object({
    outline: z.array(outlineEntrySchema),
    sections: z.array(sectionSchema),
    blocks: z.array(sectionSchema),
  }),
  focus: z.array(focusRangeSchema),
})

export type OutlineEntry = z.infer<typeof outlineEntrySchema>
export type Section = z.infer<typeof sectionSchema>
export type FocusRange = z.infer<typeof focusRangeSchema>
export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>
