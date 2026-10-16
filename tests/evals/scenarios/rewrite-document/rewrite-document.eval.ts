import { pairBlocks } from "@/tests/evals/checks"
import { gradeRewrite } from "@/tests/evals/grader"
import { expectPassRate } from "@/tests/evals/pass-rate"
import { type CaseOutcome, runScenario, scenarioTimeout } from "@/tests/evals/run-case"
import { REWRITE_DOCUMENT_CASES, type RewriteDocumentCase } from "@/tests/evals/scenarios/rewrite-document/cases"
import { checkDocumentRewrite } from "@/tests/evals/scenarios/rewrite-document/checks"

const gradeDocumentRewrite = (testCase: RewriteDocumentCase, { originalBlocks, finalBlocks }: CaseOutcome) =>
  gradeRewrite(testCase.graders, testCase.instruction, pairBlocks(originalBlocks, finalBlocks))

test(
  "rewrite-document",
  async () => {
    const run = await runScenario(REWRITE_DOCUMENT_CASES, { check: checkDocumentRewrite, grade: gradeDocumentRewrite })
    expectPassRate("rewrite-document", run)
  },
  scenarioTimeout(REWRITE_DOCUMENT_CASES),
)
