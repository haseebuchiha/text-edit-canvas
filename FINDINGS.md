# Findings

## Test setup

Models were reached through a local proxy, through its chat endpoint until round 13 and its Responses endpoint from round 14 (see "Moving to the Responses endpoint"). Token counts from these runs are real, but the timings aren't representative of the API.

Until round 14, cases ran on two documents: the editor's 1-page sample offer (5 headings) and a 9-page synthetic IT security policy (26 headings, 3 tables). Most cases ran between 3 and 40 times, through a harness of scratch scripts. From round 15 the harness is the eval suite in `evals/` (now `tests/evals/`), with 129 cases on 24 documents (see "Measuring with the eval suite"). Per-case numbers for every test round are in `TEST-RESULTS.md`.

## Document context in each request

When the user sends a message, the browser builds a snapshot of the editor and sends it to our server next to the typed message. The snapshot holds the outline (every heading with its block ID), the relevant text blocks, and the highlight as a block ID plus character offsets. The server flattens it to plain text, which costs about 2.3× fewer tokens than Tiptap JSON, and attaches it to the latest user message for that one model call. MongoDB stores only what the user typed, so old copies of the document never pile up in the history.

We considered giving the model only read tools, the way coding agents work. Every tool round trip is a new model call that re-sends the whole conversation, and each one adds a wait.

How other products handle it:

- BlockNote sends the whole document plus the selection in every message and has no read tool.
- CKEditor AI sends the selection or section up front and lets the model read more on demand.
- Tiptap's AI Toolkit ships both. Its "Workflows" read the document on the client and send it with the prompt; their example task is "Make the text more formal". Its "Agents" read only through tools, with a default read chunk of 32,000 characters. At our document sizes, that means the whole document plus an extra round trip.
- Coding agents in editors, such as Claude Code in VS Code and Copilot in VS Code, also attach the current selection or file up front. They read through tools because they can't know which of thousands of files matter.

Anthropic's context engineering guidance recommends a hybrid: retrieve some data up front for speed, and explore the rest at runtime.

We went with a hybrid. Relevant text goes up front, and a `read_section` tool fetches other sections only when they're needed, for example for "match the tone of the Services section". A plain edit took 1 model call, with 876 input and 101 output tokens. A request that also needed another section took 2 calls, with 1,730 input and 160 output tokens.

## Requests with nothing highlighted

The brief says that if nothing is highlighted, the PoC should pick relevant sections (for example through the outline) rather than send the full text. In that case we now send only the headings, plus any blocks before the first heading, and the model fetches what it needs.

In the first round of tests this was correct in 61 of 69 runs, against 40 of 45 when we sent the whole document. On the 9-page document, an edit to one section used about 2,200 input tokens instead of 7,800. On the 1-page sample it costs more, because two calls only beat one on longer documents.

The tests turned up these problems, which are now fixed:

- The proxy returns at most one tool call per response, even with parallel tool calls enabled. With a read tool that took a single ID, the model read one section per step and hit the step limit. `read_section` now takes several heading IDs at once.
- Blocks before the first heading were unreachable, and in one run the wrong paragraph was blanked. They're now always sent.
- Overlapping sections were sent twice (17.2k tokens). They're now merged (8.7k).

Reading the H1 returns the whole document, because every other heading sits under it. That's correct, but costly for a one-line header edit.

Facts that the headings don't point to were still missed. The answer to "Who coordinates the dates?" is under Background, and the model got it wrong in 3 of 3 runs: it read two sections it guessed at and answered without finding the right one. A hotline number mentioned in two sections had only one mention changed, also in 3 of 3 runs.

## Search tool

`find_text` searches every block for several terms at once and returns the matching blocks with their IDs and headings. Like section reads, saved search results are dropped from later history. The step limit went up from 3 to 4.

With search, correct runs went from 61 to 66 of 69, and total input tokens fell 13.5%. The hotline case went from 0/3 to 3/3. "Change customer to client everywhere" on the 9-page document dropped from 8,720 to 2,856 input tokens and went from 2/3 to 3/3 correct.

Each tool definition is sent on every call, and this one added about 111 input tokens per call.

## Made-up answers and quote checks

In 2 of 3 runs, "Who coordinates the dates?" got a confident, made-up answer: "[ORG_2] coordinates the dates". The real sentence is "[PERSON_2] coordinates the dates on the side of [ORG_1]."

Questions about the document now have to be answered through an `answer_question` tool, with exact quotes and their block IDs. The server checks each quote against the real document and rejects the answer if a quote isn't there. "Not in the document" is only accepted after a search. An answer that isn't verified is never shown; the user sees a "couldn't find a verified answer" line instead.

With this check, that question went from 1/3 to 8/10 correct, and no fabricated quote reached the user.

The check proves that the model looked at a real sentence. It can't tell whether the model read that sentence correctly. In 2 of 10 runs the model quoted a real but irrelevant sentence ("we will schedule the kick-off call") and drew the wrong conclusion.

The new tool's definition is sent on every call as well. Questions used about 28% more input tokens, and edits about 18% more.

Asking for the answer "in the user's language" inside the tool schema made the model answer in German or Slovenian, so we took it out. The model still sometimes answered in Swedish or Slovenian (2 of 26 runs).

## Search before answering

Every wrong answer to that question followed the same path: the model read two guessed sections and quoted a nearby sentence without searching. Every run that searched found the right sentence.

A quoted answer is now rejected unless the model searched during that request. Quotes from text that was already in the prompt, meaning the highlighted section, are the exception, so questions about highlighted text don't pay for an extra call.

That question was then correct in 20 of 20 runs, with no wrong answer shown. It also got cheaper, at 2.0 calls and 2,124 input tokens on average against 2.53 and 3,007, because the model stops wandering through sections. Other questions cost more because of the added search step: 21% and 35% more input tokens on two cases.

## Model size and thinking level

