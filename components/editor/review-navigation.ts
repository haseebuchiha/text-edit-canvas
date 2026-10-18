import { type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import { type Editor, Extension } from "@tiptap/react"
import {
  findSuggestionAt,
  findSuggestionRange,
  listSuggestionIds,
  listSuggestionStarts,
  type SuggestionStart,
} from "@/components/editor/suggestions"

export type ReviewCursor = { position: number; currentId?: string }

export type ReviewPosition = { current: number; count: number }

export type SuggestionFinder = (starts: SuggestionStart[], cursor: ReviewCursor) => SuggestionStart | undefined

type ResolveSuggestion = (editor: Editor, suggestionId: string) => void

const CURRENT_SUGGESTION_CLASS = "current-suggestion"

const SCROLL_OPTIONS: ScrollIntoViewOptions = { behavior: "smooth", block: "center" }

const revealKey = new PluginKey<number>("reviewNavigation")

const readAnchor = (starts: SuggestionStart[], { position, currentId }: ReviewCursor) =>
  starts.find(({ id }) => id === currentId)?.from ?? position

export const findNextSuggestion: SuggestionFinder = (starts, cursor) => {
  const anchor = readAnchor(starts, cursor)
  return starts.find(({ from }) => from > anchor) ?? starts[0]
}

export const findPreviousSuggestion: SuggestionFinder = (starts, cursor) => {
  const anchor = readAnchor(starts, cursor)
  return starts.findLast(({ from }) => from < anchor) ?? starts.at(-1)
}

const readReviewCursor = (state: EditorState): ReviewCursor => ({
  position: state.selection.from,
  currentId: findSuggestionAt(state),
})

export const readReviewPosition = (state: EditorState): ReviewPosition => {
  const suggestionIds = listSuggestionIds(state.doc)
  const currentId = findSuggestionAt(state)
  return { current: suggestionIds.findIndex((id) => id === currentId) + 1, count: suggestionIds.length }
}

export const hasCurrentSuggestion = (state: EditorState) => findSuggestionAt(state) !== undefined

export const findCurrentSuggestionRange = (state: EditorState) => {
  const suggestionId = findSuggestionAt(state)
  return suggestionId ? findSuggestionRange(state.doc, suggestionId) : undefined
}

export const revealSuggestion = (transaction: Transaction, suggestionId: string) => {
  const range = findSuggestionRange(transaction.doc, suggestionId)
  if (!range) return transaction
  return transaction.setSelection(TextSelection.create(transaction.doc, range.from)).setMeta(revealKey, true)
}

export const revealFirstNewSuggestion = (transaction: Transaction) => {
  const previousIds = new Set(listSuggestionIds(transaction.before))
  const firstNewId = listSuggestionIds(transaction.doc).find((suggestionId) => !previousIds.has(suggestionId))
  return firstNewId ? revealSuggestion(transaction, firstNewId) : transaction
}

export const goToSuggestion = (editor: Editor, findSuggestion: SuggestionFinder) => {
  const target = findSuggestion(listSuggestionStarts(editor.state.doc), readReviewCursor(editor.state))
  if (!target) return
  editor.view.dispatch(revealSuggestion(editor.state.tr, target.id))
  editor.commands.focus(null, { scrollIntoView: false })
}

const findFollowingSuggestion = (state: EditorState, suggestionId: string) => {
  const cursor = { position: state.selection.from, currentId: suggestionId }
  const following = findNextSuggestion(listSuggestionStarts(state.doc), cursor)
  return following?.id === suggestionId ? undefined : following
}

export const resolveCurrentSuggestion = (editor: Editor, resolve: ResolveSuggestion) => {
  const suggestionId = findSuggestionAt(editor.state)
  if (!suggestionId) return
  const following = findFollowingSuggestion(editor.state, suggestionId)
  resolve(editor, suggestionId)
  if (following) editor.view.dispatch(revealSuggestion(editor.state.tr, following.id))
}

const countReveals = (transaction: Transaction, revealCount: number) =>
  transaction.getMeta(revealKey) ? revealCount + 1 : revealCount

const readRevealCount = (state: EditorState) => revealKey.getState(state) ?? 0

const decorateCurrentSuggestion = (state: EditorState) => {
  const range = findCurrentSuggestionRange(state)
  if (!range) return DecorationSet.empty
  const highlight = Decoration.inline(range.from, range.to, { class: CURRENT_SUGGESTION_CLASS })
  return DecorationSet.create(state.doc, [highlight])
}

const scrollToCurrentSuggestion = (view: EditorView) =>
  view.dom.querySelector(`.${CURRENT_SUGGESTION_CLASS}`)?.scrollIntoView(SCROLL_OPTIONS)

const createRevealView = () => ({
  update: (view: EditorView, previousState: EditorState) => {
    if (readRevealCount(view.state) > readRevealCount(previousState)) scrollToCurrentSuggestion(view)
  },
})

export const ReviewNavigation = Extension.create({
  name: "reviewNavigation",
  addProseMirrorPlugins: () => [
    new Plugin<number>({
      key: revealKey,
      state: { init: () => 0, apply: countReveals },
      props: { decorations: decorateCurrentSuggestion },
      view: createRevealView,
    }),
  ],
})
