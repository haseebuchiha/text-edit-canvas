"use client"

import { EditorContent, type Editor as TiptapEditor, useEditor } from "@tiptap/react"
import { useEffect, useState } from "react"
import { createEditorExtensions } from "@/components/editor/editor-extensions"
import ReviewBar from "@/components/editor/review-bar"
import SuggestionMenu from "@/components/editor/suggestion-menu"
import Toolbar from "@/components/editor/toolbar"
import sampleDocument from "@/lib/sample-document"

type EditorProps = {
  onEditorChange: (editor: TiptapEditor | null) => void
}

const Editor = ({ onEditorChange }: EditorProps) => {
  const [extensions] = useState(createEditorExtensions)
  const editor = useEditor({ extensions, content: sampleDocument, immediatelyRender: false })
  useEffect(() => onEditorChange(editor), [editor, onEditorChange])
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} />
      <ReviewBar editor={editor} />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="mx-auto max-w-3xl px-6 py-8" />
        {editor && <SuggestionMenu editor={editor} />}
      </div>
    </div>
  )
}

export default Editor
