import { ChevronRightIcon } from "lucide-react"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"

type ReasoningPartProps = {
  text: string
  isThinking: boolean
}

const ReasoningLabel = ({ isThinking }: Pick<ReasoningPartProps, "isThinking">) => {
  if (isThinking)
    return (
      <>
        <Spinner />
        Thinking…
      </>
    )
  return (
    <>
      <ChevronRightIcon className="transition-transform group-aria-expanded/button:rotate-90" />
      Thought
    </>
  )
}

const ReasoningPart = ({ text, isThinking }: ReasoningPartProps) => {
  if (!isThinking && text.length === 0) return null
  return (
    <Bubble variant="ghost">
      <BubbleContent>
        <Collapsible key={isThinking ? "thinking" : "thought"} defaultOpen={isThinking}>
          <CollapsibleTrigger render={<Button variant="ghost" size="xs" />}>
            <ReasoningLabel isThinking={isThinking} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-1 border-l pl-3 whitespace-pre-wrap text-muted-foreground">{text}</p>
          </CollapsibleContent>
        </Collapsible>
      </BubbleContent>
    </Bubble>
  )
}

export default ReasoningPart
