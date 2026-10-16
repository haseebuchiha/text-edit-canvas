"use client"

import { type Editor, type EditorStateSnapshot, useEditorState } from "@tiptap/react"
import { acceptAllSuggestions, listSuggestionIds, rejectAllSuggestions } from "@/components/editor/suggestions"
import { Button } from "@/components/ui/button"

type ReviewBarProps = {
  editor: Editor | null
}

const countSuggestions = ({ editor }: EditorStateSnapshot<Editor | null>) =>
  editor ? listSuggestionIds(editor.state.doc).length : 0

const describeCount = (count: number) => (count === 1 ? "1 suggested change" : `${count} suggested changes`)

const ReviewBar = ({ editor }: ReviewBarProps) => {
  const count = useEditorState({ editor, selector: countSuggestions }) ?? 0
  if (!editor || count === 0) return null
  const resolveAll = (resolve: (target: Editor) => void) => {
    resolve(editor)
    editor.commands.focus(null, { scrollIntoView: false })
  }
  return (
    <div
      role="region"
      aria-label="Suggested changes"
      className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
    >
      <p className="flex-1 text-muted-foreground">
        {describeCount(count)}. Click a change to accept or reject it on its own.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={() => resolveAll(rejectAllSuggestions)}>
        Reject all
      </Button>
      <Button type="button" size="sm" onClick={() => resolveAll(acceptAllSuggestions)}>
        Accept all
      </Button>
    </div>
  )
}

export default ReviewBar
