import ThinkingIndicator from "@/components/chat/thinking-indicator"
import { isToolBusy, readVerifiedAnswer, type ToolPartValue } from "@/components/chat/tool-state"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import type { AnswerQuestionInput } from "@/lib/answer-question"

type AnswerPartProps = {
  part: ToolPartValue
  isResponding: boolean
}

const VerifiedAnswer = ({ answer, quotes }: AnswerQuestionInput) => (
  <Bubble variant="ghost">
    <BubbleContent>
      <p className="whitespace-pre-wrap">{answer}</p>
      {quotes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-l pl-3 text-xs text-muted-foreground">
          {quotes.map(({ nodeId, text }, index) => (
            <li key={`${nodeId}-${index}`}>“{text}”</li>
          ))}
        </ul>
      )}
    </BubbleContent>
  </Bubble>
)

const AnswerPart = ({ part, isResponding }: AnswerPartProps) => {
  const verifiedAnswer = readVerifiedAnswer(part)
  if (verifiedAnswer) return <VerifiedAnswer {...verifiedAnswer} />
  if (isResponding && isToolBusy(part)) return <ThinkingIndicator />
  return null
}

export default AnswerPart
