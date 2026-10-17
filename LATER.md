# Later

Decisions we've made, and work we've pushed back until the app is set up and working. This is a working file, not the `FINDINGS.md` the brief asks for. That one holds findings as we hit them, and gets the test-run results later.

## Decisions

### No TanStack Query or Zustand

The brief lists both as part of Pryvet's stack, but neither has a job to do in this PoC.

- TanStack Query: the AI SDK's `useChat` hook already holds the message list and the streaming state. Server components read saved chats from MongoDB before the page reaches the browser. That leaves nothing for the client to fetch or cache.
- Zustand: the editor and the chat share only three things: the focus highlights, the pending changes and the auto-accept toggle. The highlights and pending changes live inside the Tiptap editor state. The toggle sits in the component that renders both panels.

When this moves into Pryvet, the chat state and the toggle can go into their existing stores and queries if that fits their codebase better.

### Zod instead of Joi

Pryvet validates with Joi, but this PoC uses Zod. The AI SDK needs Zod either way: its provider package lists Zod as a required dependency and uses it to read model responses. Zod is also how we describe the JSON shape we want back from the model, and the SDK doesn't accept Joi schemas. Adding Joi on top would mean two libraries doing the same job. The few request checks on our API routes are small enough to rewrite in Joi when the code moves into Pryvet.

### Chat sessions in MongoDB

- Messages are stored as an array inside the session document, not in their own collection. A chat is always loaded whole, so one read gets everything. If sessions ever grow into thousands of messages, they move to their own collection.
- Each session keeps two running totals, input tokens and output tokens. Both go up whenever a message is saved, so cost totals never have to dig through the messages. They're kept separate because input and output tokens are priced differently.
- Types are derived from the Mongoose schemas, never written by hand. Model functions return plain records with `id: string`.

### No `src/` folder

We keep the create-next-app layout, with folders at the root. The lint rules use the same layout.

## Parked for later

### 0. The no-comments lint rule

Our lint rule `local/no-comments` bans every comment. The client's brief asks for "short comments where logic is not obvious". Decided: we keep the rule. The code explains itself through its names and structure, so it needs no comments.

### 1. The diff and review layer

Built. See "Review mode" in `FINDINGS.md`.

- Tiptap's Tracked Changes add-on (`@tiptap-pro/extension-tracked-changes`) is paid and still below 1.0. The brief rules out paid extensions, so we built our own on the free core.
- Two custom marks, `inserted` (green) and `deleted` (red, struck through), in `components/editor/suggestion-marks.ts`. The new text goes next to the old text. Accept removes the deleted text. Reject removes the inserted text.
- Auto-accept applies all operations in one transaction, so a single undo reverts the whole AI edit. Changed passages are highlighted for two seconds.
- `prosemirror-suggestion-mode` is a community package that does Word-style suggestions. We didn't use it because it's a small project and the client asked for popular, well-maintained packages.

### 2. Word-level diff vs. whole-paragraph replacement

Built in `lib/review-diff.ts`, with the `diff` package (jsdiff, BSD-3-Clause). If "The customer wants…" becomes "The client wants…", only "customer" and "client" get marked.

When fewer than half of a block's words stay, the whole block shows as replaced instead. We picked the cutoff from real model outputs. `FINDINGS.md` has the numbers.

### 3. Short node IDs

Built. Tiptap's UniqueID extension now gives every block a short counter ID ("1", "2", …) instead of a 36-character UUID. Every edit operation and every outline entry the model sees repeats these IDs, so the shorter IDs cut tokens on every request. See "Smaller findings" in `FINDINGS.md`.

### 4. Model access: proxy now, gateway later

During development we call models through the local openai-oauth proxy (`http://127.0.0.1:10531/v1`, model `gpt-6-luna`), so there's no API spend. The app switches to the Vercel AI Gateway when `AI_GATEWAY_API_KEY` is set.

Both paths now use OpenAI's Responses API. The proxy path goes through `@ai-sdk/openai`, which replaced `@ai-sdk/openai-compatible` and the proxy's chat endpoint, because that endpoint dropped the thinking setting. Every call sends the same options on both paths: medium effort, medium verbosity, `store: false`, the session ID as the prompt cache key, and parallel tool calls allowed. The gateway passes them on to OpenAI.

- Speed numbers from the proxy aren't representative, because it adds its own delay. The proxy does report token usage. The speed and cost figures in `FINDINGS.md` have to come from runs on the Vercel AI Gateway.
- The proxy can't show three things the paid API does: prompt caching (it almost never reports cached tokens), parallel tool calls (it turns them off) and output limits (it drops `max_output_tokens`). Measure all three on the gateway.
- On the gateway, the same model is `openai/gpt-6-luna`, at $0.10 per million input tokens and $0.50 per million output tokens. We moved from `gpt-5.6-luna` ($0.20 / $1.20), which scores about the same on Terminal-Bench 4.0 (17.3% vs 16.4%) and lower on OpenAI's tool-use benchmark. In our own tests the bigger `gpt-5.6-terra` and `gpt-5.6-sol` gave more wrong answers, at 10 to 20 times the cost.
- The client wants a dropdown to pick the model. Our tools and prompt were tuned on one model, and models differ in how they use tools: `gpt-6-luna` skipped the answer tool a few times in testing. Only offer models that pass our test harness. Thinking settings and caching also work differently per provider. The dropdown is built: it offers only `gpt-6-luna` at medium effort, to keep the cost down, and each reply shows the model that answered it.
- Once we're on the gateway, test where we can cut cost further, for example with cheaper models or smaller prompts.
- Budget: the client set a cap of roughly $25 for API costs. Start with cheap models, and email them before going over.

### 5. The test run

Before we build it: teach the user how evals work (what we measure, how an AI judge works, how the unintended-change rate is computed), one step at a time.

This is the largest piece of work after the app itself. It's close to the app in size.

- Test data: about 20 made-up business documents, 1 to 10 pages each, with 5 typical instructions per document. Synthetic data only. Personal data appears as placeholders like `[PERSON_1]`.
- Each result is measured on four things:
  - whether the instruction was carried out (an AI judge, plus manual spot checks)
  - the unintended-change rate, meaning edits outside the intended scope
  - time to first visible change, and total time
  - input and output tokens per edit
- The results go into `FINDINGS.md`: the results, a recommendation, known limits (tables, lists, very long documents), and a final section called "Open items and path to production".
