import { Bubble, BubbleContent } from "@/components/ui/bubble"

type TextPartProps = {
  text: string
  isUser: boolean
}

const TextPart = ({ text, isUser }: TextPartProps) => {
  if (text.length === 0) return null
  return (
    <Bubble variant={isUser ? "muted" : "ghost"}>
      <BubbleContent>
        <p className="whitespace-pre-wrap">{text}</p>
      </BubbleContent>
    </Bubble>
  )
}

export default TextPart
