# Evals

The evals send instructions through the app's real chat code and grade the result. A case is a frozen document, one instruction and the expected outcome. Only the outcome counts: the document as the user would see it, the reply, and the tools that ran. What the model says it did doesn't count.

## Folders

- `documents/`: the 23 frozen test documents, in Tiptap JSON. `sample-offer` is the editor's 1-page sample.
- `scenarios/`: one folder per kind of request. Each folder holds four files:
  - `cases.ts`: the cases.
  - `checks.ts`: the code checks this scenario uses.
  - `checks.test.ts`: unit tests for those checks, and a test that every case points at real text in its document. `yarn test` runs them. They call no model.
  - `<scenario>.eval.ts`: the one test that runs every case against the model.
- `run-case.ts`: runs one case. It loads the document into a headless editor built from the app's own extension list, selects the highlight if the case has one, sends the instruction through `streamChatTurn` in `services/chat.ts`, and applies the streamed edits with the app's `apply-edits.ts`. It records the tokens, the time to the first change and the total time. It also runs a scenario's cases one after another.
- `checks.ts`: the checks that more than one scenario uses, and the text helpers behind them. `checks.test.ts` tests them.
- `grader.ts`: the AI grader. It decides what code can't: tone, concision, translation quality, and whether an answer is right and supported.
- `pass-rate.ts`: writes `results/<scenario>.md` and fails the test when fewer than 80% of the cases passed.
- `labels/`: empty for now. See "Hand-labelling" below.
- `results/`: one file per scenario from the last run. Git ignores this folder.

## Scenarios

| Scenario | What the user asks | Grader |
|---|---|---|
| `change-text` | to change a word or a fact, sometimes in a highlighted passage | none |
| `answer-question` | a question the document answers, a question it doesn't answer, or small talk | answer, for both kinds of question |
| `missing-part` | to change a part the document doesn't have | none |
| `rewrite-document` | to rewrite or translate the whole document | the ones the case lists |

## How a case is graded

1. The case runs once. A cut stream, a server error or the 5-minute time limit fails the case, and the error is in the results file.
2. The code checks run. The case fails when any check fails.
3. If every check passed and the case needs the grader, the grader runs. The case fails when the grader says fail. It may also say unknown, which doesn't fail the case.

A scenario passes when at least 80% of its cases pass. Jest runs the four scenarios in parallel.

The results file lists every failed case: the instruction, the document, the `why`, each failed check with the expected and the actual text, the grader's reasoning, and the reply. In a Difference line, ~~struck-through~~ words are expected but missing, and **bold** words were written by the model instead. At the end it gives the totals: cases, passed, pass rate, app tokens, grader tokens and time.

## Case fields

- `blockContaining`: text that appears in exactly one block of the original document. It names that block.
- `becomesOneOf`: the block's whole new text. Any one of the alternatives passes. When a block may also stay as it is, its original text is one of them.
- `newTextIncludes`: phrases the block's new text must contain, for additions that can be worded in many ways.
- `goneEverywhere`: words that must not appear anywhere in the document afterwards.
- `highlight`: the text the user highlighted before sending the instruction.
- `answerMentions`: facts the checked answer must name.
- `neverSays`: false claims the reply must not make.
- `replyMentions`: words the reply must contain, such as the name of the missing part.
- `translatedTo`, `useOnlyOneOf`: the language of a translation, and groups of words of which the translation may use only one.
- `keepPhrases`: phrases that must still be there after a rewrite.
- `lengthAsShareOfOriginal`: the allowed length after a rewrite. `max: 0.95` means at most 95% of the original characters.
- `sectionHeading`: the heading of the section to rewrite.
- `graders`: the grader questions to ask after the code checks passed.
- `why`: one sentence on what the case proves.

Every block a case doesn't name must stay exactly as it was. Whole-document rewrites may change every block.

## Running

The proxy on `http://127.0.0.1:10531` must be running. Commands run from the project root.

```bash
yarn evals                          # every scenario
yarn evals rewrite-document         # one scenario
LLM_MODEL=gpt-6.1-sol yarn evals    # another model
yarn evals --listTests              # lists the eval files and calls no model
```

The evals use the model the app is configured with, through `services/llm.ts`. They read `.env.local`, and a variable set in the shell wins over it. If the app is set up for the paid AI Gateway, the evals refuse to run unless you set `EVALS_ALLOW_PAID=1`. The grader runs on the same model as the app under test, at medium effort, with a strict pair-by-pair routine, and so does the rewrite check unless `AI_GATEWAY_CHECK_MODEL` or `LLM_CHECK_MODEL` is set. Switching the model switches every call. A model grades its own work, so pass rates of different models aren't strictly comparable. On 40 saved verdicts it agreed with gpt-6.1-sol 29 times.

`yarn test` runs the `checks.test.ts` files and never an eval.

## Hand-labelling

The grader is only useful if it agrees with you. This step comes later. Each grader verdict will be saved with the material the grader saw. You will then mark each one pass or fail yourself in `labels/`, ideally before you read the grader's verdict. Comparing your labels with the grader's verdicts shows how many real failures it catches and how many good results it passes. Until then, read the grader's reasoning before you trust its verdicts.
