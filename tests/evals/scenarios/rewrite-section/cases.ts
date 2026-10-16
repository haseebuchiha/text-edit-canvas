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
    graders: ["tone", "meaning"],
  },
  {
    id: "L2",
    document: "07-it-security-policy",
    instruction: "make the phishing part shorter",
    why: "Known gap 8: every earlier run dropped 'Email is the most common route for attacks'.",
    sectionHeading: "7. Email and Internet Use",
    keepPhrases: ["most common"],
    lengthAsShareOfOriginal: { max: 0.95 },
    graders: ["concision", "meaning"],
  },
  {
    id: "S1",
    document: "sample-offer",
    instruction: "make the pricing section friendlier",
    sectionHeading: "Schedule and pricing",
    graders: ["tone", "meaning"],
  },
  {
    id: "S2",
    document: "sample-offer",
    instruction: "make the cost part shorter",
    why: "Known gap 3: one run emptied every filled cell of the pricing table and still passed the old scope check.",
    sectionHeading: "Schedule and pricing",
    keepPhrases: ["net"],
    lengthAsShareOfOriginal: { max: 0.95 },
    graders: ["concision", "meaning"],
  },
]
