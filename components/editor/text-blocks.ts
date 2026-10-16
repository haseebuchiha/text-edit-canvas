import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model"
import { DELETED_MARK } from "@/components/editor/suggestion-marks"

export type TextBlock = { node: ProseMirrorNode; position: number }

const INLINE_LEAF_TEXT = "\n"

const hasBlockId = (node: ProseMirrorNode) => node.isTextblock && typeof node.attrs.id === "string"

export const listTextBlocks = (documentNode: ProseMirrorNode) => {
  const blocks: TextBlock[] = []
  const collectTextBlock = (node: ProseMirrorNode, position: number) => {
    if (hasBlockId(node)) blocks.push({ node, position })
    return !node.isTextblock
  }
  documentNode.descendants(collectTextBlock)
  return blocks
}

export const readBlockId = ({ node }: TextBlock): string => node.attrs.id

export const readFragmentText = (fragment: Fragment) =>
  fragment.textBetween(0, fragment.size, undefined, INLINE_LEAF_TEXT)

export const hasMarkNamed = (node: ProseMirrorNode, markName: string) =>
  node.marks.some((mark) => mark.type.name === markName)

const dropDeletedText = (fragment: Fragment) =>
  Fragment.fromArray(fragment.content.filter((node) => !hasMarkNamed(node, DELETED_MARK)))

export const readBlockText = ({ node }: TextBlock) => readFragmentText(dropDeletedText(node.content))

export const contentStart = ({ position }: TextBlock) => position + 1

export const contentEnd = ({ node, position }: TextBlock) => position + node.nodeSize - 1

export const readTextOffset = (block: TextBlock, position: number) => {
  const offset = Math.min(Math.max(position - contentStart(block), 0), block.node.content.size)
  return readFragmentText(dropDeletedText(block.node.content.cut(0, offset))).length
}

export const findTextBlock = (documentNode: ProseMirrorNode, nodeId: string) =>
  listTextBlocks(documentNode).find((block) => readBlockId(block) === nodeId)
