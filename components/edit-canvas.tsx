"use client"

import type { Editor as TiptapEditor } from "@tiptap/react"
import dynamic from "next/dynamic"
import { useState } from "react"
import ChatPanel from "@/components/chat/chat-panel"
import type { ChatUIMessage } from "@/db/schemas/chat-message"

type EditCanvasProps = {
  sessionId: string
  initialMessages: ChatUIMessage[]
}

const Editor = dynamic(() => import("@/components/editor/editor"), {
  ssr: false,
  loading: () => <p className="m-auto text-sm text-muted-foreground">Loading editor…</p>,
})

const EditCanvas = ({ sessionId, initialMessages }: EditCanvasProps) => {
  const [autoAccept, setAutoAccept] = useState(false)
  const [editor, setEditor] = useState<TiptapEditor | null>(null)
  return (
    <main className="flex h-dvh flex-col md:flex-row">
      <section aria-label="Document" className="flex min-h-0 min-w-0 basis-3/5 flex-col md:basis-2/3">
        <Editor onEditorChange={setEditor} />
      </section>
      <aside
        aria-label="Chat"
        className="flex min-h-0 min-w-0 basis-2/5 flex-col border-t md:basis-1/3 md:border-t-0 md:border-l"
      >
        <ChatPanel
          sessionId={sessionId}
          initialMessages={initialMessages}
          editor={editor}
          autoAccept={autoAccept}
          onAutoAcceptChange={setAutoAccept}
        />
      </aside>
    </main>
  )
}

export default EditCanvas
