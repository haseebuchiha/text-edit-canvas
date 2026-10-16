import { Mark, mergeAttributes } from "@tiptap/react"

export const INSERTED_MARK = "inserted"
export const DELETED_MARK = "deleted"

const SUGGESTION_MARKS = `${INSERTED_MARK} ${DELETED_MARK}`

const createSuggestionMark = (name: string, tag: string) =>
  Mark.create({
    name,
    inclusive: false,
    excludes: SUGGESTION_MARKS,
    addAttributes: () => ({
      id: { default: null, renderHTML: ({ id }) => ({ "data-suggestion-id": id }) },
    }),
    renderHTML: ({ HTMLAttributes }) => [tag, mergeAttributes(HTMLAttributes, { "data-suggestion": name }), 0],
  })

export const InsertedMark = createSuggestionMark(INSERTED_MARK, "ins")

export const DeletedMark = createSuggestionMark(DELETED_MARK, "del")
