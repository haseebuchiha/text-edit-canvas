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

Each point says what went wrong, what we changed, and what happened after.

### 1. Send the outline, not the whole document

- **Problem:** with nothing highlighted, the app doesn't know which part of the document the user means. Sending the whole document every time works, but costs a lot of tokens on long documents.
- **Change:** the request now carries only the headings (the outline) and the text before the first heading. The model asks for the sections it needs through a `read_section` tool.
- **Result:** an edit to one section of a 9-page policy used about 2,200 input tokens instead of 7,800. It was correct in 61 of 69 runs, against 40 of 45 with the whole document. On a 1-page document it costs a little more, because the extra call only pays off on longer documents.

### 2. A search tool finds what the headings don't show

- **Problem:** some facts sit under a heading that doesn't hint at them. "Who coordinates the dates?" is answered under "Background", so the model read two sections it guessed at and answered wrong in 3 of 3 runs. A hotline number that appears in two sections was changed in only one of them, also 3 of 3.
- **Change:** a `find_text` tool searches every block for several words at once and returns the matching blocks with their IDs.
- **Result:** correct runs went from 61 to 66 of 69, the hotline case from 0 of 3 to 3 of 3, and input tokens fell by 13.5%.

### 3. Answers must quote the document

- **Problem:** asked "Who coordinates the dates?", the model said "[ORG_2] coordinates the dates" in 2 of 3 runs, with confidence. The document says "[PERSON_2] coordinates the dates".
- **Change:** answers now go through an `answer_question` tool with exact quotes and their block IDs. The server checks every quote against the document and rejects the answer if a quote isn't there. "It's not in the document" is accepted only after a search.
- **Result:** in 39 runs of questions the document doesn't answer, the user never saw a made-up answer. The limit: a quote proves the sentence exists, not that the model read it right.

### 4. The model doesn't copy text exactly

- **Problem:** the model writes "kick off call" where the document says "Kick-off call". An exact match then quietly drops the edit, rejects a correct quote, or finds nothing in search.
- **Change:** edits, quote checks and search share one matcher. It ignores capitals, curly quotes and extra spaces, and treats "kick-off", "kick off" and "kickoff" as the same. It does no fuzzy letter matching, because "[ORG_2]" and "[PERSON_2]" differ by only a few letters.
- **Result:** edits land on the right text. Fuzzy matching would have waved the wrong answer from point 3 through.

### 5. A table cell needs its column

- **Problem:** told that unused accounts are now locked after 30 days instead of 60, the model also changed an unrelated "60 days" in a patching table in 2 of 2 runs. The search had returned that cell alone, so the model couldn't see it was a patch deadline. In another case, "change customer to client everywhere" sent one edit to the cell next to the right one in 4 of 10 runs.
- **Change:** search results for table cells now include the table's header row, one cell per line, each with its own ID. The server rejects an edit when the text to replace isn't in the named block, and says which blocks do contain it.
- **Result:** the patching cell was left alone in 20 of 20 runs, and "customer to client" passed 10 of 10.

### 6. "Everywhere" has to mean every occurrence

- **Problem:** "change customer to client everywhere" failed in 10 of 10 runs on one document. One paragraph says "customer" twice, the model sent one replacement, and the editor only replaces the first match. The server accepted it anyway.
- **Change:** the server applies each paragraph's replacements in order and rejects the edit if the word is still there afterwards, including other forms such as "customers". The model then sends a corrected edit.
- **Result:** the "everywhere" cases went from 11 of 15 to 15 of 15.

### 7. A change can make another number wrong

- **Problem:** told "220 of 236 test cases passed, not 214", the model changed 214 to 220 but left "the remaining 22 cases" as it was. The right number is now 16, and it was in the same paragraph.
- **Change:** a prompt rule tells the model to update numbers that follow from the change, such as totals, remainders and second mentions.
- **Result:** such cases pass in 13 of 16 runs.

### 8. Asking for a part that doesn't exist