A first comparison ran on gpt-5.6 models, before the search-first rule. More thinking and bigger models gave more wrong answers there: "Who coordinates the dates?" was right in 39 of 40 runs on gpt-5.6-luna at default thinking, 36 of 40 at high thinking, 36 of 40 on gpt-5.6-sol and 3 of 11 on gpt-5.6-terra, and sol showed a wrong answer in 11 of 67 question runs. Every wrong answer came from skipping the search, which the search-first rule now blocks. On "Who signed the contract?", sol claimed "[PERSON_3] signed" in 7 of 13 runs, quoting "Kind regards, [PERSON_3]". The quote check can't catch a real quote used for a wrong claim.

The local proxy turned out to ignore `reasoning_effort` for the gpt-6 models. Its OpenAI provider doesn't recognise gpt-6 model names as reasoning models and drops the setting, so a request for gpt-6-luna with `reasoning_effort: "none"` still used 228 reasoning tokens, and an invalid value went through without an error. Every gpt-6-luna run before this matrix therefore ran at the backend's default. For the matrix, a forwarder sent each request to the proxy's Responses endpoint with the effort set, and every response reported the effort it ran at. The backend's defaults are medium for gpt-6-luna and gpt-6-astra and low for gpt-6.1-sol, so "default" repeats medium on luna and low on sol. OpenAI's API documentation gives medium as gpt-6.1-sol's default, so on the gateway "default" can mean something else. The app now sets the effort explicitly (see "Moving to the Responses endpoint").

The matrix ran on the current code, with section calls that no longer get the whole document (see "Whole-document instructions"). Each config handled 68 requests: the edit set twice, five question cases three times, "Hi!" once, and the concise, formal and German instructions twice on the policy and once or twice on the sample. A whole-document run counts as correct when German covers at least 98% of the blocks, every placeholder and figure survives, nothing is invented and concise text comes out shorter. Cost is at gateway list prices, with reasoning billed as output.

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

- "Change customer to client everywhere" missed a table cell in 4 of 10 policy runs: the edit for "customers" went to the cell next to it. This is now fixed (see "Edits sent to the wrong table cell").
- "Edit the appendix", on documents that have none, edited some part of the document in 5 of 20 runs instead of asking what to edit. One of those runs went through `transform_document`.
- "Make the whole document more concise" dropped placeholders in 5 of 10 policy runs: [ORG_1] from the definition of information, and in two runs the four site names from the scope paragraph.
- The 30-days case failed in 2 of 10 runs the familiar way: the model read only "User Accounts" and added a sentence to block 84.

On sol and astra, a policy rewrite took 38 to 58 seconds against 20 to 34 on luna, and the first change appeared after 10 to 13 seconds instead of 5 to 8. The scorer misses some problems on every model. Every German run mixed "Beschäftigte" and "Mitarbeitende" for "employees", with 2 to 20 blocks of the less common word on sol and astra and 5 to 17 on luna. Making the phishing section shorter dropped "Email is the most common route for attacks" in all 18 runs. In 2 of 10 luna runs, "more formal" weakened that sentence to "a common vector" or "one of the most common", which never happened on sol or astra.

The reasoning models reject `temperature`. Through the proxy, every request that set it failed with "Bad Request" on gpt-6-luna, gpt-6.1-sol and gpt-6-astra, even at 1 and even with effort none; the backend's message is "Unsupported parameter: temperature", and `top_p` fails the same way. OpenAI's guide to its latest models says to remove `temperature`, `top_p` and `top_logprobs` whenever the effort isn't none, and gpt-6.1-sol and gpt-6-astra don't support none at all. So temperature can't be tuned on these models, except perhaps gpt-6-luna at none on the API, which the proxy can't test.

## Choosing gpt-6-luna

Published benchmarks:

- On the official Terminal-Bench 4.0 leaderboard, all at max effort, gpt-6-luna scores 16.4%, gpt-5.6-luna 17.3%, gpt-5.6-terra 21.5% and gpt-5.6-sol 37.3%.
- OpenAI's AutomationBench tool-use scores put gpt-6-luna at 20.7% at max effort and 9.4% at medium, against 14.9% and 6.2% for gpt-5.6-luna.
- The cheapest options, gpt-5-nano and gpt-oss-20b, scored 11.5% and 3.1% on Terminal-Bench 2.0.

On the gateway, gpt-6-luna costs $0.10 / $0.50 per million tokens (in / out), half the price of gpt-5.6-luna.

On our harness, at the time of testing, gpt-6-luna gave no wrong answers to questions and no empty replies. Over the test mix, the cost per 1,000 requests fell from $0.83 to $0.41. We did see problems:

- It made an unintended edit in 2 of 2 runs. Told that unused accounts are now deactivated after 30 days instead of 60, it also changed an unrelated "60 days" in a patching table. The search had returned that table cell on its own, as `[221] (table cell r4c4) 60 days`, so the model couldn't see that the cell was the patch deadline for high-severity issues on production IT. Search hits in tables now come back with the table's header row and the cell's whole row. After that change, the patching cell was left alone in 20 of 20 runs, at a cost of about 40 extra input tokens. In 2 of those 20 runs the model skipped the search, read only the accounts section and added a sentence to the wrong paragraph there.
- It sometimes skipped the answer tool after a search found nothing.
- On two question cases it often answered first, got rejected, then searched, which used all 4 allowed calls.

For scale, one test run of the size in the brief (20 documents × 5 instructions × 3 strategies, about 300 edits) costs well under a dollar on any of these small models.

In the matrix above, gpt-6-luna cleared 90% at every effort level, with 323 of 340 requests right (95%), for $0.86 to $1.01 per 1,000 requests over a mix where 10 of 68 requests rewrite a whole document. gpt-6.1-sol at low got all 68 right for $16.71, about 19 times as much, and gpt-6-astra for $83.31. We kept gpt-6-luna, and the app now sets its effort to medium explicitly. Medium is what every earlier gpt-6-luna test ran at, high costs about 14% more without a clear gain, and at none one section call ran away. gpt-6.1-sol at low is the step up if the three remaining luna failure groups matter more than the price.

## Moving to the Responses endpoint

