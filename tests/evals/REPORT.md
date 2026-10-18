# Model comparison on the AI Gateway

On 18 October 2026 we ran the whole eval suite once on five cheap models through the Vercel AI Gateway. The suite has four scenarios and 118 cases. The app code, prompts and documents were the same for every model. Only `AI_GATEWAY_MODEL` changed.

## Results

| Model | Passed | Small tasks | Rewrites | Spent | Per 1,000 cases | Rewrite time per case |
|---|--:|--:|--:|--:|--:|--:|
| gpt-6-luna | **108 of 118 (91.5%)** | 94 of 98 | **14 of 20** | **$0.35** | **$3** | 118 s |
| claude-haiku-5.5 | 101 of 118 (85.6%) | 94 of 98 | 7 of 20 | $0.45 | $4 | 93 s |
| grok-4.3 | 100 of 118 (84.7%) | 94 of 98 | 6 of 20 | $4.51 | $38 | 206 s |
| deepseek-v4.1-flash | 99 of 118 (83.9%) | **95 of 98** | 4 of 20 | $1.17 | $10 | 172 s |
| gemini-3.8-flash | 79 of 98, stopped | 79 of 98 | not finished | $6.08 | n/a | n/a |

"Small tasks" are the change-text, answer-question and missing-part scenarios together. "Spent" is the drop in the gateway's credit balance during the run, so it includes the grader and the rewrite check. "Per 1,000 cases" divides it by 118.

## Pass rate per scenario

| Scenario | Cases | gpt-6-luna | claude-haiku-5.5 | deepseek-v4.1-flash | grok-4.3 | gemini-3.8-flash |
|---|--:|--:|--:|--:|--:|--:|
| change-text | 52 | **52 (100%)** | 51 (98.1%) | 50 (96.2%) | 48 (92.3%) | 41 (78.8%) |
| answer-question | 37 | 34 (91.9%) | 35 (94.6%) | 36 (97.3%) | **37 (100%)** | 30 (81.1%) |
| missing-part | 9 | 8 (88.9%) | 8 (88.9%) | **9 (100%)** | **9 (100%)** | 8 (88.9%) |
| rewrite-document | 20 | **14 (70%)** | 7 (35%) | 4 (20%) | 6 (30%) | stopped |

## Tokens

App tokens are the chat calls and the section calls of whole-document rewrites. They leave out the rewrite check, which `run-case.ts` doesn't record. Output includes reasoning.

| Model | Input | Cached | Output | Of which reasoning | Grader input | Grader output |
|---|--:|--:|--:|--:|--:|--:|
| gpt-6-luna | 700,861 | 27% | 272,451 | 166,221 | 163,123 | 115,766 |
| claude-haiku-5.5 | 1,287,060 | 65% | 422,511 | 253,759 | 118,305 | 98,147 |
| deepseek-v4.1-flash | 1,007,033 | 60% | 828,284 | 683,220 | 97,382 | 128,969 |
| grok-4.3 | 1,051,731 | 43% | 878,070 | 756,344 | 116,091 | 92,344 |
| gemini-3.8-flash (3 scenarios) | 728,152 | 2% | 131,044 | 117,428 | 17,033 | 8,178 |

## Speed

Average seconds per case. The four scenarios ran in parallel, and the cases inside a scenario one after another.

| Scenario | gpt-6-luna | claude-haiku-5.5 | deepseek-v4.1-flash | grok-4.3 | gemini-3.8-flash |
|---|--:|--:|--:|--:|--:|
| change-text | 6.2 | 4.6 | **3.6** | 20.2 | 18.3 |
| answer-question | 8.1 | 8.9 | **6.8** | 20.9 | 17.7 |
| missing-part | 4.6 | 4.0 | **3.4** | 6.0 | 10.6 |
| rewrite-document | 118 | **93** | 172 | 206 | stopped |
| Whole run | 39 min | **31 min** | 57 min | 69 min | stopped |

## What the numbers say

- **gpt-6-luna** passed the most cases for the least money. It is the only model that passed more than half of the whole-document rewrites.
- **claude-haiku-5.5** tied luna on the small tasks and costs about the same. It failed twice as many rewrites. With the gateway's automatic caching on, 65% of its input came from the cache. Without that setting, Claude caches nothing.
- **deepseek-v4.1-flash** was the best and fastest model on small tasks. On rewrites it spent 683,000 tokens reasoning and passed 4 of 20. Its spend was more than three times what its recorded tokens cost, because it also ran the rewrite check, which reasoned at length too.
- **grok-4.3** answered every question right and handled every missing part, but changed text less reliably than luna. On small tasks it took three times as long per case, and the run cost 13 times as much.
- **gemini-3.8-flash** was the least accurate on small tasks. It reasons at length by default, ignores our OpenAI effort setting, and almost nothing was cached. We stopped it during the rewrites after it had spent $6.08, more than five times our estimate for a full run.

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
