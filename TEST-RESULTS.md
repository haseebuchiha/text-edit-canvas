# Test results

Aggregated numbers from the chat edit and question test runs, per case and per test round. Every figure was computed from the raw run records, which lived in a temporary scratch folder.

## Test conditions

- Models were reached through a local proxy. Token counts are the ones it reported, so they're real. Timings include the proxy's own delay and aren't representative of the API.
- "Default thinking" means the app sent no `reasoning_effort`. The proxy drops `reasoning_effort` for gpt-6 models, so every gpt-6 run before round 12 ran at the backend's default, medium for gpt-6-luna. From round 14 the app calls the proxy's Responses endpoint and sets medium effort itself. Every run used the outline mode unless a table says "full".
- **Correct**: an edit case passes the scope check in the key below. In rounds 1–2, and in the G0 run, a question was judged on its reply text. From round 3 on, a question counts only when a verified `answer_question` reply states the expected fact.
- **Wrong shown**: question runs (S8, S12, L8, N1, H1) where the user saw a wrong answer. **Calls**: model calls per run. **In / Out / Reasoning**: average tokens per run, summed over its calls. Reasoning comes from logged model responses and exists only in rounds 4, 6, 7, 12 and 14.
- **Cap**: runs that used every allowed call (3 in round 1, 4 after), with "(n unresolved)" when some of them ended without an edit or a verified answer. **Empty**: no text, no edit and no answer. **Skipped tool**: a question answered in plain text instead of through `answer_question`. **Sec**: average wall time per run.
- **Edit set**: all 23 S and L cases, which include the S8, S12 and L8 questions.

## Case key

S cases run on the editor's 1-page sample offer. L cases run on the 9-page IT security policy (`evals/data/documents/07-it-security-policy.json`). From round 15 every case below is a case file in `evals/data/cases/`, with a stricter expected outcome (see round 15).

| ID | Instruction | Counts as correct |
|---|---|---|
| S1 | "make the pricing section friendlier" | edits only inside the pricing section (blocks 22–44) |
| S2 | "make the cost part shorter" | edits only inside the pricing section (blocks 22–44) |
| S3 | "change customer to client everywhere" | blocks 4, 6 and 7 changed, nothing outside 4–7 |
| S4 | "the workshop is now for 15 people" | block 6 says "15 people", nothing else changed |
| S5 | "raise the workshop price to EUR 4,000" | block 36 says 4,000 and the total in block 44 says 5,650 |
| S6 | "add that this offer is valid for 30 days next to who it's prepared for" | block 2 gains "30 days", nothing else changed |
| S7 | "make the whole document more concise" | any edit |
| S8 | "what's the total price?" | answer states EUR 5,250, no edit |
| S9 | "edit the appendix" | reply mentions the appendix, no edit |
| S10 | "make this 15" (highlight: "12 people" in block 6) | block 6 says "15 people", nothing else changed |
| S11 | "remove the draft note at the top" (sample with a draft note added at the top) | block 1 changed, nothing else |
| S12 | "who coordinates the dates?" | answer names [PERSON_2], no edit |
| S13 | "the workshop is now for 15 people" (sample with every heading turned into a plain paragraph) | block 6 says "15 people", nothing else changed |
| N1 | "who signed the contract?" | answer says the document doesn't state it, no claim that [PERSON_3] signed |
| H1 | "what is this price for?" (highlight: "EUR 3,600" in block 36) | answer mentions the workshop |
| G1 | "Hi!" | plain-text reply, no tool call |
| L1 | "make the passwords section friendlier" | edits only in blocks 85–116 |
| L2 | "make the phishing part shorter" | edits only in blocks 179–196 |
| L3 | "change customer to client everywhere" | all 11 blocks with "customer" changed |
| L4 | "workstations now lock automatically after five minutes of inactivity" | block 162 says "five minutes", nothing else changed |
| L5 | "the IT hotline number is now [PHONE_2]" | blocks 178 and 253 changed, nothing else |
| L6 | "change the version to 4.3 in the document header" | block 2 says 4.3, nothing else changed |
| L7 | "make the whole document more concise" | any edit |
| L8 | "how long must a privileged account password be?" | answer states 16, no edit |
| L9 | "edit the appendix" | reply mentions the appendix, no edit |
| L10 | "unused accounts are now deactivated after 30 days instead of 60" | block 122 says "30 days", nothing else changed |
| SF, LF | "make the whole document more formal" (SF on the 1-page sample, LF on the 9-page policy) | see the round that uses it |
| SG, LG | "translate the document to German" (SG on the 1-page sample, LG on the 9-page policy) | see the round that uses it |
| XF | "make the whole document more formal" on a 64-page document joined from 13 of the sample documents | see round 11 |

## 1. Whole document vs outline only

Code: the request carries the whole document (full), or only the outline and the blocks before the first heading, plus a `read_section` tool that takes several heading IDs (outline). The step cap is 3.
gpt-5.6-luna, default thinking. Full ran 2 times per case (S13 once) and outline 3 times. Cells read full → outline.

| Case | Correct | Wrong shown | Calls | In | Out | Cap (outline) | Empty | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| S1 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 1,231 → 1,566 | 213 → 300 | 0 | 0 → 0 | 2.8 → 4.6 |
| S2 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 1,230 → 1,564 | 216 → 243 | 0 | 0 → 0 | 3.3 → 4.4 |
| S3 | 1/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 1,230 → 1,930 | 155 → 190 | 0 | 0 → 0 | 2.2 → 3.7 |
| S4 | 1/2 → 3/3 | 0 → 0 | 1.00 → 3.00 | 1,233 → 3,110 | 82 → 247 | 3 | 0 → 0 | 2.4 → 6.2 |
| S5 | 1/2 → 2/3 | 0 → 0 | 1.00 → 2.00 | 1,235 → 1,574 | 161 → 124 | 0 | 0 → 0 | 2.6 → 3.4 |
| S6 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 1,241 → 1,945 | 186 → 229 | 0 | 0 → 0 | 2.9 → 4.6 |
| S7 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 1,231 → 1,932 | 834 → 993 | 0 | 0 → 0 | 5.2 → 8.5 |
| S8 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 1,229 → 1,562 | 27 → 56 | 0 | 0 → 0 | 1.5 → 3.8 |
| S9 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 1,228 → 1,901 | 143 → 226 | 0 | 0 → 0 | 7.5 → 5.1 |
| S10 | 2/2 → 3/3 | 0 → 0 | 1.00 → 1.00 | 1,245 → 788 | 78 → 80 | 0 | 0 → 0 | 3.0 → 2.9 |
| S11 | 2/2 → 3/3 | 0 → 0 | 1.00 → 1.00 | 1,245 → 664 | 84 → 69 | 0 | 0 → 0 | 1.9 → 1.7 |
| S12 | 2/2 → 0/3 | 0 → 3 | 1.00 → 2.00 | 1,229 → 1,623 | 20 → 160 | 0 | 0 → 0 | 2.1 → 4.1 |
| S13 | 1/1 → 3/3 | 0 → 0 | 1.00 → 1.00 | 1,191 → 1,202 | 82 → 75 | 0 | 0 → 0 | 1.6 → 2.1 |
| L1 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 7,786 → 2,204 | 316 → 332 | 0 | 0 → 0 | 3.6 → 4.6 |
| L2 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 7,785 → 2,389 | 556 → 499 | 0 | 0 → 0 | 6.3 → 6.5 |
| L3 | 2/2 → 2/3 | 0 → 0 | 1.00 → 2.00 | 7,785 → 8,720 | 587 → 675 | 0 | 0 → 0 | 4.6 → 12.4 |
| L4 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.33 | 7,790 → 4,795 | 100 → 215 | 1 | 0 → 0 | 1.9 → 4.9 |
| L5 | 2/2 → 0/3 | 0 → 0 | 1.00 → 2.00 | 7,790 → 2,192 | 118 → 99 | 0 | 0 → 0 | 1.9 → 3.1 |
| L6 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 7,792 → 8,684 | 91 → 171 | 0 | 0 → 0 | 2.1 → 4.3 |
| L7 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 7,786 → 8,722 | 3,441 → 3,861 | 0 | 0 → 0 | 20.1 → 22.4 |
| L8 | 0/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 7,788 → 2,348 | 4 → 75 | 0 | 2 → 0 | 1.6 → 3.1 |
| L9 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.00 | 7,783 → 1,836 | 149 → 212 | 0 | 0 → 0 | 2.5 → 4.0 |
| L10 | 2/2 → 3/3 | 0 → 0 | 1.00 → 2.67 | 7,794 → 3,037 | 90 → 169 | 2 | 0 → 0 | 1.6 → 4.6 |
| All | 40/45 → 61/69 | 0 → 3 | 1.00 → 1.96 | 4,146 → 2,882 | 342 → 404 | 6 | 2 → 0 | 3.8 → 5.4 |

Not shown: outline drafts B1–B3 and spot checks X1/X2. A second full-document run at the end of the round (C-full, 46 runs) got 43/46 correct, with 1.11 calls, 4,557 in and 362 out.

## 2. Search tool

Code: added `find_text`, which searches every block for several terms at once. The step cap went from 3 to 4.
gpt-5.6-luna, default thinking, 3 runs per case. Against round 1's outline runs, correct went from 61/69 to 66/69, and total input tokens from 198,864 to 171,986 (-13.5%).

| Case | Runs | Correct | Wrong shown | Calls | In | Out | Cap | Empty | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| S1 | 3 | 3/3 | 0 | 2.00 | 1,788 | 235 | 0 | 0 | 4.2 |
| S2 | 3 | 3/3 | 0 | 2.00 | 1,786 | 219 | 0 | 0 | 4.0 |
| S3 | 3 | 3/3 | 0 | 2.00 | 1,622 | 137 | 0 | 0 | 3.8 |
| S4 | 3 | 3/3 | 0 | 2.00 | 1,817 | 144 | 0 | 0 | 3.7 |
| S5 | 3 | 2/3 | 0 | 2.00 | 1,796 | 121 | 0 | 0 | 3.5 |
| S6 | 3 | 3/3 | 0 | 2.00 | 2,166 | 230 | 0 | 0 | 4.4 |
| S7 | 3 | 3/3 | 0 | 2.00 | 2,154 | 906 | 0 | 0 | 7.9 |
| S8 | 3 | 3/3 | 0 | 2.00 | 1,784 | 53 | 0 | 0 | 3.4 |
| S9 | 3 | 3/3 | 0 | 2.00 | 2,139 | 167 | 0 | 0 | 4.5 |
| S10 | 3 | 3/3 | 0 | 1.00 | 899 | 79 | 0 | 0 | 2.5 |
| S11 | 3 | 3/3 | 0 | 1.00 | 775 | 71 | 0 | 0 | 1.6 |
| S12 | 3 | 1/3 | 2 | 2.33 | 2,419 | 191 | 0 | 0 | 5.1 |
| S13 | 3 | 3/3 | 0 | 1.00 | 1,313 | 74 | 0 | 0 | 1.7 |
| L1 | 3 | 3/3 | 0 | 2.00 | 2,426 | 351 | 0 | 0 | 4.8 |
| L2 | 3 | 3/3 | 0 | 2.67 | 3,607 | 570 | 0 | 0 | 8.0 |
| L3 | 3 | 3/3 | 0 | 2.00 | 2,856 | 527 | 0 | 0 | 5.7 |
| L4 | 3 | 3/3 | 0 | 2.00 | 2,815 | 142 | 0 | 0 | 3.3 |
| L5 | 3 | 3/3 | 0 | 2.00 | 2,313 | 155 | 0 | 0 | 4.1 |
| L6 | 3 | 3/3 | 0 | 2.00 | 2,112 | 123 | 0 | 0 | 3.3 |
| L7 | 3 | 3/3 | 0 | 2.00 | 8,944 | 4,176 | 0 | 0 | 24.5 |
| L8 | 3 | 3/3 | 0 | 2.00 | 2,570 | 65 | 0 | 0 | 3.3 |
| L9 | 3 | 3/3 | 0 | 3.00 | 3,248 | 223 | 0 | 0 | 5.7 |
| L10 | 3 | 3/3 | 0 | 3.33 | 3,980 | 245 | 1 | 0 | 8.1 |
| All | 69 | 66/69 | 2 | 2.01 | 2,493 | 400 | 1 | 0 | 5.3 |

