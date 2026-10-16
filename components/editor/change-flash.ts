import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state"
import type { StepMap } from "@tiptap/pm/transform"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import { Extension } from "@tiptap/react"

type ChangedRange = { from: number; to: number }

type FlashState = { decorations: DecorationSet; version: number }

type FlashMeta = { ranges: ChangedRange[] } | { clear: true }

type FlashTimer = { timeout?: ReturnType<typeof setTimeout> }

const FLASH_CLASS = "change-flash"
const FLASH_MS = 2000
const NEW_START_INDEX = 2
const NEW_END_INDEX = 3

const changeFlashKey = new PluginKey<FlashState>("changeFlash")

const EMPTY_FLASH: FlashState = { decorations: DecorationSet.empty, version: 0 }

const listStepRanges = (map: StepMap) => {
  const ranges: ChangedRange[] = []
  const collectRange = (...bounds: number[]) =>
    ranges.push({ from: bounds[NEW_START_INDEX], to: bounds[NEW_END_INDEX] })
  map.forEach(collectRange)
  return ranges
}

const listChangedRanges = ({ mapping }: Transaction) =>
  mapping.maps.flatMap((map, index) =>
    listStepRanges(map).map(({ from, to }) => ({
      from: mapping.slice(index + 1).map(from, -1),
      to: mapping.slice(index + 1).map(to, 1),
    })),
  )

export const flashChanges = (transaction: Transaction) =>
  transaction.setMeta(changeFlashKey, { ranges: listChangedRanges(transaction).filter(({ from, to }) => from < to) })

const addFlash = (transaction: Transaction, decorations: DecorationSet, ranges: ChangedRange[]) =>
  decorations.add(
    transaction.doc,
    ranges.map(({ from, to }) => Decoration.inline(from, to, { class: FLASH_CLASS })),
  )

const isClearing = (meta?: FlashMeta) => meta !== undefined && "clear" in meta

const readNewRanges = (meta?: FlashMeta) => (meta && "ranges" in meta ? meta.ranges : [])

const applyFlash = (transaction: Transaction, { decorations, version }: FlashState): FlashState => {
  const meta: FlashMeta | undefined = transaction.getMeta(changeFlashKey)
  if (isClearing(meta)) return EMPTY_FLASH
  const mapped = decorations.map(transaction.mapping, transaction.doc)
  const ranges = readNewRanges(meta)
  if (ranges.length === 0) return { decorations: mapped, version }
  return { decorations: addFlash(transaction, mapped, ranges), version: version + 1 }
}

const readVersion = (state: EditorState) => changeFlashKey.getState(state)?.version ?? 0

const clearFlash = (view: EditorView) => {
  if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(changeFlashKey, { clear: true }))
}

const createFlashView = () => {
  const timer: FlashTimer = {}
  const restartTimer = (view: EditorView) => {
    clearTimeout(timer.timeout)
    timer.timeout = setTimeout(() => clearFlash(view), FLASH_MS)
  }
  return {
    update: (view: EditorView, previousState: EditorState) => {
      if (readVersion(view.state) > readVersion(previousState)) restartTimer(view)
    },
    destroy: () => clearTimeout(timer.timeout),
  }
}

export const ChangeFlash = Extension.create({
  name: "changeFlash",
  addProseMirrorPlugins: () => [
    new Plugin<FlashState>({
      key: changeFlashKey,
      state: { init: () => EMPTY_FLASH, apply: applyFlash },
      props: { decorations: (state) => changeFlashKey.getState(state)?.decorations },
      view: createFlashView,
    }),
  ],
})
