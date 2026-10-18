"use client"

import { type Editor, posToDOMRect } from "@tiptap/react"
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus"
import { findCurrentSuggestionRange, resolveCurrentSuggestion } from "@/components/editor/review-navigation"
import { acceptSuggestion, findSuggestionAt, rejectSuggestion } from "@/components/editor/suggestions"
import { Button } from "@/components/ui/button"

type SuggestionMenuProps = {
  editor: Editor
}

type ShouldShowProps = Parameters<NonNullable<BubbleMenuProps["shouldShow"]>>[0]

type ResolveSuggestion = (editor: Editor, suggestionId: string) => void

const MENU_OPTIONS: BubbleMenuProps["options"] = { placement: "bottom-start", offset: 6 }

const isFocused = ({ view, element }: ShouldShowProps) => view.hasFocus() || element.contains(document.activeElement)

const isReviewingSuggestion = (props: ShouldShowProps) =>
  isFocused(props) && findSuggestionAt(props.state) !== undefined

const anchorBelowSuggestion = (editor: Editor) => {
  const range = findCurrentSuggestionRange(editor.state)
  if (!range) return null
  const rect = posToDOMRect(editor.view, range.from, range.to)
  return { getBoundingClientRect: () => rect, getClientRects: () => [rect] }
}

const SuggestionMenu = ({ editor }: SuggestionMenuProps) => {
  const resolveAtCursor = (resolve: ResolveSuggestion) => {
    resolveCurrentSuggestion(editor, resolve)
    editor.commands.focus(null, { scrollIntoView: false })
  }
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={isReviewingSuggestion}
      getReferencedVirtualElement={() => anchorBelowSuggestion(editor)}
      options={MENU_OPTIONS}
      className="z-10"
    >
      <div role="group" aria-label="Review change" className="flex gap-1 rounded-md border bg-popover p-1 shadow-md">
        <Button type="button" size="xs" onClick={() => resolveAtCursor(acceptSuggestion)}>
          Accept
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={() => resolveAtCursor(rejectSuggestion)}>
          Reject
        </Button>
      </div>
    </BubbleMenu>
  )
}

export default SuggestionMenu