The app used to call the proxy's chat endpoint, which had two problems. It dropped the thinking setting for gpt-6 models, so every request ran at the backend's default, whatever the app asked for. And the proxy asks for short answers (verbosity "low") on every request that doesn't ask for something else, while the paid API's default is medium. Development didn't behave like production.

The proxy's other endpoint, Responses, honours the thinking setting and enforces a JSON schema. The app now calls it through `@ai-sdk/openai`, which replaced `@ai-sdk/openai-compatible`. Every model call, the chat call and each part call of a whole-document rewrite, sends the same settings. The gateway passes them on to OpenAI, so production gets them too:

- medium thinking and medium answer length;
- `store: false`, so OpenAI keeps nothing. The SDK then asks for the model's reasoning in encrypted form and sends it back on the next step, so reasoning still carries across tool calls;
- the chat session ID as the prompt cache key, shared by all part calls of a rewrite;
- parallel tool calls allowed.

The prompts already put their stable parts first. A chat request starts with the instructions and tool definitions, then the history, and the document snapshot rides on the newest message. Part calls share the instructions, the outline and the user's instruction, and only then list their own blocks. Part calls now get the edit format as a schema the API enforces, so we took the spelled-out JSON shape out of their prompt. All 176 part calls in the test returned JSON that matched the schema.

We ran the round 12 matrix set twice on gpt-6-luna (round 14 in `TEST-RESULTS.md`). Round 12's medium and default configs both ran at medium thinking and low verbosity:

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

Three things the proxy still can't show, so they must be measured on the paid API:

- Caching. The proxy reported cached input on 1 of 434 calls. The fixed part of a chat request is now about 1,110 tokens, above OpenAI's 1,024-token minimum, so the paid API can cache it.
- Parallel tool calls. The proxy turns them off on every call, so the model never asked for two tools at once.
- Output limits. The proxy drops `max_output_tokens`, so a limit on runaway output can't be tested here.

## Empty replies

Sometimes the user got no reply at all. It happened in 2 of 50 runs on one question, and up to about 1 in 30 in later runs.

After `find_text` returned "No block contains any of these terms.", the model sometimes ended its turn with an empty final message (no text, no tool call, about 4 output tokens). The stream closed normally. The chat showed the search step and no reply, and our fallback line didn't trigger because it was tied to the answer tool. Every empty reply on record came right after a search with no matches.

The fix: the no-match message now tells the model what to do next: "If the document doesn't state the answer, call answer_question with no quotes." In 250 replays of the failing request, that produced a proper answer every time. Before the change, 249 replays gave 19 empty and 40 plain-text replies. In the app on gpt-6-luna, "Who signed the contract?" then gave a verified "not in the document" answer in 30 of 30 runs, where it had answered in plain text, skipping the check, in 75 of 150. The chat also shows "No answer came back. Please try again." whenever a reply finishes with no text, no answer and no edit, so an empty turn is never silent.

## Matching the model's text to the document

The model doesn't always copy text exactly. If it writes "kick off call" and the document says "Kick-off call", an exact match silently drops the edit, rejects the quote or comes up empty in search.

Edits, quote checks and search now share one matcher. It tries an exact match first, then a forgiving one that:

- ignores capitalisation, curly versus straight quotes, and extra whitespace;
- lets a hyphen or dash between two letters match a hyphen, a space or nothing ("kick-off" = "kick off" = "kickoff", "e-mail" = "email");
- never lets a space match nothing, so "the rapist" doesn't match "therapist";
- leaves hyphens between digits as they are, so "10-20" doesn't match "1020".

There's deliberately no fuzzy matching that allows a few letters to differ. "[ORG_2] coordinates" and "[PERSON_2] coordinates" differ by only a few letters, and fuzzy matching would wave a wrong answer through.

For edits, the match is mapped back to the exact original characters, so formatting on the replaced text is kept.

## Edits sent to the wrong table cell

"Change customer to client everywhere" on the policy left one table cell unchanged in 4 of 10 gpt-6-luna runs in the model matrix, and in 5 of 10 runs at default thinking just before the fix. gpt-6.1-sol and gpt-6-astra never did this.

The search tool, `find_text`, printed a table hit as two lines: the header row, then the hit's whole row, with an ID before each cell:

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

Results on gpt-6-luna at default thinking:

- "Customer to client" went from 5/10 to 10/10. The new check never fired, because the model always picked the right cell.
- To test the check on its own, we put back the one-line rows and ran the case 10 more times. The check rejected 3 edits, the model fixed all 3 on its next try, and all 10 runs were correct. One of them searched again before retrying and used all 4 calls. A rejected run used 6,300 to 9,900 input tokens instead of about 3,700.
- The 30-days case stayed at 9/10. The miss was the familiar one: the model read only "User Accounts" and changed block 84. The patching-table cell was never touched.
- A search that hits a table costs about 60 more input tokens. The 1-page "customer to client" case passed 3 of 3 and the edit set 22 of 23. The miss was "edit the appendix", a known luna problem.

The scorer only checks that every block with "customer" changed. Blocks 3, 78 and 260 contain the word twice, and in every run, before and after, the model changed only the first one in at least one of those blocks.

## Smaller findings

Tiptap's UniqueID extension uses 36-character UUIDs for block IDs by default. Those IDs are sent with every block and repeated in every edit, so we switched to short counter IDs ("1", "2", …) through its `generateID` option. Splitting a paragraph gets a fresh ID automatically.

The fixed part of each request (instructions plus five tool definitions) is now about 1,110 tokens, just above OpenAI's 1,024-token minimum for prompt caching. The proxy almost never reports cached tokens, so caching needs measuring on the gateway.

An edit that replaces a whole paragraph writes plain text, so bold and links in that paragraph are lost. Swapping a phrase inside a paragraph keeps its formatting. We haven't solved this yet.

On gpt-6-luna, "Make the document more concise" drops placeholders and figures, whether the whole document is sent or not. gpt-6.1-sol and gpt-6-astra kept every placeholder in their 8 policy runs.