## 3. Quote-checked answers

Code: questions go through `answer_question` with exact quotes and block IDs, which the server checks. An unverified answer is replaced by "I couldn't find a verified answer in the document."
gpt-5.6-luna, default thinking. Cells read before → after: before is round 2 (S12, S8, L8) or the pre-tool run G0 (N1, H1, G1), 3 runs each; after is the final draft QF2, 3 runs each, plus the edit set once (R1).

| Case | Runs | Correct | Wrong shown | Calls | In | Out | Cap | Empty | Skipped tool | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| S12 | 3 → 3 | 1/3 → 3/3 | 2 → 0 | 2.33 → 2.67 | 2,419 → 3,208 | 191 → 164 | 0 → 0 | 0 → 0 | 0 | 5.1 → 6.1 |
| N1 | 3 → 3 | 2/3 → 3/3 | 1 → 0 | 2.00 → 2.33 | 1,967 → 2,768 | 163 → 188 | 0 → 0 | 0 → 0 | 0 | 6.2 → 5.0 |
| S8 | 3 → 3 | 3/3 → 3/3 | 0 → 0 | 2.00 → 2.00 | 1,784 → 2,224 | 53 → 90 | 0 → 0 | 0 → 0 | 0 | 3.4 → 3.1 |
| L8 | 3 → 3 | 3/3 → 3/3 | 0 → 0 | 2.00 → 2.00 | 2,570 → 3,010 | 65 → 127 | 0 → 0 | 0 → 0 | 0 | 3.3 → 4.5 |
| H1 | 3 → 3 | 3/3 → 3/3 | 0 → 0 | 1.00 → 1.00 | 1,021 → 1,241 | 51 → 168 | 0 → 0 | 0 → 0 | 0 | 2.2 → 4.7 |
| G1 | 3 → 3 | 3/3 → 3/3 | 0 → 0 | 1.00 → 1.00 | 753 → 973 | 34 → 11 | 0 → 0 | 0 → 0 | 0 | 1.9 → 2.2 |
| Edit set | 69 → 23 | 66/69 → 22/23 | 2 → 1 | 2.01 → 2.04 | 2,493 → 2,924 | 400 → 371 | 1 → 0 | 0 → 0 | 0 | 5.3 → 5.8 |

The R1 edit-set failure was S12, a wrong answer that was shown. Correct across the eight answer-tool drafts:

- S12: Q1 3/3, Q2 3/3, Q3 3/4 (1 wrong), Q4 4/4, QF 2/3 (1 wrong), Q5 4/5 (1 wrong), Q6 5/6 (1 wrong), QF2 3/3
- N1: Q1 3/3, Q2 3/3, Q3 2/4 (2 wrong), Q4 4/4, QF 3/3, Q5 5/5, QF2 3/3

## 4. Model and thinking comparison

Code: unchanged from the end of round 3 (repo hashes matched before and after). A forwarding proxy swapped the model, and "high" sent `reasoning_effort: high`.
S12 ran 40 times and N1 13 times (gpt-5.6-terra was stopped early at 10 and 3), S8, L8 and H1 3 times each, and the edit set once.

| Config | Case | Runs | Correct | Wrong shown | Calls | In | Out | Reasoning | Cap | Empty | Skipped tool | Sec |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| gpt-5.6-luna, default | S12 | 40 | 39/40 | 1 | 2.50 | 2,949 | 177 | 60 | 0 | 0 | 0 | 5.9 |
|  | N1 | 13 | 13/13 | 0 | 2.31 | 2,697 | 143 | 71 | 0 | 0 | 0 | 8.8 |
|  | S8, L8, H1 | 9 | 9/9 | 0 | 1.67 | 2,158 | 117 | 53 | 0 | 0 | 0 | 4.3 |
|  | Edit set | 23 | 22/23 | 0 | 1.96 | 2,798 | 353 | 89 | 0 | 0 | 0 | 9.7 |
| gpt-5.6-luna, high | S12 | 40 | 36/40 | 4 | 2.55 | 3,037 | 199 | 83 | 0 | 0 | 0 | 6.6 |
|  | N1 | 13 | 11/13 | 2 | 2.31 | 2,705 | 198 | 124 | 0 | 0 | 0 | 6.2 |
|  | S8, L8, H1 | 9 | 9/9 | 0 | 1.67 | 2,158 | 148 | 80 | 0 | 0 | 0 | 3.6 |
|  | Edit set | 23 | 22/23 | 0 | 2.09 | 3,304 | 551 | 177 | 0 | 0 | 0 | 9.1 |
| gpt-5.6-terra, default | S12 | 10 | 3/10 | 7 | 2.20 | 2,562 | 112 | 21 | 0 | 0 | 0 | 10.4 |
|  | N1 | 3 | 2/3 | 0 | 2.67 | 2,806 | 96 | - | 0 | 0 | 1 | 23.9 |
|  | S8, L8, H1 | 9 | 9/9 | 0 | 1.67 | 2,158 | 84 | - | 0 | 0 | 0 | 15.7 |
|  | Edit set | 23 | 20/23 | 1 | 1.83 | 2,607 | 309 | - | 0 | 0 | 0 | 17.0 |
| gpt-5.6-sol, default | S12 | 40 | 36/40 | 4 | 2.65 | 3,226 | 156 | 47 | 0 | 0 | 0 | 8.6 |
|  | N1 | 13 | 6/13 | 7 | 2.54 | 2,652 | 132 | 46 | 0 | 0 | 0 | 7.9 |
|  | S8, L8, H1 | 9 | 9/9 | 0 | 1.67 | 2,158 | 92 | 28 | 0 | 0 | 0 | 6.4 |
|  | Edit set | 23 | 23/23 | 0 | 1.91 | 2,714 | 310 | 51 | 0 | 0 | 0 | 9.7 |
| gpt-6-luna, default | S12 | 40 | 39/40 | 1 | 2.77 | 3,292 | 115 | 1 | 3 | 0 | 0 | 6.8 |
|  | N1 | 13 | 8/13 | 0 | 2.23 | 2,394 | 71 | 2 | 1 | 1 | 4 | 5.3 |
|  | S8, L8, H1 | 9 | 8/9 | 1 | 2.11 | 2,726 | 76 | 0 | 1 | 0 | 0 | 5.4 |
|  | Edit set | 23 | 21/23 | 0 | 2.04 | 2,909 | 247 | 15 | 1 | 0 | 0 | 7.4 |

- Reasoning is "-" where the proxy log holds extra calls from re-run terra cases that can't be matched to runs.
- Edit-set failures: gpt-5.6-luna, default: L10; gpt-5.6-luna, high: S5; gpt-5.6-terra, default: S12, L5, L10; gpt-5.6-sol, default: none; gpt-6-luna, default: S4, L10.
- Caching: gpt-5.6-sol was the only config with cached prompt tokens, 22,912 of 245,355 (9.3%) on 20 of 198 calls. Every other config reported 0, over 190 calls (gpt-5.6-luna, default), 195 calls (gpt-5.6-luna, high), 91 calls (gpt-5.6-terra, default), 206 calls (gpt-6-luna, default).

## 5. Forgiving matching and search before answering

Code: edits, quote checks and search share one forgiving matcher (80/80 matcher checks pass). Then a quoted answer is rejected unless `find_text` ran in the same request, except quotes from blocks already in the prompt (12/12 rule checks pass).
gpt-5.6-luna, default thinking. N1 ran 50 times (10 + 20 + 20), S12 20 times, S8, L8 and H1 5 times each, G1 3 times, and the edit set once after each change.

| Case | Runs | Correct | Wrong shown | Calls | In | Out | Cap | Empty | Skipped tool | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| S12 | 20 | 20/20 | 0 | 2.00 | 2,124 | 131 | 0 | 0 | 0 | 5.8 |
| N1 | 50 | 47/50 | 0 | 2.00 | 2,013 | 103 | 0 | 2 | 1 | 5.3 |
| S8 | 5 | 5/5 | 0 | 2.40 | 2,695 | 134 | 0 | 0 | 0 | 7.6 |
| L8 | 5 | 5/5 | 0 | 2.80 | 4,061 | 171 | 0 | 0 | 0 | 8.6 |
| H1 | 5 | 5/5 | 0 | 1.00 | 1,247 | 161 | 0 | 0 | 0 | 3.4 |
| G1 | 3 | 3/3 | 0 | 1.00 | 979 | 13 | 0 | 0 | 0 | 1.7 |
| Edit set, matcher only (M1) | 23 | 23/23 | 0 | 2.09 | 3,116 | 427 | 0 | 0 | 0 | 7.8 |
| Edit set, matcher + rule (RE) | 23 | 23/23 | 0 | 2.00 | 2,907 | 409 | 1 | 0 | 0 | 8.1 |

Not shown: drafts of the rule wording (RQ, RQ2–RQ4, RB).

## 6. gpt-6-luna on the current code

Code: unchanged from round 5. The model switched to gpt-6-luna, default thinking.
S12 ran 20 times, N1 10 times, S8, L8 and H1 5 times each, G1 3 times, and the edit set twice. Reasoning comes from the app's captured model requests.

| Case | Runs | Correct | Wrong shown | Calls | In | Out | Reasoning | Cap | Empty | Skipped tool | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| S12 | 20 | 20/20 | 0 | 2.05 | 2,208 | 103 | 0.0 | 0 | 0 | 0 | 5.1 |
| N1 | 10 | 6/10 | 0 | 2.10 | 2,179 | 60 | 0.0 | 0 | 0 | 4 | 5.0 |
| S8 | 5 | 5/5 | 0 | 3.60 | 4,444 | 126 | 0.0 | 3 | 0 | 0 | 8.7 |
| L8 | 5 | 5/5 | 0 | 3.60 | 5,779 | 121 | 0.0 | 4 | 0 | 0 | 8.2 |
| H1 | 5 | 5/5 | 0 | 1.20 | 1,546 | 79 | 0.0 | 0 | 0 | 0 | 3.4 |
| G1 | 3 | 3/3 | 0 | 1.00 | 979 | 12 | 0.0 | 0 | 0 | 0 | 1.9 |
| Edit set (×2) | 46 | 44/46 | 0 | 2.13 | 3,200 | 377 | 11.2 | 4 | 0 | 0 | 7.3 |

- The edit-set failure was L10 ×2: it also changed an unrelated "60 days" in block 221.
- There were 7 rejected answer attempts on S8, L8 and H1, against 0 in round 5.
- Mix-weighted per request against round 5 (`g6-report.mjs`, weights: edit set 46, S12 20, N1 10, S8+L8+H1 15, G1 3): input 2,546 → 2,925, output 264 → 230, and cost per 1,000 requests at the list prices in that script ($0.20 / $1.20 vs $0.10 / $0.50 per 1M tokens) $0.83 → $0.41.

## 7. Empty replies

Code: unchanged from round 5, before the fix. Default thinking, run counts as listed.
Replays re-sent a failing N1 request as single model calls, from the point where `find_text` had found no match. Wording is the text of that no-match result (see below).

