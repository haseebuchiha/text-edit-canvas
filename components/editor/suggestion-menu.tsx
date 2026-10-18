"use client"

import { type Editor, posToDOMRect } from "@tiptap/react"
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus"
import { useEffect, useMemo } from "react"
import {
  findCurrentSuggestionRange,
  hasCurrentSuggestion,
  resolveCurrentSuggestion,
} from "@/components/editor/review-navigation"
import { acceptSuggestion, rejectSuggestion } from "@/components/editor/suggestions"
import { Button } from "@/components/ui/button"

type SuggestionMenuProps = {
  editor: Editor
  scrollArea: HTMLElement
}

type ShouldShowProps = Parameters<NonNullable<BubbleMenuProps["shouldShow"]>>[0]

type ResolveSuggestion = (editor: Editor, suggestionId: string) => void

const MENU_KEY = "suggestionMenu"

const MENU_GAP = 6

const EDGE_PADDING = 8

const createMenuOptions = (scrollArea: HTMLElement): BubbleMenuProps["options"] => ({
  placement: "bottom-start",
  offset: MENU_GAP,
  flip: { padding: EDGE_PADDING },
  shift: { padding: EDGE_PADDING },
  scrollTarget: scrollArea,
})

const isReviewingSuggestion = ({ state }: ShouldShowProps) => hasCurrentSuggestion(state)

const showMenuAgain = (editor: Editor) => {
  if (hasCurrentSuggestion(editor.state)) editor.view.dispatch(editor.state.tr.setMeta(MENU_KEY, "show"))
}

const measureCurrentSuggestion = (editor: Editor) => {
  const { from, to } = findCurrentSuggestionRange(editor.state) ?? editor.state.selection
  return posToDOMRect(editor.view, from, to)
}

const anchorToCurrentSuggestion = (editor: Editor) => {
  if (!hasCurrentSuggestion(editor.state)) return null
  return {
    getBoundingClientRect: () => measureCurrentSuggestion(editor),
    getClientRects: () => [measureCurrentSuggestion(editor)],
  }
}

const SuggestionMenu = ({ editor, scrollArea }: SuggestionMenuProps) => {
  const options = useMemo(() => createMenuOptions(scrollArea), [scrollArea])
  useEffect(() => {
    const keepMenuOpen = () => showMenuAgain(editor)
    editor.on("blur", keepMenuOpen)
    return () => {
      editor.off("blur", keepMenuOpen)
    }
  }, [editor])
  const resolveAtCursor = (resolve: ResolveSuggestion) => {
    resolveCurrentSuggestion(editor, resolve)
    editor.commands.focus(null, { scrollIntoView: false })
  }
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={MENU_KEY}
      shouldShow={isReviewingSuggestion}
      getReferencedVirtualElement={() => anchorToCurrentSuggestion(editor)}
      options={options}
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