One undo reverts a whole AI edit. Asking the chat to revert doesn't work, because the model only ever sees the current document. The real guard against bad edits is a review mode with per-change accept and reject, which isn't built yet.

When the user clicked into the chat, the editor's selection highlight disappeared, although the selection was kept. Tiptap's own `Selection` extension keeps it visible.

Stop used to end only the stream in the browser. The server finished the run, kept calling the model and saved "Edited 199 blocks in 14 sections." to the history. Now the request's abort signal reaches `streamText` and every section call, no section call starts after it fires, and a stopped reply is saved without tool calls that never returned a result. In the browser, Stop after 4 of 14 German sections closed the 6 open section calls at once, no call started in the next 45 seconds, and the history showed "Stopped after 4 of 14 sections." with 49 changed blocks, the same 49 as the editor. A stopped reply records no token usage, and in the next turn the model read the saved progress as still running and told the user the document was being translated.

## Whole-document instructions

"Translate the document to German" and similar instructions failed on the 9-page policy in two ways.

First the model edited without reading. With only the outline in front of it, it translated just the 26 headings in 6 of 8 German runs, and in 2 of 4 "more concise" runs it replaced 13 headings with summaries it made up. A prompt line made it read first ("…including the whole document, first call `read_section` once with every outline heading…"), and `edit_document` now rejects edits that turn a heading into body text. Reading first exposed the second failure. In 4 of 10 German runs the model read all 200 blocks, then sent one edit covering only 37 to 60 of them. Replays of that edit call fell short once in 8 with either prompt, so the prompt wasn't the cause. The line also cost a targeted case. "Unused accounts are now deactivated after 30 days instead of 60" fell from 18/20 to 7/11, and each failing run read only the accounts section.

Other editors don't rely on one long pass. CKEditor's AI Translate documentation recommends its review-based path for full documents, because the single-pass translate action can miss parts of longer content. Tiptap's AI Toolkit splits large documents into chunks and processes them in parallel. In Chroma's "Context Rot" study (July 2025), models copying text did worse as the text grew longer, and some stopped early.

A new `transform_document` tool now runs the long pass in our code. It takes only the instruction, and the chat model calls it for instructions about the whole document; targeted edits stay with `edit_document`. The code splits the blocks into parts. Each heading starts one, text before the first heading forms its own, a part under about 250 tokens joins a neighbour while the pair stays at 1,000 or less, and a longer part is split between blocks. The policy becomes 14 parts. Each part gets one plain model call without tools or history, which returns `edit_document` edits for its own blocks and is told to keep placeholders, numbers and facts. Each call gets the outline, the instruction and the blocks of its own part, whatever the document's size. Six calls run at once, and a call that fails or hits 60 seconds is retried once. Each part's edits pass the heading check and must stay inside the part, then stream to the browser as the part finishes. The chat run stops there, and later turns see a short summary.

The browser applies each part outside undo history and keeps the original of every block it changes. When the run ends, including on Stop, it restores the originals and writes the new text back as one history step, so one undo reverts the whole transform; we checked this in the browser. For 1,273 blocks that step took 60 ms in Node. The editor stays editable, so text typed into a block before its part arrives is overwritten.

On the policy, against the single pass:

- German covered 198 or 199 of 200 blocks in every run, against 37 to 199. The job title "Chief Information Security Officer" stayed in English every time.
- The first German change appeared after about 6 s instead of 49 s. Complete translations took 22 to 37 s instead of 58 to 82 s; one run took 78 s because one part was slow.
- A run costs 15 calls and about 14,700 input tokens instead of 2 calls and 9,400. While each call still carried the whole document, it was about 109,000, and the proxy reported 90% of that as cached.
- "More concise" lost 7 placeholders in 5 runs, against 73 in 10.
- Each call chooses its words independently. Every German run used both "Beschäftigte" and "Mitarbeitende" for "employees", where the single pass stuck to "Beschäftigte".

Routing took three wordings. The first sent "make the passwords section friendlier" through the tool in 3 of 8 runs, at 109,000 tokens each, and the second did the same with "change customer to client everywhere" and missed a block. With the final wording no targeted instruction called the tool in 92 runs, and all 30 whole-document runs did. "Change customer to client everywhere" now goes through `find_text` and `edit_document` in 2 calls, with 2,400 input tokens on the sample and 3,700 on the policy. The 30-days case is at 23/28.

A 64-page document joined from 13 samples (128 parts, outline only) took 151 and 198 s at about 470,000 input and 80,000 output tokens per run, with no failed parts or rate limits. In one run the model wrote "In stock" into two price cells of a long table.

Each part call on a document under 20,000 tokens used to start with the whole document, so on the policy all 14 calls re-sent the 200 blocks. Each call now gets the outline instead. We compared both on gpt-6-luna at default thinking: 3 runs per policy instruction and 2 per sample instruction without the document, against the earlier 5 and 3 runs with it (rounds 11 and 12 in `TEST-RESULTS.md`).

- Input per policy run fell from about 109,000 to 14,700 tokens, and on the sample from 2,578 to 2,014. Output on the policy stayed within 8%. At gateway prices a policy run fell from $0.014–0.016 to $0.005–0.007.
- German covered 199 of 200 policy blocks in every run without the document, against 198 or 199 with it, and every block of the sample both ways.
- With the document, every formal run replaced "ours" in "companies such as ours" with [ORG_1], and 4 of 5 weakened "the most common route for attacks". Without it, no luna run added [ORG_1], and 2 of 13 weakened the phrase, counting the 10 luna runs from the model matrix.
- "More concise" dropped placeholders in 4 of 5 runs with the document. Without it none of the 3 runs did, but 5 of the 10 luna matrix runs did, so the document wasn't the cause. Concise text came out at 81% of the original length instead of 75%.
- Terminology stayed mixed. Every German run still used both words for "employees", and "Mitarbeitende" took over as the more common one, in 27 or 28 blocks against 10 or 11 for "Beschäftigte".
- The first change appeared after 5 to 9 s on average and a run finished in 18 to 22 s, against 6 to 8 s and 18 to 37 s with the document; the 37 s average included one 78 s run.

