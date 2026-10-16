import { pairBlocks } from "@/tests/evals/checks"
import { gradeRewrite } from "@/tests/evals/grader"
import { expectPassRate } from "@/tests/evals/pass-rate"
import { type CaseOutcome, runScenario, scenarioTimeout } from "@/tests/evals/run-case"
import { REWRITE_SECTION_CASES, type RewriteSectionCase } from "@/tests/evals/scenarios/rewrite-section/cases"
import { checkSectionRewrite, findSection } from "@/tests/evals/scenarios/rewrite-section/checks"

const gradeSectionRewrite = (testCase: RewriteSectionCase, { outline, originalBlocks, finalBlocks }: CaseOutcome) =>
  gradeRewrite(
    testCase.graders,
    testCase.instruction,
    pairBlocks(findSection(outline, originalBlocks, testCase.sectionHeading), finalBlocks),
  )

test(
  "rewrite-section",
  async () => {
    const run = await runScenario(REWRITE_SECTION_CASES, { check: checkSectionRewrite, grade: gradeSectionRewrite })
    expectPassRate("rewrite-section", run)
  },
  scenarioTimeout(REWRITE_SECTION_CASES),
)
