import { expectPassRate } from "@/tests/evals/pass-rate"
import { runScenario, scenarioTimeout } from "@/tests/evals/run-case"
import { CHANGE_TEXT_CASES } from "@/tests/evals/scenarios/change-text/cases"
import { checkChangeText } from "@/tests/evals/scenarios/change-text/checks"

test(
  "change-text",
  async () => {
    const run = await runScenario(CHANGE_TEXT_CASES, { check: checkChangeText })
    expectPassRate("change-text", run)
  },
  scenarioTimeout(CHANGE_TEXT_CASES),
)
