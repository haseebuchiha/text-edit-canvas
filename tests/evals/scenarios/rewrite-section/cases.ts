import type { LengthRange } from "@/tests/evals/checks"
import type { RewriteGraderName } from "@/tests/evals/grader"
import type { EvalCase } from "@/tests/evals/run-case"

export type RewriteSectionCase = EvalCase & {
  sectionHeading: string
  keepPhrases?: string[]
  lengthAsShareOfOriginal?: LengthRange
  graders: RewriteGraderName[]
}

export const REWRITE_SECTION_CASES: RewriteSectionCase[] = [
  {
    id: "L1",
    document: "07-it-security-policy",
    instruction: "make the passwords section friendlier",
    sectionHeading: "Passwords and Authentication",
    graders: ["tone"],
  },
  {
    id: "S1",
    document: "sample-offer",
    instruction: "make the pricing section friendlier",
    sectionHeading: "Schedule and pricing",
    graders: ["tone"],
  },
]
