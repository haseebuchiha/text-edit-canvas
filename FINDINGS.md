# Findings

The short version. Per-round numbers are in [`TEST-RESULTS.md`](TEST-RESULTS.md), and the model comparison is in [`tests/evals/REPORT.md`](tests/evals/REPORT.md). The long write-up of every finding is in git history, at commit `552fbe6`.

## Recommendations

- **Editor: Tiptap**, with its free MIT packages only. Every block gets a stable ID for the edits, and review mode runs on two custom marks, so the paid Tracked Changes add-on isn't needed.
- **Edit strategy: C, patch operations.** The model sends small edits on block IDs (`replace_text`, `replace_node`) and the server checks them. For targeted edits it costs about $0.50 per 1,000 edits and takes 4 to 6 s, against about $2 and 18 to 20 s for a full rewrite.
- **Whole-document instructions: the section pipeline.** It writes a term sheet, rewrites the document part by part, then checks each part for changed meaning and repairs it. It's the most expensive path, but it passed the most cases on the strict rewrite test.
- **Model: gpt-6-luna at medium effort.** It passed the most eval cases of eight cheap models on the AI Gateway, for the lowest cost. gpt-6.1-sol is the step up, at about 19 times the price.

## Results

How the tests reached the model:

- **Local proxy:** a small program on the developer's machine that passes requests on to OpenAI's models. We used it during development so test runs cost no API money. It adds its own delay, so its times are slower than the live app would be.
- **AI Gateway:** Vercel's paid service that the app uses in production. It routes a request to the chosen model's provider and bills per token. Its times and costs are the real ones.

A test case is one document, one instruction and the expected result. "One run per case" means each case was tried once.

### Edit strategies

81 edit cases per strategy, all on gpt-6-luna through the local proxy, one run per case.

| Strategy | Passed | Unintended changes | Cost per 1,000 edits | First change | Total |
|---|--:|--:|--:|--:|--:|
| A, full rewrite | 69 (85%) | 3 of 61 | $2.12 | 7.3 s | 19.2 s |
| B, section scope | 64 (79%) | 1 of 61 | $1.08 | 6.1 s | 13.0 s |
| C, patch operations (the app) | 61 (75%) | 3 of 61 | $2.13 | 8.7 s | 11.3 s |

- The accuracy gaps are within chance for one run per case.
- C's averages include its whole-document rewrites. A targeted edit with C used about 4,100 input and 130 output tokens and took 5 s.
- B lets the model change only the highlighted block. It passed 14 of 14 highlighted cases at a third of C's cost, so it's worth trying in the app.

### Whole-document rewrites, strict test

26 rewrite cases on gpt-6-luna through the local proxy, two runs each. They were graded with a stricter check for changed meaning, which isn't part of the regular test suite.

| Approach | Passed (of 52) | Cost per 1,000 | First change |
|---|--:|--:|--:|
| C, section pipeline (the app) | 16 | $7.35 | 22.4 s |
| Single pass, term sheet and meaning check | 13 | $4.96 | 4.8 s |
| Single pass with term sheet | 12 | $2.20 | 4.8 s |
| Single pass | 11 | $2.09 | 2.8 s |

- A single pass looked better in the first, one-run test. That lead was chance.
- Single passes lost a figure or a placeholder in 7 runs, against 2 for C.

### Models on the AI Gateway

The full test suite, once per model, through the AI Gateway. "Spent" is what the gateway charged, including the AI grader. "Small task" and "Rewrite" are the average time per case in the suite. "First text" and "Text speed" come from a separate test: the same short rewrite request, sent three times to each model (see [`tests/evals/REPORT.md`](tests/evals/REPORT.md)).

