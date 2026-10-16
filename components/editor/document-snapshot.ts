import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model"
import type { SelectionRange } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import {
  contentEnd,
  contentStart,
  listTextBlocks,
  readBlockId,
  readBlockText,
  readTextOffset,
  type TextBlock,
} from "@/components/editor/text-blocks"
import type { DocumentSnapshot, FocusRange, OutlineEntry, Section } from "@/lib/document-snapshot"

const HEADING_TYPE = "heading"

type DescribeContainer = (resolved: ResolvedPos) => string

const isHeading = ({ node }: TextBlock) => node.type.name === HEADING_TYPE

const headingLevel = ({ node }: TextBlock): number => node.attrs.level

const toOutlineEntry = (block: TextBlock): OutlineEntry => ({
  nodeId: readBlockId(block),
  level: headingLevel(block),
  text: readBlockText(block),
})

const describeTableCell = (resolved: ResolvedPos) =>
  `r${resolved.index(resolved.depth - 2) + 1}c${resolved.index(resolved.depth - 1) + 1}`

const describeListItem = (resolved: ResolvedPos) =>
  resolved.node(resolved.depth - 1).type.name === "orderedList" ? "numbered item" : "bullet item"

const containerDescriptions: Partial<Record<string, DescribeContainer>> = {
  listItem: describeListItem,
  tableHeader: (resolved) => `table header ${describeTableCell(resolved)}`,
  tableCell: (resolved) => `table cell ${describeTableCell(resolved)}`,
  blockquote: () => "quote",
}

const tableCellTypes = ["tableCell", "tableHeader"]

const describePlacement = (documentNode: ProseMirrorNode, block: TextBlock) => {
  if (isHeading(block)) return HEADING_TYPE
  const resolved = documentNode.resolve(block.position)
  const describeContainer = containerDescriptions[resolved.parent.type.name]
  return describeContainer ? describeContainer(resolved) : block.node.type.name
}

const readTableRow = (documentNode: ProseMirrorNode, block: TextBlock): Pick<Section, "tableId" | "rowId"> => {
  const resolved = documentNode.resolve(block.position)
  if (!tableCellTypes.includes(resolved.parent.type.name)) return {}
  return { tableId: resolved.node(resolved.depth - 2).attrs.id, rowId: resolved.node(resolved.depth - 1).attrs.id }
}

const sectionEnd = (blocks: TextBlock[], start: number) => {
  const level = isHeading(blocks[start]) ? headingLevel(blocks[start]) : Number.POSITIVE_INFINITY
  const end = blocks.findIndex((block, index) => index > start && isHeading(block) && headingLevel(block) <= level)
  return end < 0 ? blocks.length : end
}

const sectionAround = (blocks: TextBlock[], blockIndex: number) => {
  const start = Math.max(
    blocks.findLastIndex((block, index) => index <= blockIndex && isHeading(block)),
    0,
  )
  return { start, end: sectionEnd(blocks, start) }
}

const blocksBeforeFirstHeading = (blocks: TextBlock[]) => {
  const firstHeading = blocks.findIndex(isHeading)
  return firstHeading < 0 ? blocks : blocks.slice(0, firstHeading)
}

const selectSectionBlocks = (blocks: TextBlock[], focus: FocusRange[]) => {
  if (focus.length === 0) return blocksBeforeFirstHeading(blocks)
  const focusedIds = new Set(focus.map(({ nodeId }) => nodeId))
  const sections = blocks.flatMap((block, index) =>
    focusedIds.has(readBlockId(block)) ? [sectionAround(blocks, index)] : [],
  )
  return blocks.filter((_, index) => sections.some(({ start, end }) => index >= start && index < end))
}

const focusInBlock = (block: TextBlock, { $from, $to }: SelectionRange): FocusRange => ({
  nodeId: readBlockId(block),
  from: readTextOffset(block, Math.max($from.pos, contentStart(block))),
  to: readTextOffset(block, Math.min($to.pos, contentEnd(block))),
})

const readFocus = (blocks: TextBlock[], ranges: readonly SelectionRange[]) =>
  ranges.flatMap((range) => blocks.map((block) => focusInBlock(block, range))).filter(({ from, to }) => from < to)

export const buildDocumentSnapshot = (editor: Editor): DocumentSnapshot => {
  const { doc: documentNode, selection } = editor.state
  const blocks = listTextBlocks(documentNode)
  const focus = readFocus(blocks, selection.ranges)
  const toSection = (block: TextBlock): Section => ({
    nodeId: readBlockId(block),
    type: describePlacement(documentNode, block),
    text: readBlockText(block),
    ...readTableRow(documentNode, block),
  })
  return {
    document: {
      outline: blocks.filter(isHeading).map(toOutlineEntry),
      sections: selectSectionBlocks(blocks, focus).map(toSection),
      blocks: blocks.map(toSection),
    },
    focus,
  }
}