Apart from concise text coming out somewhat longer, no measure got worse.

## Measuring with the eval suite

The scratch harness scored mostly where an edit landed. It passed a run that emptied the pricing table, and every "customer to client" run that left a second "customer" in a paragraph. The eval suite in `tests/evals/` replaces it; `tests/evals/README.md` explains how to run it and how to read a case.

A case is a frozen document, an instruction and the expected outcome. A run of a case calls the app's own chat turn in-process against a headless Tiptap editor, applies the stream with the browser's `apply-edits.ts`, and grades the document the user would see, plus the reply and the tools that ran. What the model says it did doesn't count. Code checks decide whatever they can: the exact expected text of each changed paragraph, every other paragraph unchanged, the word gone everywhere, placeholders and figures kept in each block, headings still headings, no emptied table cell, every English block translated, one German word per key term, and a checked answer that names the fact. An AI grader, gpt-6-luna at medium effort with a strict pair-by-pair routine, decides tone, concision, translation quality, and whether an answer is right and supported. It runs only when every code check passed. It no longer grades whether a rewrite kept its meaning: that grader failed a whole document for one slipped word, even on the strongest model, so it was removed. A case passes only when every check passes and the grader doesn't say fail.

The suite started as a command-line tool in `evals/`, with trial counts, retries, run comparisons and margins. The numbers below come from that tool: cases ran 3 times, the risky ones 10, and proxy failures were retried once and reported apart from model failures. It is now a set of plain Jest tests in five scenarios: change-text, answer-question, missing-part, rewrite-document and rewrite-section. `yarn evals` runs every case once. A proxy failure counts as a failed case, and a scenario fails when fewer than 80% of its cases pass. The 64-page case, the only one for known gap 13, was dropped, so 128 cases on 23 documents remain, with the same instructions and expected outcomes. The new suite hasn't been run against a model yet.

The baseline had 129 cases on 24 documents: the earlier S, L, N, H, G and whole-document cases with stricter expected outcomes, PG, L11 and L12 for known gaps, and five cases on each of the other 19 samples. Every known gap had a case.

Baseline through the proxy (round 15 in `TEST-RESULTS.md`, with the command-line tool; gpt-6-luna 3 trials per case, the others 1, without the 64-page document):

| Model | Pass, 95% | Code checks only | Unintended changes | Sec | Cost per 1,000 requests |
|---|--:|--:|--:|--:|--:|
| gpt-6-luna | 70.8% ±8.6 | 84.8% ±7.7 | 5.1% | 8.2 | $1.20 |
| gpt-6.1-sol | 85.2% ±7.3 | 94.5% ±4.4 | 2.0% | 12.5 | $20.27 |
| gpt-5.6-luna | 72.7% ±7.1 | 87.5% ±7.0 | 5.9% | 10.3 | $2.67 |
| gpt-5.6-terra | 71.9% ±7.8 | 87.5% ±6.5 | 3.9% | 15.9 | n/a |
| gpt-5.6-sol | 77.3% ±8.1 | 91.4% ±5.3 | 3.9% | 13.3 | n/a |

The margins are wide: with 24 documents, differences under about 8 points between two models are noise. gpt-6.1-sol is the only clear step up, and it judged its own run.

What the suite shows on gpt-6-luna:

- Targeted edits, highlight edits and questions mostly pass: 64 of 73, 41 of 42 and 68 of 71, and no not-in-document question got a made-up answer in 39 trials.
- "Change X to Y everywhere" fails when a paragraph holds X twice: L3 0 of 10, and all 20 failed everywhere trials left a second or third occurrence, as did the 6 failures on gpt-5.6-luna and gpt-5.6-terra. gpt-6.1-sol and gpt-5.6-sol passed every everywhere case.
- Edits that make another figure wrong leave it wrong: the total or a second mention of the same number stayed unchanged in 04, 11 and 14.
- Requests for a part that doesn't exist: "edit the appendix" passed 20 of 20, but the seven new missing-part cases passed 7 of 21. The model edited the nearest paragraph, or sent "shorten the cover letter" through `transform_document` and shortened 61 to 88 blocks. The other models passed 3 to 7 of the 9 missing-part cases.
- Whole-document rewrites pass the code checks in 67 of 79 runs but rarely pass the judges: the meaning judge failed 53 of 60 rewrites, about 40 of them for a change a reader would act on, such as "immediately" becoming "without undue delay" in the data processing agreement, and the translation judge failed 20 of 30 German runs, mostly for key terms translated two ways. With judges, luna passed 17 of 91 section and whole-document rewrites, and the other models 5 to 13 of 30, gpt-6.1-sol the most.
- "Make the phishing part shorter" still drops "most common" on every model.

A review after the baseline read all 129 cases against their documents and changed one: S3 now lets "customer service", a department name, stay. It also fixed four flaws in the meaning judge's prompt (it saw only changed blocks, wanted each fact in its original block, contradicted itself on hedges, and quoted the test cases); asked again, the judge kept all 60 luna verdicts. The concision judge no longer fails a single clipped phrase. The numbers above are re-graded from the saved runs; round 15 in `TEST-RESULTS.md` lists every change.

The grader isn't validated yet. Its verdicts are stable (a second pass over the luna transcripts repeated 168 of 170 answer, tone and translation verdicts), but stable isn't the same as right. Hand labelling in `tests/evals/labels/` will show how many real failures it catches; it comes later. Until then, read the grader's reasoning before acting on its pass rate. Timings and caching come from the proxy and need a gateway run to be representative.

## A word twice in one paragraph

"Change customer to client everywhere" failed in all 10 L3 runs of the eval baseline. Block 260 of the policy reads "Incidents that affect customer information are reported to the customer in accordance with the contractual requirements." The model sent one `replace_text` with find "customer". The editor replaces only the first match, so "reported to the customer" stayed, and the server accepted the edit.

