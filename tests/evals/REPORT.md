# Model comparison on the AI Gateway

On 18 October 2026 we ran the whole eval suite once on five cheap models through the Vercel AI Gateway. The suite has four scenarios and 118 cases. The app code, prompts and documents were the same for every model. Only `AI_GATEWAY_MODEL` changed. On 19 October we added three open-weights models that Pryvet could host itself: qwen3.8-27b, which IONOS also offers, gemma-4-31b-it and glm-5.3-flash. A fourth, minimax-m3, was skipped when the credit ran low.

## Results

| Model | Passed | Small tasks | Rewrites | Spent | Per 1,000 cases | Rewrite time per case |
|---|--:|--:|--:|--:|--:|--:|
| gpt-6-luna | **108 of 118 (91.5%)** | 94 of 98 | **14 of 20** | **$0.35** | **$3** | 118 s |
| claude-haiku-5.5 | 101 of 118 (85.6%) | 94 of 98 | 7 of 20 | $0.45 | $4 | 93 s |
| grok-4.3 | 100 of 118 (84.7%) | 94 of 98 | 6 of 20 | $4.51 | $38 | 206 s |
| deepseek-v4.1-flash | 99 of 118 (83.9%) | **95 of 98** | 4 of 20 | $1.17 | $10 | 172 s |
| qwen3.8-27b | 97 of 118 (82.2%) | 93 of 98 | 4 of 20 | $4.88 | $41 | 321 s |
| glm-5.3-flash | 95 of 118 (80.5%) | 91 of 98 | 4 of 20 | $0.36 | $3 | 116 s |
| gemma-4-31b-it | 87 of 118 (73.7%) | 87 of 98 | 0 of 20 | $0.19 | $2 | 280 s |
| gemini-3.8-flash | 79 of 98, stopped | 79 of 98 | not finished | $6.08 | n/a | n/a |

"Small tasks" are the change-text, answer-question and missing-part scenarios together. "Spent" is the drop in the gateway's credit balance during the run, so it includes the grader and the rewrite check. "Per 1,000 cases" divides it by 118.

## Pass rate per scenario

| Scenario | Cases | gpt-6-luna | claude-haiku-5.5 | deepseek-v4.1-flash | grok-4.3 | qwen3.8-27b | glm-5.3-flash | gemma-4-31b-it | gemini-3.8-flash |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| change-text | 52 | **52 (100%)** | 51 (98.1%) | 50 (96.2%) | 48 (92.3%) | 51 (98.1%) | 50 (96.2%) | **52 (100%)** | 41 (78.8%) |
| answer-question | 37 | 34 (91.9%) | 35 (94.6%) | 36 (97.3%) | **37 (100%)** | 34 (91.9%) | 33 (89.2%) | 28 (75.7%) | 30 (81.1%) |
| missing-part | 9 | 8 (88.9%) | 8 (88.9%) | **9 (100%)** | **9 (100%)** | 8 (88.9%) | 8 (88.9%) | 7 (77.8%) | 8 (88.9%) |
| rewrite-document | 20 | **14 (70%)** | 7 (35%) | 4 (20%) | 6 (30%) | 4 (20%) | 4 (20%) | 0 (0%) | stopped |

## Tokens

App tokens are the chat calls and the section calls of whole-document rewrites. They leave out the rewrite check, which `run-case.ts` doesn't record. Output includes reasoning.

