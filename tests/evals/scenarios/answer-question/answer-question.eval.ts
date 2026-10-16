import { gradeQuestion, gradeUnanswerable } from "@/tests/evals/grader"
import { expectPassRate } from "@/tests/evals/pass-rate"
import { type CaseOutcome, runScenario, scenarioTimeout } from "@/tests/evals/run-case"
import { ANSWER_QUESTION_CASES, type AnswerQuestionCase } from "@/tests/evals/scenarios/answer-question/cases"
import { checkAnswerQuestion } from "@/tests/evals/scenarios/answer-question/checks"

const gradeAnswer = async (testCase: AnswerQuestionCase, outcome: CaseOutcome) => {
  if (testCase.kind === "question") return gradeQuestion(testCase.instruction, testCase.answerMentions, outcome)
  if (testCase.kind === "unanswerable") return gradeUnanswerable(testCase.instruction, outcome)
  return []
}

test(
  "answer-question",
  async () => {
    const run = await runScenario(ANSWER_QUESTION_CASES, { check: checkAnswerQuestion, grade: gradeAnswer })
    expectPassRate("answer-question", run)
  },
  scenarioTimeout(ANSWER_QUESTION_CASES),
)
