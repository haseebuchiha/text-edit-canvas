# Findings

The short version. Per-round numbers are in [`TEST-RESULTS.md`](TEST-RESULTS.md), and the model comparison is in [`tests/evals/REPORT.md`](tests/evals/REPORT.md). The long write-up of every finding is in git history, at commit `552fbe6`.

## Recommendations

- **Editor: Tiptap**, with its free MIT packages only. Every block gets a stable ID for the edits, and review mode runs on two custom marks, so the paid Tracked Changes add-on isn't needed.
- **Edit strategy: C, patch operations.** The model sends small edits on block IDs (`replace_text`, `replace_node`) and the server checks them. For targeted edits it costs about $0.50 per 1,000 edits and takes 4 to 6 s, against about $2 and 18 to 20 s for a full rewrite.
- **Whole-document instructions: the section pipeline.** It writes a term sheet, rewrites the document part by part, then checks each part for changed meaning and repairs it. It's the most expensive path, but it passed the most cases on the strict rewrite test.
- **Model: gpt-6-luna at medium effort.** It passed the most eval cases of five cheap models on the AI Gateway, for the lowest cost. gpt-6.1-sol is the step up, at about 19 times the price.

## Results

### Edit strategies

81 edit cases per strategy, gpt-6-luna, local proxy, one run per case. Proxy times include the proxy's own delay.

| Strategy | Passed | Unintended changes | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|
| A, full rewrite | 69 (85%) | 3 of 61 | $2.12 | 7.3 s | 19.2 s |
| B, section scope | 64 (79%) | 1 of 61 | $1.08 | 6.1 s | 13.0 s |
| C, patch operations (the app) | 61 (75%) | 3 of 61 | $2.13 | 8.7 s | 11.3 s |

- The accuracy gaps are within chance for one run per case.
- C's averages include its whole-document rewrites. A targeted edit with C used about 4,100 input and 130 output tokens and took 5 s.
- B lets the model change only the highlighted block. It passed 14 of 14 highlighted cases at a third of C's cost, so it's worth trying in the app.

### Whole-document rewrites, strict test

26 rewrite cases, two runs each, graded with a stricter meaning check that isn't part of the regular suite.

| Approach | Passed (of 52) | Cost per 1,000 | First change |
|---|--:|--:|--:|
| C, section pipeline (the app) | 16 | $7.35 | 22.4 s |
| Single pass, term sheet and meaning check | 13 | $4.96 | 4.8 s |
| Single pass with term sheet | 12 | $2.20 | 4.8 s |
| Single pass | 11 | $2.09 | 2.8 s |

- A single pass looked better in the first, one-run test. That lead was chance.
- Single passes lost a figure or a placeholder in 7 runs, against 2 for C.

### Models on the AI Gateway

The full eval suite once per model. Spend is what the gateway charged, grading included.

| Model | Passed (of 118) | Rewrites (of 20) | Spent |
|---|--:|--:|--:|
| gpt-6-luna | 108 (91.5%) | 14 | $0.35 |
| claude-haiku-5.5 | 101 (85.6%) | 7 | $0.45 |
| grok-4.3 | 100 (84.7%) | 6 | $4.51 |
| deepseek-v4.1-flash | 99 (83.9%) | 4 | $1.17 |
| gemini-3.8-flash | stopped, too expensive | — | $6.08 |

- On small edits and questions, four of the models were within one case of each other. Rewrites separated them.
- gpt-6-luna graded the first three models. DeepSeek and Grok graded their own work, so their scores aren't strictly comparable.
- The cheap Grok model, grok-4.1-fast-reasoning, was unavailable: the gateway answered "Not Found" on 18 October. We used grok-4.3 instead.

### The eval suite

- **Four scenarios, 118 cases** on 23 synthetic documents: change text (52), answer a question (37), a part the document doesn't have (9) and whole-document rewrites (20).
- **Code checks decide first:** the exact new text, nothing else changed, placeholders and figures kept. An AI grader then judges tone, concision, translation and answers.
- **A scenario fails below 80%.** `yarn evals` runs the suite. See [`tests/evals/README.md`](tests/evals/README.md).

