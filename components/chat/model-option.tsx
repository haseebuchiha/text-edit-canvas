import type { ChatModel } from "@/lib/chat-models"

type ModelOptionProps = Pick<ChatModel, "name" | "logo">

const ModelOption = ({ name, logo }: ModelOptionProps) => (
  <>
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true" className="size-4">
      <path d={logo} />
    </svg>
    {name}
  </>
)

export default ModelOption