`edit_document` now applies each block's `replace_text` edits to the block's text in order, with the editor's own matcher. If a find text is still in the block afterwards, it rejects the whole call:

```
Not applied. "customer" appears 2 times in block 260, you sent 1 edit. Send one edit per occurrence, or add surrounding words if only some should change. Send all changes again in one edit_document call.
```

Two edits with the same find text pass, and the editor changes the first and then the second occurrence. Edits with different text that together cover every occurrence also pass, such as "the plant managers" and "plant managers" in block 135 of the incident report. A plain count of each find text would have rejected those, and they passed in 3 of 3 baseline runs. On the saved edits of all five baseline runs, the check would have fired in 17 trials, all of them failed ones.

Results on gpt-6-luna, full suite, against the re-graded baseline (round 16 in `TEST-RESULTS.md`):

- The check fired in 13 of 415 trials, and in 9 of 10 runs of a separate L3 run. Each time the model's next edit was accepted. 19 of the 22 took 3 model calls (search, rejected edit, edit) and 3 took all 4, because the model searched again first. None ran out of calls, so the limit stays at 4.
- "Bulky goods" to "oversized goods" went from 1/3 to 3/3, "customer" to "client" on the IT offer from 1/3 to 2/3, and "trade fair" to "trade show" from 0/3 to 1/3.
- L3 went from 0/10 to 1/10, and 2/10 in the separate run. Block 260 is now right in every run. Blocks 3 and 78 still keep one "customer". The model sends find "customers", which occurs once, and the other word is the singular in "our customer contracts". That is different text, so the check can't see it. The other everywhere failures are the same kind: "The customer's" next to "the customer wants", "trade fairs" next to "trade fair", and 'the "Main Agreement"' next to a lowercase "main agreement".

## Other forms of the same word

`edit_document` now also looks for other forms of each find text in its block, after the block's edits are applied. Code cuts the ending off every word, so "customers", "customer's" and "customer" all become "customer", and compares the find text's words with every run of words in the block. When they match, it rejects the whole call:

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

## Figures that follow from a change

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

The full change-text scenario on the final version passed 51 of 52 (98.1%), against 48 of 52 after the word-form check and 45 of 52 in the suite's first run. The one failure was 08: the model moved the review to two months and cut the buddy programme from six months to four. App input tokens rose from 167,746 to 213,848 (+27%), from the prompt line on every call and the extra call after each rejection. With the first wording, answer-question passed 37 of 37 (36 before), rewrite-section 2 of 4 (2 before) and missing-part 6 of 9 (7 before). The new missing-part failure was "shorten the cover letter" editing the submission line, the known luna failure from "Requests for a part the document doesn't have", with no figure involved.

## Requests for a part the document doesn't have

Asked for a part that isn't there, gpt-6-luna usually changed something nearby. The warehouse proposal opens with a submission line ("Submitted by [ORG_1] to [ORG_2], attention of [PERSON_2], …") and an executive summary, and has no cover letter. "Shorten the cover letter" went to `transform_document` in 3 of 3 baseline runs and shortened 61 to 88 blocks of the proposal. "Add an entry for transaction log to the glossary" changed the report's approval paragraph in 3 of 3. The seven missing-part cases other than "edit the appendix" passed 7 of 21.

The system prompt has one new line: "If the instruction names a part the document doesn't have, such as a section that isn't in the outline, change nothing rather than editing a similar part: make no edit and no transform, say that part isn't there and ask what to change."

Results on gpt-6-luna, full suite:

- The seven cases went from 7/21 to 15/21. "Edit the appendix" stayed at 10/10 on both documents. No run called `transform_document` for a missing part (3 before). 4 runs still edited a nearby paragraph (10 before, plus the 3 transforms), and 2 read and searched until they ran out of calls and gave no reply (1 before).
- Trials that changed a block outside the case's scope fell from 17 of 336 to 9 of 336.
- Parts named loosely still work: "the pricing section" (heading "Schedule and pricing"), "the draft note at the top", "the document header" and "section 9" passed 3 of 3 each. "The cost part", "the passwords section" and "the phishing part" edited the right section in every run; they fail on the judges, as before.
- A possible side effect: 2 of 110 question runs replied in plain text instead of a checked answer, against 0 of 110 in the baseline. One of them answered "who is the named service manager?" with "The document does not name a specific service manager", which is right but unchecked. A rerun of that case gave 1 more of 10. The new line's "say that part isn't there" may cause this.

## Rewrites that change how strong a statement is

In round 16 on gpt-6-luna, section and whole-document rewrites passed 18 of 91 runs, and the meaning judge failed 53 of them. The part prompt said to keep every number, date, amount and fact, but nothing about how strong a statement is. The model treated words like "should", "only" and "without delay" as style:

- Data processing agreement, "more formal": "shall inform the Controller without delay" became "without undue delay" in 3 of 3 runs.
- Security policy, "more formal": "Employees who receive a suspicious email should use the report button" became "must use the report button" in 3 of 3.
- Sensor spec, "more concise": "intended exclusively for measuring vibration" lost "exclusively" in 3 of 3, and "The sensor should be installed as close as possible to the bearing" became "Install the sensor as close as possible to the bearing".

The part prompt in `services/document-transform.ts` has one new line. Section rewrites such as "make the passwords section friendlier" go through `edit_document`, not the part calls, so the chat's system prompt has the same rule as one line, starting "When you rewrite text, keep how strong…":

"Keep how strong each statement is: don't turn should into must or into a command, or a definite statement into one with can, may or helps, or any of these the other way round, and keep every word that limits or qualifies a statement, such as only, exclusively, most, always or without delay."

We tried three wordings on the 31 rewrite cases. They passed 30, 30 and 26 of 91. This one, the second, had the fewest meaning failures (36), so it stayed. The third also asked to keep words that narrow whom, what or when a rule applies to; it helped nothing.

Results on gpt-6-luna, full suite (round 17 in `TEST-RESULTS.md`):

