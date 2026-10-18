# Test results

The test rounds behind [`FINDINGS.md`](FINDINGS.md): what each round changed, what we measured and what we decided. The rounds are numbered 1 to 21; there is no round 19. The full per-case tables are in git history at commit `c8bcb6e` (`git show c8bcb6e:TEST-RESULTS.md`).

## Terms and cases

- **Proxy:** a small program on the developer's machine that passes requests on to OpenAI's models. Every round here ran through it, so the tests cost no API money. Its token counts are real, but it adds its own delay, so its times are slower than production.
- **Gateway:** Vercel's paid AI Gateway, which the app uses in production. Costs in this file are worked out from the measured tokens at its list prices.
- **Models:** gpt-6-luna is the small model the app uses, and gpt-5.6-luna the older small model used in rounds 1 to 5. gpt-5.6-terra, gpt-5.6-sol, gpt-6-sol, gpt-6.1-sol and gpt-6-astra are bigger and cost more. **Effort** is how much a model thinks before it answers. gpt-6-luna ran at medium, its default, except in the effort tests of rounds 12 and 20.
- **Runs:** a run is one attempt at one case, and a case is a document, an instruction and the expected result. From round 15 a run is called a trial. An edit is correct when the expected change is there and nothing outside the case's scope changed. From round 3 an answer counts only when it passes the quote check and states the expected fact.
- **Cases:** the documents are synthetic, with names written as placeholders such as [PERSON_2]. The editor stores them as blocks: headings, paragraphs and table cells. S cases run on a 1-page sample offer, L cases on a 9-page IT security policy of about 200 blocks, and the **edit set** is all 23 of them. The cases named below:
  - S12: "Who coordinates the dates?" (the answer is [PERSON_2]). N1: "Who signed the contract?" (the document doesn't say).
  - L3: "Change customer to client everywhere". L5: a new IT hotline number, which appears in two sections. L10: "Unused accounts are now deactivated after 30 days instead of 60", while a patching table also says "60 days".
  - L7, LF and LG: make the whole policy more concise, make it more formal, translate it to German. S7, SF and SG do the same on the sample, and XF makes a 64-page document more formal.

## Round 1. Whole document or outline only

Sending the whole document with every request costs many tokens on long documents. We tried sending only the outline (the headings and the text before the first heading) with a `read_section` tool for the sections the model needs. gpt-5.6-luna on the edit set, 2 runs per case with the whole document and 3 with the outline.

- Correct: 40/45 with the whole document, 61/69 with the outline. A section edit on the policy used 2,204 input tokens instead of 7,786. On the 1-page sample the outline cost a little more (1,566 instead of 1,231).
- With the outline, S12 showed a wrong answer and L5 changed only one hotline number, each in 3 of 3 runs. We kept the outline and added a search tool.

## Round 2. Search tool

A `find_text` tool searches every block for several words at once and returns the matches with their block IDs. The cap rose from 3 to 4 model calls per request. On gpt-5.6-luna, 3 runs per case, the edit set went from 61/69 to 66/69 correct, and input tokens fell by 13.5%. L5 went from 0/3 to 3/3, but S12 still showed a wrong answer in 2 of 3 runs.

## Round 3. Quote-checked answers

Answers now go through an `answer_question` tool with exact quotes and their block IDs. The server checks each quote against the document and replaces an unverified answer with "I couldn't find a verified answer in the document." On gpt-5.6-luna, S12 went from 1/3 to 3/3 and N1 from 2/3 to 3/3, with no wrong answer shown. The edit set passed 22/23; its one failure was a wrong S12 answer. Over eight drafts of the prompt, S12 went wrong in 4 of 31 runs.

## Round 4. Models and effort

The same code on five configurations, to see whether a bigger model or more thinking answers better. S12 ran 40 times and N1 13 times (gpt-5.6-terra was stopped at 10 and 3), and the edit set once. The bigger models and high effort showed more wrong answers. gpt-6-luna showed no wrong N1 answer: its 5 misses were 4 plain-text answers that skipped the quote check and 1 empty reply.

| Model, effort | S12 correct | N1 correct | Edit set |
|---|--:|--:|--:|
| gpt-5.6-luna, default | 39/40 | 13/13 | 22/23 |
| gpt-5.6-luna, high | 36/40 | 11/13 | 22/23 |
| gpt-5.6-terra, default | 3/10 | 2/3 | 20/23 |
| gpt-5.6-sol, default | 36/40 | 6/13 | 23/23 |
| gpt-6-luna, default | 39/40 | 8/13 | 21/23 |

## Round 5. Forgiving matching, and search before answering

The model doesn't copy text exactly: it writes "kick off call" where the document says "Kick-off call". Edits, quote checks and search now share one matcher that allows for this, and a quoted answer is rejected unless `find_text` ran in the same request. On gpt-5.6-luna, S12 passed 20/20 and N1 47/50, with no wrong answer shown; N1's misses were 2 empty replies and 1 plain-text answer. The edit set passed 23/23 after each change.

## Round 6. gpt-6-luna on the same code

With round 5's code, gpt-6-luna cost $0.41 per 1,000 requests across the mix of cases, against $0.83 for gpt-5.6-luna, and the app moved to it. S12 passed 20/20 and the edit set 44/46. Both failures were L10, which also changed the "60 days" in the patching table. N1 passed 6/10; the other 4 runs answered in plain text.

## Rounds 7 and 8. Empty and plain-text replies

When `find_text` found nothing, gpt-6-luna often ended without calling the answer tool: on N1 it used the tool in 73 of 150 live runs, against 145 of 150 for gpt-5.6-luna. Replays of that step tried a new "no match" message that adds "If the document doesn't state the answer, call answer_question with no quotes."

- With the old message gpt-6-luna used the answer tool in 43 of 99 replays, with the new one in 100 of 100. gpt-5.6-luna went from 141 of 150 to 150 of 150.
- Round 8 shipped the message, and the chat now says "No answer came back. Please try again." when a reply has no text, edit or answer. N1 then passed 30/30, S12 10/10 and the edit set 22/23, with L10 failing again.

## Round 9. Table rows in search results

L10 failed because the search returned the patching-table cell on its own, so the model couldn't see it held a patch deadline. A hit in a table cell now comes with the table's header row and the cell's whole row.

- L10 went from 0/3 to 18/20, and the patching cell was left alone in all 20 runs. The edit set passed 23/23.
- In 2 of 4 runs of L7, the model replaced 13 headings with summaries it made up, without reading the text, and the checks passed them.

## Rounds 10 and 11. Whole-document rewrites

Round 10 added a prompt line: the outline shows headings only, so first read every section the instruction may refer to. The checks now fail an edit made without reading. LF went from 4/8 to 10/10 and LG from 2/8 to 6/10; before, LG translated only the headings in 6 of 8 runs. One call still couldn't rewrite 200 blocks: 4 of 10 German runs sent back only 37 to 60 of them, and L7 lost 73 placeholders over 10 runs.

Round 11 added a `transform_document` tool. It splits the document into parts at the headings (14 on the policy) and rewrites each part in its own model call, 6 at a time. Each part call also got the whole document. gpt-6-luna, 5 runs per policy case.

- Every German run translated 198 or 199 of 200 blocks, but used two different words for "employees". L7 lost 7 placeholders instead of 73.
- The first change came after 6 to 8 s instead of 10 to 49 s, but input grew from about 9,400 to about 109,000 tokens per policy run. XF split into 128 parts and took 151 and 198 s.
- In the browser, Stop ended the stream, but the server finished the translation and saved "Edited 199 blocks in 14 sections." to the chat history.

## Round 12. Model and effort matrix

Stop now cancels the request on the server too. Each part call now gets only the outline, the instruction and its own blocks, which cut a policy rewrite to about 14,700 input tokens, and L7 lost no placeholders. Each configuration then ran the same 68 requests: 36 edits, 22 questions and 10 whole-document rewrites. Every configuration answered all 22 questions correctly.

| Model, effort | Correct (of 68) | Cost per 1,000 requests | Seconds per request |
|---|--:|--:|--:|
| gpt-6-luna, medium (2 configurations) | 64, 66 | $0.88, $0.86 | 7.9, 7.1 |
| gpt-6-luna, none, low or high | 63–66 | $0.87–1.01 | 8.0–9.5 |
| gpt-6.1-sol, low or high (3 configurations) | 68 | $16.58–18.75 | 10.4–13.0 |
| gpt-6-astra, default | 68 | $83.31 | 14.3 |

- Stop after 4 of 14 sections ended all open calls at once. The history saved "Stopped after 4 of 14 sections." with the 49 blocks that had changed.
- We kept gpt-6-luna at medium. gpt-6.1-sol passed every request, at about 19 times the cost.

## Round 13. Table cells on their own lines, and a check on edit targets

In L3 the model sometimes edited the table cell next to the right one. Search results now list each cell on its own line with its own ID, and the server rejects an edit whose text isn't in the named block, saying which blocks do hold it. gpt-6-luna, 10 runs per case.

- L3 went from 5/10 to 10/10. With the server check alone it also passed 10/10: 3 edits were rejected, and all 3 were resent correctly.
- Not yet scored: where a paragraph says "customer" twice, all 31 L3 runs in this round left one of them.

## Round 14. Medium effort set by the app

The app now calls the proxy's Responses endpoint and asks for medium effort and medium verbosity on every call. Part calls get the edit format as an enforced JSON schema. gpt-6-luna, two passes of round 12's 68 requests.

- The passes got 67/68 and 68/68, against 64/68 and 66/68 for round 12's medium configurations, at $0.89 per 1,000 requests. All 176 part calls returned valid JSON.
- The proxy turned parallel tool calls off and reported cached input on only 1 of 434 calls, so neither could be measured.

## Round 15. Eval suite baseline

The test scripts became an eval suite: 129 cases on 24 documents, run through the app's real chat code against a headless editor. Code checks decide first, then an AI grader (gpt-6.1-sol) judges meaning, tone, translation and answers. gpt-6-luna ran most cases 3 times (415 trials in all), the other models once. The 95% margins are ±7 to ±9 points, and gpt-6.1-sol graded its own run.

| Model | Passed | Code checks only | Cost per 1,000 requests |
|---|--:|--:|--:|
| gpt-6-luna | 70.8% | 84.8% | $1.20 |
| gpt-6.1-sol | 85.2% | 94.5% | $20.27 |
| gpt-5.6-luna | 72.7% | 87.5% | $2.67 |
| gpt-5.6-terra | 71.9% | 87.5% | no price set |
| gpt-5.6-sol | 77.3% | 91.4% | no price set |

- gpt-6-luna lost most on rewrites: formal 3/25, concise 1/24, German 10/30. The grader failed 53 of 60 rewrite trials on meaning, about 40 of them for a change a reader would act on, such as "immediately" becoming "without undue delay".
- "Everywhere" edits passed 35/55, and each failure missed a second or third occurrence of the word. Missing parts passed 27/41: "shorten the cover letter" shortened 61 to 88 blocks of a proposal that has no cover letter. None of the 39 questions the document doesn't answer got a made-up answer.
- "Make the phishing part shorter" dropped "Email is the most common route for attacks" on every model.

## Round 16. Repeated words and missing parts

The server now rejects an edit if the word is still in the paragraph afterwards. A prompt line says that if the instruction names a part the document doesn't have, the model changes nothing, says so and asks. Full suite, 415 trials.

- Passed rose from 70.8% to 72.8%, within noise (paired gain 1.9 ±3.4 points). Missing parts went from 27/41 to 35/41 (the seven new cases from 7/21 to 15/21), and out-of-scope changes fell from 17 to 9 of 336 trials.
- Every edit the repeated-word check rejected (in 13 trials) was followed by an accepted one. L3 still passed only 1/10: its edits replaced the plural "customers" and left the singular "customer" in two blocks.

## Rounds 17 and 18. Keeping the meaning in rewrites

Rewrites had turned "should" into "must" and dropped words like "exclusively". Round 17 added a prompt line to keep how strong each statement is. Three wordings ran on the 31 rewrite cases, and the one with the fewest meaning failures was kept. Round 18 added a check after each rewritten part: one more call compares it with the original and corrects the blocks whose meaning changed.

- Round 17: rewrite trials passed 18/91 without the line and 30, 30 and 26 with the three wordings. Three slips that round 16 made in 3 of 3 runs each appeared in 0 of 12: "without delay" becoming "without undue delay", "should use" becoming "must use", and a dropped "exclusively". "The sensor should be installed" still became "Install the sensor" in 12 of 12.
- The full suite rose from 72.8% to 74.5%, within noise, and missing parts fell from 35/41 to 32/41. Of its 106 failed trials, 38 were rewrites that changed meaning, 21 German translations, 14 "everywhere" edits, 10 a second figure not updated, 9 missing parts and 14 other causes.
- Round 18, on the 26 whole-document cases, 3 trials each: passed 23/78 → 29/78 (within noise), meaning failures 33 → 26, tokens per rewrite 14,619 → 25,976, cost per 1,000 rewrites $3.38 → $5.22, first change 6.3 → 9.0 s. "Install the sensor" fell to 0 of 3.

## Rounds 20 and 21. Term sheet and check model

Round 20 added a term sheet before the parts (one translation per key term), a check that sees word-level changes, a repair call for flagged English blocks, code guards for lost numbers and placeholders, and the option to run the check and repair on a second model. Round 21 tried cheaper models for the check. All runs used the 26 whole-document cases, one trial each, and gpt-6-luna wrote the parts except in the second row.

| Setup | Passed (of 26) | Cost per 1,000 rewrites |
|---|--:|--:|
| Round 18 code | 9 | $5.20 |
| Everything on gpt-6.1-sol | 19 | $96 |
| New steps, check on gpt-6-luna (4 runs) | 11–15 | $7.60–8.90 |
| New steps, check on gpt-6-sol (round 21) | 12 | $70 |
| New steps, check on gpt-6.1-sol (6 runs) | 17–22 | $48.60–54.10 |
| Final version, check on gpt-6.1-sol | 20 | $55 |

- gpt-6.1-sol stays the check model: no cheaper one reached about 80%. gpt-6-sol has the same token price but wrote about 1.8 times as many output tokens per check. gpt-5.6-luna passed 1 of the 8 cases that had failed most often and wasn't run on all 26. gpt-5.6-terra and gpt-5.6-sol cost at least as much per token as gpt-6.1-sol, so they weren't run.
- The first change now appears about 20 s after the request, against about 9 s in round 18.
- The final run failed 6 cases, among them "require approval" becoming "may require approval". In the same run, change text passed 46/52, answer a question 35/37, missing part 9/9 and section rewrite 2/4.
