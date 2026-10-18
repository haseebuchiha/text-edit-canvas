# Text Edit Canvas

A proof of concept for Pryvet: a Tiptap rich-text editor next to an AI chat. The goal is for the user to ask the chat for changes to the document and review each change as a diff before it's applied. That editing isn't built yet. Today the chat is a plain conversation, and the model never receives the document.

## Status

Works today:

- The editor opens a built-in sample document (`lib/sample-document.ts`) with headings, lists, tables and links. Its toolbar covers bold, italic, two heading levels, bullet lists, links and tables. Edits aren't saved. Tiptap's UniqueID extension gives headings, paragraphs, list items, table rows and the other block types listed in `components/editor/editor-extensions.ts` a stable ID, which the planned edit operations will refer to.
- The chat streams replies, can stop and retry, and shows the model's reasoning when the model returns it.
- Each chat is a session in MongoDB. Opening `/` creates a session and redirects to `/chat/<id>`; reloading that URL restores the history. The "New chat" button starts another session.
- Each reply stores its input and output tokens, and each session keeps running totals of both.
- Review mode: with the "Auto-accept" switch off (the default), AI edits show as suggestions, removed text in red and struck through, added text in green. Click a suggestion to accept or reject it, or use "Accept all" and "Reject all" in the bar above the document. Undo and redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z) step through proposing, accepting and rejecting. With the switch on, edits apply directly and one undo reverts the whole AI edit.

