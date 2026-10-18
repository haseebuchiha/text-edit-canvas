import { z } from "zod"
import type { OutlineEntry, Section } from "@/lib/document-snapshot"
import type { ReplaceNodeOperation } from "@/lib/edit-operations"

export type BlockTexts = Partial<Record<string, string>>

const SUMMARY_DESCRIPTION = "One short sentence for the user on what changed, in the user's language"

export const createBlockTextsSchema = (nodeIds: string[]) =>
  z.object({
    blocks: z.object(Object.fromEntries(nodeIds.map((nodeId) => [nodeId, z.string()]))),
    summary: z.string().describe(SUMMARY_DESCRIPTION),
  })

const isText = (value: unknown): value is string => typeof value === "string"

export const listCompletedIds = (nodeIds: string[], texts: BlockTexts, isFinished: boolean) => {
  const presentIds = nodeIds.filter((nodeId) => isText(texts[nodeId]))
  return isFinished ? presentIds : presentIds.slice(0, -1)
}

const stripTypeLabel = ({ type }: Section, text: string) => {
  const label = `(${type}) `
  return text.startsWith(label) ? text.slice(label.length) : text
}

const toReplaceOperation = (block: Section, text?: string): ReplaceNodeOperation[] => {
  if (text === undefined) return []
  const newText = stripTypeLabel(block, text)
  if (newText.trim() === block.text.trim()) return []
  return [{ op: "replace_node", nodeId: block.nodeId, text: newText }]
}

export const toReplaceOperations = (blocks: Section[], texts: BlockTexts) =>
  blocks.flatMap((block) => toReplaceOperation(block, texts[block.nodeId]))

const isListed = (nodeIds: Set<string>, block?: Section) => block !== undefined && nodeIds.has(block.nodeId)

export const selectContextBlocks = (blocks: Section[], targetIds: Set<string>) =>
  blocks.filter(
    (block, index) =>
      !targetIds.has(block.nodeId) &&
      (isListed(targetIds, blocks[index - 1]) || isListed(targetIds, blocks[index + 1])),
  )

const findSectionStart = (blocks: Section[], headingIds: Set<string>, index: number) => {
  const headingIndex = blocks.findLastIndex((block, position) => position <= index && headingIds.has(block.nodeId))
  return blocks[headingIndex < 0 ? index : headingIndex].nodeId
}

export const listBlocksBeforeFirstHeading = (blocks: Section[], outline: OutlineEntry[]) => {
  const headingIds = new Set(outline.map(({ nodeId }) => nodeId))
  const firstHeading = blocks.findIndex((block) => headingIds.has(block.nodeId))
  return firstHeading < 0 ? blocks : blocks.slice(0, firstHeading)
}

export const selectSectionBlocks = (blocks: Section[], outline: OutlineEntry[], pickedIds: string[]) => {
  const headingIds = new Set(outline.map(({ nodeId }) => nodeId))
  const picked = new Set(pickedIds)
  return blocks.filter((_block, index) => picked.has(findSectionStart(blocks, headingIds, index)))
}
