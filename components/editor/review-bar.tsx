"use client"

import { type Editor, type EditorStateSnapshot, useEditorState } from "@tiptap/react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import {
  findNextSuggestion,
  findPreviousSuggestion,
  goToSuggestion,
  type ReviewPosition,
  readReviewPosition,
} from "@/components/editor/review-navigation"
import { acceptAllSuggestions, rejectAllSuggestions } from "@/components/editor/suggestions"
import { Button } from "@/components/ui/button"

type ReviewBarProps = {
  editor: Editor | null
}

const NO_SUGGESTIONS: ReviewPosition = { current: 0, count: 0 }

const readPosition = ({ editor }: EditorStateSnapshot<Editor | null>) =>
  editor ? readReviewPosition(editor.state) : NO_SUGGESTIONS

const describeCount = (count: number) => (count === 1 ? "1 suggested change" : `${count} suggested changes`)

const describePosition = ({ current, count }: ReviewPosition) =>
  current > 0 ? `Change ${current} of ${count}` : describeCount(count)

const ReviewBar = ({ editor }: ReviewBarProps) => {
  const position = useEditorState({ editor, selector: readPosition }) ?? NO_SUGGESTIONS
  if (!editor || position.count === 0) return null
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
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Previous change"
          title="Previous change"
          onClick={() => goToSuggestion(editor, findPreviousSuggestion)}
        >
          <ChevronUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Next change"
          title="Next change"
          onClick={() => goToSuggestion(editor, findNextSuggestion)}
        >
          <ChevronDownIcon />
        </Button>
      </div>
      <p aria-live="polite" className="flex-1 text-muted-foreground">
        {describePosition(position)}
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
