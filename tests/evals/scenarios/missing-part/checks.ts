import { containsLoosely, noUnintendedChanges, toCheckResult } from "@/tests/evals/checks"
import { type CaseOutcome, describeShownReply, type Reply } from "@/tests/evals/run-case"
import type { MissingPartCase } from "@/tests/evals/scenarios/missing-part/cases"

export const replyMentions = (reply: Reply, words: string[]) => {
  const shownReply = describeShownReply(reply)
  const evidence = words
    .filter((word) => !containsLoosely(shownReply, word))
    .map((word) => ({ where: "the reply", expected: [`mentions "${word}"`], actual: shownReply }))
  return toCheckResult("reply-mentions", evidence, "The reply doesn't mention what the user asked about.")
}

export const checkMissingPart = (testCase: MissingPartCase, { originalBlocks, finalBlocks, reply }: CaseOutcome) => [
  replyMentions(reply, testCase.replyMentions),
  noUnintendedChanges(originalBlocks, finalBlocks, []),
]
