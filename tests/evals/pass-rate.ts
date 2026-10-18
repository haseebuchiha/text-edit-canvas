import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { diffWords } from "diff"
import type { CheckResult, Evidence } from "@/tests/evals/checks"
import { GRADER_EFFORT, type Grade } from "@/tests/evals/grader"
import {
  addTokens,
  type CaseResult,
  describeShownReply,
  NO_TOKENS,
  type ScenarioRun,
  type Tokens,
} from "@/tests/evals/run-case"

const RESULTS_FOLDER = join(process.cwd(), "tests", "evals", "results")
const MIN_PASS_RATE = 0.8
const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

const TEXT_COMPARING_CHECKS = new Set([
  "expected-changes",
  "no-unintended-changes",
  "placeholders-kept",
  "figures-kept",
  "quotes-real",
])

const DIFFERENCE_LEGEND =
  "Each failed check lists the block, the text it should have and the text it has. In a Difference line, ~~struck-through~~ words are expected but missing, and **bold** words were written by the model instead."

const formatCount = (count: number) => count.toLocaleString("en-US")

const formatPercent = (part: number, whole: number) => `${((100 * part) / whole).toFixed(1)}%`

const formatTokens = ({ input, cachedInput, output, reasoning }: Tokens) =>
  `${formatCount(input)} in (${formatCount(cachedInput)} cached), ${formatCount(output)} out (${formatCount(reasoning)} reasoning)`

const formatSeconds = (milliseconds: number) => `${(milliseconds / MILLISECONDS_PER_SECOND).toFixed(1)} s`

const formatDuration = (milliseconds: number) => {
  const seconds = Math.round(milliseconds / MILLISECONDS_PER_SECOND)
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)} min ${seconds % SECONDS_PER_MINUTE} s`
}

const markDifference = ({ added, removed, value }: { added: boolean; removed: boolean; value: string }) => {
  if (added) return `**${value}**`
  return removed ? `~~${value}~~` : value
}

const formatDifference = (expected: string, actual: string) =>
  `    - Difference: ${diffWords(expected, actual).map(markDifference).join("")}`

const formatExpected = (expected: string[]) =>
  expected.length === 1
    ? `    - Expected: ${expected[0]}`
    : `    - Expected, any of:\n${expected.map((text) => `      - ${text}`).join("\n")}`

const formatEvidence =
  (check: string) =>
  ({ where, expected, actual }: Evidence) =>
    [
      `  - ${where}`,
      formatExpected(expected),
      `    - Actual: ${actual}`,
      ...(TEXT_COMPARING_CHECKS.has(check) && expected.length > 0 ? [formatDifference(expected[0], actual)] : []),
    ].join("\n")

const formatFailedCheck = ({ check, explanation, evidence }: CheckResult) =>
  [`- **${check}**: ${explanation}`, ...evidence.map(formatEvidence(check))].join("\n")

const formatGrade = ({ grader, verdict, reasoning }: Grade) =>
  `- **grader: ${grader}**: ${verdict}. ${reasoning.replaceAll("\n", " ")}`

const describeRun = ({ outcome }: CaseResult) =>
  [
    `Tools: ${outcome.toolCalls.map(({ name }) => name).join(", ") || "none"}`,
    `Tokens: ${formatTokens(outcome.tokens)}`,
    `Time: ${formatSeconds(outcome.totalMs)}`,
  ].join(" · ")

const formatFailedCase = (result: CaseResult) =>
  [
    `### ${result.testCase.id}: "${result.testCase.instruction}"`,
    [`Document: ${result.testCase.document}`, ...(result.testCase.why ? [`Why: ${result.testCase.why}`] : [])].join(
      "\n\n",
    ),
    describeRun(result),
    ...(result.error ? [`- **error**: ${result.error}`] : []),
    ...result.failedChecks.map(formatFailedCheck),
    ...result.grades.filter(({ verdict }) => verdict !== "pass").map(formatGrade),
    `Reply: ${describeShownReply(result.outcome.reply).replaceAll("\n", " ")}`,
  ].join("\n\n")

const formatFailedSection = (failed: CaseResult[]) =>
  failed.length === 0
    ? "## Failed cases\n\nNone."
    : ["## Failed cases", DIFFERENCE_LEGEND, ...failed.map(formatFailedCase)].join("\n\n")

const sumAppTokens = (results: CaseResult[]) =>
  results.reduce((total, { outcome }) => addTokens(total, outcome.tokens), NO_TOKENS)

const sumGraderTokens = (results: CaseResult[]) =>
  results.flatMap(({ grades }) => grades).reduce((total, { tokens }) => addTokens(total, tokens), NO_TOKENS)

const formatTotals = ({ results, startedAt }: ScenarioRun, passedCount: number) =>
  [
    "## Totals",
    [
      "| Measure | Value |",
      "|---|---|",
      `| Cases | ${results.length} |`,
      `| Passed | ${passedCount} |`,
      `| Pass rate | ${formatPercent(passedCount, results.length)} |`,
      `| App tokens | ${formatTokens(sumAppTokens(results))} |`,
      `| Grader tokens | ${formatTokens(sumGraderTokens(results))} |`,
      `| Time | ${formatDuration(Date.now() - startedAt)} |`,
    ].join("\n"),
  ].join("\n\n")

const formatResults = (scenario: string, run: ScenarioRun, failed: CaseResult[]) =>
  [
    `# ${scenario}`,
    `Model: ${run.model}. Grader: the same model at ${GRADER_EFFORT} effort. Started ${new Date(run.startedAt).toISOString()}.`,
    formatFailedSection(failed),
    formatTotals(run, run.results.length - failed.length),
  ].join("\n\n")

export const writeResults = (scenario: string, run: ScenarioRun, failed: CaseResult[]) => {
  const path = join(RESULTS_FOLDER, `${scenario}.md`)
  mkdirSync(RESULTS_FOLDER, { recursive: true })
  writeFileSync(path, `${formatResults(scenario, run, failed)}\n`)
  return path
}

const describeFailedCase = ({ testCase, failedChecks, grades, error }: CaseResult) => {
  const reasons = [
    ...(error ? [`error: ${error}`] : []),
    ...failedChecks.map(({ check }) => check),
    ...grades.filter(({ verdict }) => verdict === "fail").map(({ grader }) => `grader: ${grader}`),
  ]
  return `- ${testCase.id} (${testCase.document}) "${testCase.instruction}": ${reasons.join(", ")}`
}

export const expectPassRate = (scenario: string, run: ScenarioRun) => {
  const failed = run.results.filter(({ passed }) => !passed)
  const path = writeResults(scenario, run, failed)
  const passedCount = run.results.length - failed.length
  if (passedCount / run.results.length >= MIN_PASS_RATE) return
  throw new Error(
    [
      `${scenario}: ${passedCount} of ${run.results.length} cases passed (${formatPercent(passedCount, run.results.length)}), under the ${100 * MIN_PASS_RATE}% needed. Failed cases:`,
      ...failed.map(describeFailedCase),
      `Details: ${path}`,
    ].join("\n"),
  )
}