The three edit strategies the brief asks to compare (full rewrite, highlighted sections only, and JSON patch operations) were tested end to end on the eval cases. The app uses patch operations. Results, known limits and the recommendation are in "Edit strategies" in [`FINDINGS.md`](FINDINGS.md#edit-strategies).

[`LATER.md`](LATER.md) explains where this PoC departs from Pryvet's stack (Zod instead of Joi, no TanStack Query or Zustand).

## Setup

You need Node.js 24 (developed on 24.14.1), Yarn 1 (developed on 1.22.22), and Docker or a local MongoDB.

1. Install the dependencies:

   ```bash
   yarn install
   ```

2. Start MongoDB 8 in Docker, reachable only from localhost:

   ```bash
   docker run -d --name pryvet-mongo -p 127.0.0.1:27017:27017 mongo:8.0
   ```

   After a reboot, `docker start pryvet-mongo` starts it again. Any local MongoDB on port 27017 works too.

3. Create the env file:

   ```bash
   cp .env.example .env.local
   ```

   `MONGODB_URI` already points at the database from step 2. For the model, fill in one of two options:

   - Vercel AI Gateway: set `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL`. Gateway model IDs have the form `provider/model`, for example `openai/gpt-5.6-luna`.
   - Any endpoint that serves OpenAI's Responses API: set `LLM_BASE_URL` (the base URL ending in `/v1`; the app calls `/responses` under it) and `LLM_MODEL`, plus `LLM_API_KEY` if the endpoint needs one. The example value `http://127.0.0.1:10531/v1` is a local OAuth proxy used during development; replace it unless you run that proxy.

   When `AI_GATEWAY_API_KEY` is set, the gateway wins and the `LLM_*` values are ignored.

4. Start the dev server:

   ```bash
   yarn dev
   ```

   Open http://localhost:3000; it redirects to a new chat at `/chat/<id>`.

## Scripts

| Command             | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `yarn dev`          | Starts the Next.js dev server on port 3000.                          |
| `yarn build`        | Builds for production. It doesn't run ESLint; run `yarn lint` too.   |
| `yarn start`        | Serves the production build from `yarn build`.                      |
| `yarn test`         | Runs the Jest tests in `tests/`.                                     |
| `yarn lint`         | Runs ESLint. Any finding fails the run.                              |
| `yarn format`       | Formats the code with Biome and sorts imports, writing the changes.  |
| `yarn format:check` | Checks formatting with Biome without changing files.                 |
| `yarn evals`        | Runs the evaluation suite; see `tests/evals/README.md`.              |

The tests need MongoDB on `127.0.0.1:27017`. They create databases whose names start with `pryvet-test`, drop them afterwards, and don't call a model. `yarn test` sets `NODE_OPTIONS=--experimental-vm-modules`, because without it the MongoDB driver can't connect inside Jest ([`FINDINGS.md`](FINDINGS.md) has the details). Run the tests through `yarn test`; calling `jest` directly skips the flag and the database tests time out.

## Architecture

### Folders and imports

Folders sit at the project root (no `src/`), and `@/` points at the root. Calls go downward only: `app → services → models → db`.

| Folder                          | Holds                                                                      | May import                                                         |
| ------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `app/`                          | pages and API routes                                                       | `services/`, `components/`, `config/`, types from `db/schemas/`    |
| `services/`                     | the processes: the chat flow, model selection                              | `models/`, other services, `config/`, types from `db/schemas/`     |
| `models/`                       | data access, one file per collection                                       | `db/`, `mongoose`                                                  |
| `db/`                           | `client.ts` (connection), `schemas/` (Mongoose schemas and their types)    | `config/`, `mongoose`                                              |
| `config/`                       | `env.ts`, the only code that reads environment variables                   | no project folders                                                 |
| `components/`, `hooks/`, `lib/` | browser code; `components/ui/` is vendored from shadcn                     | each other, types from `db/schemas/`                               |
| `tests/`                        | Jest tests, mirroring the source folders                                   | anything                                                           |
| `tests/evals/`                  | the evaluation suite: documents, scenarios with their cases and checks     | anything                                                           |

Apart from tests, only `models/` and `db/` import `mongoose`, and every file in them starts with `import "server-only"`, so the build fails if browser code reaches the database. ESLint enforces the import rules. `tests/evals/` holds the evaluation suite: 23 frozen test documents in Tiptap JSON, five scenarios with their cases and checks, and the code that runs them against the app's model and grades the result ([`tests/evals/README.md`](tests/evals/README.md)). `yarn test` never runs an eval. Code style and lint rules are in [`AGENTS.md`](AGENTS.md).

### Chat message flow

```
components/chat/chat-panel.tsx   useChat sends { id: sessionId, message: newest user message }
        │  POST /api/chat
        ▼
app/api/chat/route.ts            validates the body (Zod, safeValidateUIMessages); 400 if invalid
        ▼
services/chat.ts                 streamChatReply
        ├─ services/llm.ts       createConfiguredModel; 503 if no model is configured
        ├─ models/chat-sessions  findChatSessionById; 404 if the session doesn't exist
        ├─ streamText            system prompt + saved messages + the new message
        └─ toUIMessageStream     streams the reply to useChat, token usage in the finish metadata
                 │  onEnd, completed replies only
                 ▼
models/chat-sessions.ts          appendChatMessages: $push both messages, $inc token totals
```

The browser sends only the newest message, and the server rebuilds the history from MongoDB. The user message and the reply are saved together in one update after the reply completes; nothing is saved when the reply fails.

### Data model

There is one collection, `chatsessions`. Each document has a `title`, the `messages` array, `totalInputTokens`, `totalOutputTokens`, `createdAt` and `updatedAt`, with an index on `updatedAt`. Messages are embedded because a chat always loads whole. A message stores the AI SDK `UIMessage` fields (`id`, `role`, `parts`), plus `inputTokens` and `outputTokens` on replies, and `createdAt`. The update that appends messages also raises the session totals, so per-session token counts need no aggregation.

The types (`ChatSession`, `ChatMessage` and so on) are derived from the Mongoose schemas with `InferSchemaType` in `db/schemas/`. Model functions return plain objects with `id: string`, not Mongoose documents.

### Model provider

`services/llm.ts` picks the model on every request:

1. If `AI_GATEWAY_API_KEY` is set, it uses the Vercel AI Gateway with `AI_GATEWAY_MODEL`. When that ID is missing or not in `provider/model` form, no model is configured; there is no fallback to the `LLM_*` settings.
2. Otherwise it uses `@ai-sdk/openai` with `LLM_BASE_URL`, `LLM_MODEL` and the optional `LLM_API_KEY`, through OpenAI's Responses API. Without `LLM_API_KEY` it sends an empty key, and never falls back to `OPENAI_API_KEY`.
3. If neither is complete, `/api/chat` answers 503 with a message naming the settings to fill in.

The chat composer has a model menu. Its button shows the chosen provider's logo and name; the menu lists the providers, and each opens a submenu of its models, the provider's cheap default first, with a check mark on the chosen one and a muted hint of its price for a million input plus a million output tokens, relative to `gpt-6-luna`. The models live in `CHAT_MODELS` (`lib/chat-models.ts`), one entry each with the ID the client sends, the provider, a short name, the logo, the gateway model ID and the gateway price:

- GPT: `openai/gpt-6-luna` (the default), `openai/gpt-6.1-sol`, `openai/gpt-6-sol`, `openai/gpt-5.6-luna`
- Claude: `anthropic/claude-haiku-5.5`, `anthropic/claude-sonnet-5.5`, `anthropic/claude-opus-5.5`, `anthropic/claude-opus-5`
- Gemini: `google/gemini-3.8-flash`, `google/gemini-4-argon`, `google/gemini-3.7-flash`, `google/gemini-3.5-flash-lite`
- DeepSeek: `deepseek/deepseek-v4.1-flash`, `deepseek/deepseek-v4-flash-vision-exp`, `deepseek/deepseek-v4-flash`, `deepseek/deepseek-v3.1`
- Grok: `spacexai/grok-4.3`, `spacexai/grok-4.7`, `spacexai/grok-4.6`, `spacexai/grok-4.5`

Each provider has its cheap default plus its newest models (by release date) in the public AI Gateway model list that support tool use and structured output, at most four in all. Left out: `gpt-6-astra`, anything priced at $10 / $50 per million tokens or more, `-pro` models, gpt-oss, Codex and coding-only models, and the `-fast`, `-batch` and dated copies of a listed model. The page offers only the models the current path serves, all twenty on the gateway and the four GPT models on the proxy, which lists all four in its `/v1/models`, and `/api/chat` answers 400 for any other. The chosen model runs the chat call and the section calls of a whole-document rewrite, and a request that names none falls back to `LLM_MODEL` or `AI_GATEWAY_MODEL`. Each reply saves and shows the model ID and its thinking: medium for OpenAI models, and default for the others, which ignore the OpenAI options below.

A whole-document rewrite checks each rewritten part on a second model, the check model, which also repairs the blocks whose meaning changed. By default it is the chat's own model, the one picked in the dropdown. `AI_GATEWAY_CHECK_MODEL` on the gateway or `LLM_CHECK_MODEL` on the other path sets a different one. A stronger check model such as gpt-6.1-sol makes rewrites more accurate at about ten times the cost.

Every model call, the chat call and each section call of a whole-document rewrite, sends the same OpenAI options on both paths (`createModelOptions` in `services/llm.ts`; the gateway passes them on to OpenAI): medium reasoning effort, medium text verbosity, `store: false`, the chat session ID as the prompt cache key, and parallel tool calls allowed. With `store: false` the SDK asks for the model's reasoning in encrypted form and sends it back on the next step, so reasoning carries across tool calls without being stored.

## Dependencies and licenses

Versions are the installed ones; licenses come from each package's `package.json` in `node_modules`.

### dependencies

| Package                       | Version | License      |
| ----------------------------- | ------- | ------------ |
| `@ai-sdk/openai`              | 4.0.93  | Apache-2.0   |
| `@ai-sdk/react`               | 4.0.142 | Apache-2.0   |
| `@base-ui/react`              | 1.9.0   | MIT          |
| `@shadcn/react`               | 0.3.1   | MIT          |
| `@tiptap/extension-table`     | 3.32.0  | MIT          |
| `@tiptap/extension-unique-id` | 3.32.0  | MIT          |
| `@tiptap/pm`                  | 3.32.0  | MIT          |
| `@tiptap/react`               | 3.32.0  | MIT          |
| `@tiptap/starter-kit`         | 3.32.0  | MIT          |
| `ai`                          | 7.0.139 | Apache-2.0   |
| `class-variance-authority`    | 0.7.1   | Apache-2.0   |
| `cn`                          | 0.4.0   | MIT          |
| `diff`                        | 9.0.0   | BSD-3-Clause |
| `lucide-react`                | 1.56.0  | ISC          |
| `mongoose`                    | 9.11.2  | MIT          |
| `next`                        | 16.4.0  | MIT          |
| `react`                       | 19.3.0  | MIT          |
| `react-dom`                   | 19.3.0  | MIT          |
| `shadcn`                      | 4.21.4  | MIT          |
| `tw-animate-css`              | 1.4.0   | MIT          |
| `zod`                         | 4.6.7   | MIT          |

### devDependencies

| Package                                | Version  | License                   |
| -------------------------------------- | -------- | ------------------------- |
| `@biomejs/biome`                       | 2.5.15   | MIT OR Apache-2.0         |
| `@shadcn/lint`                         | 0.2.0    | MIT                       |
| `@tailwindcss/turbopack`               | 4.3.3    | MIT                       |
| `@types/jest`                          | 30.0.0   | MIT                       |
| `@types/node`                          | 20.19.43 | MIT                       |
| `@types/react`                         | 19.3.0   | MIT                       |
| `@types/react-dom`                     | 19.3.0   | MIT                       |
| `eslint`                               | 9.39.5   | MIT                       |
| `eslint-config-next`                   | 16.4.0   | MIT                       |
| `eslint-plugin-better-tailwindcss`     | 4.7.0    | MIT                       |
| `eslint-plugin-functional`             | 10.0.1   | MIT                       |
| `eslint-plugin-prefer-arrow-functions` | 3.10.2   | MIT                       |
| `eslint-plugin-unicorn`                | 65.0.1   | MIT                       |
| `jest`                                 | 30.5.2   | MIT                       |
| `tailwindcss`                          | 4.3.3    | MIT                       |
| `typescript`                           | 5.9.3    | Apache-2.0                |

### Copied assets

The provider logos in `lib/provider-logos.ts` are the monochrome SVG paths of [Lobe Icons](https://github.com/lobehub/lobe-icons) (`@lobehub/icons-static-svg` 1.95.1), copied rather than installed. They are under the [MIT License](https://github.com/lobehub/lobe-icons/blob/master/LICENSE), Copyright (c) 2023 LobeHub.

## Humanizer

The prose in this repository's Markdown files was run through [Unslop](https://github.com/jlwin/unslop_ai), the humanizer the brief recommends.