## What we learned

- **Send the outline, not the whole document.** The model gets the headings and fetches the sections it needs. On a 9-page document an edit used about 2,200 input tokens instead of 7,800.
- **A search tool helps.** With it, correct runs rose from 61 to 66 of 69, and input tokens fell by 13.5%.
- **Answers must quote the document.** The server checks every quote against the text, so a made-up answer such as "[ORG_2] coordinates the dates" never reaches the user.
- **Matching has to be forgiving.** The model writes "kick off call" where the document says "Kick-off call". Edits, quotes and search now share one matcher that tolerates this.
- **A table cell needs its column.** Search hits now come with the table's header row. Before, the model changed an unrelated "60 days" in 2 of 2 runs. After, it left it alone in 20 of 20.
- **"Everywhere" means every occurrence.** A word that appeared twice in one paragraph was only changed once, in 10 of 10 runs. The server now rejects an edit that leaves the word behind, and the everywhere cases went from 11 to 15 of 15.
- **Figures that depend on a change.** After "214 passed" became "220 passed", the model left "the remaining 22" unchanged. A prompt rule fixed most of these: 13 of 16 runs now pass.
- **Parts that don't exist.** Asked to shorten a cover letter the document doesn't have, the model shortened something else. It now says the part isn't there: 15 of 21 runs pass, and 8 of 9 on the gateway.
- **Keep how strong a statement is.** "Without delay" became "without undue delay" in a formal rewrite. A prompt rule and the meaning check catch most of these.
- **Long rewrites need parts and a term sheet.** One long pass stopped after 37 to 60 of 200 blocks in 4 of 10 runs. Part-by-part rewriting fixed that, and the term sheet stopped German translations from using two words for "employees".
- **Bigger models aren't automatically better.** Before the search-first rule, bigger gpt-5.6 models gave more wrong answers. gpt-6.1-sol got 68 of 68 right, at about 19 times luna's cost.
- **The proxy ignored the thinking setting.** Its chat endpoint dropped it for gpt-6 models. The app now uses the Responses endpoint and sets medium itself.
- **Claude needs caching turned on.** With the gateway's `caching: 'auto'`, now on, 65% of Claude's input was cached. Gemini cached about 2%.
- **Review mode needs no paid add-on.** Suggestions are marks in the document. Reject all brings back the exact original, Previous and Next step through the changes, and the Accept / Reject menu opens on the current change.
- **Short block IDs.** Counter IDs ("1", "2", …) replace 36-character UUIDs and save tokens on every request.

## Known limits

- **Tables.** No edit can add or remove a row. Rewrites have emptied price cells, and a translation can leave a header in English.
- **Lists.** No edit can add or remove an item. The evals have few list cases.
- **Very long documents.** A 64-page document went through the pipeline in 151 to 198 s, but it isn't in the current suite. Wording can drift between parts, and the first change takes about 20 s.
- **Formatting.** A block that is replaced whole loses its bold and links. The pipeline does this on almost every block it changes.
- **Rewrites are the weakest area.** They passed 14 of 20 on the gateway and 8 of 20 in another run of the same code, so results vary from run to run.
- **"Make the phishing part shorter"** drops "Email is the most common route for attacks" on every model.
- **Not measured yet.** Whether the AI grader agrees with a human, the time to first change on the gateway, and parallel tool calls and output limits on the gateway.
- **Each case ran once.** Gaps under about 8 points can be chance.

## Smaller notes

- **Undo instead of "revert".** One undo reverts a whole AI edit. Asking the chat to revert doesn't work, because the model only sees the current document.
- **Jest and the MongoDB driver.** From driver 7.6, database tests under Jest fail unless Node runs with `--experimental-vm-modules`. `yarn test` sets it. Running `jest` directly brings the failure back.