| Model | Open weights | Passed (of 118) | Rewrites (of 20) | Spent | Small task | Rewrite | First text | Text speed |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| gpt-6-luna | no | 108 (91.5%) | 14 | $0.35 | 6.8 s | 118 s | 4.9 s | 94 tokens/s |
| claude-haiku-5.5 | no | 101 (85.6%) | 7 | $0.45 | 6.2 s | 93 s | 2.0 s | 196 tokens/s |
| grok-4.3 | no | 100 (84.7%) | 6 | $4.51 | 19.2 s | 206 s | 15.7 s | 72 tokens/s |
| deepseek-v4.1-flash | yes | 99 (83.9%) | 4 | $1.17 | 4.8 s | 172 s | 20.7 s | 204 tokens/s |
| qwen3.8-27b | yes | 97 (82.2%) | 4 | $4.88 | 13.3 s | 321 s | 71.8 s | 72 tokens/s |
| glm-5.3-flash | yes | 95 (80.5%) | 4 | $0.36 | 13.5 s | 116 s | 1.5 s | 62 tokens/s |
| gemma-4-31b-it | yes | 87 (73.7%) | 0 | $0.19 | 8.0 s | 280 s | 9.1 s | 61 tokens/s |
| gemini-3.8-flash | no | stopped, too expensive | — | $6.08 | 17.4 s | — | 11.1 s | 130 tokens/s |

- On small edits and questions, five of the models passed 93 to 95 of 98. Rewrites separated them.
- **qwen3.8-27b** is the model IONOS also hosts. It matched gpt-6-luna on small tasks but passed 4 of 20 rewrites. In 9 of the 16 failed rewrites the gateway returned a server error three times in a row and a part never came back. Of the 11 rewrites without errors, it passed 4.
- **Qwen is slow because it thinks, not because it writes slowly.** It thinks about 20 times as long as luna before its first word, and that thinking is billed as output. Counting thinking, it produces tokens about as fast as luna, 62 against 64 per second. Setting its thinking to low cut it from about 5,000 to 870 tokens on the speed test.
- **glm-5.3-flash ran without a single error**, at about luna's cost and rewrite time, and showed its first word fastest. It passed 4 of 20 rewrites, all failures on quality: four of its concise rewrites kept 96 to 98% of the text, and its translations and formal rewrites failed the grader. IONOS doesn't offer it.
- **gemma-4-31b-it failed all 20 rewrites for a technical reason.** The gateway's Gemma doesn't accept the JSON format the rewrite pipeline asks for, so every part was rejected. The score says nothing about its writing. It answered questions worst of all, 28 of 37.
- gpt-6-luna graded every model except DeepSeek and Grok, which graded their own work, so those two scores aren't strictly comparable. A rewrite case is cut off after 5 minutes and counts as failed.
- The cheap Grok model, grok-4.1-fast-reasoning, was unavailable: the gateway answered "Not Found" on 18 October. We used grok-4.3 instead.
- minimax-m3 was planned as a fourth open-weights model but skipped: the gateway credit ran too low.

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

- **Problem:** we expected bigger models to answer better. On an older model family, the bigger models gave more wrong answers: "Who coordinates the dates?" was right in 39 of 40 runs on the small model and 3 of 10 on a mid-size one. Every wrong answer came from skipping the search.
- **Change:** a rule makes the model search before it answers. We then compared current models.
- **Result:** gpt-6.1-sol got 68 of 68 requests right, gpt-6-luna about 95%, at a nineteenth of the price. We kept gpt-6-luna.

### 12. Review mode works on the free editor

- **Problem:** the brief asks for every AI change to be shown as a diff the user can accept or reject. Tiptap's own tracked-changes add-on is paid and not yet stable.
- **Change:** a suggestion is two marks inside the document: the old text in red and struck through, the new text in green. Only the changed words are marked. Previous and Next step through the changes, and the Accept / Reject menu opens under the current one.
- **Result:** accept, reject and undo are ordinary editor steps. "Reject all" gives back the exact original, bold and links included.

### 13. Stop has to stop the server too

- **Problem:** the Stop button only ended the stream in the browser. The server kept calling the model, finished the whole translation, and saved "Edited 199 blocks in 14 sections" to the chat history.
- **Change:** Stop now cancels the request on the server, and no new section starts after it.
- **Result:** Stop after 4 of 14 sections ended all calls at once, and the history showed exactly the 49 blocks that changed.

### 14. Short block IDs save tokens

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

## Open items and path to production

### Open TODOs

- **Editor comparison page.** The one-page comparison of Tiptap, Lexical and BlockNote wasn't written. The Tiptap recommendation rests on building this PoC with it.
- **Grader not checked against people.** The AI grader decides tone, translation and answer quality, but nobody has hand-labelled its verdicts yet (`tests/evals/labels/` is empty), so we don't know how often it is wrong.
- **Not measured on the gateway:** the time to the first visible change, parallel tool calls and output limits. Most timings in this file come from the local proxy and are slower than production.
- **Most picker models are untested.** Four of the twenty models in the menu ran the full suite on the gateway. The others are offered on price and capability only.
- **One promising idea not built.** In the strategy test, letting a highlighted edit change only the highlighted block passed 14 of 14 highlighted cases at a third of the cost. The app doesn't do this yet.

