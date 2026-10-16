import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Spinner } from "@/components/ui/spinner"

const ThinkingIndicator = () => (
  <Bubble variant="ghost">
    <BubbleContent>
      <p className="flex items-center gap-2 text-muted-foreground">
        <Spinner />
        Thinking…
      </p>
    </BubbleContent>
  </Bubble>
)

export default ThinkingIndicator
