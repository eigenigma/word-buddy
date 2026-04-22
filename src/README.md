# Source Architecture

This codebase follows a strict runtime layering rule:

- `src/entrypoints/**` owns browser entry points and UI wiring.
- `src/shared/**` owns runtime-safe contracts, message schemas, DOM helpers, and client helpers.
- `src/background/**` owns persistence, services, and message handling.

## Message flow

The normal request path is:

1. An entrypoint calls a shared runtime client.
2. The client sends a typed runtime message.
3. The background router matches the message against a handler descriptor.
4. The descriptor calls a background service.
5. The service talks to storage, the static dictionary, or the LLM client.

Entry points do not import background internals directly. Shared clients and shared message schemas are the contract between UI code and background code.

## Router pattern

`src/background/router.ts` is a small dispatch registry.

Each feature exports `HandlerDescriptor` values next to its own code, for example:

- `src/background/dictionary/router.ts`
- `src/background/wordbook/router.ts`
- `src/background/settings/router.ts`
- `src/background/llm/router.ts`
- `src/background/siteControl/router.ts`

The top-level router composes those descriptor arrays and tries them in order. A descriptor owns two things:

- the request schema used to parse a message
- the handler used to produce the response

This keeps protocol concerns in router files and keeps domain services focused on domain data.

## Parse at the boundary

External data is parsed once at the system boundary and then treated as trusted inside the app.

Current boundary parsers include:

- runtime messages parsed with zod schemas in `src/shared/runtime/messages/**`
- browser storage reads parsed in `src/background/settings/storage.ts` and `src/background/siteControl/storage.ts`
- dictionary assets parsed in `src/background/dictionary/assets.ts`
- LLM responses parsed in `src/background/llm/openaiClient.ts`

Do not add repeated inner-layer validation after a value has already crossed one of those boundaries successfully.

## Async state pattern

Signal-backed UI state uses one shared helper:

- `src/shared/state/asyncState.ts`

Use it for the common `loading -> ready/error` flow in thin state modules such as:

- `src/entrypoints/options/settingsData.ts`
- `src/entrypoints/options/wordbookData.ts`
- `src/entrypoints/options/siteControlData.ts`
- `src/entrypoints/popup/state.ts`

Keep these modules small. They should coordinate signals and call shared clients, not implement business logic.

## Dependency injection

Background services are assembled in `src/background/composition.ts`.

Business logic should receive collaborators through parameters instead of instantiating them internally. This keeps tests focused and lets the router, storage layer, and services evolve independently.