| Model | Input | Cached | Output | Of which reasoning | Grader input | Grader output |
|---|--:|--:|--:|--:|--:|--:|
| gpt-6-luna | 700,861 | 27% | 272,451 | 166,221 | 163,123 | 115,766 |
| claude-haiku-5.5 | 1,287,060 | 65% | 422,511 | 253,759 | 118,305 | 98,147 |
| deepseek-v4.1-flash | 1,007,033 | 60% | 828,284 | 683,220 | 97,382 | 128,969 |
| grok-4.3 | 1,051,731 | 43% | 878,070 | 756,344 | 116,091 | 92,344 |
| qwen3.8-27b | 813,658 | 69% | 321,142 | 229,603 | 64,141 | 63,274 |
| glm-5.3-flash | 1,142,405 | 19% | 286,734 | 127,177 | 112,101 | 103,290 |
| gemma-4-31b-it | 746,297 | 47% | 115,883 | 40 | 17,283 | 6,878 |
| gemini-3.8-flash (3 scenarios) | 728,152 | 2% | 131,044 | 117,428 | 17,033 | 8,178 |

## Speed

Average seconds per case. The four scenarios ran in parallel, and the cases inside a scenario one after another.

| Scenario | gpt-6-luna | claude-haiku-5.5 | deepseek-v4.1-flash | grok-4.3 | qwen3.8-27b | glm-5.3-flash | gemma-4-31b-it | gemini-3.8-flash |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| change-text | 6.2 | 4.6 | **3.6** | 20.2 | 12.4 | 10.8 | 5.7 | 18.3 |
| answer-question | 8.1 | 8.9 | **6.8** | 20.9 | 13.9 | 18.7 | 12.0 | 17.7 |
| missing-part | 4.6 | 4.0 | **3.4** | 6.0 | 15.8 | 7.2 | 5.1 | 10.6 |
| rewrite-document | 118 | **93** | 172 | 206 | 321 | 116 | 280 | stopped |
| Whole run | 39 min | **31 min** | 57 min | 69 min | 107 min | 39 min | 93 min | stopped |

## What the numbers say

- **gpt-6-luna** passed the most cases for the least money. It is the only model that passed more than half of the whole-document rewrites.
- **claude-haiku-5.5** tied luna on the small tasks and costs about the same. It failed twice as many rewrites. With the gateway's automatic caching on, 65% of its input came from the cache. Without that setting, Claude caches nothing.
- **deepseek-v4.1-flash** was the best and fastest model on small tasks. On rewrites it spent 683,000 tokens reasoning and passed 4 of 20. Its spend was more than three times what its recorded tokens cost, because it also ran the rewrite check, which reasoned at length too.
- **grok-4.3** answered every question right and handled every missing part, but changed text less reliably than luna. On small tasks it took three times as long per case, and the run cost 13 times as much.
- **gemini-3.8-flash** was the least accurate on small tasks. It reasons at length by default, ignores our OpenAI effort setting, and almost nothing was cached. We stopped it during the rewrites after it had spent $6.08, more than five times our estimate for a full run.
- **qwen3.8-27b** matched luna on small tasks, 93 of 98. It passed 4 of 20 rewrites, but in 9 of the 16 failures the gateway returned a server error (status 500) three times in a row and a part never came back. Of the 11 rewrites without errors it passed 4: five translations failed the translation checks, one formal rewrite failed on tone, and one changed nothing. Alibaba doesn't support JSON Schema output for this model, so the gateway put the schema into the prompt and checked the reply afterwards. Its thinking makes it the slowest and most expensive model that finished the suite.
- **glm-5.3-flash** ran without a single request error and cost about as much as luna. Its rewrites took 116 s per case, like luna's, but passed only 4 of 20, all failures on quality: six translations failed the translation checks, six concise rewrites failed (four of them kept 96 to 98% of the text), and four formal rewrites failed on tone. It is a mixture-of-experts model, 320 billion weights with 18 billion active, and IONOS doesn't offer it.
- **gemma-4-31b-it** was cheap and quick on small tasks and got every text change right, but it answered questions worst, 28 of 37. All 20 rewrites failed before grading: the gateway's Gemma doesn't accept the JSON response format the rewrite pipeline uses ("JSON response format schema is only supported with structuredOutputs"), so every part was rejected. This is an integration gap, not a measure of its writing.

We keep gpt-6-luna as the default.

## What was unavailable

