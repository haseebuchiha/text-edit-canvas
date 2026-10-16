import { expectPassRate } from "@/tests/evals/pass-rate"
import { runScenario, scenarioTimeout } from "@/tests/evals/run-case"
import { MISSING_PART_CASES } from "@/tests/evals/scenarios/missing-part/cases"
import { checkMissingPart } from "@/tests/evals/scenarios/missing-part/checks"

test(
  "missing-part",
  async () => {
    const run = await runScenario(MISSING_PART_CASES, { check: checkMissingPart })
    expectPassRate("missing-part", run)
  },
  scenarioTimeout(MISSING_PART_CASES),
)
