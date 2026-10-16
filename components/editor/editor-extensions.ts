import { TableKit } from "@tiptap/extension-table"
import { UniqueID } from "@tiptap/extension-unique-id"
import { Selection } from "@tiptap/extensions"
import { StarterKit } from "@tiptap/starter-kit"
import { ChangeFlash } from "@/components/editor/change-flash"
import { DeletedMark, InsertedMark } from "@/components/editor/suggestion-marks"

const blockTypesWithIds = [
  "heading",
  "paragraph",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "table",
  "tableRow",
]

const createBlockIdGenerator = () => {
  const counter = { lastBlockId: 0 }
  const generateBlockId = () => {
    counter.lastBlockId += 1
    return String(counter.lastBlockId)
  }
  return generateBlockId
}

export const createEditorExtensions = () => [
  StarterKit.configure({ link: { openOnClick: false } }),
  TableKit.configure({ table: { resizable: false } }),
  UniqueID.configure({ types: blockTypesWithIds, generateID: createBlockIdGenerator() }),
  Selection,
  InsertedMark,
  DeletedMark,
  ChangeFlash,
]
