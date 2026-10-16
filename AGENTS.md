<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# How this project is built

How the code is organised and written. Follow it for every change.

## Folders

Each kind of code has one home, split by what it does, not by feature. Folders sit at the project root (there's no `src/`, and `@/` points at the root). Create a folder when its first file arrives.

- `app/`: pages and API routes only. Calls services, may read `config/`, may `import type` from `db/schemas/`. Never imports values from `models/` or `db/`.
- `services/`: what the app does, every process and decision. Calls models and other services, and may `import type` from `db/schemas/`. Never imports `app/`, `components/` or `hooks/`, nor values from `db/`.
- `models/`: the only layer that touches the database. One file per collection: it imports the schema from `db/schemas/`, compiles the model (`model(name, schema, undefined, { overwriteModels: true })`) and exports small data-access arrow functions, the CRUD and business functions. Never imports `services/`, `app/`, `components/` or `hooks/`.
- `db/`: `db/client.ts` is the Mongo connection helper. `db/schemas/` holds one Mongoose schema per file (`chat-message.ts`, `chat-session.ts`): the exported `Schema.create(...)`, its index definitions, and the types derived from it, side by side. A schema file never calls `model()` and runs no queries; a sub-schema's types live in the sub-schema's file.
- `config/`: the only place that reads environment variables. `config/` and `db/` sit at the bottom and never import `services/`, `models/`, `app/`, `components/` or `hooks/`.
- `components/`, `hooks/`, `lib/`: browser-safe code. They may `import type` from `db/schemas/`, but never import values from `models/`, `services/`, `db/` or `config/`. `components/ui/` and `lib/utils.ts` come from shadcn (`npx shadcn@latest add <name>`).
- `tests/evals/`: the evaluation suite that runs the real chat and editor code against a model (see `tests/evals/README.md`). Like the rest of `tests/`, it may import any layer. Its `.eval.ts` files run only through `yarn evals`, never through `yarn test`.
- `tests/`: every test, mirroring the source folders (`tests/models/chat-sessions.test.ts` covers `models/chat-sessions.ts`). Never put a test next to the code. Tests may import any layer, values from `db/`, and `mongoose`, and get relaxed lint limits. Jest only runs `tests/**/*.test.{ts,tsx}`.
- Only `models/` and `db/` import the `mongoose` package. Only `models/` imports values from `db/`; every other layer takes only types, with `import type` from `db/schemas/`. Tests may import both.

## How a request flows

1. A page or API route receives the request. An API route stays thin: read the request, call one service, return the result.
2. It calls one service function. That function is the whole process.
3. The service runs its steps in order: a helper in the same file, a model function for anything that touches the database, or a function from another service.
4. The model reads or writes through Mongoose, on the connection from `db/`, and the result goes back up.

Code only calls downward or sideways, never upward. Lint enforces the import rules above.

A service reads like a list of steps, each line feeding the next. Services are long modules: one file holds a whole area of work, exports only what other code calls, and keeps its helpers private in the same file. When a page needs a model read as it is, the service re-exports it (`export { findChatById } from "@/models/chat"`) rather than wrapping it.

Schema files own the shape of the data and its types. The types are derived from the Mongoose schema (`InferSchemaType` and friends) next to it, never written as separate interfaces, and every layer imports them from there with `import type`. Models own the compiled model and the data functions, and make no decisions. Model functions return plain records with `id: string`, never Mongoose documents or `ObjectId`s.

## Server code and browser code

- Every file in `db/` (schemas included) and `models/` starts with `import "server-only"`, so the build fails if browser code reaches the database. Services import models, so they're covered too. An `import type` from `db/schemas/` is erased at build time, so client components can use the schema types safely.
- Pages run on the server: they call a service and pass the result down to components. Browser code gets its data from pages and API routes.

## Code style

- No comments. Encode the intent in well-named functions and variables instead.
- Clear names: no single letters, abbreviations or vague names like `data` or `tmp`. Top-level constants holding a string, number or boolean are in capitals, like `MAX_MESSAGES`.
- Arrow functions everywhere. A default export is `const Home = () => ...`, then `export default Home` at the end of the file.
- No classes, no `let`, no loops. Using a library's class with `new` is fine; for errors use `new Error("message", { cause })`.
- Small functions: at most 10 statements, 3 parameters, complexity 3 and one level of nesting. Components (`.tsx`) may run to 300 lines with complexity 10.
- Guard clauses (early returns) instead of `else`, and no nested ternaries. Inline callbacks are expressions; anything longer becomes a named function.
- `console` is banned. In `.tsx`, use shadcn components instead of raw `<button>`, `<input>` and the like, and theme tokens instead of raw Tailwind colors.

## Formatting and linting

- `yarn format` formats with Biome and sorts imports; `yarn format:check` only checks. Lines are up to 120 characters, with 2-space indents, double quotes and no semicolons. Biome's linter is off, so ESLint is the one linter.
- `yarn lint` runs ESLint (`eslint.config.mjs`). Every rule is an error, and it passes only when it finds nothing. `next build` doesn't lint, so run it yourself.
- `eslint-disable` comments are switched off. Change the code, not the rule.
- Type-check with `yarn tsc --noEmit` (run `yarn next typegen` first on a fresh checkout, for route types like `LayoutProps`). Test with `yarn test`.
- The vendored shadcn files skip our style rules and formatting. The vendored paths in `biome.json` must match `VENDORED` in `eslint.config.mjs`. Change both together.
- In `eslint.config.mjs`, a later block's `no-restricted-imports` replaces an earlier one for the same file, so each layer block lists every pattern for its folder.
