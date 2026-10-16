"use client"

import { type Editor, type EditorStateSnapshot, useEditorState } from "@tiptap/react"
import {
  BoldIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  type LucideIcon,
  TableIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const TABLE_SIZE = 3

type ToolbarAction = {
  label: string
  icon: LucideIcon
  run: (editor: Editor) => void
  isActive?: (editor: Editor) => boolean
}

type ToolbarButtonProps = {
  action: ToolbarAction
  editor: Editor | null
  isActive: boolean
}

type ToolbarProps = {
  editor: Editor | null
}

const applyLink = (editor: Editor, url: string) => {
  const chain = editor.chain().focus().extendMarkRange("link")
  return url ? chain.setLink({ href: url }).run() : chain.unsetLink().run()
}

const promptForLink = (editor: Editor) => {
  const currentUrl: string | undefined = editor.getAttributes("link").href
  const url = window.prompt("Link URL", currentUrl)
  if (url !== null) applyLink(editor, url.trim())
}

const insertTable = (editor: Editor) =>
  editor.chain().focus().insertTable({ rows: TABLE_SIZE, cols: TABLE_SIZE, withHeaderRow: true }).run()

const toolbarActions: ToolbarAction[] = [
  {
    label: "Bold",
    icon: BoldIcon,
    run: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive("bold"),
  },
  {
    label: "Italic",
    icon: ItalicIcon,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive("italic"),
  },
  {
    label: "Heading 1",
    icon: Heading1Icon,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
  },
  {
    label: "Heading 2",
    icon: Heading2Icon,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    label: "Bullet list",
    icon: ListIcon,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive("bulletList"),
  },
  { label: "Link", icon: LinkIcon, run: promptForLink, isActive: (editor) => editor.isActive("link") },
  { label: "Insert table", icon: TableIcon, run: insertTable },
]

const selectActiveStates = ({ editor }: EditorStateSnapshot<Editor | null>) =>
  toolbarActions.map((action) => Boolean(editor && action.isActive?.(editor)))

const ToolbarButton = ({ action, editor, isActive }: ToolbarButtonProps) => {
  const { label, icon: ActionIcon } = action
  const runAction = () => {
    if (editor) action.run(editor)
  }
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={action.isActive ? isActive : undefined}
      disabled={!editor}
      onClick={runAction}
    >
      <ActionIcon />
    </Button>
  )
}

const Toolbar = ({ editor }: ToolbarProps) => {
  const activeStates = useEditorState({ editor, selector: selectActiveStates })
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 border-b p-2">
      {toolbarActions.map((action, index) => (
        <ToolbarButton key={action.label} action={action} editor={editor} isActive={activeStates?.[index] ?? false} />
      ))}
    </div>
  )
}

export default Toolbar