- **Problem:** asked to "shorten the cover letter" in a proposal that has none, the model shortened 61 to 88 other blocks instead, in 3 of 3 runs. Asked to add a glossary entry to a report without a glossary, it changed an unrelated paragraph.
- **Change:** a prompt rule says: if the part isn't in the document, change nothing, say so, and ask what to change.
- **Result:** these cases went from 7 of 21 to 15 of 21 runs, and 8 of 9 on the gateway. Sometimes the model still edits a nearby paragraph, or searches until it runs out of calls and gives no reply.

### 9. Rewrites must keep how strong a statement is

- **Problem:** in "make it more formal" rewrites, the model treated words like "should" and "without delay" as style. In a data processing agreement, "inform the Controller without delay" became "without undue delay", which is a weaker legal promise. "Should use the report button" became "must", and "intended exclusively for" lost "exclusively".
- **Change:** a prompt rule to keep how strong each statement is, and a meaning check after each rewritten part that repairs what changed.
- **Result:** in the four test runs after the change, none of those three slips came back. Similar slips still show up now and then, so rewrites remain the weakest area.

### 10. Long rewrites need parts and a term sheet

- **Problem:** asked to translate a 9-page policy into German in one go, the model translated only the 26 headings in 6 of 8 runs. When it did read all 200 blocks, it sent back only 37 to 60 of them in 4 of 10 runs. Every German run also used two different words for "employees".
- **Change:** whole-document instructions now run through a pipeline. It first writes a term sheet with one translation per key term, then rewrites the document part by part in parallel calls, then checks each part.
- **Result:** every block gets rewritten, and the key terms stay consistent in most runs. The cost is time: the first change appears after about 20 s.

### 11. Bigger models weren't more accurate here

- **Problem:** we expected bigger models to answer better. On an older model family, the bigger models gave more wrong answers: "Who coordinates the dates?" was right in 39 of 40 runs on the small model and 3 of 11 on a mid-size one. Every wrong answer came from skipping the search.
- **Change:** a rule makes the model search before it answers. We then compared current models.
- **Result:** gpt-6.1-sol got 68 of 68 requests right, gpt-6-luna about 95%, at a nineteenth of the price. We kept gpt-6-luna.

### 12. The development proxy ignored the thinking setting

- **Problem:** during development we call models through a local proxy. Its chat endpoint silently dropped the thinking setting for gpt-6 models. A request with thinking turned off still used 228 reasoning tokens. It also made answers shorter than the paid API does, so development didn't behave like production.
- **Change:** the app now uses the Responses endpoint, which honours the setting, and sends medium thinking and medium verbosity itself.
- **Result:** development and the gateway now get the same settings.

### 13. Claude only caches when asked

- **Problem:** providers charge a fraction of the price, often a tenth, for input they've seen before, such as our fixed instructions. GPT, Gemini, DeepSeek and Grok do this automatically. Claude only caches when the request marks what to cache, and ours didn't.
- **Change:** the gateway option `caching: 'auto'` adds those marks. It's now on for every request.
- **Result:** 65% of Claude's input came from the cache. Gemini still cached only about 2%, which is one reason it was the most expensive.

### 14. Review mode works on the free editor

- **Problem:** the brief asks for every AI change to be shown as a diff the user can accept or reject. Tiptap's own tracked-changes add-on is paid and not yet stable.
- **Change:** a suggestion is two marks inside the document: the old text in red and struck through, the new text in green. Only the changed words are marked. Previous and Next step through the changes, and the Accept / Reject menu opens under the current one.
- **Result:** accept, reject and undo are ordinary editor steps. "Reject all" gives back the exact original, bold and links included.

### 15. Stop has to stop the server too

- **Problem:** the Stop button only ended the stream in the browser. The server kept calling the model, finished the whole translation, and saved "Edited 199 blocks in 14 sections" to the chat history.
- **Change:** Stop now cancels the request on the server, and no new section starts after it.
- **Result:** Stop after 4 of 14 sections ended all calls at once, and the history showed exactly the 49 blocks that changed.

### 16. Short block IDs save tokens

- **Problem:** every block had a 36-character ID, about 20 tokens, repeated in every block the model sees and every edit it sends.
- **Change:** blocks now get counter IDs: "1", "2", and so on.
- **Result:** fewer tokens on every request.

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