| Test | Model | Case | Runs | Answer tool | Plain text | Empty | Other | Calls | In | Out | Reasoning | Sec |
|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Live runs | gpt-5.6-luna | N1 | 150 | 145 | 0 | 5 | 0 | 2.02 | 2,054 | 107 | 43 | 5.0 |
| Live runs | gpt-5.6-luna | S8 | 40 | 40 | 0 | 0 | 0 | 2.50 | 2,868 | 140 | 46 | 5.9 |
| Live runs | gpt-5.6-luna | L8 | 40 | 40 | 0 | 0 | 0 | 2.88 | 4,452 | 178 | 72 | 7.8 |
| Live runs | gpt-6-luna | N1 | 150 | 73 | 75 | 2 | 0 | 2.03 | 2,066 | 53 | 0 | 4.4 |
| Replay, old wording | gpt-5.6-luna | N1 | 150 | 141 | 1 | 8 | 0 | 1.00 | 1,030 | 46 | 16 | - |
| Replay, new wording | gpt-5.6-luna | N1 | 150 | 150 | 0 | 0 | 0 | 1.00 | 1,045 | 30 | 0 | - |
| Replay, old wording | gpt-6-luna | N1 | 99 | 43 | 39 | 11 | 6 | 1.00 | 1,035 | 21 | 0 | - |
| Replay, new wording | gpt-6-luna | N1 | 100 | 100 | 0 | 0 | 0 | 1.00 | 1,050 | 30 | 0 | - |

- Old wording: "No block contains any of these terms." New wording adds "If the document doesn't state the answer, call answer_question with no quotes."
- Other: a different tool call (`read_section`) instead of an answer.

## 8. Empty-reply fix

Code: the no-match search result uses round 7's new wording. The chat shows "No answer came back. Please try again." when a reply ends with no text, edit or answer.
gpt-6-luna, default thinking, reasoning not recorded. N1 ran 30 times, S12 10 times, S8, L8 and H1 5 times each, G1 3 times, and the edit set once.

| Case | Runs | Correct | Wrong shown | Calls | In | Out | Cap | Empty | Skipped tool | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| S12 | 10 | 10/10 | 0 | 2.30 | 2,618 | 106 | 0 | 0 | 0 | 5.5 |
| N1 | 30 | 30/30 | 0 | 2.00 | 2,028 | 59 | 0 | 0 | 0 | 4.5 |
| S8 | 5 | 5/5 | 0 | 2.80 | 3,309 | 99 | 1 | 0 | 0 | 5.9 |
| L8 | 5 | 5/5 | 0 | 3.40 | 5,337 | 120 | 3 | 0 | 0 | 7.4 |
| H1 | 5 | 5/5 | 0 | 1.00 | 1,247 | 54 | 0 | 0 | 0 | 2.2 |
| G1 | 3 | 3/3 | 0 | 1.00 | 979 | 11 | 0 | 0 | 0 | 2.8 |
| Edit set | 23 | 22/23 | 0 | 2.09 | 3,310 | 381 | 2 | 0 | 0 | 6.9 |

- The edit-set failure was L10, the same unrelated change to block 221.
- Every run that used all 4 calls still ended with an edit or a verified answer. There were 4 rejected answer attempts on S8, L8 and H1.

## 9. Table rows in search results

Code: a `find_text` hit in a table cell returns the table's header row and the cell's whole row, with block IDs on every cell. The snapshot carries table and row IDs for this.
gpt-6-luna, default thinking. L10 ran 20 times, L3 and S5 3 times each, S8, L8 and N1 3 times each, and the edit set once.

| Case | Runs | Correct | Unintended changes | In | Out |
|---|--:|--:|--:|--:|--:|
| L10 before | 3 | 0/3 | 3 (block 221) | 2,670 | 107 |
| L10 after | 20 | 18/20 | 2 (block 84) | 2,831 | 94 |
| L3 before | 3 | 3/3 | 0 | 3,305 | 283 |
| L3 after | 3 | 3/3 | 0 | 3,336 | 265 |
| S5 before | 3 | 3/3 | 0 | 2,248 | 100 |
| S5 after | 3 | 3/3 | 0 | 2,248 | 99 |

- Block 221, the patching-table cell, wasn't changed in any of the 20 L10 runs. In the 2 failures the model skipped the search, read only the "User Accounts" section and added a sentence to block 84.
- L10's token figures for the "after" row are from the first 10 runs.
- The edit set passed 23/23. S8 and L8 were 3/3 each. N1 was 3/3 on manual reading; the evaluator scored it 1/3 because it misses the curly apostrophe in "doesn’t".
- L7 ("make the whole document more concise"): in 2 of 4 runs the model skipped reading and replaced 13 headings with summaries it made up. The evaluator passed those runs.

## 10. Whole-document read fixes

Code: a prompt line, "The outline shows headings only, not the text under them. When the instruction refers to content that isn't shown, including the whole document, first call `read_section` once with every outline heading whose section may hold it." `edit_document` rejects an edit that adds a line break to a heading or makes it more than twice as long, the browser applies only accepted edits, and the run stops only on an accepted edit. The evaluator accepts a curly apostrophe in N1 and fails an edit made without reading anything.
gpt-6-luna, default thinking. Before is the previous code, 8 runs per case. After ran the 9-page cases 10 times, the 1-page cases 3 times, the edit set once, S8, L8 and N1 3 times each, L4 5 times and L10 10 more times.

| Case | Runs | Read first | Headings only | Partial German | Correct | Calls | In | Out | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| LF | 8 → 10 | 4 → 10 | 1 → 0 | - | 4/8 → 10/10 | 1.50 → 2.00 | 5,276 → 9,408 | 524 → 852 | 21.6 → 10.4 |
| LG | 8 → 10 | 2 → 10 | 6 → 0 | 6 → 4 | 2/8 → 6/10 | 1.25 → 2.00 | 3,225 → 9,406 | 2,866 → 6,898 | 24.6 → 51.8 |
| SF | 8 → 3 | 8 → 3 | 0 → 0 | - | 8/8 → 3/3 | 2.00 → 2.00 | 2,606 → 2,640 | 808 → 804 | 27.1 → 7.6 |
| SG | 8 → 3 | 8 → 3 | 0 → 0 | 0 → 0 | 8/8 → 3/3 | 2.00 → 2.00 | 2,604 → 2,638 | 864 → 985 | 10.0 → 9.3 |
| L7 | 10 | 10 | 0 | - | 10/10 | 2.00 | 9,391 | 4,609 | 32.3 |
| S7 | 3 | 3 | 0 | - | 3/3 | 2.00 | 2,640 | 699 | 11.7 |

| Case | Runs | Correct |
|---|--:|--:|
| Edit set | 23 | 22/23 |
| S8, L8, N1 | 9 | 9/9 |
| L4 | 5 | 5/5 |
| L10 | 11 | 7/11 |

- **Correct** here: the model read before editing, wrote no body text into a heading, and for German changed at least 75% of the blocks (150 of 200, 27 of 35). L7 and S7 have no "before" run.
- In the 4 partial German runs the model read every section, then sent one edit with 37, 37, 53 or 60 of the 200 blocks. Replaying that edit call 8 times per prompt gave 7 full translations with either prompt. The eighth stopped with no edit (old prompt) or sent 37 blocks (new prompt).
- L10 failed in the edit set and in 3 of the 10 extra runs, each time by reading only "User Accounts" and changing block 84. Replaying L10's first call 15 times per prompt gave 12/15 correct with the old prompt and 11/15 with the new one.
- The heading check rejected no edit in the 39 whole-document runs, because every run read first.
- L7 dropped placeholders in all 10 runs: the four site names in block 6 every time, 73 placeholders in total.

## 11. Section-by-section pass

Code: a `transform_document` tool that splits the document into parts and runs one plain model call per part (see FINDINGS.md). A heading starts a part; a part under 250 estimated tokens joins a neighbour while the pair stays at 1,000 or less; a longer part is split between blocks. Each call gets the whole document as context up to 20,000 tokens, the outline above that. 6 calls run at a time, each with a 60-second timeout and one retry. The round 10 prompt line loses "including the whole document" and gains one line that routes whole-document instructions to the tool.
gpt-6-luna, default thinking. Cells read round 10 → round 11. **Calls** count the chat call plus one call per part. **First**: seconds to the first visible change in the document. **Correct** as in round 10, minus the reading rule, since the tool reads every part.

| Case | Runs | Correct | Blocks changed | Placeholders lost | Calls | In | Out | First | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| L7 | 10 → 5 | 10/10 → 5/5 | 43.7 → 123.4 | 73 → 7 | 2.00 → 15.00 | 9,391 → 108,981 | 4,609 → 6,798 | 32.1 → 6.3 | 32.3 → 18.4 |
| LF | 10 → 5 | 10/10 → 5/5 | 19.8 → 115.4 | 0 → 0 | 2.00 → 15.00 | 9,408 → 108,939 | 852 → 8,537 | 10.4 → 7.7 | 10.4 → 22.0 |
| LG | 10 → 5 | 6/10 → 5/5 | 138.1 → 198.8 | 0 → 0 | 2.00 → 15.00 | 9,406 → 109,008 | 6,898 → 10,621 | 49.4 → 6.4 | 51.8 → 36.7 |
| S7 | 3 → 3 | 3/3 → 3/3 | 13.7 → 13.7 | 0 → 0 | 2.00 → 2.00 | 2,640 → 2,578 | 699 → 543 | 11.2 → 8.8 | 11.7 → 8.8 |
| SF | 3 → 3 | 3/3 → 3/3 | 13.0 → 17.0 | 0 → 0 | 2.00 → 2.00 | 2,640 → 2,578 | 804 → 769 | 7.6 → 9.0 | 7.6 → 9.0 |
| SG | 3 → 3 | 3/3 → 3/3 | 29.3 → 28.0 | 0 → 0 | 2.00 → 2.00 | 2,638 → 2,577 | 985 → 961 | 9.3 → 11.3 | 9.3 → 11.3 |

| Case | Runs | Correct | Calls | In | Out |
|---|--:|--:|--:|--:|--:|
| Edit set without S7, L7 | 21 → 42 | 20/21 → 40/42 | 2.05 → 2.02 | 2,815 → 2,982 | 125 → 132 |
| S8, L8, N1, S12 | 8 | 8/8 | 2.25 | 3,162 | 86 |
| L10 | 11 → 12 | 7/11 → 10/12 | 2.18 → 2.33 | 3,031 → 3,523 | 115 → 118 |

| XF run | Parts | Calls | In | Out | First | Sec | Blocks changed | Failed parts | Rejected edits |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | 128 | 129 | 469,569 | 79,784 | 6.0 | 150.7 | 1,145 | 0 | 3 |
| 2 | 128 | 129 | 470,977 | 82,174 | 6.2 | 197.8 | 1,125 | 0 | 3 |

- The 9-page policy split into 14 parts, the 1-page sample into 1 and XF (2,545 blocks, 301 headings) into 128. XF exceeds 20,000 tokens, so its calls got the outline.
- German: 198 or 199 of 200 blocks in every run. "Chief Information Security Officer" stayed English every time. In 1 run the heading "Data Protection Officer" also stayed English, and that run rejected one edit.
- The 7 lost placeholders were [ORG_1], in 4 of the 5 L7 runs. Every LF run replaced "ours" in "companies such as ours" with [ORG_1], and 4 of 5 turned "the most common route for attacks" into "a common vector" or "a common means".
- Terms: in every German run, "employees" became "Beschäftigte" in 15 to 32 blocks and "Mitarbeitende" in 9 to 19. Complete single-pass runs in round 10 used "Beschäftigte" in 42 to 44 blocks and another word in at most 3. "Passwort", "Richtlinie" and "Konto" were used throughout in both rounds.
- Timing: in 2 of the 15 9-page runs one part finished 14 s and 54 s after the others. Totals without those two ranged from 17 to 25 s.
- Routing, final wording: no targeted instruction called `transform_document` in 92 runs (the edit set ×2, L10 ×26, and S3, L1 and L9 ×6), and all 30 whole-document runs did. "Change customer to client everywhere" went to `find_text` and `edit_document` in every run: S3 in 2 calls and 2,413 input tokens, L3 in 2 calls and 3,675.
- Earlier wordings: the first sent L1 ("make the passwords section friendlier") through the tool in 3 of 8 runs, at 108,927 input tokens each. The second sent S3 through it in 2 of 2 runs, which missed block 7. The third got L10 to 8/12.
- L10 with the final wording: 23/28 over all runs, with every failure reading only "User Accounts" and changing block 84.
- Edit-set failures: L3 once targeted block 68 instead of 69, the table cell next to it, and S4 once changed block 14 instead of 6. L9 ("edit the appendix") edited the last section in 1 of 8 runs with the final wording.
- The fixed part of a chat request grew by 152 tokens (S10: 1,142 → 1,294).
- XF: run 2 wrote "In stock" into two price cells of the spare-parts table. An earlier pair of XF runs, before the routing wording was final, replaced 12 "piece" cells in that table with "Unit" or a product name in one run.
- Caching: in two direct runs on the policy, the proxy reported 96,768 of about 107,600 part-call input tokens as cached.
- Browser (agent-browser, 9-page policy): parts appeared in 12 steps between 7.9 s and 22.8 s, one undo restored all 200 blocks, redo re-applied them, and Stop after 3 of 14 parts left 22 changed blocks that one undo reverted. After a reload the editor showed the untouched sample and had no undo history. The server kept running after Stop and saved "Edited 199 blocks in 14 sections." to the history.