- Rewrites passed 28 of 91, against 18: whole-document 23 of 79 (15 before), section 5 of 12 (3). The meaning judge failed 38 runs, against 53. English rewrites went from 7 of 61 to 19 of 61. German stayed at 9 to 12 of 30, because those fail on terms translated two ways, not on meaning.
- In all four runs with the rule, no rewrite wrote "without undue delay" or "must use the report button", and "exclusively" and "strongly recommended" were kept every time.
- Some remain. "The sensor should be installed" still became "Install the sensor" in every run, "Documents for older machines … are added on request" became "can be added" in 2 of 3, and "the entire foundry stops with it" became "is affected" in 3 of 3. Concise rewrites still drop words that limit a rule, such as "Privileged sessions on critical servers are recorded" becoming "Sessions on critical servers are recorded".
- The overall pass rate went from 72.8% ±7.3 to 74.5% ±7.6. Paired by case, that is +1.8 ±3.8 points, within noise. Missing-part cases passed 32 of 41 against 35, and 33 in a rerun, with the same failures as before. That is within noise but worth watching. The other kinds moved by one trial or not at all.

## A meaning check after each rewritten part

After round 17, whole-document rewrites passed 23 of 78 runs, not counting the 64-page case. Most failures were the meaning judge finding a sentence whose meaning had shifted, such as "should be installed" becoming "Install". A bigger model was not the fix: gpt-6.1-sol passed 13 of 30 rewrites.

Each part of a whole-document rewrite now gets one more model call, after its rewrite and before its changes go to the editor. It uses the same model and settings as the part call. It gets the instruction, the part's original blocks and its rewritten blocks, and looks for sentences whose meaning changed: a fact, condition, limit or scope that was lost or changed, or a statement that got stronger or weaker. It returns the whole corrected text of just those blocks, still in the instruction's style, length and language, or an empty list. The corrected text replaces the part's changes for those blocks, and the changes then stream as before.

- A correction for a block the rewrite didn't change, or one that breaks a heading, is ignored.
- If the call fails or takes more than 30 seconds, the part keeps its rewrite. A part with no changes skips the call.
- Its tokens count in the session's token totals and in the eval's token figures.
- Section rewrites such as "make the passwords section friendlier" go through `edit_document`, not the part calls, so they don't get the check.

Two examples, 3 runs each, before and after the check:

- Product specification, "more concise": "The sensor should be installed as close as possible to the bearing" became "Install the sensor …" in 3 of 3 runs. With the check, it stayed "The sensor should be installed …" in 3 of 3.
- Customer case study, "more formal": "When the line stops, the entire foundry stops with it" became "the entire foundry is affected" in 3 of 3 runs. With the check, it stayed "the entire foundry stops" in 2 of 3.

Results on gpt-6-luna, on the 26 whole-document rewrite cases at 3 trials each, against the same cases in round 17 (round 18 in `TEST-RESULTS.md`):

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

What is left:

- Concise rewrites still fail. The maintenance contract, the project plan, the curriculum, the procurement guideline and the security policy failed the meaning judge in 3 of 3 runs, before and after.
- One call misses shifts it can see. We asked the check again on the final text of the 8 meaning failures from the one-trial run, using the blocks around each finding. It flagged the block the judge named in 5 of them. A stricter wording that went sentence by sentence flagged more blocks, but not more of the judge's findings, so it wasn't tried in a run.
- The check can cost tone. In 2 of 3 formal runs on the sample offer, "The customer wants a workshop for 12 people" came out unchanged, and the tone judge failed both as not formal enough. Before the check, every run rewrote it, for example to "would like a workshop". The check most likely put back the original sentence instead of a formal one with the same meaning. This case went from 3 of 3 to 0 of 3.

## Whole-document rewrites: a term sheet and a stronger check

After round 18, whole-document rewrites passed 9 of 26 cases on gpt-6-luna. German translations mixed key terms, because each part is translated on its own. Concise and formal rewrites dropped or changed small words, such as "visitor" in "visitor badge". The grader fails a whole document for one such slip.

A rewrite now runs in four steps:

1. A term sheet. One call reads the whole document and lists the terms every part must word the same way, plus notes such as the form of address. Each part and its check get the terms that occur in that part.
2. The part rewrites, as before, with the term sheet in the prompt.
3. A meaning check per part. It sees each changed block as a word-level difference. Code adds hints when a word such as should, must, only or all changes its count, or when a number or placeholder is lost or added.
4. A repair. Flagged English blocks go to one more call with the original, the rewrite and the problems. Translated blocks get the check's own find-and-replace fix. A lost number or changed placeholder always goes to repair; if the repair still has it, the block keeps its original text.

The check and the repair can run on a stronger model (`LLM_CHECK_MODEL`, `AI_GATEWAY_CHECK_MODEL`). The default is gpt-6-luna, like the rest, to keep the cost down.

One bug turned up: the heading guard rejected any heading that more than doubled in length, so "Air", "2. Scope" and some longer German headings stayed English. A heading may now grow to twice its length plus 20 characters.

What didn't work:

- gpt-6-luna as the checker. It let the same slips through in every run, such as "Nobody will face disciplinary consequences" becoming "No employee will …". It judges them harmless; the grader doesn't. The best luna-only variant passed 15 of 26.
- Letting the check write its own fix. In one run, 3 of 7 meaning failures came from the fix itself, which dropped "early", "immediately" and "production IT".
- Restoring the original of every flagged English block. Meaning failures fell from 7 to 2, but formal rewrites kept informal blocks and concise ones stayed too long.
- Telling the rewriter to change only what the instruction needs. Formal rewrites left conversational headings, and the tone grader failed them.
- A term-sheet note on number formats. The model wrote "1 working day" for "one working day", which the figure check counts as an invented number.
- Before the term sheet was told to list everyday words with several translations, it listed 117 terms for the security policy but not "employee".

Results on the 26 cases, one run each (round 20 in `TEST-RESULTS.md`):

