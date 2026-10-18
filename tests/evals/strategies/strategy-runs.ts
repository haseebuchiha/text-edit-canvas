import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { isChanged, pairBlocks } from "@/tests/evals/checks"
import { gradeRewrite } from "@/tests/evals/grader"
import { expectPassRate, writeResults } from "@/tests/evals/pass-rate"
import {
  type CaseOutcome,
  type CaseResult,
  type EvalCase,
  runScenario,
  type Scenario,
  type ScenarioRun,
  type StreamTurn,
  scenarioTimeout,
} from "@/tests/evals/run-case"
import { CHANGE_TEXT_CASES } from "@/tests/evals/scenarios/change-text/cases"
import { checkChangeText } from "@/tests/evals/scenarios/change-text/checks"
import { MISSING_PART_CASES } from "@/tests/evals/scenarios/missing-part/cases"
import { checkMissingPart } from "@/tests/evals/scenarios/missing-part/checks"
import { REWRITE_DOCUMENT_CASES, type RewriteDocumentCase } from "@/tests/evals/scenarios/rewrite-document/cases"
import { checkDocumentRewrite } from "@/tests/evals/scenarios/rewrite-document/checks"
import { QUOTA_READINGS } from "@/tests/evals/strategies/edit-strategies"

export type Strategy = { name: string; streamTurn?: StreamTurn }

export type StrategyScenario<TestCase extends EvalCase> = Scenario<TestCase> & { name: string; cases: TestCase[] }

const RESULTS_FOLDER = join(process.cwd(), "tests", "evals", "results")
const SCOPE_CHECK = "no-unintended-changes"
const CHANGE_TEXT = "change-text"

const gradeDocumentRewrite = (testCase: RewriteDocumentCase, { originalBlocks, finalBlocks }: CaseOutcome) =>
  gradeRewrite(testCase.graders, testCase.instruction, pairBlocks(originalBlocks, finalBlocks))

const describeEditKind = (testCase: EvalCase) => ("goneEverywhere" in testCase ? "everywhere" : "targeted")

const describeKind = (scenario: string, testCase: EvalCase) => {
  if (testCase.highlight) return "highlight"
  return scenario === CHANGE_TEXT ? describeEditKind(testCase) : scenario
}

const countUnintendedBlocks = ({ failedChecks }: CaseResult) =>
  failedChecks.find(({ check }) => check === SCOPE_CHECK)?.evidence.length ?? 0

const toCaseMeasures = (scenario: string) => (result: CaseResult) => ({
  id: result.testCase.id,
  document: result.testCase.document,
  kind: describeKind(scenario, result.testCase),
  passed: result.passed,
  error: result.error ?? null,
  failedChecks: result.failedChecks.map(({ check }) => check),
  grades: result.grades.map(({ grader, verdict }) => ({ grader, verdict })),
  unintendedBlocks: countUnintendedBlocks(result),
  changedBlocks: pairBlocks(result.outcome.originalBlocks, result.outcome.finalBlocks).filter(isChanged).length,
  tokens: result.outcome.tokens,
  firstChangeMs: result.outcome.firstChangeMs ?? null,
  totalMs: result.outcome.totalMs,
})

const writeMeasures = (name: string, scenario: string, run: ScenarioRun) => {
  const measures = {
    model: run.model,
    startedAt: run.startedAt,
    finishedAt: Date.now(),
    quotaReadings: QUOTA_READINGS,
    cases: run.results.map(toCaseMeasures(scenario)),
  }
  mkdirSync(RESULTS_FOLDER, { recursive: true })
  writeFileSync(join(RESULTS_FOLDER, `${name}.json`), `${JSON.stringify(measures, null, 2)}\n`)
}

const listFailedCases = ({ results }: ScenarioRun) => results.filter(({ passed }) => !passed)

const runStrategyScenario = async <TestCase extends EvalCase>(
  strategy: Strategy,
  { name, cases, ...scenario }: StrategyScenario<TestCase>,
) => {
  const run = await runScenario(cases, { ...scenario, streamTurn: strategy.streamTurn })
  const resultsName = `strategy-${strategy.name}-${name}`
  writeMeasures(resultsName, name, run)
  if (strategy.streamTurn) return writeResults(resultsName, run, listFailedCases(run))
  expectPassRate(resultsName, run)
}

export const testStrategyScenario = <TestCase extends EvalCase>(
  strategy: Strategy,
  scenario: StrategyScenario<TestCase>,
) => test(scenario.name, () => runStrategyScenario(strategy, scenario), scenarioTimeout(scenario.cases))

export const testStrategy = (strategy: Strategy) => {
  testStrategyScenario(strategy, { name: CHANGE_TEXT, cases: CHANGE_TEXT_CASES, check: checkChangeText })
  testStrategyScenario(strategy, { name: "missing-part", cases: MISSING_PART_CASES, check: checkMissingPart })
  testStrategyScenario(strategy, {
    name: "rewrite-document",
    cases: REWRITE_DOCUMENT_CASES,
    check: checkDocumentRewrite,
    grade: gradeDocumentRewrite,
  })
}