## 12. Model and thinking-level matrix

Code: the Stop fix, and section calls that get the outline, the instruction and their own blocks only, whatever the document's size (repo hashes matched before and after the matrix). The proxy's chat endpoint drops `reasoning_effort` for gpt-6 models, so a forwarder sent every matrix request to the proxy's Responses endpoint with the model and effort set. Every response reported the effort it ran at: "default" ran at medium on gpt-6-luna and gpt-6-astra and at low on gpt-6.1-sol.

**Correct** for a whole-document run: at least one change; German covers at least 98% of the blocks with text to translate; no placeholder or figure lost; no placeholder or figure that appears nowhere in the original; no heading turned into body text; no failed section; concise text shorter than the original. Against round 11's evaluator, single-word blocks the model left alone ("Phase", "Workshop") no longer count as untranslated, number words count as figures ("three" = "3"), and blocks that grew by more than half are read by hand instead of failing.

### Section calls without the document

gpt-6-luna, default thinking, through the proxy's chat endpoint as in round 11. Cells read with the document (round 11's runs, rescored) → without.

| Case | Runs | Correct | Blocks changed | Placeholders lost | Placeholders added | In | Out | First | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| L7 | 5 → 3 | 1/5 → 3/3 | 123.4 → 114.7 | 7 → 0 | 0 → 0 | 108,981 → 14,817 | 6,798 → 7,309 | 6.3 → 5.4 | 18.4 → 18.1 |
| LF | 5 → 3 | 5/5 → 3/3 | 115.4 → 109.0 | 0 → 0 | 5 → 0 | 108,939 → 14,705 | 8,537 → 8,492 | 7.7 → 8.7 | 22.0 → 22.3 |
| LG | 5 → 3 | 5/5 → 3/3 | 198.8 → 199.0 | 0 → 0 | 0 → 0 | 109,008 → 14,667 | 10,621 → 10,753 | 6.4 → 6.5 | 36.7 → 22.3 |
| S7 | 3 → 2 | 3/3 → 2/2 | 13.7 → 13.0 | 0 → 0 | 0 → 0 | 2,578 → 2,014 | 543 → 566 | 8.8 → 9.3 | 8.8 → 9.3 |
| SF | 3 → 2 | 3/3 → 2/2 | 17.0 → 15.0 | 0 → 0 | 0 → 0 | 2,578 → 2,014 | 769 → 897 | 9.0 → 10.3 | 9.0 → 10.3 |
| SG | 3 → 2 | 3/3 → 2/2 | 28.0 → 29.5 | 0 → 0 | 0 → 0 | 2,577 → 2,012 | 961 → 964 | 11.3 → 10.9 | 11.3 → 10.9 |

- Cost per policy run at gateway prices: L7 $0.0143 → $0.0051, LF $0.0152 → $0.0057, LG $0.0162 → $0.0068.
- German coverage: 99.0 to 99.5% → 99.5% on the policy, 100% on the sample both ways.
- Placeholders added: every LF run with the document turned "companies such as ours" into "companies such as [ORG_1]". The 4 L7 failures with the document each lost [ORG_1] in one or two blocks.
- Meaning drift: with the document, 4 of 5 LF runs weakened "the most common route for attacks" to "a common vector" or similar; without, 0 of 3.
- "Employees" in LG: with the document "Beschäftigte" in 15 to 32 blocks and "Mitarbeitende" in 9 to 19; without, 10 or 11 and 27 or 28. Both versions mixed the two words in every run, and both used "Richtlinie" for "policy" throughout.
- Concise length: L7 kept 75% of the original characters with the document and 81% without.
- LG's 36.7 s with the document includes one 78 s run; the medians are 23.3 and 23.0 s.

### Matrix

Each config ran the edit set twice without S7 and L7 (42 runs, of which S8, S12 and L8 count as questions), S8, L8, N1, S12 and H1 3 times, G1 once, and L7, LF, LG and S7 twice and SF and SG once as whole-document runs: 68 runs, of which 36 edits (S9 and L9 included), 22 questions and 10 whole-document runs. Three instances ran in parallel, each with up to 4 chat runs or 1 whole-document run at a time.

**Unintended**: edit and question runs (58 per config) that changed a block outside the case's scope. **Routing**: a targeted instruction sent to `transform_document`, a whole-document instruction not sent to it, a question answered without `answer_question`, or a tool call on "Hi!". **Cap**: runs that used all 4 chat calls; none ended unresolved. **Calls**, **In**, **Out** and **Reasoning** are averages per request over all 68, from the forwarder's log. **Cost**: per 1,000 requests at gateway list prices ($0.10 / $0.50, $2 / $10 and $10 / $50 per 1M tokens in / out), with reasoning billed as output. **First** and **Policy sec**: seconds to the first visible change, and total seconds, on the 6 policy whole-document runs.

| Config | Correct | Edits | Questions | Whole doc | Unintended | Wrong shown | Routing | Empty | Cap | Calls | In | Out | Reasoning | Cost | Sec | First | Policy sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| gpt-6-luna, none | 63/68 | 34/36 | 22/22 | 7/10 | 1 | 0 | 1 | 0 | 7 | 3.51 | 4,337 | 1,159 | 0 | $1.01 | 9.5 | 5.4 | 33.8 |
| gpt-6-luna, low | 64/68 | 32/36 | 22/22 | 10/10 | 3 | 0 | 0 | 0 | 5 | 3.29 | 4,161 | 910 | 1 | $0.87 | 8.7 | 5.4 | 29.0 |
| gpt-6-luna, medium | 64/68 | 34/36 | 22/22 | 8/10 | 1 | 0 | 0 | 0 | 3 | 3.24 | 4,186 | 919 | 77 | $0.88 | 7.9 | 7.8 | 22.0 |
| gpt-6-luna, high | 66/68 | 34/36 | 22/22 | 10/10 | 1 | 0 | 0 | 0 | 5 | 3.31 | 4,382 | 1,108 | 255 | $0.99 | 8.0 | 7.0 | 25.5 |
| gpt-6-luna, default | 66/68 | 35/36 | 22/22 | 9/10 | 1 | 0 | 0 | 0 | 4 | 3.21 | 3,920 | 931 | 75 | $0.86 | 7.1 | 6.3 | 20.1 |
| gpt-6.1-sol, low | 68/68 | 36/36 | 22/22 | 10/10 | 0 | 0 | 0 | 0 | 0 | 3.29 | 4,334 | 804 | 1 | $16.71 | 10.5 | 10.4 | 37.6 |
| gpt-6.1-sol, default | 68/68 | 36/36 | 22/22 | 10/10 | 0 | 0 | 0 | 0 | 0 | 3.26 | 4,287 | 800 | 1 | $16.58 | 10.4 | 10.0 | 37.9 |
| gpt-6.1-sol, high | 68/68 | 36/36 | 22/22 | 10/10 | 0 | 0 | 0 | 0 | 0 | 3.32 | 4,368 | 1,001 | 176 | $18.75 | 13.0 | 12.3 | 46.8 |
| gpt-6-astra, default | 68/68 | 36/36 | 22/22 | 10/10 | 0 | 0 | 0 | 0 | 0 | 3.26 | 4,294 | 808 | 0 | $83.31 | 14.3 | 12.7 | 58.2 |

- Failures. gpt-6-luna, none: L3 (edited block 68 instead of 69), L9 (sent to `transform_document`, which rewrote 4 blocks), L7 ×2 ([ORG_1] lost in block 23), LG (one section's output didn't parse and its retry ran away, 88.6% coverage). Low: L3, L9 ×2 (rewrote blocks 272 and 273), S9 (rewrote 6 blocks of the sample). Medium: L3, L9, L7 ×2 ([LOCATION_1] to [LOCATION_4] in block 6 and [ORG_1] in block 23). High: L3, L10 (sentence added to block 84). Default: L10 (block 84), L7 ([ORG_1]). gpt-6.1-sol and gpt-6-astra: none.
- Cost per 1,000 requests by kind, edits / questions / whole document: gpt-6-luna $0.33 to $0.46 / $0.38 to $0.43 / $3.72 to $4.36, gpt-6.1-sol $7.33 to $7.79 / $8.57 to $8.82 / $67.44 to $80.05, gpt-6-astra $36.26 / $43.96 / $339.27.
- The runaway gpt-6-luna call at none ran 13 minutes on the proxy and stopped at 128,000 output tokens, long after the app's 60-second timeout. Its tokens and those of one 72-second gpt-6-luna call at low count only for their first 60 seconds. Without that cap, gpt-6-luna at none costs $1.88 per 1,000 requests.
- Not scored: every LG run mixed "Beschäftigte" and "Mitarbeitende", with 2 to 20 blocks of the less common word on gpt-6.1-sol and gpt-6-astra and 5 to 17 on gpt-6-luna. gpt-6-luna left "Chief Information Security Officer" in English in all 10 LG runs; gpt-6.1-sol and gpt-6-astra wrote "Informationssicherheitsbeauftragter" in all 8. LF weakened "the most common route for attacks" in 2 of 10 gpt-6-luna runs (low, high) and in none of 8 on the other models. L2 dropped that sentence in all 18 runs. L7 kept 75 to 83% of the original characters on gpt-6-luna and 81 to 83% on the others.
- Two LF runs on gpt-6.1-sol were flagged for a table cell that grew by more than half ("Access on a need-to-know basis; encrypt when sent externally; lock away printouts"). Read by hand, both are faithful formal versions and count as correct.
- Infrastructure: 11 calls hit the proxy's rate limit in the first two minutes, while three edit phases overlapped, and the app's retries recovered all of them. One gpt-6.1-sol call at low failed on the backend ("response.failed"), so L10 showed "The model request failed"; that run was repeated. The Responses endpoint reported almost no cached input (under 200 tokens per request on average), so the costs carry no cache discount.
- Stop (agent-browser, LG on the policy, gpt-6-luna through a logging forwarder): Stop after 4 of 14 parts closed the 6 open section calls as it was clicked, and no call started in the next 45 s, so the run made 11 calls instead of 15. The history saved "Stopped after 4 of 14 sections." with 49 edited blocks, the number the editor showed, and token totals of 0. In round 11 the same test saved "Edited 199 blocks in 14 sections." A follow-up "Hi!" got "Hi! The document is being translated into German."

## 13. Table cells on their own lines, and a check on edit targets