The cheap Grok models, `spacexai/grok-4.1-fast-reasoning` and `spacexai/grok-4.1-fast-non-reasoning`, returned "Not Found" from the gateway on 18 October 2026 between 14:55 and 15:00, on both the chat completions and the Responses endpoint. The gateway lists them, but routed the requests to a provider that doesn't serve them. The more expensive Grok models answered. We ran grok-4.3, the cheapest working Grok, instead, and the model picker now offers grok-4.3 in place of grok-4.1-fast-reasoning.

## Limits

- Each case ran once. With 118 cases, a gap of less than about 8 points between two models can be chance.
- The grader and the rewrite check aren't the same for every model. For gpt-6-luna, claude-haiku-5.5 and gemini-3.8-flash, gpt-6-luna graded the answers and ran the rewrite check. For deepseek-v4.1-flash and grok-4.3, the model under test did both, because we changed the setup between runs so that switching the model switches every call. The code checks are the same for all, but the tone, concision, translation and answer verdicts come from different graders, and a model may judge its own work kindly.
- The app sends OpenAI settings: medium reasoning effort and medium verbosity. The other providers ignore them and run at their own defaults, which for DeepSeek, Grok and Gemini means long reasoning.
- The token tables leave out the rewrite check, so the spend column is the one to trust for cost.
- Luna's spend was read 2.5 minutes after its run started, so its figure is slightly low. Gemini's figure includes part of an unfinished rewrite scenario.
- This run records total time per scenario, not the time to the first visible change.
- The comparison cost $12.56 in total, of which $6.08 was Gemini.
- For qwen3.8-27b, glm-5.3-flash and gemma-4-31b-it, gpt-6-luna graded the answers again, but the rewrite check ran on the model under test, as it would on Pryvet's own servers. Their spend excludes about $0.16 of side tests run at the same time.

## Speed of a single reply

On 19 October 2026 we sent each model the same streamed request three times through the gateway: rewrite a four-sentence paragraph in a formal tone, in about 250 words. OpenAI models got medium reasoning effort, as in the app. The others ran at their own defaults. The table gives the median of the three runs.

| Model | First text | Whole reply | Output tokens | Of which thinking | Text speed (tokens/s) |
|---|--:|--:|--:|--:|--:|
| gpt-6-luna | 4.9 s | 8.4 s | 495 | 223 | 94 |
| claude-haiku-5.5 | **2.0 s** | **4.0 s** | 510 | 125 | 196 |
| grok-4.3 | 15.7 s | 19.1 s | 1,168 | 947 | 72 |
| deepseek-v4.1-flash | 20.7 s | 22.0 s | 3,412 | 3,111 | 204 |
| gemini-3.8-flash | 11.1 s | 13.5 s | 1,244 | 960 | 130 |
| qwen3.8-27b | 71.8 s | 75.7 s | 5,049 | 4,761 | 72 |
| gemma-4-31b-it | 9.1 s | 15.5 s | 392 | 0 | 61 |
| glm-5.3-flash | **1.5 s** | 7.1 s | 346 | 56 | 62 |
| minimax-m3 | 5.9 s | 7.0 s | 998 | 705 | **254** |

- **First text** is the wait until the first visible word. Most of it is thinking, so a model that thinks longer shows text later.
- **Text speed** counts only the visible text, from the first visible word to the end. Thinking can't be timed this way, because some providers hide it.
- **qwen3.8-27b** produces tokens about as fast as gpt-6-luna when thinking is counted, 62 against 64 per second over the whole reply. It is slow because it thinks about 20 times as long first. With `reasoning: { effort: "low" }` on a similar request it thought for 870 tokens instead of 4,200 to 6,300.
- **gemma-4-31b-it** reported no thinking tokens, but still waited about 9 s before its first word.
- Three runs per model is a small sample. Qwen's wait ranged from 55 to 97 s, and GLM's from 1.1 to 10.6 s.
