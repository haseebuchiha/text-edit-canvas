import type { ToolPartValue } from "@/components/chat/tool-state"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Spinner } from "@/components/ui/spinner"
import { type TransformProgress, transformProgressSchema } from "@/lib/transform-document"

type TransformPartProps = {
  part: ToolPartValue
  isResponding: boolean
}

type ProgressLineProps = {
  text: string
  isBusy: boolean
}

const STARTING_MESSAGE = "Editing sections…"
const FAILED_MESSAGE = "Editing the document section by section failed."

const readProgress = (part: ToolPartValue) =>
  part.state === "output-available" ? transformProgressSchema.safeParse(part.output).data : undefined

const describeRunning = ({ finishedCount, sectionCount }: TransformProgress, isResponding: boolean) =>
  isResponding
    ? `Editing sections: ${finishedCount} of ${sectionCount}`
    : `Stopped after ${finishedCount} of ${sectionCount} sections.`

const countOf = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`

const describeDone = ({ editedBlockCount, sectionCount }: TransformProgress) =>
  `Edited ${countOf(editedBlockCount, "block")} in ${countOf(sectionCount, "section")}.`

const ProgressLine = ({ text, isBusy }: ProgressLineProps) => (
  <p className="flex items-center gap-2 font-medium">
    {isBusy && <Spinner />}
    {text}
  </p>
)

const FailedSections = ({ failedSections }: Pick<TransformProgress, "failedSections">) => {
  if (failedSections.length === 0) return null
  return <p className="text-destructive">Couldn&apos;t edit: {failedSections.join(", ")}</p>
}

const TransformStatus = ({ part, isResponding }: TransformPartProps) => {
  if (part.state === "output-error") return <p className="text-destructive">{FAILED_MESSAGE}</p>
  const progress = readProgress(part)
  if (!progress) return <ProgressLine text={STARTING_MESSAGE} isBusy={isResponding} />
  if (progress.status === "running")
    return <ProgressLine text={describeRunning(progress, isResponding)} isBusy={isResponding} />
  return (
    <>
      <ProgressLine text={describeDone(progress)} isBusy={false} />
      <FailedSections failedSections={progress.failedSections} />
    </>
  )
}

const TransformPart = ({ part, isResponding }: TransformPartProps) => (
  <Bubble variant="outline">
    <BubbleContent>
      <div className="flex flex-col gap-2">
        <TransformStatus part={part} isResponding={isResponding} />
      </div>
    </BubbleContent>
  </Bubble>
)

export default TransformPart