Code: a `find_text` hit in a table cell lists the header row and the cell's row with one cell per line, each written like any other block (`[69] (table cell r4c2) …`). `edit_document` rejects the whole call when a `replace_text` text isn't in its block (the browser's forgiving matcher) or an operation targets a block that doesn't exist, and names up to three blocks that hold the text, nearest first.
gpt-6-luna, default thinking, through the proxy's chat endpoint. Before is the round 12 code, L3 and L10 10 times each. After ran L3 and L10 10 times each, S3 3 times and the edit set once. **Check only** put back the one-line rows, kept the new check and ran L3 10 times. **Rejected**: runs with a rejected edit. **Recovered**: of those, runs that then sent an accepted edit.

| Case | Runs | Correct | Rejected | Recovered | Calls | In | Out | Sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| L3 before | 10 | 5/10 | 0 | - | 2.00 | 3,676 | 271 | 11.7 |
| L3 after | 10 | 10/10 | 0 | - | 2.00 | 3,738 | 268 | 7.2 |
| L3 check only | 10 | 10/10 | 3 | 3 | 2.40 | 4,823 | 348 | 9.7 |
| L10 before | 10 | 9/10 | 0 | - | 2.00 | 3,033 | 113 | 4.8 |
| L10 after | 10 | 9/10 | 0 | - | 2.10 | 3,264 | 93 | 5.2 |
| S3 after | 3 | 3/3 | 0 | - | 2.00 | 2,414 | 113 | 4.5 |
| Edit set after | 23 | 22/23 | 0 | - | 1.96 | 3,482 | 482 | 7.3 |

- L3 before: 4 runs sent "customers" to block 68 instead of 69 and 1 left block 69 out. Every edit was accepted.
- L3 check only: the 3 rejections named block 68 ("customers" twice, "or its customers" once). 2 runs resent a full edit in call 3; 1 searched again and resent in call 4, the last allowed call. Rejected runs used 6,292, 6,334 and 9,882 input tokens.
- L10: the failure was the same both times, reading only "User Accounts" and changing block 84. Block 221 wasn't changed in any run. Two-call search runs went from 3,047–3,053 to 3,110–3,147 input tokens; L10 after includes one 3-call run (4,821).
- Edit-set failure: S9 renamed the title in block 1 to "Appendix: …". L2 used all 4 calls and still edited.
- Not scored: blocks 3, 78 and 260 contain "customer" twice, and all 31 L3 runs in this round left it in at least one of them. S2 emptied all 14 filled cells of the pricing table and put the total in the paragraph above; the scope check passes it.

## 14. Responses endpoint with medium effort and verbosity

Code: the proxy path uses `@ai-sdk/openai`'s Responses model instead of `@ai-sdk/openai-compatible`'s chat model, so the app calls the proxy's `/v1/responses`. Every call, the chat call and each part call, sends medium effort, medium verbosity, `store: false`, the chat session ID as the prompt cache key and parallel tool calls on. Part calls get the edit schema as an enforced format (strict `json_schema`), and the JSON shape spelled out in the part prompt is gone.
gpt-6-luna through the proxy. Two passes of the round 12 matrix set ran side by side (68 runs each: 36 edits, 22 questions, 10 whole-document runs), each with a logging forwarder between app and proxy that passed requests through unchanged. Before is round 12's gpt-6-luna medium and default configs, which both ran at medium effort and at the proxy's low verbosity, and before round 13's table-cell fix. Columns as in round 12; **Cached** is cached input tokens per request.

| Config | Correct | Edits | Questions | Whole doc | Cap | Calls | In | Cached | Out | Reasoning | Cost | Sec | First | Policy sec |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Round 12, medium | 64/68 | 34/36 | 22/22 | 8/10 | 3 | 3.24 | 4,186 | 0 | 919 | 77 | $0.88 | 7.9 | 7.8 | 22.0 |
| Round 12, default | 66/68 | 35/36 | 22/22 | 9/10 | 4 | 3.21 | 3,920 | 0 | 931 | 75 | $0.86 | 7.1 | 6.3 | 20.1 |
| Round 14, pass 1 | 67/68 | 35/36 | 22/22 | 10/10 | 4 | 3.16 | 4,170 | 26 | 945 | 57 | $0.89 | 7.1 | 6.9 | 20.9 |
| Round 14, pass 2 | 68/68 | 36/36 | 22/22 | 10/10 | 6 | 3.22 | 4,207 | 0 | 945 | 64 | $0.89 | 6.7 | 6.5 | 20.0 |

| Call | Round 12 (medium and default) | Round 14 |
|---|--:|--:|
| Chat call: in / out / reasoning | 1,466 / 54 / 4 | 1,473 / 54 / 3 |
| Part call: in / out / reasoning | 949 / 634 / 53 | 1,077 / 651 / 42 |
| Policy whole-document run: in / out | 14,677–14,719 / 7,059–10,801 | 16,447–16,529 / 7,521–10,766 |

- Failures: pass 1 L10 (read only "User Accounts" and changed block 84). Pass 2: none. Round 12 medium failed L3, L9 and L7 ×2, default L10 and L7. S9 and L9 asked which part to edit in all 8 runs, and no targeted run went to `transform_document`.
- Edit cases against round 13 (the 21 cases without S7 and L7): round 13 got 20/21 in 2.05 calls, 3,010 in, 144 out and 6.7 s; round 14 got 83/84 in 1.98 calls, 2,991 in, 125 out and 5.4 s. L3 was 4/4, L10 3/4.
- Part outputs: all 176 part calls returned JSON that matched the schema without the shape in the prompt, with no failed or retried part. The schema now goes with every part call and costs about 190 input tokens (a minimal request measured 15 tokens without it and 203 with it), so a part call grew by 128 tokens even with the prompt's copy gone.
- Verbosity: every response reported medium. L7 kept 78 to 84% of the original characters (round 12 matrix: 75 to 81%) with 7,302 to 7,821 output tokens (6,957 to 7,254), and lost no placeholder in 4 runs (round 12: 3 of 4 lost some). L2 still dropped "Email is the most common route for attacks" in all 4 runs. LF kept it in all 4.
- Reasoning: 17 of 258 chat calls sent earlier reasoning back as encrypted items, and the proxy accepted all of them.
- Caching: 1 of 434 calls reported cached input, 1,792 of 2,012 tokens on a question's second call. The proxy answered `parallel_tool_calls: false` on every call, and no call returned two tool calls. Output limits weren't sent.
- Cap: 10 runs used all 4 calls, 8 of them S8 or L8 questions; all ended with a verified answer or an edit.
- Second turns: 3 three-turn chats on the policy (30 days, customer to client, password length) answered every turn. In one, the first turn's reasoning (1,740 characters, encrypted) belonged to a `read_section` call that later turns drop from the history; it was sent back in turns 2 and 3 and accepted.
- Failures injected at the forwarder: a stream cut after 1,500 bytes and an HTTP 500 both ended in the chat's "The model request failed" line, after 9.5 s and 6.1 s including the SDK's two retries. With the proxy down the line came after 7.8 s.
- Not scored: LG covered 199 of 200 blocks in all 4 runs and left "Chief Information Security Officer" in English. "Employees" became "Beschäftigte" in 12 to 24 blocks, "Mitarbeitende" in 17 to 27 and "Mitarbeiter" in 4 to 11. Blocks 3, 78 and 260 kept a second "customer" in every L3 run.
- Browser (agent-browser, dev server, 9-page policy, one chat): the five-minutes edit changed block 162 after 5.2 s. The password question showed a verified answer quoting "16 characters". "More formal" showed its first change at 6.7 s, streamed "Editing sections: n of 14", and finished at 17.7 s with "Edited 112 blocks in 14 sections."; one undo restored all 112 blocks and kept the earlier edit. "Translate the document to German" was stopped after 4 of 14 parts: 49 blocks stayed changed, nothing changed in the next 30 s, the chat said "Stopped after 4 of 14 sections.", and one undo restored them. A following "Hi!" got a plain greeting, and a reload restored all 10 messages. The stopped reply again saved no token usage; the others did.

## 15. Eval suite baseline

Code: the app behaves as in round 14. Two seams let the evals run it in-process: `streamChatTurn` in `services/chat.ts` runs one chat turn without MongoDB, and `streamChatReply` now wraps it; `components/editor/editor-extensions.ts` holds the editor's extension list, which the evals' headless editor uses too. The harness is now `evals/` (see `evals/README.md`) instead of scratch scripts: each trial runs the real chat turn against a headless Tiptap editor, applies the stream with `apply-edits.ts` and grades the document the browser would show.
All models through the proxy at medium effort; judge gpt-6.1-sol at medium effort. gpt-6-luna ran the full suite: 129 cases on 24 documents, 3 trials per case, 10 for L3, L9, L10 and S9, 5 for S12 and 1 for XF (415 trials). The other models ran every case once, without XF (128 trials). gpt-6.1-sol judged its own run.

**Pass**: every code check passed and no judge said fail. **Code only**: the same trials graded by code checks alone, which is what the fast suite reports. **±**: 95% interval clustered by document. **Unintended**: trials that changed a block outside the case's scope, out of the trials with that check (all but whole-document rewrites). **Calls**, **In**, **Cached**, **Out**, **Reasoning**: averages per request over all model calls, part calls included. **Cost**: per 1,000 requests at list prices ($0.10 / $0.50, $2 / $10 and $0.20 / $1.20 per 1M tokens in / out), reasoning billed as output, no cache discount; the config has no price for gpt-5.6-terra and gpt-5.6-sol. **Sec** and **First**: seconds per request and to the first change in the editor.

| Model | Trials | Pass | Code only | Cases, every trial passed | Unintended | Errors | Calls | In | Cached | Out | Reasoning | Cost | Sec | First |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| gpt-6-luna | 415 | 70.8% ±8.6 | 84.8% ±7.7 | 85/129 | 17/336 | 0 | 3.63 | 5,839 | 540 | 1,240 | 80 | $1.20 | 8.2 | 6.6 |
| gpt-6-luna, without XF | 414 | 71.0% ±8.6 | 85.0% ±7.7 | 85/128 | 17/336 | 0 | 3.33 | 4,677 | 24 | 1,042 | 69 | $0.99 | 7.9 | 6.6 |
| gpt-6.1-sol | 128 | 85.2% ±7.3 | 94.5% ±4.4 | 109/128 | 2/102 | 0 | 3.44 | 4,918 | 8 | 1,044 | 10 | $20.27 | 12.5 | 9.9 |
| gpt-5.6-luna | 128 | 72.7% ±7.1 | 87.5% ±7.0 | 93/128 | 6/102 | 0 | 3.35 | 4,613 | 0 | 1,460 | 371 | $2.67 | 10.3 | 7.9 |
| gpt-5.6-terra | 128 | 71.9% ±7.8 | 87.5% ±6.5 | 92/128 | 4/102 | 0 | 3.45 | 4,952 | 22 | 1,128 | 161 | n/a | 15.9 | 11.2 |
| gpt-5.6-sol | 128 | 77.3% ±8.1 | 91.4% ±5.3 | 99/128 | 4/102 | 0 | 3.31 | 4,638 | 108 | 1,403 | 421 | n/a | 13.3 | 10.2 |

Passed trials by kind, with code only in brackets:

| Kind | Cases | gpt-6-luna | gpt-6.1-sol | gpt-5.6-luna | gpt-5.6-terra | gpt-5.6-sol |
|---|--:|--:|--:|--:|--:|--:|
| Targeted edit | 22 | 64/73 (64) | 22/22 (22) | 20/22 (20) | 19/22 (19) | 20/22 (20) |
| Everywhere edit | 16 | 35/55 (35) | 16/16 (16) | 12/16 (12) | 14/16 (14) | 16/16 (16) |
| Highlight edit | 14 | 41/42 (41) | 14/14 (14) | 14/14 (14) | 14/14 (14) | 14/14 (14) |
| Question | 23 | 68/71 (68) | 23/23 (23) | 22/23 (23) | 22/23 (22) | 22/23 (23) |
| Not in the document | 13 | 39/39 (39) | 13/13 (13) | 13/13 (13) | 13/13 (13) | 13/13 (13) |
| Missing part | 9 | 27/41 (27) | 7/9 (7) | 3/9 (3) | 4/9 (4) | 3/9 (3) |
| Small talk | 1 | 3/3 (3) | 1/1 (1) | 1/1 (1) | 1/1 (1) | 1/1 (1) |
| Section rewrite | 4 | 3/12 (8) | 2/4 (3) | 2/4 (3) | 1/4 (2) | 3/4 (3) |
| Rewrite: formal | 9 | 3/25 (24) | 5/8 (7) | 2/8 (7) | 0/8 (7) | 2/8 (7) |
| Rewrite: concise | 8 | 1/24 (21) | 2/8 (8) | 1/8 (8) | 1/8 (7) | 1/8 (8) |
| Rewrite: German | 10 | 10/30 (22) | 4/10 (7) | 3/10 (8) | 3/10 (9) | 4/10 (9) |

- Known gaps on gpt-6-luna. Word twice in a paragraph: L3 0/10, every run leaving a second "customer" in block 3 (9 runs), 78 (8) or 260 (7); all 20 failed everywhere trials were a second or third occurrence (L3, 01, 03, 11, 19), against 0 on gpt-6.1-sol and gpt-5.6-sol. The edit for block 69 went to the right cell in all 10 L3 runs. Emptied table: S2 emptied the three Timing cells in 1 of 3 runs, and gpt-5.6-terra wrote "—" into every price cell; both fail now. Missing part: S9 and L9 asked which part to edit in 20 of 20 runs, but the seven new missing-part cases passed 7 of 21. 10 runs edited the nearest paragraph instead (the closing paragraph, the scope paragraph, the confidentiality clause), 1 used all 4 calls without a reply, and "shorten the cover letter" went to `transform_document` in 3 of 3 runs, which shortened 61 to 88 blocks of the whole proposal. 30 days: L10 9/10, the miss again adding a sentence to block 84. German: every run translated every English block, but LG mixed the words for "employees" in 3 of 3 and 19-rewrite mixed "Dienstreise" and "Geschäftsreise" in 3 of 3. Phishing shorter: L2 dropped "most common" in 3 of 3 and on every other model. Formal: LF kept "most common" and added no placeholder in 3 of 3; gpt-5.6-luna turned "ours" into [ORG_1] and gpt-5.6-terra dropped "most common". Concise: L7 kept every placeholder and heading at 80 to 84% of the length. Made-up answers: S12 5/5, N1 3/3, and all 39 not-in-document trials passed. Text before the first heading: PG translated the draft note in 3 of 3. Heading edit: L11 3/3. Highlight: S10 and L12 3/3 each.
- XF (64 pages, luna only): no figure lost and no text in a price cell; it added [ORG_1] where three paragraphs of the quarterly report said "us" or "we". 129 calls, 487,105 in (214,016 cached), 83,131 out, first change 5.9 s, 153 s in total.
- Other luna failures: a figure that depends on the edit wasn't updated in 04-edit (3/3), 11-edit (3/3) and 14-edit (1/3); 17-question wrote the answer into the document in 3 of 3 runs instead of answering; 05-edit reworded the whole sentence once instead of changing the amount; 02-highlight asked once what "make this in writing" meant.
- Judges on luna: meaning failed 53 of 60 rewrite trials. In about 40 it quotes a change a reader would act on, such as "immediately" becoming "without undue delay" in the data processing agreement, "in agreement with the buyer" becoming "in consultation with the buyer", or "should use the report button" becoming "must use". About 13 are borderline, such as "some always get through" becoming "some may still get through". In 2 S2 runs it calls "fixed fee" new, although the Services section, which it doesn't see, says the price is fixed. Translation failed 20 of 30 German runs, mostly for key terms translated two ways and a few real errors ("Rückstellungen" for a contingency reserve, "Vorabend" for 01:30, a jointing cutter for a flush-trimming cutter). Concision failed 0 of 30 after the review (6 before), tone 1 of 30, answer 3 of 110 (the 17-question runs). On the code checks alone, luna's whole-document rewrites passed 67 of 79.
- Judge consistency: a second judge pass over the same luna transcripts gave the same answer, tone and translation verdict in 168 of 170 cases. The meaning and concision wording changed between the two passes (meaning fails only for a change a reader would act on; concision allows compact lead-in lines), which turned 5 meaning and 7 concision fails into passes and 1 concision pass into a fail. The luna numbers above use the second pass; the other models ran with the final wording.
- Checks fixed after reading transcripts: a "not stated" answer may quote the related sentence it checked; figures accept clock times in 12- or 24-hour form, German compounds such as "zweitägig", "both" for two, and a count dropped from a line that introduces a list; "2%" equals "2 percent"; 09-missing-part accepts a question about which revision details to add. Every run was then re-graded from its saved transcripts.
- Infrastructure: no error and no retry in 927 trials. Run times: 18 minutes for the luna suite at 5 trials at once, 6 to 8 minutes for each one-trial run at 6 at once. The proxy reported 10% of its quota used before the runs and 18% after.

Review of the suite, after the baseline. A second agent checked every case against its document, the checks, the judges, the reports and the two app seams. The numbers above are the re-graded ones; no model run was repeated, because no instruction or document changed.

- Cases: all 129 expected outcomes were read against their documents. Every expected text differs from the original only in the words the instruction names, every snippet, figure and placeholder exists, every "gone" word sits only in blocks the case lists, and every missing part is really missing. One case was wrong: S3, "change customer to client everywhere", required "customer service" to become "client service", but that is the name of a department at the client, so leaving it is also right. S3 now accepts both. The loader now allows a block's original text as one alternative, which is how a case says a block may change or stay.
- Kept as they were: 01-edit, 04-edit, 09-edit, 11-edit, 14-edit and 12-edit also expect a second figure to change. Each time the old figure would contradict the new one: a table total, "remaining 22" next to "220 of 236", a project length of "14 months" after the last phase moved to month 15, or the same count stated twice. The app's prompt tells the model to change a fact wherever it appears, so these stay strict. L2 keeps requiring "most common", the gap earlier rounds recorded.
- Meaning judge: it saw only the changed blocks, required every fact to stay "in its block", allowed dropping "hedges" while forbidding weaker wording, and its examples were copied from the test cases ("the most common route for attacks", "without undue delay"). It now sees every block in scope, lets a fact move to another block, treats words such as should, may, most and always as meaning, and uses neutral examples. Asked again, it changed none of luna's 60 verdicts and 9 of 80 on the other models (7 to pass, 2 to fail). Its fails are mostly real.
- Concision judge: it failed S7 for a single clipped phrase such as "Legal basis:". A single clipped phrase or a dropped article no longer fails; 8 concision fails became passes.
- Checks: terms-consistent matched any word starting with a term, so "Mitarbeiterzeitung" or "IT-Mitarbeiter" counted as "Mitarbeiter". It now counts the word and its German endings only. never-said also searched the quotes, which are copied from the document, so a correct answer quoting a sentence with "480" would have failed. It now reads the answer only. Neither change flipped a baseline trial.
- Reports: the paired difference in `yarn evals compare` used a plain standard error over cases. It is now clustered by document, like the pass rate.
- Judge noise: asked again with an unchanged prompt, the answer judge failed one gpt-5.6-sol answer that had passed (it added that the contract states no distance in kilometers or miles), and the translation judge flipped one 01-rewrite and two PG runs.
- Seams: `streamChatReply` builds the same model settings, tools, stop conditions, messages and save callback as before, now through `streamChatTurn`, and the editor uses the same extension list from its new file. `server-only` is mapped to an empty module only in `evals/tsconfig.json`, which only `yarn evals` uses.
- The proxy reported 18% of its quota used before the review's judge calls and 22% after.

## 16. Repeated words and missing parts

Code: `edit_document` applies each block's `replace_text` edits to the block's text in order, with the editor's matcher, and rejects the whole call when a find text is still in the block afterwards ("Not applied. "customer" appears 2 times in block 260, you sent 1 edit. Send one edit per occurrence, or add surrounding words if only some should change. Send all changes again in one edit_document call."). The system prompt has one new line: when the instruction names a part the document doesn't have, change nothing, say the part isn't there and ask what to change. The step limit stays at 4.
gpt-6-luna at medium effort through the proxy, judge gpt-6.1-sol at medium effort. The full suite ran as in round 15: 129 cases on 24 documents, 3 trials per case, 10 for L3, L9, L10 and S9, 5 for S12 and 1 for XF (415 trials). Before is round 15's re-graded luna run. Also run: L3 alone, 10 trials, fast suite; and 01-question, 01-not-stated and 08-edit, 10 trials each, full suite. Columns as in round 15.

| Run | Trials | Pass | Code only | Cases, every trial passed | Unintended | Errors | Calls | In | Cached | Out | Reasoning | Cost | Sec | First |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Before | 415 | 70.8% ±8.6 | 84.8% ±7.7 | 85/129 | 17/336 | 0 | 3.63 | 5,839 | 540 | 1,240 | 80 | $1.20 | 8.2 | 6.6 |
| After | 415 | 72.8% ±7.3 | 86.7% ±6.0 | 83/129 | 9/336 | 0 | 3.48 | 5,724 | 557 | 1,208 | 74 | $1.18 | 8.3 | 6.5 |

Paired by case, the pass rate rose by 1.9 ±3.4 points (95%, clustered by document), which is within noise.

Passed trials by kind, with code only in brackets:

| Kind | Before | After |
|---|--:|--:|
| Edit (targeted, everywhere, highlight) | 140/170 (140) | 143/170 (143) |
| Question | 68/71 (68) | 66/71 (66) |
| Not in the document | 39/39 (39) | 37/39 (38) |
| Missing part | 27/41 (27) | 35/41 (35) |
| Small talk | 3/3 (3) | 3/3 (3) |
| Section rewrite | 3/12 (8) | 3/12 (6) |
| Whole-document rewrite | 14/79 (67) | 15/79 (69) |

- Repeated words: the check fired in 13 full-suite trials (01-everywhere 2, 03-everywhere 3, L3 6, 11-everywhere 2) and in 9 of 10 runs of the L3-only run. Every rejected call was followed by an accepted edit: 19 of 22 in 3 model calls, 3 in 4 (they searched again first). None ran out of calls. L3 went from 0/10 to 1/10, and 2/10 in the L3-only run. Block 260 was right in all 20 runs; blocks 3 and 78 kept "customer contracts" or "the customer contract", because the model's find text was the plural "customers", which occurs once in each. 11-everywhere 1/3 to 3/3, 01-everywhere 1/3 to 2/3, 19-everywhere 0/3 to 1/3, 03-everywhere 0/3 to 0/3 (the lowercase "main agreement" in block 4 stayed).
- Missing parts: 02 0/3 to 2/3, 05 0/3 to 1/3, 09 3/3 to 3/3, 11 0/3 to 2/3, 14 0/3 to 1/3, 17 3/3 to 3/3, 19 1/3 to 3/3, so 7/21 to 15/21. S9 and L9 stayed at 10/10 each. "Shorten the cover letter" no longer went to `transform_document` (3 of 3 before). Failures: 4 edits to a nearby paragraph (05 #3, 11 #3, 14 #2, 14 #3) and 2 runs that read and searched for all 4 calls without a reply (02 #1, 05 #1).
- Parts named loosely: S1 3/3, S11 3/3, L6 3/3, L11 3/3. S2, L1 and L2 edited inside their sections in every run and failed on the judges, as in round 15. S2 lost figures or table cells in 3 of 3 runs (1 of 3 before); the case fails on the meaning judge either way.
- Worse cases: 01-question 3/3 to 2/3 (answered "around 280 employees" in plain text), 01-not-stated 3/3 to 2/3 (plain-text "The document does not name a specific service manager"), 05-edit 2/3 to 1/3 (reworded the whole sentence, as in round 15's failure), 06-not-stated 3/3 to 2/3 (the answer added a made-up EUR 4.0 million), 08-edit 3/3 to 1/3 (also changed the review dates in blocks 301 or 303), 12-question 3/3 to 2/3 (two section reads, a rejected answer and a search used all 4 calls), 15-question 3/3 to 2/3 (said the pilot size isn't stated). Rerun 10 times each: 08-edit 10/10, 01-question 10/10, 01-not-stated 9/10, the miss again a plain-text reply. The plain-text replies (3 of 130 question runs, 0 of 110 before) may come from the new prompt line. The others match failures seen before or have no link to either change.
- Unit tests: 5 new tests in `tests/services/document-edit.test.ts` (one edit for two occurrences rejected with the message above; two edits pass and change both; a find text that occurs once passes; surrounding words that make it occur once pass; different find texts that together cover every occurrence pass). `yarn format`, `yarn lint`, `yarn tsc --noEmit` and `yarn test` (155 tests) pass.
- Browser (agent-browser, dev server, sample offer, new chat): "change customer to client everywhere" changed both "the customer" sentences and "customer service" to "client service", which S3 accepts, and nothing else. "Shorten the appendix" read one section, changed nothing and replied "There's no appendix in the document. What would you like me to shorten instead?"
- Infrastructure: no error and no retry. The full suite took 22 minutes. The proxy reported 22% of its quota used before the runs and 23% after.

## 17. Keeping how strong a statement is

Code: one new line in the part prompt of `transform_document` (`SECTION_INSTRUCTIONS` in `services/document-transform.ts`). Section rewrites such as L1, L2, S1 and S2 go through `read_section` and `edit_document` (12 of 12 runs in round 16, 47 of 48 in this round), not through the part calls, so the chat's system prompt in `services/chat.ts` has the same rule as one line, starting "When you rewrite text, keep how strong…". The final line: "Keep how strong each statement is: don't turn should into must or into a command, or a definite statement into one with can, may or helps, or any of these the other way round, and keep every word that limits or qualifies a statement, such as only, exclusively, most, always or without delay." Nothing else changed.

gpt-6-luna at medium effort through the proxy, judge gpt-6.1-sol at medium effort, 5 trials at once. Before is round 16's run. Each wording ran once on the 31 rewrite cases (27 whole-document, 4 section), full suite, 3 trials per case and 1 for XF (91 trials). The kept wording then ran the full suite as in round 16 (415 trials). The nine missing-part cases ran once more (41 trials), to check a drop.

Wordings on the rewrite cases. **English** and **German**: passed trials of the English rewrites and of the translations. **Meaning** and **Translation**: trials failed by that judge.

| Run | Wording | Passed | Whole-document | Section | English | German | Meaning | Translation |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| Round 16 | none | 18/91 | 15/79 | 3/12 | 7/61 | 11/30 | 53 | 19 |
| 1 | should into must or back, a recommendation or option into an instruction, limiting words | 30/91 | 25/79 | 5/12 | 18/61 | 12/30 | 41 | 18 |
| 2 (kept) | 1, with "a definite statement into one with can, may or helps" | 30/91 | 22/79 | 8/12 | 20/61 | 10/30 | 36 | 19 |
| 3 | 2, with words that narrow "whom, what or when it applies to" | 26/91 | 22/79 | 4/12 | 17/61 | 9/30 | 42 | 21 |
| Full suite | 2 | 28/91 | 23/79 | 5/12 | 19/61 | 9/30 | 38 | 21 |

The full suite, columns as in round 15:

| Run | Trials | Pass | Code only | Cases, every trial passed | Unintended | Errors | Calls | In | Cached | Out | Reasoning | Cost | Sec | First |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Before | 415 | 72.8% ±7.3 | 86.7% ±6.0 | 83/129 | 9/336 | 0 | 3.48 | 5,724 | 557 | 1,208 | 74 | $1.18 | 8.3 | 6.5 |
| After | 415 | 74.5% ±7.6 | 86.7% ±6.8 | 80/129 | 13/336 | 0 | 3.57 | 6,159 | 856 | 1,213 | 112 | $1.22 | 5.6 | 4.3 |

Paired by case, the pass rate rose by 1.8 ±3.8 points (95%, clustered by document), which is within noise.

Passed trials by kind, with code only in brackets:

| Kind | Before | After |
|---|--:|--:|
| Edit (targeted, everywhere, highlight) | 143/170 (143) | 144/170 (144) |
| Question | 66/71 (66) | 65/71 (65) |
| Not in the document | 37/39 (38) | 37/39 (37) |
| Missing part | 35/41 (35) | 32/41 (32) |
| Small talk | 3/3 (3) | 3/3 (3) |
| Section rewrite | 3/12 (6) | 5/12 (9) |
| Whole-document rewrite | 15/79 (69) | 23/79 (70) |

- Named slips, in the four runs with a rule against round 16: "without delay" became "without undue delay" in 0 of 12 runs (3 of 3), "should use the report button" became "must use" in 0 of 12 (3 of 3), "exclusively" was dropped in 0 of 12 (3 of 3) and "strongly recommended" lost "strongly" in 0 of 12 (3 of 3). Still there: "The sensor should be installed" became "Install the sensor" in 12 of 12, "are added on request" became "can be added" in 10 of 12, "This prevents incorrect orders" became "helps prevent" in 10 of 12, and "the entire foundry stops with it" became "is affected" in 9 of 12.
- Better rewrite cases: 03-rewrite 0/3 to 2/3, 09-rewrite 0/3 to 2/3, 11-rewrite 0/3 to 3/3, L1, LF, 13-rewrite and S2 0/3 to 1/3, S7 1/3 to 2/3.
- Worse cases: missing part 35/41 to 32/41, and 33/41 in the rerun. The failures are the kinds round 16 saw: 6 edits to a nearby paragraph and 3 runs without a reply. The seven cases other than S9 and L9 passed 12 and 13 of 21, against 15 in round 16. That is within noise, but worth watching. L2 edited the paragraph on simulated phishing emails, outside the phishing part, in 2 of 3 runs (0 in round 16). Single trials also moved in L10, 10-rewrite, PG, 11-question, 12-question, 14-edit, 16-not-stated, 17-question, 19-everywhere, 20-edit and 20-everywhere, each by one run, with failures seen before. One L1 run called `transform_document` for the passwords section; its part calls changed only the two password paragraphs, and it passed.
- In the XF run, the chat model added "Preserve the existing meaning, factual details, qualifications, and level of obligation" to the instruction it passed to `transform_document`.
- Unit tests: none assert the prompt text, so none changed. `yarn format`, `yarn lint`, `yarn tsc --noEmit` and `yarn test` (155 tests) pass.
- Infrastructure: no error, and 1 trial retried once. Each rewrite run took about 8 minutes and the full suite 12.5 minutes. The proxy reported 40% of its quota used after the first rewrite run and 43% at the end.

What stands between 74.5% and 90%. 90% is 374 of 415 trials, 65 more than now. The 106 failed trials, by cause:

| Cause | Failed trials | Unfair or borderline verdicts | Example: expected → what the model wrote |
|---|--:|--:|---|
| Rewrite changes the meaning (meaning judge) | 38 | 7 | spec, "more concise": "The sensor should be installed as close as possible to the bearing" → "Install the sensor as close as possible to the bearing" |
| German translation (translation judge, terms-consistent) | 21 | 1 | onboarding handbook: "Bitte lesen Sie es vor Ihrem ersten Arbeitstag" in one part, "Vor deinem ersten Arbeitstag …" in another; each part is translated in its own call, so terms and Sie/du drift |
| Everywhere edit leaves a word | 14 | 0 | L3: "our customers entrust" → "our clients entrust", but "our customer contracts" stayed in the same paragraph |
| A second figure isn't updated | 10 | 0 | 04-edit: "220 of 236 test cases were completed" is right, but "The remaining 22 cases" stayed (expected 16) |
| Missing part edited anyway or no reply | 9 | 0 | "add an entry for transaction log to the glossary": the heading "Approval" → "Glossary" and the approval paragraph → a glossary entry |
| Question not answered or answer wrong | 6 | 0 | "how deep do we have to drill the hole for screw mounting?": "The document does not specify how deep …", although it says "at least 12 mm deep" |
| Section rewrite edits outside the section | 2 | 0 | L2: shortened "The information security team regularly sends simulated phishing emails …", outside the phishing part, and left the part unchanged |
| L10 edits the wrong paragraph | 2 | 0 | "accounts that have not been used for 60 days" stayed; a sentence about leavers changed instead |
| "Not stated" answer in plain text | 2 | 2 | "The document doesn't state how long the warranty on spare parts lasts." Right, but not a checked answer |
| Placeholder or figure check on a rewrite | 2 | 2 | XF: "year 1" → "first year" counts as a lost figure; "our … customers" → "[ORG_1]'s … customers" (a known limit of placeholders-kept) |

- The 7 meaning verdicts that look borderline: "the growing importance of energy-efficient appliances" → "growing demand" (06-rewrite, 3 runs), "for all colleagues" → "for colleagues" in the newsletter's opening line (13-rewrite), "Purchases between companies of the group" → "group-company purchases" (18-rewrite), "We propose the following schedule" → "Schedule and net pricing:" in an offer (S2), and "Written summary with recommended next steps" → "Written summary of recommended next steps" (S7). The other 31 change something a reader would act on, such as "Privileged sessions on critical servers are recorded" → "Sessions on critical servers are recorded".
- The borderline translation verdict is 01-rewrite #3, which failed for "Monitoring" in one block and "Überwachung" in another for the same service.
- Counting all 12 borderline trials as passes would give 321 of 415, 77.3%. Reaching 90% needs most of the 51 real rewrite failures fixed, and those come from writing each part separately (German terms) and from concise and formal rewrites that still change what a sentence requires.

## 18. A meaning check after each rewritten part

Code: one new step in `services/document-transform.ts`. After a part of `transform_document` is rewritten, one more call with the same model and settings gets the instruction, the part's original blocks and its rewritten blocks. It returns the whole corrected text of each block whose meaning changed, or an empty list, through structured output. The corrections replace the part's changes for those blocks before they stream. A correction for a block the rewrite didn't change, or one that breaks a heading, is ignored. If the call fails or takes more than 30 seconds, the part keeps its rewrite. A part with no changes skips the call. The call's tokens go into the same usage list as the part calls. Section rewrites go through `edit_document`, so they don't get the check. Nothing else changed.

gpt-6-luna at medium effort through the proxy, judge gpt-6.1-sol at medium effort, 4 trials at once. Only the 26 whole-document rewrite cases ran, without the 64-page XF. One run at 1 trial per case while trying the change, then one at 3 trials per case. Before is the same 26 cases from round 17's full run (78 trials). Columns as in round 15; **Meaning** and **Translation** are trials failed by that judge; **Tokens** is input plus output per rewrite.

| Run | Trials | Pass | Code only | English | German | Meaning | Translation | Tone | Calls | In | Out | Reasoning | Tokens | Cost | Sec | First |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Before (round 17) | 78 | 23/78, 29.5% ±18.6 | 70/78 | 14/48 | 9/30 | 33 | 21 | 0 | 8.27 | 9,818 | 4,801 | 484 | 14,619 | $3.38 | 12.1 | 6.3 |
| Check, 1 trial | 26 | 10/26, 38.5% ±23.5 | 23/26 | 6/16 | 4/10 | 8 | 4 | 1 | 15.50 | 19,375 | 6,644 | 1,542 | 26,019 | $5.26 | 21.2 | 9.1 |
| Check, 3 trials | 78 | 29/78, 37.2% ±16.3 | 72/78 | 18/48 | 11/30 | 26 | 14 | 3 | 15.54 | 19,413 | 6,563 | 1,518 | 25,976 | $5.22 | 18.9 | 9.0 |

Paired by case, the pass rate rose by 7.7 ±11.8 points (95%, clustered by document), which is within noise.

- Better cases: 06-rewrite 0/3 to 2/3, 13-rewrite 1/3 to 3/3, 12-rewrite, 17-rewrite and 20-rewrite 0/3 to 1/3, and 09-rewrite, 10-rewrite, PG and S7 by one run each.
- Worse cases: SF 3/3 to 0/3, 03-rewrite 2/3 to 1/3, 11-rewrite 3/3 to 2/3. In SF #2 and #3, "The customer wants a workshop for 12 people" stayed unchanged and the tone judge failed both as not formal enough; every round 17 run had rewritten it. In SF #1 it became "requires", which the meaning judge failed. In 03-rewrite #2 and #3, "in text form", a term the agreement defines, became "in writing".
- Named slips: "The sensor should be installed" became "Install the sensor" in 0 of 3 runs (3 of 3 before). In the incoming goods procedure, "the goods receipt staff inform the responsible buyer" became "shall inform" or "must inform" in 0 of 3 (3 of 3). "The entire foundry stops with it" became "is affected" in 1 of 3 (3 of 3).
- Still failing the meaning judge in 3 of 3: 02-rewrite, 05-rewrite, 15-rewrite, 18-rewrite and L7, all "more concise". Examples: in the maintenance contract, "shall first attempt to rectify the fault by remote diagnosis" became "shall first attempt remote diagnosis" (3 of 3), and in the project plan, "At the end of each sprint" became "at each sprint review" (2 of 3).
- Replaying the check: on the final text of the 8 meaning failures from the 1-trial run, with the blocks around each finding, the check flagged the judge's block in 5. A stricter wording that went sentence by sentence flagged more blocks, but not more of the judge's findings. It wasn't tried in a run. The two replays used 16 calls and about 29,000 tokens.
- Unit tests: 5 new tests in `tests/services/document-transform.test.ts` (corrections replace the part's changes; an empty list leaves them as they were; a failed call keeps them; a correction for an unchanged block is ignored; the check's tokens are counted with the part calls). The abort test in `tests/services/chat.test.ts` now answers the check call with an empty list. `yarn format`, `yarn lint`, `yarn tsc --noEmit` and `yarn test` (179 tests) pass.
- Browser (agent-browser, dev server, sample offer, new chat): "make the whole document more concise" finished in about 14 s with "Edited 7 blocks in 1 section." The changes appeared in the editor. Placeholders, the 12 people, the price table and the closing stayed as they were, and the text read correctly.
- Infrastructure: no error and no retry. The 1-trial run took 3.5 minutes and the 3-trial run 9.5 minutes. The proxy reported 44% of its quota used after the first run and 45% at the end.

## 20. A term sheet and a stronger check for whole-document rewrites

Code: see "Whole-document rewrites: a term sheet and a stronger check" in `FINDINGS.md`. In short: a term-sheet call before the parts, a meaning check that sees word-level changes and code hints, a repair call for flagged English blocks, code guards for lost numbers and placeholders, a heading guard that allows twice the length plus 20 characters, and the check and repair on a separate check model.

Only the 26 rewrite-document cases ran, one trial each, judged by gpt-6.1-sol at medium effort as usual. Experiments ran through a scratch harness that calls the eval's own `runCase`, checks and grader, 4 cases at once; the last row is `yarn evals`. **Hard** runs used only the hardest cases. **Meaning**, **Tone**, **Translation**: cases failed by that grader. **Code**: cases failed by a code check. **Tokens**: input plus output per rewrite, gpt-6-luna plus gpt-6.1-sol, from a logging wrapper around both models. **Cost**: per 1,000 rewrites at list prices ($0.10 / $0.50 and $2 / $10 per 1M tokens in / out). **Sec**: per rewrite, with other cases running alongside.

| Run | Change | Check model | Passed | English | German | Meaning | Tone | Translation | Code | Tokens (luna + sol) | Cost | Sec |
|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Round 18 code | none | luna | 9/26 | | | 8 | 0 | 6 | 3 | 25,800 | $5.20 | 19 |
| Effort test A | check at high | luna | 12/26 | | | 6 | 2 | 4 | 2 | 27,300 | $5.90 | 32 |
| Effort test B | rewrite at high, no check | luna | 8/26 | | | 7 | 1 | 4 | 6 | 15,900 | $4.10 | 24 |
| Effort test C | everything on gpt-6.1-sol | sol | 19/26 | | | 0 | 0 | 3 | 4 | 0 + 25,100 | $96 | 40 |
| Round 18 code, hard English | none | luna | 2/8 | 2/8 | | 5 | | | 1 | 35,400 | $7.10 | 30 |
| 1, hard German | term sheet, placeholder guard, label strip, heading allowance, marked changes in the check | luna | 4/6 | | 4/6 | | | 1 | 1 | 46,600 | $8.30 | 40 |
| 1b, hard English | 1, term sheet filtered per part | luna | 1/6 | 1/6 | | 4 | | | 1 | 54,800 | $10.80 | 45 |
| 2, hard English | check returns problems with find-and-replace fixes, code hints, check at high | luna | 2/6 | 2/6 | | 4 | | | | 63,100 | $12.80 | 64 |
| 2 | as above | luna | 14/26 | 8/16 | 6/10 | 7 | 3 | 3 | 1 | 36,700 | $7.70 | 44 |
| 3 | flagged English blocks restored | luna | 14/26 | 7/16 | 7/10 | 2 | 5 | 2 | 4 | 36,300 | $7.60 | 41 |
| 4 | flagged English blocks repaired | luna | 15/26 | 8/16 | 7/10 | 6 | 2 | 3 | 1 | 40,000 | $8.30 | 46 |
| 5 | 4 with check and repair on sol, medium | sol | 18/26 | 10/16 | 8/10 | 3 | 3 | 2 | 0 | 20,000 + 16,200 | $48.60 | 40 |
| 6 | no "change only what the instruction needs", translation checks | luna | 11/26 | 5/16 | 6/10 | 8 | 3 | 2 | 3 | 41,900 | $8.90 | 45 |
| 6s | 6 | sol | 22/26 | 13/16 | 9/10 | 2 | 1 | 1 | 0 | 19,800 + 16,900 | $51.60 | 41 |
| 7s | placeholder changes become hints, number-format line | sol | 19/26 | 11/16 | 8/10 | 4 | 1 | 1 | 1 | 20,400 + 17,700 | $54.10 | 42 |
| 8s | heading allowance 2x + 20, core-noun terms, "keep wording that fits", number note in term sheet | sol | 17/26 | 11/16 | 6/10 | 2 | 1 | 3 | 3 | 20,300 + 17,600 | $53.70 | 45 |
| 9s | lost numbers and placeholders always repaired, number guard, number note removed | sol | 19/26 | 12/16 | 7/10 | 2 | 2 | 2 | 1 | 19,800 + 17,100 | $53.10 | 45 |
| 10s | term sheet lists everyday words first, "keep wording that fits" removed | sol | 21/26 | 13/16 | 8/10 | 3 | 0 | 2 | 0 | 20,100 + 17,400 | $53.20 | 43 |
| Final, `yarn evals` | 10s with a configurable check model | sol | 20/26 | 12/16 | 8/10 | 2 | 2 | 2 | 0 | 21,700 + 17,500 | $55 | 48 |

- Final run failures: 04-rewrite ("EUR 4.8 million" left in English notation), 05-rewrite (the realisation-phase sentence, failed in every run), LF ("require approval" became "may require approval"), 11-rewrite ("our offer is the right fit" left unchanged), 16-rewrite (one technical term translated two ways), SF ("The customer wants a workshop for 12 people" left unchanged).
- The other scenarios in the same `yarn evals` run, against the first run of the suite: change-text 46/52, 88.5% (86.5%); answer-question 35/37, 94.6% (97.3%), both failures without a transform; missing-part 9/9, 100% (77.8%); rewrite-section 2/4, 50% (50%).
- Calls in the final run: two check calls and one part call hit their time limit; the parts kept their unchecked or retried rewrite. The first change showed about 20 s after the request, against about 9 s in round 18.
- Check and repair, run 10s: the check flagged 197 problems in 189 calls, and 72 repair calls rewrote 137 blocks.
- The eval's App tokens line counts only gpt-6-luna (400,699 in and 164,639 out in the final run), because `run-case.ts` records only the app model.
- Eval issues seen, not fixed: `all-translated` read "Servicezeiten: … außer an gesetzlichen Feiertagen in Baden-Württemberg" (run 3) and "[PERSON_4], Leiter/in IT" (run 6) as English; `figures-kept` counted "seventy" → "70" and "one" → "1" as invented figures (run 8s); the translation grader failed unlocalized "EUR 150,000" in run 2 and localized "18.000" in run 6s.
- Unit tests: `tests/services/document-transform.test.ts` now has 13 tests (term sheet per part, change marks and hints, repair, restore on failed repair, failed check, lost number, placeholder, translated fix, label strip, check model, token counts, failed term sheet), and `tests/services/document-edit.test.ts` 2 new heading tests. `yarn format`, `yarn lint`, `yarn tsc --noEmit` and `yarn test` (294 tests) pass.
- Quota: 48% before the first experiment, 56% before `yarn evals`, 57% after it.

## 21. Cheaper check models for whole-document rewrites

Code: unchanged from round 20. Only the check and repair model changed, through `LLM_CHECK_MODEL`. gpt-6-luna still wrote every part. The grader stayed on gpt-6.1-sol at medium effort.

The proxy serves seven text models: gpt-6.1-sol, gpt-6-sol, gpt-6-luna, gpt-6-astra, gpt-5.6-sol, gpt-5.6-terra and gpt-5.6-luna. It refused every older name we tried, such as gpt-5.5, gpt-5-mini, gpt-4.1, gpt-4o, o3 and o4-mini. All four candidates accepted structured output and medium effort. gpt-6-astra was never run.

**Screen**: the 8 cases that failed most often in round 20 (LF, 05-rewrite, LG, 16-rewrite, L7, 15-rewrite, SF, 08-rewrite), 4 at a time through the scratch harness. **Full**: `yarn evals rewrite-document`, 26 cases. **Tokens**: per rewrite, gpt-6-luna plus the check model, on the full run. **Cost**: per 1,000 rewrites at Vercel AI Gateway list prices, read on 2026-10-16. **Sec**: per rewrite on the full run.

| Check model | Price in / out per 1M | Screen | Full | Tokens (luna + check) | Cost | Sec | Errors |
|---|---|--:|--:|--:|--:|--:|---|
| gpt-6-luna (round 20) | $0.10 / $0.50 | 0–3/8 | 11–15 | 36,300–41,900 in all | $7.60–8.90 | 41–46 | none |
| gpt-5.6-luna | $0.20 / $1.20 | 1/8 | not run | | | | none |
| gpt-6.1-sol (round 20) | $2 / $10 | 3/8, 4/8 | 20, 21 | 21,700 + 17,500 | $55 | 48 | 2 check timeouts, 1 part timeout |
| gpt-6-sol | $2 / $10 | 3/8 | 12 | 21,800 + 19,600 | $70 | 47 | 1 check 503, 1 part timeout |
| gpt-5.6-terra | $2 / $12 | not run | not run | | | | |
| gpt-5.6-sol | $4 / $20 | not run | not run | | | | |

- The gpt-6-luna row comes from round 20 runs on earlier versions of the code. It wasn't run again.
- No check model on the proxy reached about 80% for less than gpt-6.1-sol. gpt-6.1-sol stays the cheapest that does.
- gpt-5.6-luna passed only SF on the screen. It let 4 meaning slips and 3 translation errors through. On the 8 screen cases it cost $23 per 1,000 rewrites.
- gpt-6-sol matched gpt-6.1-sol on the screen but passed only 12 of 26 cases in the full run: 5 meaning, 4 tone, 4 translation and 1 length failure. It costs the same per token, but it wrote about 1.8 times as many output tokens per check call (369 against 201), so it cost more.
- gpt-5.6-terra wasn't run. It costs at least as much per token as gpt-6.1-sol, so it would need fewer output tokens than gpt-6.1-sol, the leanest model here. It was also the weakest of the gpt-5.6 models on rewrites in round 15.
- gpt-5.6-sol wasn't run. Its input tokens alone would cost about $63 per 1,000 rewrites.
- The grader is gpt-6.1-sol, so it may favour its own checks. gpt-6-sol's 12 is below every gpt-6.1-sol run in round 20 (17 to 22), so that bias doesn't seem to explain the whole gap.
- A screen score of 3/8 didn't predict the full result. Eight hard cases are too few to tell close models apart.
- Quota: 57% before the first screen, 58% before the full run, 59% at the end.
