# Findings

Results of the Text Edit Canvas proof of concept. Per-case numbers for every numbered test round are in [`TEST-RESULTS.md`](TEST-RESULTS.md), and the full model comparison on the AI Gateway is in [`tests/evals/REPORT.md`](tests/evals/REPORT.md).

## Summary

**What the PoC does.** A Tiptap rich-text editor sits next to an AI chat. The user asks for a change in the chat, optionally after highlighting passages, and the model sends edit operations on block IDs (`replace_text` or `replace_node`), which the server checks before the browser applies them. With auto-accept off, each change shows as a suggestion to accept or reject. With it on, the change applies directly and one undo reverts the whole AI edit. Questions about the document get answers whose quotes the server checks against the text. Instructions about the whole document, such as "translate the document to German", go through a section-by-section pipeline. Chats and their token counts are saved in MongoDB.

**Recommendations**

- **Editor: Tiptap**, using only its MIT-licensed packages. Its UniqueID extension gives every block a stable ID for the edit operations, and review mode runs on two custom marks, so the paid Tracked Changes add-on isn't needed. Packages and licenses are in [`README.md`](README.md). [`LATER.md`](LATER.md) says why we skipped the paid add-on and `prosemirror-suggestion-mode`.
- **Edit strategy: C, patch operations**, which the app already uses. For targeted, highlighted and "everywhere" edits, C cost $0.44 to $0.60 per 1,000 edits and finished in 3.8 to 5.9 s, against $2.09 to $2.24 and 17.9 to 19.6 s for A, the full rewrite. The accuracy differences between the strategies were within noise ([Edit strategies](#edit-strategies)). Whole-document instructions go through C's section pipeline: a term sheet, one rewrite per part, then a meaning check and a repair. It is the most expensive path ($7.00 per 1,000 rewrites, first change after about 19 s), but on the strict rewrite set it passed the most cases, 16 of 52 against 11 to 13 for three single-pass variants ([strict rewrite test](#whole-document-rewrites-on-the-strict-set)). One thing to try next: let a highlighted edit change only the highlighted block, as strategy B does. B passed 14 of 14 highlighted cases at a third of C's cost.
- **Model: gpt-6-luna at medium effort** as the default. On the AI Gateway it passed 108 of 118 eval cases, the most of five cheap models, and the whole run cost $0.35 ([five cheap models](#five-cheap-models-on-the-ai-gateway)). gpt-6.1-sol at low effort got all 68 requests right in the model matrix at about 19 times the cost. It is the step up if the remaining gpt-6-luna failures matter more than the price ([Model choice](#model-choice)).
- **Review mode on the free Tiptap core.** Suggested changes are marks inside the document (`inserted` and `deleted`), so accept, reject, undo and redo are ordinary editor steps, and Reject all gives back the exact original, bold and links included ([Review mode](#review-mode)).

**Headline numbers.** The three strategies on all 81 edit cases, gpt-6-luna at medium effort through the local proxy, one run per case. Proxy timings include the proxy's own delay. Per-kind tables are in [Edit strategies](#edit-strategies).

| Strategy | Passed | Unintended changes | Tokens in / out per edit | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 69 (85.2%) | 3 of 61 (4.9%) | 5,394 / 3,154 | $2.12 | 7.3 s | 19.2 s |
| B, section scope | 64 (79.0%) | 1 of 61 (1.6%) | 3,274 / 1,498 | $1.08 | 6.1 s | 13.0 s |
| C, patch operations (the app) | 61 (75.3%) | 3 of 61 (4.9%) | 11,017 / 2,058 | $2.13 | 8.7 s | 11.3 s |

- C's average is dominated by whole-document rewrites. A targeted edit took about 4,100 input and 130 output tokens and finished after 5.0 s. A whole-document rewrite took about 30,800 and 7,800 tokens, showed its first change after 18.9 s and finished after 30.4 s.
- The current eval suite on the gateway, gpt-6-luna: 108 of 118 cases (91.5%). Change-text passed 52 of 52, answer-question 34 of 37, missing-part 8 of 9 and rewrite-document 14 of 20. On the gateway a case took 4.6 to 8.1 s on average for small requests and 118 s for a whole-document rewrite, grading included. The gateway run didn't record the time to the first change.
- Each case ran once. With about 120 cases, a gap of less than about 8 points can be chance. A's lead came mostly from whole-document rewrites, and it didn't hold on the strict rewrite set.

**Weak spots.** All of them are collected in [Known limits](#known-limits).

- Whole-document rewrites fail most often: 14 of 20 on the gateway and 8 of 20 in the strategy run, on the same code. They fail on a shifted meaning, on a German key term worded two ways, or on a formal rewrite that leaves a conversational sentence. Six rewrite cases that gpt-6-luna kept failing are no longer in the suite.
- No edit can add or remove a block, so table rows, list items and paragraphs can't be added or deleted.
- A block replaced as a whole loses its bold and links. The section pipeline replaces nearly every block it changes this way.
- Asked to change a part the document doesn't have, gpt-6-luna still sometimes edits a nearby paragraph.
- The AI grader hasn't been checked against hand labels, and most timings come from the local proxy.

**Contents**

1. [Evaluation](#evaluation): setup, the eval suite, edit strategies, the strict rewrite test, models on the gateway, grader caveats
2. [How editing works and what we fixed](#how-editing-works-and-what-we-fixed)
3. [Model choice](#model-choice)
4. [Review mode](#review-mode)
5. [Known limits](#known-limits)
6. [Smaller findings](#smaller-findings)

## Evaluation

### Setup and how to read the numbers

Rounds 1 to 14 ran on two documents: the editor's 1-page sample offer (5 headings) and a 9-page synthetic IT security policy (26 headings, 3 tables). Most cases ran between 3 and 40 times, through a harness of scratch scripts. Models were reached through a local proxy, through its chat endpoint until round 13 and its Responses endpoint from round 14 (see [The Responses endpoint](#the-responses-endpoint)). From round 15 the harness is the eval suite in `tests/evals/` (first `evals/`). The comparison of five models on 18 October 2026 ran through the Vercel AI Gateway, which is what production would use.

- Token counts from the proxy are real. Its timings include its own delay and aren't representative of the API.
- Costs are at gateway list prices, with reasoning billed as output and no cache discount unless a table says otherwise: $0.10 / $0.50 per million tokens in / out for gpt-6-luna, $2 / $10 for gpt-6.1-sol and $10 / $50 for gpt-6-astra.
- Single runs are noisy. With about 120 cases, a gap of less than about 8 points between two models or strategies can be chance. On the same 20 whole-document rewrite cases, with gpt-6-luna as the model, the check and the grader, the app's pipeline passed 8 in the strategy run, 25 of 40 in the two trials of the strict test when judged the same way, and 14 in the gateway run.
- Case names: S cases run on the sample offer and L cases on the 9-page policy (see the [case key](TEST-RESULTS.md#case-key)). XF is a 64-page document joined from 13 samples. A numbered case such as 04-edit runs on the document with that number in `tests/evals/documents/`.

### The eval suite

The scratch harness scored mostly where an edit landed. It passed a run that emptied the pricing table, and every "customer to client" run that left a second "customer" in a paragraph. The eval suite in `tests/evals/` replaced it. [`tests/evals/README.md`](tests/evals/README.md) explains how to run it and how to read a case.

A case is a frozen document, an instruction and the expected outcome. A run of a case calls the app's own chat turn in-process against a headless Tiptap editor, applies the stream with the browser's `apply-edits.ts`, and grades the document the user would see, plus the reply and the tools that ran. What the model says it did doesn't count. Code checks decide whatever they can: the exact expected text of each changed paragraph, every other paragraph unchanged, the word gone everywhere, placeholders and figures kept in each block, headings still headings, no emptied table cell, every English block translated, one German word per key term, and a checked answer that names the fact. An AI grader decides tone, concision, translation quality, and whether an answer is right and supported. It runs only when every code check passed, on the same model as the app under test, at medium effort with a strict pair-by-pair routine. A case passes only when every check passes and the grader doesn't say fail.

The suite now has four scenarios with 118 cases on 23 documents. `yarn evals` runs every case once. A proxy failure counts as a failed case, and a scenario fails when fewer than 80% of its cases pass.

| Scenario | Cases | What the user asks |
|---|--:|---|
| change-text | 52 | to change a word or a fact, sometimes in a highlighted passage or everywhere |
| answer-question | 37 | a question the document answers, a question it doesn't answer, or small talk |
| missing-part | 9 | to change a part the document doesn't have |
| rewrite-document | 20 | to rewrite or translate the whole document |

How the suite changed since the baseline:

- It started as a command-line tool in `evals/`, with trial counts, retries, run comparisons and margins. The baseline numbers come from that tool: cases ran 3 times, the risky ones 10, and proxy failures were retried once and reported apart from model failures. Rounds 16 to 18 also ran 3 trials per case. In rounds 15 to 21 the grader was gpt-6.1-sol at medium effort, and it also judged whether a rewrite kept its meaning.
- The baseline had 129 cases on 24 documents: the earlier S, L, N, H, G and whole-document cases with stricter expected outcomes, PG, L11 and L12 for known gaps, and five cases on each of the other 19 samples. Every known gap had a case.
- The 64-page case (XF), the only one on a very long document, was dropped, which left 128 cases in five scenarios.
- The meaning grader was removed. It failed a whole document for one slipped word, even on the strongest model. The code checks still guard figures, placeholders, headings and terms, and the tone, concision and translation graders stayed.
- Six rewrite-document cases that gpt-6-luna kept failing were taken out: the German translations of the onboarding handbook, the incident report and the travel expense policy, the formal rewrites of the data processing agreement and the goods-inspection procedure, and the concise rewrite of the sample offer. The rewrite-section scenario (4 cases, among them "make the phishing part shorter" and "make the cost part shorter") was removed too. That left 118 cases.
- The grader moved from gpt-6.1-sol to gpt-6-luna, and then to the model under test, so that choosing a model switches every call. A model now grades its own work, so pass rates of different models aren't strictly comparable. On 40 saved verdicts the grader agreed with gpt-6.1-sol 29 times.

The six dropped cases, the rewrite-section cases and the meaning grader came back once, for the [strict rewrite test](#whole-document-rewrites-on-the-strict-set). They aren't part of the current suite.

#### Baseline, round 15

Through the proxy, with the command-line tool and gpt-6.1-sol as the grader, meaning judge included. gpt-6-luna ran 3 trials per case, the other models 1, all without the 64-page document.

| Model | Pass, 95% | Code checks only | Unintended changes | Sec | Cost per 1,000 requests |
|---|--:|--:|--:|--:|--:|
| gpt-6-luna | 70.8% ±8.6 | 84.8% ±7.7 | 5.1% | 8.2 | $1.20 |
| gpt-6.1-sol | 85.2% ±7.3 | 94.5% ±4.4 | 2.0% | 12.5 | $20.27 |
| gpt-5.6-luna | 72.7% ±7.1 | 87.5% ±7.0 | 5.9% | 10.3 | $2.67 |
| gpt-5.6-terra | 71.9% ±7.8 | 87.5% ±6.5 | 3.9% | 15.9 | n/a |
| gpt-5.6-sol | 77.3% ±8.1 | 91.4% ±5.3 | 3.9% | 13.3 | n/a |

The margins are wide: with 24 documents, differences under about 8 points between two models are noise. gpt-6.1-sol is the only clear step up, and it judged its own run.

What the baseline showed on gpt-6-luna:

- Targeted edits, highlight edits and questions mostly passed: 64 of 73, 41 of 42 and 68 of 71. No not-in-document question got a made-up answer in 39 trials.
- "Change X to Y everywhere" failed when a paragraph held X twice: L3 passed 0 of 10, and all 20 failed everywhere trials left a second or third occurrence, as did the 6 failures on gpt-5.6-luna and gpt-5.6-terra. gpt-6.1-sol and gpt-5.6-sol passed every everywhere case. Fixed since ([Repeated words](#repeated-words-and-other-word-forms)).
- Edits that made another figure wrong left it wrong: the total or a second mention of the same number stayed unchanged in 04, 11 and 14 ([Figures](#figures-that-follow-from-a-change)).
- Requests for a part that doesn't exist: "edit the appendix" passed 20 of 20, but the seven new missing-part cases passed 7 of 21. The model edited the nearest paragraph, or sent "shorten the cover letter" through `transform_document` and shortened 61 to 88 blocks. The other models passed 3 to 7 of the 9 missing-part cases ([Missing parts](#requests-for-a-part-the-document-doesnt-have)).
- Whole-document rewrites passed the code checks in 67 of 79 runs but rarely passed the judges. The meaning judge failed 53 of 60 rewrites, about 40 of them for a change a reader would act on, such as "immediately" becoming "without undue delay" in the data processing agreement. The translation judge failed 20 of 30 German runs, mostly for key terms translated two ways. With judges, luna passed 17 of 91 section and whole-document rewrites, and the other models 5 to 13 of 30, gpt-6.1-sol the most.
- "Make the phishing part shorter" dropped "most common" on every model.

A review after the baseline read all 129 cases against their documents and changed one: S3 now lets "customer service", a department name, stay. It also fixed four flaws in the meaning judge's prompt (it saw only changed blocks, wanted each fact in its original block, contradicted itself on hedges, and quoted the test cases). Asked again, the judge kept all 60 luna verdicts. The concision judge no longer fails a single clipped phrase. The numbers above are re-graded from the saved runs, and round 15 in `TEST-RESULTS.md` lists every change.

Later full-suite runs on gpt-6-luna, same 415 trials: 72.8% ±7.3 in round 16 and 74.5% ±7.6 in round 17. The current 118-case suite passed 108 on the gateway.

### Edit strategies

The brief asks us to test three ways of getting an edit from the model. We ran all three end to end on every eval case that edits the document, once each: change-text (22 targeted, 14 highlighted and 16 "everywhere" edits), missing-part (9) and rewrite-document (20). That is 81 cases per strategy. The answer-question cases make no edit and were left out. All three used gpt-6-luna at medium effort through the local proxy, with the same documents, code checks and grader (gpt-6-luna at medium effort). The harness is in `tests/evals/strategies/`, and each strategy and scenario writes its cases to `tests/evals/results/strategy-*`.

- **A, full rewrite.** One call gets the instruction and every block in the app's plain-text format (`[id] (type) text`), plus the focus when something is highlighted. It returns the full new text of every block, keyed by block ID, through a JSON schema the API enforces, so no block can be left out. Each block whose text changed becomes a `replace_node` edit.
- **B, section scope.** With a highlight, the call gets the highlighted block. Without one, a first call sees only the outline and the text before the first heading and picks sections, and the call gets the blocks of those sections. It also gets the outline and one neighbouring block on each side, for context only. It returns new text for the sent blocks only; the schema has no field for any other block.
- **C, patch operations.** The app as it is. The chat model reads, searches and sends `replace_text` or `replace_node` operations through `edit_document`, which checks them. Whole-document instructions go through the section pipeline (`transform_document`) with its term sheet and meaning check, with gpt-6-luna as the check model, the default on the proxy at the time.

A and B share one prompt with the app's editing rules: change only what's asked, follow a changed figure, keep placeholders and how strong each statement is, and say when a part is missing. They have no tools, checks or retries. Both stream their output. A block counts as finished when the next one starts, and it goes into the headless editor through the app's `apply-edits.ts` at that moment, so the first change is the first finished block that changed.

- **Passed**: every code check passed and the grader didn't say fail.
- **Unintended**: cases where a block outside the case's scope changed, from the `no-unintended-changes` check. Whole-document rewrites have no such check.
- **In** and **Out**: average tokens per edit over all model calls, including B's picking call and C's check model. Out includes reasoning, which was small (27 tokens per edit on A, 65 on B, 369 on C).
- **Cost**: per 1,000 edits at gateway list prices for openai/gpt-6-luna, $0.10 / $0.50 per million tokens in / out, reasoning billed as output, no cache discount. The proxy reported almost no cached tokens.
- **First change**: average over the cases where the document changed. **Total**: average over all cases. Both are proxy timings and include the proxy's own delay. The three strategies ran at the same time, and C's section pass runs 6 calls at once.

Targeted edits, 22 cases:

| Strategy | Passed | Unintended | In | Out | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 21 (95.5%) | 0 (0%) | 5,357 | 3,210 | $2.14 | 11.3 s | 18.9 s |
| B, section scope | 19 (86.4%) | 1 (4.5%) | 2,111 | 631 | $0.53 | 7.6 s | 8.9 s |
| C, patch operations | 21 (95.5%) | 1 (4.5%) | 4,063 | 130 | $0.47 | 5.0 s | 5.0 s |

Highlighted edits, 14 cases:

| Strategy | Passed | Unintended | In | Out | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 13 (92.9%) | 1 (7.1%) | 5,765 | 3,336 | $2.24 | 12.4 s | 19.6 s |
| B, section scope | 14 (100%) | 0 (0%) | 855 | 100 | $0.14 | 3.3 s | 3.5 s |
| C, patch operations | 13 (92.9%) | 1 (7.1%) | 3,907 | 95 | $0.44 | 3.8 s | 3.8 s |

"Everywhere" edits, 16 cases:

| Strategy | Passed | Unintended | In | Out | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 15 (93.8%) | 0 (0%) | 5,239 | 3,134 | $2.09 | 4.0 s | 17.9 s |
| B, section scope | 12 (75.0%) | 0 (0%) | 5,407 | 2,879 | $1.98 | 7.2 s | 20.8 s |
| C, patch operations | 13 (81.3%) | 0 (0%) | 4,491 | 304 | $0.60 | 5.5 s | 5.9 s |

Missing part, 9 cases. Any change here is a failure, so there is no first-change column:

| Strategy | Passed | Unintended | In | Out | Cost per 1,000 edits | Total |
|---|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 7 (77.8%) | 2 (22.2%) | 5,654 | 3,301 | $2.22 | 21.1 s |
| B, section scope | 9 (100%) | 0 (0%) | 474 | 52 | $0.07 | 2.7 s |
| C, patch operations | 6 (66.7%) | 1 (11.1%) | 6,628 | 98 | $0.71 | 5.2 s |

Whole-document rewrites, 20 cases (7 translations, 6 "more formal", 7 "more concise"):

| Strategy | Passed | Code checks only | In | Out | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 13 (65.0%) | 19 | 5,182 | 2,915 | $1.98 | 2.4 s | 19.3 s |
| B, section scope | 10 (50.0%) | 15 | 5,802 | 2,978 | $2.07 | 5.7 s | 22.6 s |
| C, patch operations | 8 (40.0%) | 20 | 30,841 | 7,838 | $7.00 | 18.9 s | 30.4 s |

All 81 cases:

| Strategy | Passed | Unintended | In | Out | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 69 (85.2%) | 3 of 61 (4.9%) | 5,394 | 3,154 | $2.12 | 7.3 s | 19.2 s |
| B, section scope | 64 (79.0%) | 1 of 61 (1.6%) | 3,274 | 1,498 | $1.08 | 6.1 s | 13.0 s |
| C, patch operations | 61 (75.3%) | 3 of 61 (4.9%) | 11,017 | 2,058 | $2.13 | 8.7 s | 11.3 s |

Each case ran once, so the accuracy numbers are noisy. A and C disagree on 16 cases: A passed 12 that C failed, and C passed 4 that A failed (two-sided exact test, p ≈ 0.08). B and C disagree on 19 cases, 11 to 8. The grader also varies: C's German sample offer (SG) passed in the smoke run before the full run and failed in it. The cost and time gaps are large and stable; the accuracy order is not.

What the run shows:

- Cost and time follow the output. A writes the whole document back for every edit, about 3,200 output tokens on average, so changing one figure costs about as much as translating the document: $2.14 per 1,000 targeted edits against $0.47 for C, and 18.9 s against 5.0 s. On the eight longest documents, with 4,600 to 7,700 tokens of text, A took 30 s per targeted, highlighted or "everywhere" edit on average and up to 37 s, writing about 5,300 tokens each time. C took 5.4 s. On the 1-page sample A was the fastest, at 4.2 s against 6.6 s for C.
- C's whole-document rewrites cost the most, about 31,000 input and 7,800 output tokens each, against about 5,200 and 2,900 for A. The term sheet, the part calls, the meaning checks and the repairs all add up. The first change appeared after 19 s, because the term sheet comes first and each part waits for its check, against 2.4 s for A. C passed every code check on the rewrites, but the grader failed 12 of 20: all 7 translations, 4 of the 6 formal rewrites and 1 concise one. Its reasons were an untranslated table header, a switch between "Sie" and the third person, a mistranslated discount condition, and formal rewrites that left many blocks in their old tone. This grader is gpt-6-luna, and so is the check model. Round 20 used gpt-6.1-sol for both, so these 8 of 20 can't be compared with its 20 of 26.
- The enforced schema stopped the single pass from ending early. A's German policy (LG) came back with 199 of 200 blocks changed. Before, a single `edit_document` pass covered only 37 to 60 of them in 4 of 10 runs (see [Whole-document instructions](#whole-document-instructions)).
- With a highlight, B sends one editable block, and it passed all 14 cases for 855 input and 100 output tokens. In 15-highlight, "make this 12 months" on "six months" in a list item, A and C both changed a different "six months" instead, the programme length in block 6. B's schema has no field for block 6.
- With nothing highlighted, B's picking call sees only headings. It has the problem round 1 found when only the outline was sent ([Requests with nothing highlighted](#requests-with-nothing-highlighted)): it misses facts that no heading points to. Round 1 also showed the gain: on the 9-page policy, an edit to one section took about 2,200 input tokens with the outline against 7,800 with the whole document. Here B's targeted edits took 2,111 input tokens against A's 5,357. B missed the second hotline mention (L5), the project length in the executive summary (11-edit) and both skip-lot mentions (09-edit, where it then said the text wasn't shown). In L10 it added a sentence to the accounts section, as C did in earlier rounds. For "everywhere" edits it picked nearly every section and sent as much as A (5,407 against 5,239 input tokens).
- Missing parts: B passed all 9, because the picking call picked nothing and said the part wasn't there, for 474 input tokens. C failed 3, each time ending with no reply text: once after reads and searches used all 4 calls, once after an edit call that changed nothing, and once after editing a block. A failed 2 by rewriting the whole document: asked to shorten a cover letter and a definitions section that don't exist, it shortened 80 and 24 blocks. Those two runs hold 104 of the 105 blocks that A changed out of scope. C's and B's unintended changes were one block each.
- "Everywhere" edits: each strategy missed a second occurrence in one paragraph once (A in 10-everywhere, B in 03-everywhere, C in 01-everywhere). B also left the heading "Responsibilities of the Customer" unchanged (01-everywhere) and missed one block in L3. In C's L3 run, the check rejected three edits in a row and the request ran out of its 4 calls with nothing changed.

**Recommendation: keep C**, the patch operations the app already uses. Most requests are targeted or "everywhere" edits, and for those C was the cheapest and fastest: $0.47 to $0.60 per 1,000 edits and 5 to 6 s, against $2.09 to $2.14 and 18 to 19 s for A. Its accuracy is within noise of A's. It also keeps bold and links when it uses `replace_text`; A and B drop them from every block they change. Two parts of the other strategies looked worth trying in the app, each after a repeat run with more trials:

- For a highlighted edit, make only the highlighted block editable, as B does. All 14 passed, at a third of C's cost, and the model can't touch another block. An edit to a highlighted figure that should also update a total elsewhere would still need C; none of these cases asked for that.
- For whole-document rewrites, one pass with an enforced field per block (A) passed 13 of 20 against 8 for the section pass, at $1.98 against $7.00 per 1,000, with the first change after 2 s instead of 19 s. The 7 to 2 split on these cases could still be noise (p ≈ 0.18). Long documents would still need splitting into parts (see the limits below). The [strict rewrite test](#whole-document-rewrites-on-the-strict-set) checked this, A's lead didn't hold, and the app keeps C's section pipeline.

**Limits by strategy:**

- **A, full rewrite.**
  - Cost and time grow with the document, not with the edit.
  - The 64-page document wasn't run. It would need roughly 60,000 output tokens in one stream, several minutes at the speeds seen here, and a schema with one field per block (about 300 in the largest document here). C's section pass handled it in 151 to 198 s (round 11).
  - A change near the end of a long document shows up late, because the model writes the blocks in order: 11 s for targeted edits on average.
  - When the part named in the instruction is missing, it may rewrite the whole document.
- **B, section scope.**
  - Without a highlight, it finds sections from headings alone and misses facts that no heading points to.
  - For "everywhere" and whole-document instructions it sends nearly the whole document, so it has A's costs and limits. Long documents would need the sent sections split into parts.
  - A highlighted edit can't follow a figure into another block, because only the highlighted block is editable.
  - The context is one block on each side. For a table cell, that is the cells next to it, not its column header.
- **C, patch operations.**
  - It makes several calls per request (search, read, edit, and a retry after a rejected edit), each sending the conversation again, so its input per targeted edit is twice B's.
  - The 4-call limit can end a request with nothing changed (L3).
  - Whole-document rewrites cost the most and start last. It is the only strategy that splits a long document into parts, though.
  - In 3 of 9 missing-part cases it ended with no reply text.
- **All three.**
  - None of them can add or remove a block, such as a table row, a list item or a paragraph. Each operation replaces the text of an existing block.
  - Table cells and list items are blocks of their own, so table and list structure survived in every run: no strategy failed the table or heading checks on the rewrites.
  - A and B replace every changed block as plain text, so bold and links in it are lost. C keeps them when it uses `replace_text`.

`tests/evals/run-case.ts` now also counts the check model's tokens. Before, the eval's token totals for C's rewrites left out the meaning check and the repairs (round 20 in `TEST-RESULTS.md`). The full run took 30.5 minutes with the three strategies in parallel. It used about 1.6 million input and 0.54 million output tokens in the app calls and 0.36 and 0.10 million in the grader, with no errors and no retries. The proxy's weekly quota read 1% used before the smoke run and 1% after the full run.

### Whole-document rewrites on the strict set

The strategy run put A ahead of C on whole-document rewrites, 13 to 8 of 20. Before changing the app we ran a stricter and larger test. Its extra cases and the meaning grader are not part of the current suite: they were restored only for this comparison, in a separate worktree on the `rewrite-a` branch (commit 848cf6c), which was not merged. The harness files for this run (`*.rewrites.ts` in `tests/evals/strategies/`) are on that branch.

The test ran all 26 rewrite-document cases, including the six dropped from the suite, with the meaning grader back on every formal and concise case, plus the four rewrite-section cases. Every case ran twice through each strategy, on gpt-6-luna through the local proxy. The grader was gpt-6-luna at medium effort with its strict pair-by-pair routine. Two variants of A ran next to it:

- **A2** is A with the term sheet folded into the same call. The schema asks first for every key term with the one wording the rewrite uses for it, and the prompt asks for that wording in every block and one form of address throughout.
- **A3** is A2 followed by the app's own meaning check and repair from `services/document-transform.ts`, exported on that branch as `checkRewriteMeaning`. It runs part by part on the check model over the blocks A2 changed, with A2's term sheet as the shared wording, and drops edits that lose a figure or a placeholder, as the app does. A2's blocks appear as they stream, and the repairs land at the end.

For rewrite-section, A sends the whole document and gets every block back, and the scope check still fails any change outside the asked section. Measures are as in the strategy run. A grader column counts passes out of the runs it graded, and it grades only runs that passed every code check.

Whole-document rewrites, 26 cases, 52 runs per strategy:

| Strategy | Passed | Code checks | Meaning | Tone | Concision | Translation | Trials agree | In | Out | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 11 (21.2%) | 45 | 3 of 26 | 13 of 15 | 7 of 11 | 8 of 19 | 19 of 26 | 5,279 | 3,116 | $2.09 | 2.8 s | 21.5 s |
| A2, with term sheet | 12 (23.1%) | 45 | 2 of 25 | 9 of 14 | 9 of 11 | 10 of 20 | 22 of 26 | 5,461 | 3,307 | $2.20 | 4.8 s | 23.5 s |
| A3, A2 plus meaning check | 13 (25.0%) | 50 | 7 of 31 | 8 of 16 | 10 of 15 | 9 of 19 | 21 of 26 | 20,274 | 5,868 | $4.96 | 4.8 s | 33.7 s |
| C, section pipeline | 16 (30.8%) | 50 | 11 of 30 | 11 of 16 | 12 of 14 | 8 of 20 | 16 of 26 | 31,994 | 8,309 | $7.35 | 22.4 s | 36.3 s |

Section rewrites, 4 cases, 8 runs per strategy:

| Strategy | Passed | Unintended | In | Out | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|--:|--:|
| A, full rewrite | 2 | 1 | 5,103 | 3,249 | $2.13 | 11.4 s | 19.1 s |
| A2, with term sheet | 1 | 2 | 5,285 | 3,403 | $2.23 | 13.7 s | 22.8 s |
| A3, A2 plus meaning check | 2 | 3 | 7,199 | 3,854 | $2.65 | 13.3 s | 27.1 s |
| C, patch operations | 1 | 0 | 3,294 | 206 | $0.43 | 4.5 s | 4.5 s |

Code-check failures, by check:

- Whole document: A had figures-kept 5, placeholders-kept 2 and terms-consistent 1, in 7 runs. A2 had figures-kept 4 and placeholders-kept 3, in 7 runs. A3 had figures-kept 1 and terms-consistent 1. C had figures-kept 1 and length-in-range 1.
- Section: A had phrases-kept 2, something-changed 2, length-in-range 2 and no-unintended-changes 1. A2 had phrases-kept 2 and no-unintended-changes 2. A3 had no-unintended-changes 3 and length-in-range 2. C had phrases-kept 2 and length-in-range 1.

What the run shows:

- A's lead didn't hold. C passed the most, 16 of 52, against 11 to 13 for the three single passes. None of the gaps is significant: where A and C disagreed, C won 10 to 5 (p ≈ 0.30), against A2 10 to 6 (p ≈ 0.45) and against A3 12 to 9 (p ≈ 0.66). Judged as in the strategy run, on the original 20 cases and without the meaning grader, C passed 25 of 40, A2 23, A 21 and A3 19. The earlier 13 to 8 for A was most likely noise.
- The meaning grader decides most outcomes. It failed 23 of 26 graded A runs and 19 of 30 C runs. On the 10 cases whose documents run to 6 pages or more, it passed 0 of 12 graded A runs, 0 of 11 A2, 3 of 15 A3 and 4 of 15 C, and the strategies passed only 0 to 4 of their 20 runs there. Its reasons usually name one or a few pairs in a long document, such as a description turned into an obligation or a definition narrowed.
- A and A2 drop figures and placeholders. Each failed a code check in 7 of 52 runs, against 2 for C. Concise rewrites turned "All three sites" into "All sites" (05) and cut "The third quarter of 2026" from the quarterly report's opening sentence (06). Formal rewrites of the security policy turned "companies such as ours" into "companies such as [ORG_1]" (LF), a slip first seen in round 11. A3's check and repair brought this down to 2 runs, the same as C.
- Long documents didn't break the single pass. No run was cut off, errored or hit the time limit. A's and A2's German translations of the 9-page policy (LG, 200 blocks) and the onboarding handbook (08, 277 blocks) wrote 7,500 to 8,200 output tokens in one stream in 47 to 60 s, and every block came back. No strategy emptied or merged a block in any run. The 64-page document still wasn't run.
- Formatting is lost either way. The single passes lost bold or links on every changed block that had them, 518 of 518 for A. C lost them on 484 of 495: its section pass sends `replace_node` for nearly every block, which also writes plain text. Formatting is no reason to keep C for whole-document rewrites; both need a fix.
- The term sheet helped a little, and only on translations. A2 passed 10 of 20 translation runs against 8 for A, and never failed terms-consistent, which A and A3 each failed once on the German policy. It added about 5% to the cost and 2 s to the first change, because the term sheet is written before the first block. The gap is within noise.
- The meaning check (A3) brought the code checks to C's level and lifted meaning passes from 2 of 25 to 7 of 31. It more than doubled A2's cost, to $4.96 against $7.35 for C, and its total time of 34 s is close to C's 36 s. The first change still came after 5 s, against 22 s for C.
- A single pass is the wrong tool for a section. It changed a block outside the section in 1 to 3 of 8 runs, such as the pricing paragraph just before "Schedule and pricing" (S2) and a paragraph in another section of the security policy (L2). For one section of the 9-page policy it took 30 to 46 s and wrote the whole policy back, against 4 to 6 s for C. All four strategies passed only 1 or 2 of 8: "make the phishing part shorter" lost "most common" in every A, A2 and C run, and the meaning grader failed L1 in every strategy.
- Two trials of the same case agreed on 19 to 22 of 26 cases for the single passes and 16 of 26 for C.

**Recommendation: keep C for whole-document instructions, and for section rewrites.** On the strict set a single pass wasn't more accurate. C passed 16 of 52 against 11 to 13, and A and A2 failed a code check in 7 runs each against 2, mostly by losing a figure or a placeholder. What a single pass buys is cost and speed: A2 costs $2.20 per 1,000 against $7.35 and shows its first change after 5 s instead of 22 s. A3 matches C on the code checks at two thirds of its cost, with the first change after 5 s, but it didn't pass more cases than C, and like A it can't take a 64-page document in one call. If cost or time to first change becomes the priority, A3 is the variant to try next, with more trials and hand labels for a sample of the meaning verdicts, since that grader decides most outcomes.

The run took 27 minutes with the four strategies in parallel and two trials at a time per strategy. Another eval run used the same proxy at the same time, so times are likely higher than in a quiet run: C's first change took 22.4 s here against 18.9 s in the strategy run. The app calls used about 3.4 million input and 1.2 million output tokens and the grader 2.2 and 0.5 million, with no errors. The proxy's weekly quota (`x-codex-primary-used-percent`) read 1% in the smoke run and at the start of the full run, and 2% at its end, the other run included.

### Five cheap models on the AI Gateway

On 18 October 2026 the eval suite (118 cases) ran once on five cheap models through the Vercel AI Gateway. The app code, prompts and documents were the same for every model; only the model changed. [`tests/evals/REPORT.md`](tests/evals/REPORT.md) has the full tables: pass rate per scenario, tokens, cached share, spend and time per case.

| Model | Passed | Small tasks | Rewrites | Spent |
|---|--:|--:|--:|--:|
| gpt-6-luna | 108 of 118 (91.5%) | 94 of 98 | 14 of 20 | $0.35 |
| claude-haiku-5.5 | 101 of 118 (85.6%) | 94 of 98 | 7 of 20 | $0.45 |
| grok-4.3 | 100 of 118 (84.7%) | 94 of 98 | 6 of 20 | $4.51 |
| deepseek-v4.1-flash | 99 of 118 (83.9%) | 95 of 98 | 4 of 20 | $1.17 |
| gemini-3.8-flash | 79 of 98, stopped during the rewrites | 79 of 98 | not finished | $6.08 |

"Small tasks" are the change-text, answer-question and missing-part scenarios together. "Spent" is the drop in the gateway's credit balance during the run, so it includes the grader and the rewrite check. The comparison cost $12.56 in all, $6.08 of it for Gemini.

gpt-6-luna passed the most cases for the least money and stays the default. It passed all 52 change-text cases. On small edits and questions, four of the five models were within one case of each other. The rewrites separated them: gpt-6-luna is the only model that passed more than half.

The cheap Grok model we had picked, `spacexai/grok-4.1-fast-reasoning`, was unavailable: the gateway answered "Not Found" to every request on 18 October between 14:55 and 15:00. We ran grok-4.3 instead and replaced the cheap Grok model in the picker with it.

The grader and the rewrite check weren't the same in every run. gpt-6-luna graded luna, Claude and Gemini. DeepSeek and Grok graded their own work, because the setup changed between runs so that choosing a model switches every call, grader included. The app sends OpenAI's effort and verbosity settings, which the other providers ignore; they ran at their own defaults, which for DeepSeek, Grok and Gemini means long reasoning.

### Grader and eval caveats

- The grader isn't validated yet. Its verdicts are stable (a second pass over the round 15 luna transcripts repeated 168 of 170 answer, tone and translation verdicts), but stable isn't the same as right. Hand labelling in `tests/evals/labels/` will show how many real failures it catches; it comes later. Until then, read the grader's reasoning before acting on its pass rate.
- A model grades its own work, because the grader runs on the model under test. In rounds 15 to 21, gpt-6.1-sol graded every run, including its own run in round 15 and its own checks in round 21.
- The meaning grader is gone from the suite, but while it ran it decided most rewrite outcomes. It failed a whole document for one slipped word, and on the strict set it failed 23 of 26 graded A runs.
- The translation grader isn't consistent on number formats. One run failed "EUR 4.8 million" as wrong in German; another failed "18.000" because its criteria say numbers stay as written.
- Round 20 found three problems in the eval code. All three are fixed. `all-translated` no longer counts "in", "an", "it" and "will" as English words, so "[PERSON_4], Leiter/in IT" no longer counts as English. `figures-kept` now knows number words above ten, so "seventy" written as "70" no longer counts as an invented number. `run-case.ts` now records the check model's tokens as well, since the strategy run. The gateway run came before that last fix, so its token tables leave out the rewrite check, and its spend column is the one to trust for cost.
- Most timings come from the proxy. The gateway run recorded the total time per scenario but not the time to the first visible change.

## How editing works and what we fixed

### Context sent with each request

When the user sends a message, the browser builds a snapshot of the editor and sends it to our server next to the typed message. The snapshot holds the outline (every heading with its block ID), the relevant text blocks, and the highlight as a block ID plus character offsets. The server flattens it to plain text, which costs about 2.3× fewer tokens than Tiptap JSON, and attaches it to the latest user message for that one model call. MongoDB stores only what the user typed, so old copies of the document never pile up in the history.

We considered giving the model only read tools, the way coding agents work. Every tool round trip is a new model call that re-sends the whole conversation, and each one adds a wait.

How other products handle it:

- BlockNote sends the whole document plus the selection in every message and has no read tool.
- CKEditor AI sends the selection or section up front and lets the model read more on demand.
- Tiptap's AI Toolkit ships both. Its "Workflows" read the document on the client and send it with the prompt; their example task is "Make the text more formal". Its "Agents" read only through tools, with a default read chunk of 32,000 characters. At our document sizes, that means the whole document plus an extra round trip.
- Coding agents in editors, such as Claude Code in VS Code and Copilot in VS Code, also attach the current selection or file up front. They read through tools because they can't know which of thousands of files matter.

Anthropic's context engineering guidance recommends a hybrid: retrieve some data up front for speed, and explore the rest at runtime.

We went with a hybrid. Relevant text goes up front, and a `read_section` tool fetches other sections only when they're needed, for example for "match the tone of the Services section". A plain edit took 1 model call, with 876 input and 101 output tokens. A request that also needed another section took 2 calls, with 1,730 input and 160 output tokens.

### Requests with nothing highlighted

The brief says that if nothing is highlighted, the PoC should pick relevant sections (for example through the outline) rather than send the full text. In that case we send only the headings, plus any blocks before the first heading, and the model fetches what it needs.

In the first round of tests this was correct in 61 of 69 runs, against 40 of 45 when we sent the whole document. On the 9-page document, an edit to one section used about 2,200 input tokens instead of 7,800. On the 1-page sample it costs more, because two calls only beat one on longer documents.

The tests turned up these problems, which are now fixed:

- The proxy returns at most one tool call per response, even with parallel tool calls enabled. With a read tool that took a single ID, the model read one section per step and hit the step limit. `read_section` now takes several heading IDs at once.
- Blocks before the first heading were unreachable, and in one run the wrong paragraph was blanked. They're now always sent.
- Overlapping sections were sent twice (17.2k tokens). They're now merged (8.7k).

Reading the H1 returns the whole document, because every other heading sits under it. That's correct, but costly for a one-line header edit.

Facts that the headings don't point to were still missed. The answer to "Who coordinates the dates?" is under Background, and the model got it wrong in 3 of 3 runs: it read two sections it guessed at and answered without finding the right one. A hotline number mentioned in two sections had only one mention changed, also in 3 of 3 runs. The search tool fixed both.

### Search

`find_text` searches every block for several terms at once and returns the matching blocks with their IDs and headings. Like section reads, saved search results are dropped from later history. The step limit went up from 3 to 4 model calls per request.

With search, correct runs went from 61 to 66 of 69, and total input tokens fell 13.5%. The hotline case went from 0/3 to 3/3. "Change customer to client everywhere" on the 9-page document dropped from 8,720 to 2,856 input tokens and went from 2/3 to 3/3 correct.

Each tool definition is sent on every call, and this one added about 111 input tokens per call.

### Quote-checked answers

In 2 of 3 runs, "Who coordinates the dates?" got a confident, made-up answer: "[ORG_2] coordinates the dates". The real sentence is "[PERSON_2] coordinates the dates on the side of [ORG_1]."

Questions about the document now have to be answered through an `answer_question` tool, with exact quotes and their block IDs. The server checks each quote against the real document and rejects the answer if a quote isn't there. "Not in the document" is only accepted after a search. An answer that isn't verified is never shown; the user sees a "couldn't find a verified answer" line instead.

With this check, that question went from 1/3 to 8/10 correct, and no fabricated quote reached the user. The check proves that the model looked at a real sentence. It can't tell whether the model read that sentence correctly: in 2 of 10 runs the model quoted a real but irrelevant sentence ("we will schedule the kick-off call") and drew the wrong conclusion.

The new tool's definition is sent on every call as well. Questions used about 28% more input tokens, and edits about 18% more.

Asking for the answer "in the user's language" inside the tool schema made the model answer in German or Slovenian, so we took it out. The model still sometimes answered in Swedish or Slovenian (2 of 26 runs).

**Search before answering.** Every wrong answer to that question followed the same path: the model read two guessed sections and quoted a nearby sentence without searching. Every run that searched found the right sentence. A quoted answer is now rejected unless the model searched during that request. Quotes from text that was already in the prompt, meaning the highlighted section, are the exception, so questions about highlighted text don't pay for an extra call.

That question was then correct in 20 of 20 runs, with no wrong answer shown. It also got cheaper, at 2.0 calls and 2,124 input tokens on average against 2.53 and 3,007, because the model stops wandering through sections. Other questions cost more because of the added search step: 21% and 35% more input tokens on two cases.

**Empty replies.** Sometimes the user got no reply at all. It happened in 2 of 50 runs on one question, and up to about 1 in 30 in later runs. After `find_text` returned "No block contains any of these terms.", the model sometimes ended its turn with an empty final message (no text, no tool call, about 4 output tokens). The stream closed normally. The chat showed the search step and no reply, and our fallback line didn't trigger because it was tied to the answer tool. Every empty reply on record came right after a search with no matches.

The no-match message now tells the model what to do next: "If the document doesn't state the answer, call answer_question with no quotes." In 250 replays of the failing request, that produced a proper answer every time. Before the change, 249 replays gave 19 empty and 40 plain-text replies. In the app on gpt-6-luna, "Who signed the contract?" then gave a verified "not in the document" answer in 30 of 30 runs, where it had answered in plain text, skipping the check, in 75 of 150. The chat also shows "No answer came back. Please try again." whenever a reply finishes with no text, no answer and no edit, so an empty turn is never silent.

### Matching the model's text to the document

The model doesn't always copy text exactly. If it writes "kick off call" and the document says "Kick-off call", an exact match silently drops the edit, rejects the quote or comes up empty in search.

Edits, quote checks and search now share one matcher. It tries an exact match first, then a forgiving one that:

- ignores capitalisation, curly versus straight quotes, and extra whitespace;
- lets a hyphen or dash between two letters match a hyphen, a space or nothing ("kick-off" = "kick off" = "kickoff", "e-mail" = "email");
- never lets a space match nothing, so "the rapist" doesn't match "therapist";
- leaves hyphens between digits as they are, so "10-20" doesn't match "1020".

There's deliberately no fuzzy matching that allows a few letters to differ. "[ORG_2] coordinates" and "[PERSON_2] coordinates" differ by only a few letters, and fuzzy matching would wave a wrong answer through.

For edits, the match is mapped back to the exact original characters, so formatting on the replaced text is kept.

### Table cells

**A search hit without its column.** Told that unused accounts are now deactivated after 30 days instead of 60 (L10), gpt-6-luna also changed an unrelated "60 days" in a patching table in 2 of 2 runs. The search had returned that table cell on its own, as `[221] (table cell r4c4) 60 days`, so the model couldn't see that the cell was the patch deadline for high-severity issues on production IT. Search hits in tables now come back with the table's header row and the cell's whole row. After that change, the patching cell was left alone in 20 of 20 runs, at a cost of about 40 extra input tokens. In 2 of those 20 runs the model skipped the search, read only the accounts section and added a sentence to the wrong paragraph there. That miss still turns up in about 1 run in 10.

**Edits sent to the wrong cell.** "Change customer to client everywhere" on the policy left one table cell unchanged in 4 of 10 gpt-6-luna runs in the model matrix, and in 5 of 10 runs at default thinking just before the fix. gpt-6.1-sol and gpt-6-astra never did this.

`find_text` printed a table hit as two lines: the header row, then the hit's whole row, with an ID before each cell:

```
[53] Class | [54] Description | [55] Examples | [56] Handling
[68] Confidential | [69] Information whose disclosure could harm [ORG_1] or its customers | [70] …
```

The model sent the change for "customers" to block 68, the first ID on the line, instead of 69. Block 68 doesn't contain "customers", so nothing changed. The server still accepted the edit, and the run ended as if it had worked. Of the 5 misses, 4 went to block 68 and 1 left the cell out.

We made two changes:

- Search results now print each table cell on its own line, the same way as every other block: the ID first, then the cell's place in the table, then its text. The header row still comes first and says "table header", so the 30-days case can still see which column a cell is in.

  ```
  [56] (table header r1c4) Handling
  [68] (table cell r4c1) Confidential
  [69] (table cell r4c2) Information whose disclosure could harm [ORG_1] or its customers
  ```

- The server now rejects an edit when the text it should replace isn't in its block, or when the block doesn't exist. It uses the same forgiving match as the editor. Like the heading check, it rejects the whole call and says what to fix, for example: `Not applied. "customers" is not in block 68. It appears in blocks 69, 78, 3. Send all changes again in one edit_document call.` It names at most three blocks that hold the text, nearest first. A request gets 4 model calls, so a search, a rejected edit and a retry still fit.

Results on gpt-6-luna at default thinking (round 13):

- "Customer to client" went from 5/10 to 10/10. The new check never fired, because the model always picked the right cell.
- To test the check on its own, we put back the one-line rows and ran the case 10 more times. The check rejected 3 edits, the model fixed all 3 on its next try, and all 10 runs were correct. One of them searched again before retrying and used all 4 calls. A rejected run used 6,300 to 9,900 input tokens instead of about 3,700.
- The 30-days case stayed at 9/10. The miss was the familiar one: the model read only "User Accounts" and changed block 84. The patching-table cell was never touched.
- A search that hits a table costs about 60 more input tokens. The 1-page "customer to client" case passed 3 of 3 and the edit set 22 of 23. The miss was "edit the appendix", a known luna problem.

The scorer of that time only checked that every block with "customer" changed. Blocks 3, 78 and 260 contain the word twice, and in every run, before and after, the model changed only the first one in at least one of those blocks. The next section deals with that.

### Repeated words and other word forms

**A word twice in one paragraph.** "Change customer to client everywhere" failed in all 10 L3 runs of the eval baseline. Block 260 of the policy reads "Incidents that affect customer information are reported to the customer in accordance with the contractual requirements." The model sent one `replace_text` with find "customer". The editor replaces only the first match, so "reported to the customer" stayed, and the server accepted the edit.

`edit_document` now applies each block's `replace_text` edits to the block's text in order, with the editor's own matcher. If a find text is still in the block afterwards, it rejects the whole call:

```
Not applied. "customer" appears 2 times in block 260, you sent 1 edit. Send one edit per occurrence, or add surrounding words if only some should change. Send all changes again in one edit_document call.
```

Two edits with the same find text pass, and the editor changes the first and then the second occurrence. Edits with different text that together cover every occurrence also pass, such as "the plant managers" and "plant managers" in block 135 of the incident report. A plain count of each find text would have rejected those, and they passed in 3 of 3 baseline runs. On the saved edits of all five baseline runs, the check would have fired in 17 trials, all of them failed ones.

Results on gpt-6-luna, full suite, against the re-graded baseline (round 16):

- The check fired in 13 of 415 trials, and in 9 of 10 runs of a separate L3 run. Each time the model's next edit was accepted. 19 of the 22 took 3 model calls (search, rejected edit, edit) and 3 took all 4, because the model searched again first. None ran out of calls, so the limit stays at 4.
- "Bulky goods" to "oversized goods" went from 1/3 to 3/3, "customer" to "client" on the IT offer from 1/3 to 2/3, and "trade fair" to "trade show" from 0/3 to 1/3.
- L3 went from 0/10 to 1/10, and 2/10 in the separate run. Block 260 is now right in every run. Blocks 3 and 78 still keep one "customer". The model sends find "customers", which occurs once, and the other word is the singular in "our customer contracts". That is different text, so the check can't see it. The other everywhere failures are the same kind: "The customer's" next to "the customer wants", "trade fairs" next to "trade fair", and 'the "Main Agreement"' next to a lowercase "main agreement".

**Other forms of the same word.** `edit_document` now also looks for other forms of each find text in its block, after the block's edits are applied. Code cuts the ending off every word, so "customers", "customer's" and "customer" all become "customer", and compares the find text's words with every run of words in the block. When they match, it rejects the whole call:

```
Not applied. Block 3 still has "customer", another form of "customers". Send one edit per occurrence, or add surrounding words if only some should change. Send all changes again in one edit_document call.
```

Code only finds the leftover; the model makes the fix. Editors that replace word forms themselves get it wrong. Word's "Find all word forms" covers English only and misses forms, and a WordPerfect-era patent describes replacing the noun "saw" with "hammer", which also turned "I saw" into "I hammered". Tiptap's example replace-all tool for its AI Toolkit swaps the exact text only.

Search engines match word forms with stemmers, which cut words down to a common stem:

- English: the full stemmers, Porter and Snowball, cut "customer" to "custom" in every JavaScript package we tried, so "custom fields" would block a customer-to-client change. We use the minimal stemmer that Elasticsearch offers as `minimal_english`, from Harman's "How effective is suffixing?" (1991). It only removes plural endings ("policies" to "policy", "fairs" to "fair"), and we drop a possessive 's first. It's a few lines in `lib/word-forms.ts`, with no package. It misses -es plurals of words ending in s, x, ch or sh ("processes" and "process") and irregular plurals.
- German: the Snowball German stemmer from `@orama/stemmers` (Apache-2.0, no dependencies, last release July 2026). It matches "Kunde" and "Kunden", and "Vertrag", "Verträge" and "Vertrags". Like every German stemmer we tried, it also matches "Lage" and "Lager", and it doesn't link "Kundin" to "Kunde". `natural`, the most downloaded option, pulls in mongoose, pg and redis, and `snowball-stemmers` hasn't had a release since 2022.
- The language comes from the whole document: German when it has more common German words (der, die, und, …) than common English ones (the, and, of, …). All 23 test documents are English, so only unit tests cover German.

Results on gpt-6-luna, change-text scenario, one run each, against the suite's first run:

| | Before | After |
|---|--:|--:|
| Cases passed | 45 of 52 (86.5%) | 48 of 52 (92.3%) |
| Everywhere and throughout cases passed | 11 of 15 | 15 of 15 |
| App input tokens | 163,686 | 167,746 |
| Time | 4 min 54 s | 5 min 13 s |

- The four failures left aren't about word forms. Three are a figure whose second mention or total stayed the same (04, 11, 14), and in 05 the model reworded the sentence instead of making the expected change.
- Three more runs of the 15 everywhere and throughout cases passed 39 of 45 (87%). With a further 3 runs each of L3 and the IT offer, the check rejected an edit in 10 runs, every time for a real leftover. In 8 of them the model's next edit was accepted and the case passed.
- Across the new runs, "trade fair" to "trade show" and "Main Agreement" to "Master Agreement" passed 4 of 4, and L3 4 of 7, against 1/10 and 2/10 in round 16. The IT offer passed 4 of 7: 0 of 3 in one batch with no word-form rejection, whose cause we didn't record, then 3 of 3.
- A rejected run used 7,000 to 11,100 input tokens instead of 3,000 to 4,000.
- In 2 L3 runs the model kept resending block 3 without a second edit, was rejected again and used up its 4 model calls. Nothing was applied. Before, most blocks would have changed.
- In 1 L3 run the model sent find "our customers entrust to us". The check compares the whole find text, so "our customer contracts" didn't match it and stayed. Adding surrounding words is also how the model keeps a form on purpose, so this one stays open.
- A rejection that quotes the words around the leftover, such as "customer" in "our customer contracts", would give the model text to copy into its next edit. Not built yet.

### Figures that follow from a change

Three change-text cases failed because one figure changed and a figure tied to it didn't:

- 04, "correct the interface test result: 220 of 236 test cases passed, not 214": the model changed 214 to 220 and left "the remaining 22 cases" in the same paragraph and in an action item, where 16 is now right. It had the paragraph in front of it.
- 11, "extend the stabilisation phase to month 15": the model changed the phase and left the project length in the summary at 14 months. It read only the Phases section.
- 14, "it was actually 25 delayed customer orders, not 23": the summary and the impact section both say 23. The model searched for "23 orders", which found only the summary.

A fourth case guards the other side. 08, "shorten the probation period to four months", must keep a review "after three months" and a notice "at least four weeks before the probation period ends".

There are two changes. First, `edit_document` checks figures. When an edit removes a number of two or more digits from a block, and the number still appears anywhere in the document after the edit, the call is rejected once with every place quoted:

```
Not applied. You changed 14 in block 162. 14 also appears in block 5: "…stem and introduced in three waves over 14 months. The solution covers goods recei…"; block 11: "…stead of custom development: 13 of your 14 must-have requirements are met by stand…"; … Change each one that states the same fact or follows from your change, such as a total or a remaining count, and leave the ones that state something else. Send all changes again in one edit_document call.
```

Code can't tell which 14 is the project length, so it lists up to six places and the model decides. A second edit in the same request skips the check. Single digits and numbers inside placeholders such as [PERSON_12] are skipped, and numbers written as words, such as "six months", aren't seen.

Second, the chat's system prompt has one new line: "When the instruction changes a number, date or other fact, also change every other mention of the same fact and every figure calculated from it, such as a remaining count or a total. Find them with `find_text`, searching for the old value on its own, such as "23" or "14". Don't adjust any other figure, even one that seems to scale with the change, such as a deadline or a check-in date within a changed period."

It took three wordings. The first said "figures that follow from it, such as a remaining count, a total, a duration or an end date", and in the full suite 08 then moved the review to two months and the notice to two weeks. The second ended with "Leave every other figure as it is, including periods, deadlines and amounts that are set on their own". The last sentence of the third was written against 08, so 08's result partly measures its own fix.

Results on gpt-6-luna, repeated runs of the four cases:

| | 04 | 08 | 11 | 14 |
|---|--:|--:|--:|--:|
| Before | 0 of 3 | 2 of 2 in full runs | 0 of 3 | 2 of 3 |
| Prompt line only, first wording | 1 of 5 | | 1 of 5 | 5 of 5 |
| Check and prompt line, first wording | 4 of 5 | 0 of 1 in a full run | 4 of 5 | 5 of 5 |
| Check and prompt line, second wording | 5 of 5 | 3 of 5 | 5 of 5 | 5 of 5 |
| Check only | 0 of 6 | 3 of 6 | 6 of 6 | 6 of 6 |
| Check and prompt line, third wording | 4 of 6 | 5 of 6 | 5 of 6 | 6 of 6 |

- 04 is arithmetic, and the check can't help: 214 appears nowhere else. Without the prompt line it passed 0 of 9 runs, and with the check and the prompt line 13 of 16.
- The check fired in all 22 runs of 11 that had it, and 20 passed. No run changed the other 14s ("14 must-have requirements", "14 years", "14:00"). With the prompt line alone, 11 passed 1 of 5.
- With the prompt line, 14 searched for "23" on its own and changed both blocks in one call in all 16 runs, so the check never had to fire. With the check only, it fired in 2 of 6.
- 08 fails without either change too: with the check only, 3 of 6 runs moved the notice to two weeks or the review to two months. The prompt line's last sentence lowers that to 1 of 6.
- A rejected run costs one more model call: 11 used 5,400 to 8,800 input tokens, against about 3,400.
- The check also fires when the old number only appears with another meaning, such as "14:00" or a code like "F-14", and it sent back one 11 run that had already changed both mentions, because other 14s were left. That costs a call but changed nothing.

The full change-text scenario on the final version passed 51 of 52 (98.1%), against 48 of 52 after the word-form check and 45 of 52 in the suite's first run. The one failure was 08: the model moved the review to two months and cut the buddy programme from six months to four. App input tokens rose from 167,746 to 213,848 (+27%), from the prompt line on every call and the extra call after each rejection. With the first wording, answer-question passed 37 of 37 (36 before), rewrite-section 2 of 4 (2 before) and missing-part 6 of 9 (7 before). The new missing-part failure was "shorten the cover letter" editing the submission line, the known luna failure from the next section, with no figure involved.

### Requests for a part the document doesn't have

Asked for a part that isn't there, gpt-6-luna usually changed something nearby. The warehouse proposal opens with a submission line ("Submitted by [ORG_1] to [ORG_2], attention of [PERSON_2], …") and an executive summary, and has no cover letter. "Shorten the cover letter" went to `transform_document` in 3 of 3 baseline runs and shortened 61 to 88 blocks of the proposal. "Add an entry for transaction log to the glossary" changed the report's approval paragraph in 3 of 3. The seven missing-part cases other than "edit the appendix" passed 7 of 21.

The system prompt has one new line: "If the instruction names a part the document doesn't have, such as a section that isn't in the outline, change nothing rather than editing a similar part: make no edit and no transform, say that part isn't there and ask what to change."

Results on gpt-6-luna, full suite (round 16):

- The seven cases went from 7/21 to 15/21. "Edit the appendix" stayed at 10/10 on both documents. No run called `transform_document` for a missing part (3 before). 4 runs still edited a nearby paragraph (10 before, plus the 3 transforms), and 2 read and searched until they ran out of calls and gave no reply (1 before).
- Trials that changed a block outside the case's scope fell from 17 of 336 to 9 of 336.
- Parts named loosely still work: "the pricing section" (heading "Schedule and pricing"), "the draft note at the top", "the document header" and "section 9" passed 3 of 3 each. "The cost part", "the passwords section" and "the phishing part" edited the right section in every run; they fail on the judges, as before.
- A possible side effect: 2 of 110 question runs replied in plain text instead of a checked answer, against 0 of 110 in the baseline. One of them answered "who is the named service manager?" with "The document does not name a specific service manager", which is right but unchecked. A rerun of that case gave 1 more of 10. The new line's "say that part isn't there" may cause this.

In round 17 the missing-part cases passed 32 of 41 and then 33 of 41, against 35 in round 16, with the same kinds of failure: within noise, but worth watching. In the strategy run C failed 3 of 9, each time with no reply text, and in the gateway run 1 of 9.

### Keeping how strong a statement is

In round 16 on gpt-6-luna, section and whole-document rewrites passed 18 of 91 runs, and the meaning judge failed 53 of them. The part prompt said to keep every number, date, amount and fact, but nothing about how strong a statement is. The model treated words like "should", "only" and "without delay" as style:

- Data processing agreement, "more formal": "shall inform the Controller without delay" became "without undue delay" in 3 of 3 runs.
- Security policy, "more formal": "Employees who receive a suspicious email should use the report button" became "must use the report button" in 3 of 3.
- Sensor spec, "more concise": "intended exclusively for measuring vibration" lost "exclusively" in 3 of 3, and "The sensor should be installed as close as possible to the bearing" became "Install the sensor as close as possible to the bearing".

The part prompt in `services/document-transform.ts` has one new line. Section rewrites such as "make the passwords section friendlier" go through `edit_document`, not the part calls, so the chat's system prompt has the same rule as one line, starting "When you rewrite text, keep how strong…":

"Keep how strong each statement is: don't turn should into must or into a command, or a definite statement into one with can, may or helps, or any of these the other way round, and keep every word that limits or qualifies a statement, such as only, exclusively, most, always or without delay."

We tried three wordings on the 31 rewrite cases. They passed 30, 30 and 26 of 91. This one, the second, had the fewest meaning failures (36), so it stayed. The third also asked to keep words that narrow whom, what or when a rule applies to; it helped nothing.

Results on gpt-6-luna, full suite (round 17):

- Rewrites passed 28 of 91, against 18: whole-document 23 of 79 (15 before), section 5 of 12 (3). The meaning judge failed 38 runs, against 53. English rewrites went from 7 of 61 to 19 of 61. German stayed at 9 to 12 of 30, because those fail on terms translated two ways, not on meaning.
- In all four runs with the rule, no rewrite wrote "without undue delay" or "must use the report button", and "exclusively" and "strongly recommended" were kept every time.
- Some remain. "The sensor should be installed" still became "Install the sensor" in every run, "Documents for older machines … are added on request" became "can be added" in 2 of 3, and "the entire foundry stops with it" became "is affected" in 3 of 3. Concise rewrites still drop words that limit a rule, such as "Privileged sessions on critical servers are recorded" becoming "Sessions on critical servers are recorded".
- The overall pass rate went from 72.8% ±7.3 to 74.5% ±7.6. Paired by case, that is +1.8 ±3.8 points, within noise. Missing-part cases passed 32 of 41 against 35, and 33 in a rerun ([Missing parts](#requests-for-a-part-the-document-doesnt-have)). The other kinds moved by one trial or not at all.

### Whole-document instructions

"Translate the document to German", "make the whole document more formal" and "more concise" run through a pipeline in our code. On the current suite it passed 14 of 20 rewrite cases on the gateway, and 8 of 20 in the strategy run through the proxy. It got there in steps.

#### One long pass wasn't enough

These instructions failed on the 9-page policy in two ways. First the model edited without reading. With only the outline in front of it, it translated just the 26 headings in 6 of 8 German runs, and in 2 of 4 "more concise" runs it replaced 13 headings with summaries it made up. A prompt line made it read first ("…including the whole document, first call `read_section` once with every outline heading…"), and `edit_document` now rejects edits that turn a heading into body text. Reading first exposed the second failure. In 4 of 10 German runs the model read all 200 blocks, then sent one edit covering only 37 to 60 of them. Replays of that edit call fell short once in 8 with either prompt, so the prompt wasn't the cause. The line also cost a targeted case. "Unused accounts are now deactivated after 30 days instead of 60" fell from 18/20 to 7/11, and each failing run read only the accounts section.

Other editors don't rely on one long pass. CKEditor's AI Translate documentation recommends its review-based path for full documents, because the single-pass translate action can miss parts of longer content. Tiptap's AI Toolkit splits large documents into chunks and processes them in parallel. In Chroma's "Context Rot" study (July 2025), models copying text did worse as the text grew longer, and some stopped early.

#### The section pipeline

A `transform_document` tool runs the long pass in our code. It takes only the instruction, and the chat model calls it for instructions about the whole document; targeted edits stay with `edit_document`. The code splits the blocks into parts. Each heading starts one, text before the first heading forms its own, a part under about 250 tokens joins a neighbour while the pair stays at 1,000 or less, and a longer part is split between blocks. The policy becomes 14 parts. Each part gets one plain model call without tools or history, which returns `edit_document` edits for its own blocks and is told to keep placeholders, numbers and facts. Each call gets the outline, the instruction and the blocks of its own part, whatever the document's size. Six calls run at once, and a call that fails or hits 60 seconds is retried once. Each part's edits pass the heading check and must stay inside the part, then stream to the browser as the part finishes. The chat run stops there, and later turns see a short summary.

The browser applies each part outside undo history and keeps the original of every block it changes. When the run ends, including on Stop, it restores the originals and writes the new text back as one history step, so one undo reverts the whole transform; we checked this in the browser. For 1,273 blocks that step took 60 ms in Node. The editor stays editable, so text typed into a block before its part arrives is overwritten.

On the policy, against the single pass (round 11):

- German covered 198 or 199 of 200 blocks in every run, against 37 to 199. The job title "Chief Information Security Officer" stayed in English every time.
- The first German change appeared after about 6 s instead of 49 s. Complete translations took 22 to 37 s instead of 58 to 82 s; one run took 78 s because one part was slow.
- A run costs 15 calls and about 14,700 input tokens instead of 2 calls and 9,400. While each call still carried the whole document, it was about 109,000, and the proxy reported 90% of that as cached.
- "More concise" lost 7 placeholders in 5 runs, against 73 in 10.
- Each call chooses its words independently. Every German run used both "Beschäftigte" and "Mitarbeitende" for "employees", where the single pass stuck to "Beschäftigte".

Routing took three wordings. The first sent "make the passwords section friendlier" through the tool in 3 of 8 runs, at 109,000 tokens each, and the second did the same with "change customer to client everywhere" and missed a block. With the final wording no targeted instruction called the tool in 92 runs, and all 30 whole-document runs did. "Change customer to client everywhere" now goes through `find_text` and `edit_document` in 2 calls, with 2,400 input tokens on the sample and 3,700 on the policy. The 30-days case is at 23/28.

A 64-page document joined from 13 samples (128 parts, outline only) took 151 and 198 s at about 470,000 input and 80,000 output tokens per run, with no failed parts or rate limits. In one run the model wrote "In stock" into two price cells of a long table.

#### Part calls without the whole document

Each part call on a document under 20,000 tokens used to start with the whole document, so on the policy all 14 calls re-sent the 200 blocks. Each call now gets the outline instead. We compared both on gpt-6-luna at default thinking: 3 runs per policy instruction and 2 per sample instruction without the document, against the earlier 5 and 3 runs with it (rounds 11 and 12).

- Input per policy run fell from about 109,000 to 14,700 tokens, and on the sample from 2,578 to 2,014. Output on the policy stayed within 8%. At gateway prices a policy run fell from $0.014–0.016 to $0.005–0.007.
- German covered 199 of 200 policy blocks in every run without the document, against 198 or 199 with it, and every block of the sample both ways.
- With the document, every formal run replaced "ours" in "companies such as ours" with [ORG_1], and 4 of 5 weakened "the most common route for attacks". Without it, no luna run added [ORG_1], and 2 of 13 weakened the phrase, counting the 10 luna runs from the model matrix.
- "More concise" dropped placeholders in 4 of 5 runs with the document. Without it none of the 3 runs did, but 5 of the 10 luna matrix runs did, so the document wasn't the cause. Concise text came out at 81% of the original length instead of 75%.
- Terminology stayed mixed. Every German run still used both words for "employees", and "Mitarbeitende" took over as the more common one, in 27 or 28 blocks against 10 or 11 for "Beschäftigte".
- The first change appeared after 5 to 9 s on average and a run finished in 18 to 22 s, against 6 to 8 s and 18 to 37 s with the document; the 37 s average included one 78 s run.

Apart from concise text coming out somewhat longer, no measure got worse.

#### Stop

Stop used to end only the stream in the browser. The server finished the run, kept calling the model and saved "Edited 199 blocks in 14 sections." to the history. Now the request's abort signal reaches `streamText` and every section call, no section call starts after it fires, and a stopped reply is saved without tool calls that never returned a result. In the browser, Stop after 4 of 14 German sections closed the 6 open section calls at once, no call started in the next 45 seconds, and the history showed "Stopped after 4 of 14 sections." with 49 changed blocks, the same 49 as the editor. A stopped reply records no token usage, and in the next turn the model read the saved progress as still running and told the user the document was being translated.

#### A meaning check after each rewritten part

After round 17, whole-document rewrites passed 23 of 78 runs, not counting the 64-page case. Most failures were the meaning judge finding a sentence whose meaning had shifted, such as "should be installed" becoming "Install". A bigger model was not the fix: gpt-6.1-sol passed 13 of 30 rewrites.

Each part of a whole-document rewrite now gets one more model call, after its rewrite and before its changes go to the editor. It uses the same model and settings as the part call. It gets the instruction, the part's original blocks and its rewritten blocks, and looks for sentences whose meaning changed: a fact, condition, limit or scope that was lost or changed, or a statement that got stronger or weaker. It returns the whole corrected text of just those blocks, still in the instruction's style, length and language, or an empty list. The corrected text replaces the part's changes for those blocks, and the changes then stream as before.

- A correction for a block the rewrite didn't change, or one that breaks a heading, is ignored.
- If the call fails or takes more than 30 seconds, the part keeps its rewrite. A part with no changes skips the call.
- Its tokens count in the session's token totals and in the eval's token figures.
- Section rewrites such as "make the passwords section friendlier" go through `edit_document`, not the part calls, so they don't get the check.

Two examples, 3 runs each, before and after the check:

- Product specification, "more concise": "The sensor should be installed as close as possible to the bearing" became "Install the sensor …" in 3 of 3 runs. With the check, it stayed "The sensor should be installed …" in 3 of 3.
- Customer case study, "more formal": "When the line stops, the entire foundry stops with it" became "the entire foundry is affected" in 3 of 3 runs. With the check, it stayed "the entire foundry stops" in 2 of 3.

Results on gpt-6-luna, on the 26 whole-document rewrite cases at 3 trials each, against the same cases in round 17 (round 18):

| | Before | After |
|---|--:|--:|
| Passed | 23 of 78 (29.5%) | 29 of 78 (37.2%) |
| English rewrites failed by the meaning judge | 33 of 48 | 26 of 48 |
| English rewrites passed | 14 of 48 | 18 of 48 |
| German translations passed | 9 of 30 | 11 of 30 |
| Model calls per rewrite | 8.3 | 15.5 |
| App tokens per rewrite, input and output | 14,619 | 25,976 |
| Time per rewrite | 12.1 s | 18.9 s |
| Time to the first change | 6.3 s | 9.0 s |

Paired by case, the pass rate rose by 7.7 ±11.8 points. That is within noise.

The extra cost is about 11,400 tokens per rewrite (78% more), 6.8 seconds more per rewrite, and 2.7 seconds more before the first change shows. At list prices, 1,000 rewrites cost $5.22 instead of $3.38.

What was left after this step:

- Concise rewrites still failed. The maintenance contract, the project plan, the curriculum, the procurement guideline and the security policy failed the meaning judge in 3 of 3 runs, before and after.
- One call misses shifts it can see. We asked the check again on the final text of the 8 meaning failures from the one-trial run, using the blocks around each finding. It flagged the block the judge named in 5 of them. A stricter wording that went sentence by sentence flagged more blocks, but not more of the judge's findings, so it wasn't tried in a run.
- The check can cost tone. In 2 of 3 formal runs on the sample offer, "The customer wants a workshop for 12 people" came out unchanged, and the tone judge failed both as not formal enough. Before the check, every run rewrote it, for example to "would like a workshop". The check most likely put back the original sentence instead of a formal one with the same meaning. This case went from 3 of 3 to 0 of 3.

#### Whole-document rewrites: a term sheet and a stronger check

After round 18, whole-document rewrites passed 9 of 26 cases on gpt-6-luna. German translations mixed key terms, because each part is translated on its own. Concise and formal rewrites dropped or changed small words, such as "visitor" in "visitor badge". The grader fails a whole document for one such slip.

A rewrite now runs in four steps:

1. A term sheet. One call reads the whole document and lists the terms every part must word the same way, plus notes such as the form of address. Each part and its check get the terms that occur in that part.
2. The part rewrites, as before, with the term sheet in the prompt.
3. A meaning check per part. It sees each changed block as a word-level difference. Code adds hints when a word such as should, must, only or all changes its count, or when a number or placeholder is lost or added.
4. A repair. Flagged English blocks go to one more call with the original, the rewrite and the problems. Translated blocks get the check's own find-and-replace fix. A lost number or changed placeholder always goes to repair; if the repair still has it, the block keeps its original text.

The check and the repair can run on a stronger model (`LLM_CHECK_MODEL`, `AI_GATEWAY_CHECK_MODEL`). By default they run on the chat's own model, so switching the model switches every call.

One bug turned up: the heading guard rejected any heading that more than doubled in length, so "Air", "2. Scope" and some longer German headings stayed English. A heading may now grow to twice its length plus 20 characters.

What didn't work:

- gpt-6-luna as the checker. It let the same slips through in every run, such as "Nobody will face disciplinary consequences" becoming "No employee will …". It judges them harmless; the grader doesn't. The best luna-only variant passed 15 of 26.
- Letting the check write its own fix. In one run, 3 of 7 meaning failures came from the fix itself, which dropped "early", "immediately" and "production IT".
- Restoring the original of every flagged English block. Meaning failures fell from 7 to 2, but formal rewrites kept informal blocks and concise ones stayed too long.
- Telling the rewriter to change only what the instruction needs. Formal rewrites left conversational headings, and the tone grader failed them.
- A term-sheet note on number formats. The model wrote "1 working day" for "one working day", which the figure check counts as an invented number.
- Before the term sheet was told to list everyday words with several translations, it listed 117 terms for the security policy but not "employee".

Results on the 26 cases, one run each, graded by gpt-6.1-sol with the meaning judge (round 20):

| Setup | Runs | Cases passed per run | Tokens per rewrite | Cost per 1,000 rewrites | Seconds per rewrite |
|---|--:|---|--:|--:|--:|
| Before: round 18 code, gpt-6-luna only | 1 | 9 | 25,800 | $5.20 | 19 |
| New steps, gpt-6-luna only | 4 | 14, 14, 15, 11 | 36,300–41,900 | $7.60–8.90 | 41–46 |
| New steps, check and repair on gpt-6.1-sol | 6 | 18, 22, 19, 17, 19, 21 | 36,200–38,100 | $49–54 | 40–45 |
| Final code, `yarn evals` | 1 | 20 | 39,200 | $55 | 48 |
| Everything on gpt-6.1-sol (earlier effort test) | 1 | 19 | 25,100 | $96 | 40 |

With the stronger check, runs passed 17 to 22 cases, so 80% is about the average, not a floor. The final code passed 21 and then 20. Seconds come from runs with other cases alongside, so one rewrite alone is likely faster. The first change now shows after about 20 seconds instead of 9, mostly because the term sheet comes first.

What is left: the project plan fails every run on one sentence, where "during the realisation phase" moves to the front and covers the whole staffing promise. Other failures change from run to run: one technical term in a translation, one conversational sentence left in a formal rewrite, or one subtle shift such as "require approval" becoming "may require approval".

The token figures in the round 20 table come from a logging wrapper around both models, because `run-case.ts` didn't record the check model then. The eval problems this round found, and their fixes, are under [Grader and eval caveats](#grader-and-eval-caveats).

**Cheaper check models (round 21).** No check model on the proxy reached about 80% for less than gpt-6.1-sol. gpt-6-sol passed 12 of 26 and cost more than gpt-6.1-sol ($70 against $55 per 1,000 rewrites), because it wrote about 1.8 times as many output tokens per check call. gpt-5.6-luna passed 1 of 8 hard cases. The check still runs on the chat's own model by default (gpt-6-luna unless the user picks another), to keep the cost down. A stronger check model such as gpt-6.1-sol makes rewrites more accurate at about ten times the cost.

## Model choice

### Model size and thinking level

A first comparison ran on gpt-5.6 models, before the search-first rule. More thinking and bigger models gave more wrong answers there: "Who coordinates the dates?" was right in 39 of 40 runs on gpt-5.6-luna at default thinking, 36 of 40 at high thinking, 36 of 40 on gpt-5.6-sol and 3 of 11 on gpt-5.6-terra, and sol showed a wrong answer in 11 of 67 question runs. Every wrong answer came from skipping the search, which the search-first rule now blocks. On "Who signed the contract?", sol claimed "[PERSON_3] signed" in 7 of 13 runs, quoting "Kind regards, [PERSON_3]". The quote check can't catch a real quote used for a wrong claim.

The local proxy turned out to ignore `reasoning_effort` for the gpt-6 models. Its OpenAI provider doesn't recognise gpt-6 model names as reasoning models and drops the setting, so a request for gpt-6-luna with `reasoning_effort: "none"` still used 228 reasoning tokens, and an invalid value went through without an error. Every gpt-6-luna run before the matrix below therefore ran at the backend's default. For the matrix, a forwarder sent each request to the proxy's Responses endpoint with the effort set, and every response reported the effort it ran at. The backend's defaults are medium for gpt-6-luna and gpt-6-astra and low for gpt-6.1-sol, so "default" repeats medium on luna and low on sol. OpenAI's API documentation gives medium as gpt-6.1-sol's default, so on the gateway "default" can mean something else. The app now sets the effort explicitly (see [The Responses endpoint](#the-responses-endpoint)).

The matrix (round 12) ran with section calls that no longer get the whole document. Each config handled 68 requests: the edit set twice, five question cases three times, "Hi!" once, and the concise, formal and German instructions twice on the policy and once or twice on the sample. A whole-document run counts as correct when German covers at least 98% of the blocks, every placeholder and figure survives, nothing is invented and concise text comes out shorter. Cost is at gateway list prices, with reasoning billed as output.

| Config | Correct | Edits | Questions | Whole document | Cost per 1,000 requests | Avg time |
|---|--:|--:|--:|--:|--:|--:|
| gpt-6-luna, none | 63/68 (92.6%) | 34/36 | 22/22 | 7/10 | $1.01 | 9.5 s |
| gpt-6-luna, low | 64/68 (94.1%) | 32/36 | 22/22 | 10/10 | $0.87 | 8.7 s |
| gpt-6-luna, medium | 64/68 (94.1%) | 34/36 | 22/22 | 8/10 | $0.88 | 7.9 s |
| gpt-6-luna, high | 66/68 (97.1%) | 34/36 | 22/22 | 10/10 | $0.99 | 8.0 s |
| gpt-6-luna, default (medium) | 66/68 (97.1%) | 35/36 | 22/22 | 9/10 | $0.86 | 7.1 s |
| gpt-6.1-sol, low | 68/68 (100%) | 36/36 | 22/22 | 10/10 | $16.71 | 10.5 s |
| gpt-6.1-sol, default (low) | 68/68 (100%) | 36/36 | 22/22 | 10/10 | $16.58 | 10.4 s |
| gpt-6.1-sol, high | 68/68 (100%) | 36/36 | 22/22 | 10/10 | $18.75 | 13.0 s |
| gpt-6-astra, default (medium) | 68/68 (100%) | 36/36 | 22/22 | 10/10 | $83.31 | 14.3 s |

No config showed a wrong answer in its 22 question runs, and no reply came back empty. gpt-6.1-sol and gpt-6-astra got all 272 requests right. gpt-6-luna missed 17 of 340, and more thinking didn't change that beyond noise: medium and default are the same setting and scored 64 and 66 of 68. At none, one German section came back as output that didn't parse, and its retry ran on for 13 minutes and 128,000 output tokens; the app gave up after 60 seconds and that section stayed English.

The other 16 luna failures fall into four groups, none of which showed up on sol or astra:

- "Change customer to client everywhere" missed a table cell in 4 of 10 policy runs: the edit for "customers" went to the cell next to it. This is now fixed (see [Table cells](#table-cells)).
- "Edit the appendix", on documents that have none, edited some part of the document in 5 of 20 runs instead of asking what to edit. One of those runs went through `transform_document`.
- "Make the whole document more concise" dropped placeholders in 5 of 10 policy runs: [ORG_1] from the definition of information, and in two runs the four site names from the scope paragraph. gpt-6.1-sol and gpt-6-astra kept every placeholder in their 8 policy runs. The rewrite pipeline now always repairs a lost placeholder or number.
- The 30-days case failed in 2 of 10 runs the familiar way: the model read only "User Accounts" and added a sentence to block 84.

On sol and astra, a policy rewrite took 38 to 58 seconds against 20 to 34 on luna, and the first change appeared after 10 to 13 seconds instead of 5 to 8. The scorer misses some problems on every model. Every German run mixed "Beschäftigte" and "Mitarbeitende" for "employees", with 2 to 20 blocks of the less common word on sol and astra and 5 to 17 on luna. Making the phishing section shorter dropped "Email is the most common route for attacks" in all 18 runs. In 2 of 10 luna runs, "more formal" weakened that sentence to "a common vector" or "one of the most common", which never happened on sol or astra.

**Temperature can't be tuned.** The reasoning models reject `temperature`. Through the proxy, every request that set it failed with "Bad Request" on gpt-6-luna, gpt-6.1-sol and gpt-6-astra, even at 1 and even with effort none; the backend's message is "Unsupported parameter: temperature", and `top_p` fails the same way. OpenAI's guide to its latest models says to remove `temperature`, `top_p` and `top_logprobs` whenever the effort isn't none, and gpt-6.1-sol and gpt-6-astra don't support none at all. So temperature can't be tuned on these models, except perhaps gpt-6-luna at none on the API, which the proxy can't test.

### Choosing gpt-6-luna

Published benchmarks:

- On the official Terminal-Bench 4.0 leaderboard, all at max effort, gpt-6-luna scores 16.4%, gpt-5.6-luna 17.3%, gpt-5.6-terra 21.5% and gpt-5.6-sol 37.3%.
- OpenAI's AutomationBench tool-use scores put gpt-6-luna at 20.7% at max effort and 9.4% at medium, against 14.9% and 6.2% for gpt-5.6-luna.
- The cheapest options, gpt-5-nano and gpt-oss-20b, scored 11.5% and 3.1% on Terminal-Bench 2.0.

On the gateway, gpt-6-luna costs $0.10 / $0.50 per million tokens (in / out), half the price of gpt-5.6-luna.

On our harness, when we switched (round 6), gpt-6-luna gave no wrong answers to questions and no empty replies. Over the test mix, the cost per 1,000 requests fell from $0.83 to $0.41. We did see problems:

- It made an unintended edit in 2 of 2 runs of the 30-days case, in a patching table. Fixed by sending the table's header and row with a search hit (see [Table cells](#table-cells)).
- It sometimes skipped the answer tool after a search found nothing (fixed, see [Quote-checked answers](#quote-checked-answers)).
- On two question cases it often answered first, got rejected, then searched, which used all 4 allowed calls.

For scale, one test run of the size in the brief (20 documents × 5 instructions × 3 strategies, about 300 edits) costs well under a dollar on any of these small models.

In the matrix above, gpt-6-luna cleared 90% at every effort level, with 323 of 340 requests right (95%), for $0.86 to $1.01 per 1,000 requests over a mix where 10 of 68 requests rewrite a whole document. gpt-6.1-sol at low got all 68 right for $16.71, about 19 times as much, and gpt-6-astra for $83.31. We kept gpt-6-luna, and the app now sets its effort to medium explicitly. Medium is what every earlier gpt-6-luna test ran at, high costs about 14% more without a clear gain, and at none one section call ran away. gpt-6.1-sol at low is the step up if the three remaining luna failure groups matter more than the price. The gateway run of 18 October confirmed the choice among cheap models (see [Five cheap models on the AI Gateway](#five-cheap-models-on-the-ai-gateway)).

### The Responses endpoint

The app used to call the proxy's chat endpoint, which had two problems. It dropped the thinking setting for gpt-6 models, so every request ran at the backend's default, whatever the app asked for. And the proxy asks for short answers (verbosity "low") on every request that doesn't ask for something else, while the paid API's default is medium. Development didn't behave like production.

The proxy's other endpoint, Responses, honours the thinking setting and enforces a JSON schema. The app now calls it through `@ai-sdk/openai`, which replaced `@ai-sdk/openai-compatible`. Every model call, the chat call and each part call of a whole-document rewrite, sends the same settings. The gateway passes them on to OpenAI, so production gets them too:

- medium thinking and medium answer length;
- `store: false`, so OpenAI keeps nothing. The SDK then asks for the model's reasoning in encrypted form and sends it back on the next step, so reasoning still carries across tool calls;
- the chat session ID as the prompt cache key, shared by all part calls of a rewrite;
- parallel tool calls allowed.

The prompts put their stable parts first. A chat request starts with the instructions and tool definitions, then the history, and the document snapshot rides on the newest message. Part calls share the instructions, the outline and the user's instruction, and only then list their own blocks. Part calls now get the edit format as a schema the API enforces, so we took the spelled-out JSON shape out of their prompt. All 176 part calls in the test returned JSON that matched the schema.

We ran the round 12 matrix set twice on gpt-6-luna (round 14). Round 12's medium and default configs both ran at medium thinking and low verbosity:

| | Round 12, medium | Round 12, default | Round 14, two passes |
|---|--:|--:|--:|
| Correct | 64/68 | 66/68 | 67/68 and 68/68 |
| Whole document correct | 8/10 | 9/10 | 10/10 and 10/10 |
| Time per request | 7.9 s | 7.1 s | 7.1 and 6.7 s |
| First change in a policy rewrite | 7.8 s | 6.3 s | 6.9 and 6.5 s |
| Policy rewrite, total | 22.0 s | 20.1 s | 20.9 and 20.0 s |
| Input tokens per request | 4,186 | 3,920 | 4,170 and 4,207 |
| Output tokens per request | 919 | 931 | 945 and 945 |
| Reasoning tokens per request | 77 | 75 | 57 and 64 |
| Cached input tokens per request | 0 | 0 | 26 and 0 |

Part of the gain comes from round 13's table-cell fix, which round 12 didn't have. The one failure in 136 runs was the familiar 30-days miss.

The longer answer length barely changed the whole-document rewrites. "Make the whole document more concise" kept 78 to 84% of the policy's characters, against 75 to 81% before, and lost no placeholder in 4 runs. Making the phishing section shorter still dropped "Email is the most common route for attacks" in all 4 runs. Output per request rose about 2%.

The schema costs input tokens. It goes with every part call, at about 190 tokens, so a part call grew from 949 to 1,077 input tokens even with the prompt's copy of the shape gone. A policy rewrite grew from about 14,700 to 16,500. Chat calls stayed the same.

Follow-up turns work. A saved reply keeps its encrypted reasoning, and the next turn sends it back, even when the history drops the read it belonged to; the proxy accepted it every time. A model failure still reaches the chat: a cut stream, an HTTP 500 and a stopped proxy each ended in "The model request failed" within 10 seconds.

### Caching

The fixed part of each chat request, the instructions plus five tool definitions, is about 1,110 tokens, just above OpenAI's 1,024-token minimum for prompt caching. Every call sends the chat session ID as the prompt cache key, and the prompts put their stable parts first.

The proxy hardly ever reported cached input: on 1 of 434 calls in round 14. The exception was round 11, while every part call still carried the whole document: the proxy then reported 90% of a policy rewrite's part-call input as cached. Costs from proxy runs therefore carry no cache discount.

On the gateway, the app turns on automatic caching (`caching: 'auto'`). In the five-model run, 27% of gpt-6-luna's input came from the cache, 65% of claude-haiku-5.5's, 60% of deepseek-v4.1-flash's, 43% of grok-4.3's and 2% of gemini-3.8-flash's. Without that setting, Claude caches nothing.

### Model picker

The chat has a model menu: five providers with up to four models each, twenty on the gateway and the four GPT models on the proxy (list and selection rules in [`README.md`](README.md)). gpt-6-luna is the default. The chosen model runs the chat call, the part calls of a whole-document rewrite and, unless `AI_GATEWAY_CHECK_MODEL` or `LLM_CHECK_MODEL` names another, the rewrite check. Each reply saves the model ID and its thinking setting.

Our tools and prompts were tuned on gpt-6-luna. Seven of the twenty models have been through the eval suite as the chat model: gpt-6-luna, gpt-6.1-sol and gpt-5.6-luna through the proxy, and claude-haiku-5.5, grok-4.3, deepseek-v4.1-flash and gemini-3.8-flash (stopped during the rewrites) on the gateway. The non-OpenAI models ignore our OpenAI options and run at their provider's default thinking. Several models in the menu cost 20 to 50 times as much as gpt-6-luna.

## Review mode

With auto-accept off, an AI edit shows up in the document as suggestions instead of being applied. Removed text is red and struck through, added text is green, and the two sit next to each other. Clicking a suggestion opens a small menu below it with Accept and Reject. The bar above the document steps through the pending suggestions one by one and has Accept all and Reject all.

### Approach

We built it on the free Tiptap core with two custom marks, `inserted` and `deleted` (`components/editor/suggestion-marks.ts`). A suggestion is part of the document. The old text keeps its own marks, bold and links included, under a `deleted` mark. The new text sits right after it under an `inserted` mark. Both carry the same suggestion ID.

- Accept deletes the text marked `deleted` and drops the `inserted` mark. Reject deletes the text marked `inserted` and drops the `deleted` mark. Both are ordinary ProseMirror steps (`components/editor/suggestions.ts`).
- Reject is exact by construction. The old text is never rewritten, only marked, so removing the mark gives back the same nodes. A unit test checks that rejecting everything gives a document equal to the original, bold and link included.
- Undo and redo come from Tiptap's history, because proposing, accepting and rejecting are all normal transactions.

We looked at decorations with plugin state instead, where the document stays as it was and the new text is drawn as widgets. We dropped it. Widget text can't be clicked or selected like text, accept would have to rebuild each change from plugin state, and plugin state isn't in the undo history, so propose, accept and reject would each need their own undo handling, mapped through every user edit. The paid Tracked Changes add-on and `prosemirror-suggestion-mode` were ruled out (see `LATER.md`).

No dependency was added. The per-suggestion menu is Tiptap's `BubbleMenu` from `@tiptap/react/menus`. `@tiptap/react` already installs it as its optional dependency `@tiptap/extension-bubble-menu` (MIT), together with `@floating-ui/dom` (MIT).

### From an edit operation to suggestions

1. The operation runs on the block's text as if every pending suggestion were accepted. That is the text the model was shown.
2. The result is compared with the block's original text, as if every pending suggestion were rejected. So a block always shows one layer: its original against the latest proposal.
3. The block's content is rebuilt. Unchanged and removed pieces are cut from the original nodes, so they keep their marks. Added text takes the marks of the text it replaces, so "fixed price" in bold becomes "flat fee" in bold.

The word diff is `diffArrays` from jsdiff over our own tokens (`lib/review-diff.ts`): words, runs of spaces, and single punctuation marks. Numbers such as `3,600` and placeholders such as `PERSON_1` stay whole. We didn't use jsdiff's `diffWords`, because it treats changed whitespace as equal, so the old text couldn't be rebuilt exactly. `diffWordsWithSpace` splits `3,600` into three pieces. Changes with only spaces or one word between them are joined into one suggestion.

### When a block shows as one replacement

We count how much of a block stays: twice the kept words, divided by the words of the old and the new text together. The whole block shows as one replacement when half or less stays and the changes sit in more than one place. Otherwise the marks stay word by word. A block with only one change keeps its word-level marks, so "EUR [-3,600-]{+4,000+}" stays that way even though half of the cell changed.

We picked the cutoff from real gpt-6-luna outputs:

- 11 concise rewrites of long contract paragraphs (44 to 89 words) from the eval run. Ten kept 0.62 to 0.88 of their words and read cleanly word by word. The eleventh kept less than half once short gaps were joined, and was hard to read.
- Three concise rewrites of the sample offer and one formal rewrite of its pricing section in the browser tests. Blocks that kept 0.55 or more read cleanly. "We sat down with the customer…" kept exactly half in one run and showed four scattered changes in a 20-word sentence, which is the confetti we want to avoid. In another run it kept nothing.
- Translations keep almost nothing, so translated blocks show as replacements.

Word level also keeps formatting. A whole-block replacement can only carry marks that cover the whole old text, so accepting a reworded paragraph with a link in it loses the link. That's the same as `replace_node` in auto-accept. The sample is small, about 45 block pairs from two documents, so check the cutoff on more documents.

### Undo

- An `edit_document` proposal is one undo step.
- A whole-document rewrite shows section by section outside the history. It becomes one undo step when it ends or is stopped, as in auto-accept.
- Each accept or reject, one or all, is its own undo step.

### Stepping through

The bar shows the current suggestion's place, such as "Change 2 of 7", with Previous and Next buttons that move through the pending suggestions in document order and wrap around at both ends. The current suggestion is simply the one at the cursor, so clicking a change makes it current too. Moving to one puts the cursor at its start, scrolls it smoothly to the middle of the editor, rings its old and new text in their own colours, and opens its menu. After Accept or Reject the editor moves on to the next pending suggestion and opens its menu, and the bar goes away after the last one.

When an AI edit arrives as suggestions, its first new suggestion becomes current and its menu opens, without taking focus, so the chat input keeps it while the reply streams. The menu shows whenever the cursor is on a suggestion, focused or not, and hides when the cursor moves off the suggestions or none are left. Tiptap's bubble menu hides itself whenever the editor loses focus, so on blur we show it again with the bubble menu's own `show` meta.

The menu sits 6px under the last line of the whole change, old and new text together, and flips above only when there's no room below in the editor's scroll area, so it never covers the change. It keeps 8px from the editor's sides and repositions when the editor scrolls. The change is measured when the menu is placed, not before: measuring it earlier put the menu on top of the change whenever the review bar appeared in the same step and pushed the document down. Moving only changes the selection, and the ring is a decoration, so accept, reject and undo work exactly as before. The code is in `components/editor/review-navigation.ts`.

### Auto-accept

Edits apply directly, as before. `applyAcceptedEdits` in `apply-edits.ts` takes an optional mode, and the evals call it without one, which means apply. One undo reverts the whole AI edit. Changed passages get a green highlight that fades over 2 seconds (`components/editor/change-flash.ts`). It's a decoration, and a timer in the plugin view clears it, so the headless editor in the evals never starts a timer.

### A second turn while suggestions are pending

The model sees the document as if every pending suggestion were accepted. Follow-ups usually build on the last proposal, such as "now make it shorter" or "use buyer instead". The new proposal replaces the old one in that block and is still shown against the original text, so Reject all still brings back the document from before the first turn. Suggestions the user rejected are gone, and accepted ones are part of the text.

With auto-accept on, an AI edit to a block with pending suggestions first accepts that block's suggestions, because the model's edit builds on them. Then it applies directly. Other blocks keep their suggestions.

The mode is read when a message is sent. Flipping the switch while a reply streams changes the next reply, not this one.

### Limits of review mode

- Suggestions aren't saved. Reloading a chat restores the messages, but the document starts again from the sample, as it always has in this proof of concept.
- Accepting or rejecting while a whole-document rewrite still streams works. Undoing that accept afterwards may not work on its own, because the rewrite is folded into one history step when it ends.
- Added text takes the marks shared by all the text it replaces. When it replaces a mix of bold and plain text, it comes out plain.
- Text typed inside a suggestion takes that suggestion's mark. Copying a suggestion pastes plain text.
- The chat history still shows earlier edits as made, even after the user rejected them. The document the model gets is what counts.
- Suggestions only change text inside blocks. The edit operations can't add or remove blocks, so neither can a suggestion.
- The sample offer fits into one part of a whole-document rewrite, so all its suggestions arrive at once at the end. Section-by-section arrival shows on longer documents.
- The review bar appears above the document and pushes it down by one line, and pulls it back up when the last suggestion is resolved.

### What we tested

Unit tests: `tests/lib/review-diff.test.ts` covers the word diff and the cutoff. `tests/components/editor/suggestions.test.ts` covers accept and reject, one and all, exact restore with bold and links, text added at the end of a block and in an empty table cell, a second edit on a pending block, and undo and redo. `tests/components/editor/review-navigation.test.ts` covers next and previous with wrap-around, the position count, when the menu shows, moving on after accept and reject, and which suggestion becomes current after an AI edit. `tests/components/editor/apply-edits.test.ts` covers the stream: apply and suggest mode, a streamed rewrite as one undo step, a stopped stream, and auto-accept on a block with pending suggestions.

Browser tests ran in Chromium through `agent-browser`, against the dev server and the model proxy, 16 chat turns in all:

- "change customer to client everywhere": three word-level suggestions such as "The [-customer-]{+client+} wants…". Accept and reject one at a time, undo and redo over both, Reject all back to the exact original, Accept all to the edited text.
- "make the pricing section more formal": four suggestions in the pricing section and its table, none of them confetti. Reject all gave back the exact original.
- "change "fixed price" to "flat fee", and raise the workshop price to EUR 4,000 with the matching total": "flat fee" stayed bold, the link stayed, the table showed "EUR [-3,600-]{+4,000+}" and "EUR [-5,250-]{+5,650+}". Three undos after Reject all brought the suggestions back one by one, and Reject all gave back the original HTML exactly.
- "make the whole document more concise", three times on the sample: one undo reverted the whole rewrite. The cutoff figures above come from these runs.
- "translate the document to German": every block showed as a replacement, and Reject all gave back the original.
- A second turn while suggestions were pending: "use the word buyer instead of client" after the customer-to-client turn gave "The [-customer-]{+buyer+} wants…". Reject all returned to the original.
- Stop: on a 3-page offer loaded into the editor, Stop after the first section kept its 42 suggestions, and the chat said "Stopped after 1 of 4 sections". Accept and reject still worked, two undos took them back, a third undid the stopped rewrite, and Reject all gave back the loaded document.
- Auto-accept: the change applied directly, the highlight showed and was gone 4 seconds later, and one undo reverted the whole edit, for a word change and for a concise rewrite.
- Reload of a saved chat: the messages came back, the document was the sample again, auto-accept was off, and a new review turn worked.
- Dark theme: the inserted and deleted text stay readable on the dark background.
- Stepping through: "make the Background and Services sections more formal" gave 15 suggestions. The first became current with its menu open while the chat input kept focus, and the menu stayed open after clicking back into the chat input. Next and Previous wrapped around at both ends and centred each change. Each accept and reject moved on to the next change, the bar went away after the last one, and one undo brought back the last change exactly. Dark theme and phone width were checked too.

The first browser run found a crash when text was added at the very end of a block. It's fixed, and a unit test covers it.

## Known limits

The brief asks about tables, lists and very long documents. The evals add more weak spots, listed after them. Limits of strategies A and B are under [Edit strategies](#edit-strategies), and those of the review UI under [Limits of review mode](#limits-of-review-mode).

### Tables

- Table cells are blocks of their own, so table structure survived in every strategy run: no strategy failed the table or heading checks on the rewrites, and no strategy emptied or merged a block in the strict test.
- No edit operation can add or remove a block, so the model can't add or delete a table row.
- A search hit in a table cell comes back with the header row and the cell's row, one cell per line, so the model knows which column a cell is in. Before that, gpt-6-luna changed an unrelated "60 days" in a patching table and sent an edit to the cell next to the right one ([Table cells](#table-cells)).
- Rewrites can still damage tables. "Make the cost part shorter" emptied all 14 filled cells of the pricing table in round 13 and the three Timing cells in 1 of 3 baseline runs, and gpt-5.6-terra wrote "—" into every price cell. A rewrite of the 64-page document wrote "In stock" into two price cells. The suite's emptied-cell check still exists, but the case that tripped it left with the rewrite-section scenario.
- Translations can leave a table header in English: one of the reasons the grader failed C's translations in the strategy run.
- Strategy B sends a table cell with the cells next to it, not its column header.

### Lists

- List items are blocks too, so list structure survived in every strategy run.
- No edit can add or remove a list item.
- The evals have few list cases. The one list failure on record is 15-highlight: asked to "make this 12 months" on "six months" in a highlighted list item, A and C changed the programme length in block 6 instead. B, which makes only the highlighted block editable, passed.

### Very long documents

- The 64-page document (XF, 128 parts) ran through the section pipeline in 151 and 198 s at about 470,000 input and 80,000 output tokens per run, with no failed parts or rate limits (round 11). It isn't in the current suite, and no run after round 17 used it.
- A single pass (strategy A) wasn't run on it. It would need roughly 60,000 output tokens in one stream. On the 9-page policy (200 blocks) and the onboarding handbook (277 blocks) a single pass wrote 7,500 to 8,200 output tokens in 47 to 60 s and returned every block.
- Each part is rewritten in its own call, so wording can drift between parts. Before the term sheet, every German run of the policy used two words for "employees". After it, one technical term translated two ways still fails a case now and then.
- A whole-document rewrite shows its first change after about 19 to 22 s on the proxy, mostly because the term sheet is written first. A rewrite took 118 s per case on the gateway, grading included.
- Reading the H1 returns the whole document, because every other heading sits under it.
- The editor stays editable during a rewrite, so text typed into a block before its part arrives is overwritten.

### Formatting

- `replace_node` writes plain text, so a block replaced as a whole loses its bold and links. Strategies A and B lose them on every changed block (518 of 518 for A on the strict set). C keeps them when it swaps a phrase with `replace_text`, but its section pipeline sends `replace_node` for nearly every block and lost them on 484 of 495.
- In review mode, a block shown word by word keeps its marks. A whole-block replacement keeps only marks that cover the whole old text, and added text that replaces mixed bold and plain text comes out plain.

### Weak spots the evals show on gpt-6-luna

- **Whole-document rewrites.** 14 of 20 on the gateway, 8 of 20 in the strategy run and 16 of 52 on the strict set. Failures change from run to run: one shifted statement, one conversational sentence left in a formal rewrite, or one technical term translated two ways. The project plan fails every run on its realisation-phase sentence. Six cases gpt-6-luna kept failing (three German translations, two formal rewrites and the concise rewrite of the sample offer) were dropped from the suite.
- **Statement strength.** The prompt rule and the meaning check removed most of the named slips, such as "without undue delay", "must use the report button" and "Install the sensor". Others still turn up from run to run, such as "require approval" becoming "may require approval" in round 20.
- **"Make the phishing part shorter"** drops "Email is the most common route for attacks" on every model.
- **Missing parts.** The model still edits a nearby paragraph in some runs, or reads and searches until it runs out of calls and gives no reply (15 of 21 after the fix, 8 of 9 on the gateway).
- **Follow-on figures.** Arithmetic such as "the remaining 22 cases" passed 13 of 16 runs. A changed period can still pull an unrelated figure along (08). Single digits and numbers written as words aren't checked.
- **Everywhere edits.** When the model adds surrounding words to its find text, the word-form check can't see a leftover form. The English stemmer misses -es plurals of words ending in s, x, ch or sh, and irregular plurals. German word forms are only covered by unit tests.
- **The 30-days case (L10).** In about 1 run in 10 the model reads only "User Accounts" and changes the wrong paragraph.
- **Questions.** The quote check proves that a real sentence was quoted, not that it was read correctly. Some answers come back in plain text instead of a checked answer, even when they are right (2 of 110 question runs in round 16). Answers came back in Swedish or Slovenian in 2 of 26 runs. Answer-question passed 34 of 37 on the gateway.
- **The 4-call limit** can end a request with nothing changed, for example after three rejected edits in a row (L3).

### Not measured yet

- Parallel tool calls and output limits. The proxy turns parallel tool calls off and drops `max_output_tokens`, and neither was tested on the gateway.
- The time to the first visible change on the gateway.
- How often the grader is right, which needs hand labels.
- Thirteen of the twenty models in the picker.

## Smaller findings

**Short block IDs.** Tiptap's UniqueID extension uses 36-character UUIDs for block IDs by default. Those IDs are sent with every block and repeated in every edit, so we switched to short counter IDs ("1", "2", …) through its `generateID` option. Splitting a paragraph gets a fresh ID automatically.

**Undo instead of "revert".** One undo reverts a whole AI edit. Asking the chat to revert doesn't work, because the model only ever sees the current document. Review mode, with accept and reject per change, is the guard against bad edits.

**The selection stays visible.** When the user clicked into the chat, the editor's selection highlight disappeared, although the selection was kept. Tiptap's own `Selection` extension keeps it visible.

### Jest breaks the MongoDB driver from version 7.6

Since version 7.6.0, the MongoDB Node.js driver loads Node's `os` module with a dynamic `import()` in `lib/runtime_adapters.js`. Version 7.5 used `require('os')`. Jest runs CommonJS code inside a VM context, and Node refuses dynamic imports there unless it was started with `--experimental-vm-modules`. The error is `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`.

The driver catches that error and silently falls back to empty handshake metadata. MongoDB 8 then rejects the connection with `Missing required sub-document 'driver' in the client metadata document`. In practice, every database test times out once server selection gives up, and nothing in the message points at Jest. Outside Jest the same driver connects normally; a plain Node script connected in 18 ms. Mongoose 9.11.2 pins `mongodb@~7.7`, so it is affected.

In this PoC, the test script sets the flag:

```json
"test": "NODE_OPTIONS=--experimental-vm-modules jest"
```

Running `jest` directly (through `npx` or an editor's test runner) skips the script, and the failure comes back. The other option is to hand the driver its `os` module through the `runtimeAdapters: { os }` connection option, which works however Jest is started. We didn't use it, because it puts a test-runner workaround into app code.

Pryvet runs Jest and MongoDB. Upgrading to driver 7.6 or later, directly or through a Mongoose upgrade, will break database-backed Jest tests in the same way.

References: [NODE-7603](https://jira.mongodb.org/browse/NODE-7603), [NODE-7385](https://jira.mongodb.org/browse/NODE-7385)