| Setup | Runs | Cases passed per run | Tokens per rewrite | Cost per 1,000 rewrites | Seconds per rewrite |
|---|--:|---|--:|--:|--:|
| Before: round 18 code, gpt-6-luna only | 1 | 9 | 25,800 | $5.20 | 19 |
| New steps, gpt-6-luna only | 4 | 14, 14, 15, 11 | 36,300–41,900 | $7.60–8.90 | 41–46 |
| New steps, check and repair on gpt-6.1-sol | 6 | 18, 22, 19, 17, 19, 21 | 36,200–38,100 | $49–54 | 40–45 |
| Final code, `yarn evals` | 1 | 20 | 39,200 | $55 | 48 |
| Everything on gpt-6.1-sol (earlier effort test) | 1 | 19 | 25,100 | $96 | 40 |

With the stronger check, runs passed 17 to 22 cases, so 80% is about the average, not a floor. The final code passed 21 and then 20. Seconds come from runs with other cases alongside, so one rewrite alone is likely faster. The first change now shows after about 20 seconds instead of 9, mostly because the term sheet comes first.

What is left: the project plan fails every run on one sentence, where "during the realisation phase" moves to the front and covers the whole staffing promise. Other failures change from run to run: one technical term in a translation, one conversational sentence left in a formal rewrite, or one subtle shift such as "require approval" becoming "may require approval".

The eval suite has four problems, left as they are:

- `all-translated` counts "in", "an" and "it" as English words, so "[PERSON_4], Leiter/in IT" counts as English.
- `figures-kept` knows no number word above ten, so "seventy" written as "70" counts as an invented number.
- The eval's token figures leave out the check model's calls, because `run-case.ts` records only the app model. The figures above come from a logging wrapper around both models.
- The translation grader isn't consistent on number formats. One run failed "EUR 4.8 million" as wrong in German; another failed "18.000" because its criteria say numbers stay as written.

## Jest breaks the MongoDB driver from version 7.6

Since version 7.6.0, the MongoDB Node.js driver loads Node's `os` module with a dynamic `import()` in `lib/runtime_adapters.js`. Version 7.5 used `require('os')`. Jest runs CommonJS code inside a VM context, and Node refuses dynamic imports there unless it was started with `--experimental-vm-modules`. The error is `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`.

The driver catches that error and silently falls back to empty handshake metadata. MongoDB 8 then rejects the connection with `Missing required sub-document 'driver' in the client metadata document`. In practice, every database test times out once server selection gives up, and nothing in the message points at Jest. Outside Jest the same driver connects normally; a plain Node script connected in 18 ms. Mongoose 9.11.2 pins `mongodb@~7.7`, so it is affected.

In this PoC, the test script sets the flag:

```json
"test": "NODE_OPTIONS=--experimental-vm-modules jest"
```

Running `jest` directly (through `npx` or an editor's test runner) skips the script, and the failure comes back. The other option is to hand the driver its `os` module through the `runtimeAdapters: { os }` connection option, which works however Jest is started. We didn't use it, because it puts a test-runner workaround into app code.

Pryvet runs Jest and MongoDB. Upgrading to driver 7.6 or later, directly or through a Mongoose upgrade, will break database-backed Jest tests in the same way.

References: [NODE-7603](https://jira.mongodb.org/browse/NODE-7603), [NODE-7385](https://jira.mongodb.org/browse/NODE-7385)

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

Word level also keeps formatting. A whole-block replacement can only carry marks that cover the whole old text, so accepting a reworded paragraph with a link in it loses the link. That's the same as replace_node in auto-accept today. The sample is small, about 45 block pairs from two documents, so check the cutoff on more documents.

### Undo

- An `edit_document` proposal is one undo step.
- A whole-document rewrite shows section by section outside the history. It becomes one undo step when it ends or is stopped, as in auto-accept.
- Each accept or reject, one or all, is its own undo step.

### Stepping through

The bar shows the current suggestion's place, such as "Change 2 of 7", with Previous and Next buttons that move through the pending suggestions in document order and wrap around at both ends. The current suggestion is simply the one at the cursor, so clicking a change makes it current too. Moving to one puts the cursor at its start, scrolls it smoothly to the middle of the editor, rings its old and new text in their own colours, and opens its menu. After Accept or Reject the editor moves on to the next pending suggestion and opens its menu, and the bar goes away after the last one. When an AI edit arrives as suggestions, its first new suggestion becomes current and its menu opens, without taking focus, so the chat input keeps it while the reply streams. The menu shows whenever the cursor is on a suggestion, focused or not, and hides when the cursor moves off the suggestions or none are left. Tiptap's bubble menu hides itself whenever the editor loses focus, so on blur we show it again with the bubble menu's own `show` meta. The menu sits 6px under the last line of the whole change, old and new text together, and flips above only when there's no room below in the editor's scroll area, so it never covers the change. It keeps 8px from the editor's sides and repositions when the editor scrolls. The change is measured when the menu is placed, not before: measuring it earlier put the menu on top of the change whenever the review bar appeared in the same step and pushed the document down. Moving only changes the selection, and the ring is a decoration, so accept, reject and undo work exactly as before. The code is in `components/editor/review-navigation.ts`.

### Auto-accept

Edits apply directly, as before. `applyAcceptedEdits` in `apply-edits.ts` takes an optional mode, and the evals call it without one, which means apply. One undo reverts the whole AI edit. Changed passages now get a green highlight that fades over 2 seconds (`components/editor/change-flash.ts`). It's a decoration, and a timer in the plugin view clears it, so the headless editor in the evals never starts a timer.

### A second turn while suggestions are pending

The model sees the document as if every pending suggestion were accepted. Follow-ups usually build on the last proposal, such as "now make it shorter" or "use buyer instead". The new proposal replaces the old one in that block and is still shown against the original text, so Reject all still brings back the document from before the first turn. Suggestions the user rejected are gone, and accepted ones are part of the text.

With auto-accept on, an AI edit to a block with pending suggestions first accepts that block's suggestions, because the model's edit builds on them. Then it applies directly. Other blocks keep their suggestions.

The mode is read when a message is sent. Flipping the switch while a reply streams changes the next reply, not this one.

### Limits

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
