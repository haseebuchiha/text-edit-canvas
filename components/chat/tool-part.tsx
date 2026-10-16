import { getToolName } from "ai"
import { ChevronRightIcon } from "lucide-react"
import { describeToolState, formatToolValue, isToolBusy, type ToolPartValue } from "@/components/chat/tool-state"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"

type ToolPartProps = {
  part: ToolPartValue
  isResponding: boolean
}

const ToolValue = ({ value }: { value: unknown }) => {
  if (value === undefined) return null
  return (
    <pre className="overflow-x-auto text-xs whitespace-pre-wrap text-muted-foreground">{formatToolValue(value)}</pre>
  )
}

const ToolOutput = ({ output }: { output: unknown }) => (
  <Collapsible>
    <CollapsibleTrigger render={<Button variant="ghost" size="xs" />}>
      <ChevronRightIcon className="transition-transform group-aria-expanded/button:rotate-90" />
      Output
    </CollapsibleTrigger>
    <CollapsibleContent>
      <ToolValue value={output} />
    </CollapsibleContent>
  </Collapsible>
)

const ToolDetails = ({ part }: Pick<ToolPartProps, "part">) => {
  if (part.state === "input-streaming") return <ToolValue value={part.input} />
  if (part.state === "output-available") return <ToolOutput output={part.output} />
  if (part.state === "output-error") return <p className="whitespace-pre-wrap text-destructive">{part.errorText}</p>
  return null
}

const ToolPart = ({ part, isResponding }: ToolPartProps) => (
  <Bubble variant="outline">
    <BubbleContent>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-medium">
          {isResponding && isToolBusy(part) && <Spinner />}
          {describeToolState(getToolName(part), part)}
        </p>
        <ToolDetails part={part} />
      </div>
    </BubbleContent>
  </Bubble>
)

export default ToolPart