### Known issues

- **Whole-document rewrites are the weakest area.** They passed 14 of 20 on the gateway and 8 of 20 in another run of the same code. A run can fail on one shifted statement, one sentence left in the old tone, or one term translated two ways. They are also slow: the first change appears after about 20 s.
- **No edit can add or remove a block**, so the model can't add a table row, a list item or a paragraph.
- **Bold and links are lost** when a block is replaced as a whole, which the rewrite pipeline does on almost every block it changes.
- **Asking for a part that doesn't exist** still sometimes changes a nearby paragraph, or ends with no reply after the model uses up its 4 calls.
- **Typing during a rewrite** is overwritten when that part of the rewrite arrives.
- **After Stop**, the reply records no token usage, and in the next turn the model can believe the stopped rewrite is still running.
- **Rejected edits stay in the chat history** as if they were made. The model always works from the current document, so this only affects what the user reads.
- **A part that fails or times out** (60 s per part) stays unchanged.
- **Untested edge case:** if a model sends a block ID as a number instead of text, the edit fails validation. We haven't seen it happen.
- **Models can disappear.** The cheap Grok model returned "Not Found" from the gateway for a whole afternoon. The app has no fallback model.
- **Non-OpenAI models ignore our settings** for thinking and verbosity, so their cost and speed are less predictable. Gemini cost five times its estimate.

### Shortcuts that won't hold in production

- **Hard-coded sample document.** Nothing loads or saves a real document; a reload starts again from the sample. Pending suggestions aren't saved either.
- **Hard-coded model list and prices** in `lib/chat-models.ts`. Prices and availability change, so this needs to come from Pryvet's per-project model settings.
- **Fixed limits:** 4 model calls per message and 60 s per rewrite part, chosen from tests, not production traffic.
- **Test data only:** 23 synthetic documents of 1 to 10 pages. The 64-page document isn't in the current suite.
- **Zod instead of Joi, and no Zustand or TanStack Query** (see [`LATER.md`](LATER.md)).

### Security and privacy gaps

- **No pseudonymisation.** Document text goes to the model provider as it is. The test documents use placeholders such as [PERSON_1] to imitate Pryvet's layer, but this PoC doesn't call it.
- **No login and no access control.** Anyone with a chat's URL can read it, and anyone with the demo's URL can chat and spend the gateway credit.
- **No rate limits or budgets** per user or project.
- **Data retention depends on the provider.** We send `store: false` to OpenAI, but haven't set the gateway's options that restrict other providers, such as excluding providers that train on prompts.
- **Prompt injection:** a document could contain instructions aimed at the model. The server only checks that edits target real blocks; review mode is the safeguard.
- **Chats are stored as plain documents** in MongoDB, with no retention or deletion policy.

### Path to production

Rough effort for one developer who knows Pryvet's codebase, in order:

| Step | What changes | Effort |
|---|---|--:|
| 1. Model access through Pryvet | Pryvet's API takes chat completions without streaming. The app needs streaming, tool calls and JSON schemas through the Responses API. Either Pryvet's endpoint gains those, or the app runs without live progress through an adapter. | 3–5 days |
| 2. Pseudonymisation | Edits quote document text, so Pryvet must map placeholders back consistently in edit operations and quotes, not only in plain answers. | 2–3 days |
| 3. Move into Pryvet's stack | Joi for request checks, Pryvet's projects, users, enabled models and budgets, its MongoDB models and state stores. | 3–5 days |
| 4. Hardening | Retries and a fallback model when a provider fails, token usage after Stop, block-ID validation, rate limits. | 2–3 days |
| 5. Measure the production path | Time to first change, caching and parallel tool calls on the real route, plus a cost check per project. | 1 day |
| 6. Quality | Hand-label the grader, run the suite on every model Pryvet offers, add operations that insert and delete blocks, and keep formatting on rewrites. | 4–6 days |

About three to five weeks in total. Saving and versioning documents was out of scope here and isn't included.
