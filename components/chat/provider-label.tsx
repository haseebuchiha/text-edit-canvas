import type { ChatModel } from "@/lib/chat-models"

type ProviderLabelProps = Pick<ChatModel, "provider" | "logo">

const ProviderLabel = ({ provider, logo }: ProviderLabelProps) => (
  <>
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true" className="size-4">
      <path d={logo} />
    </svg>
    {provider}
  </>
)

export default ProviderLabel
