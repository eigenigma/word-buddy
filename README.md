# Word Buddy

A Firefox vocabulary helper for English reading.

Word Buddy inlines concise glosses for infrequent English words directly into
any web page, lets you collect unknowns into a personal wordbook, and exposes
a click-to-lookup popup backed by a local dictionary plus an OpenAI-compatible
LLM endpoint.

## Features

- **Inline annotation.** Infrequent words get a small gloss rendered next to
  the original word. Page scanning uses an Aho-Corasick trie with failure
  links over your wordbook (typically a few hundred entries), streaming
  paragraphs through an `IntersectionObserver`/`MutationObserver` pipeline.
- **Click-to-lookup.** Select any word on the page to see its lemma, phonetic,
  BNC frequency band, and definition. One tap adds it to the wordbook.
- **Personal wordbook.** Dexie-backed IndexedDB store with search, inline
  editing, row deletion, and CSV export.
- **LLM translation cache.** SHA-256 content-addressable cache keyed by
  `model + paragraph + sorted words`; switching models invalidates entries.
  Any OpenAI-compatible endpoint works (OpenAI, local `llama.cpp`/`ollama`,
  etc.).
- **Per-site control.** Pause/Resume toggle for the current host from the
  toolbar popup, plus a persistent host blocklist managed in Options.
- **Local-first.** All state lives in `browser.storage.local` and IndexedDB.
  No telemetry. The only outbound traffic is to the LLM endpoint you
  configure.

## Installation

### From Firefox Add-ons (recommended)

Install from the
[Word Buddy listing on addons.mozilla.org](https://addons.mozilla.org/firefox/addon/word-buddy/).
Future versions update automatically via AMO.

### Unpacked (for hacking)

```sh
bun install
bun run fetch:dict
bun run build:dict
bun run build:firefox
```

Load `.output/firefox-mv3/` from `about:debugging` via
"Load Temporary Add-on".

## Configuration

1. Click the Word Buddy toolbar icon, then **Open options**.
2. In **Settings**, configure an OpenAI-compatible endpoint, API key, and
   model. Examples:
   - `https://api.openai.com/v1` + `gpt-4o-mini`
   - `http://127.0.0.1:11434/v1` + `qwen2.5:7b` (local Ollama)
3. In **Site Control**, add hosts where annotation should never run.
4. In **Wordbook**, search, edit, and delete collected words; export to CSV.

The toolbar popup exposes a per-host Pause/Resume toggle for the current tab.

## Permissions

| Permission     | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `storage`      | Persist settings, wordbook, translation cache, blocklist  |
| `activeTab`    | Interact with the current tab for lookups and annotation  |
| `tabs`         | Broadcast setting changes to open tabs for invalidation   |
| `<all_urls>`   | Annotate English text on any site you visit               |

## Development

### Prerequisites

- [Bun](https://bun.sh) 1.1 or newer
- Firefox 115 or newer

### Dictionary data

The shipped dictionary is built from two public data sets that are **not**
checked into the repo: [ECDict](https://github.com/skywind3000/ECDICT) and
[lemma.en](https://github.com/skywind3000/lemma.en). `scripts/dict/sources.ts`
pins each one to an upstream commit and a SHA-256.

1. `bun run fetch:dict` downloads them into `data/raw/`, or verifies the
   copies already there.
2. `bun run build:dict` checks `data/raw/` against the same hashes, then
   generates sharded dictionary artifacts under `public/data/` (`dict-0.json`,
   `dict-1.json`, ... plus `lemma-index.json` and `dict-meta.json`). Shards
   are sized to stay under AMO's 5MB per-file linter threshold; the exact
   count is recorded in `dictShardCount` of `dict-meta.json`.

### Reproducing an AMO submission build

```sh
bun install --frozen-lockfile
bun run fetch:dict
bun run build:dict
bun run zip             # produces .output/*-firefox.zip and *-sources.zip
```

### Commands

```sh
bun install              # install deps (runs `wxt prepare` via postinstall)
bun run fetch:dict       # download or verify the pinned dictionary sources
bun run build:dict       # rebuild dictionary artifacts from data/raw/
bun run build:firefox    # build unpacked extension into .output/firefox-mv3
bun run zip              # build + pack xpi and sources zip for AMO
bun run submit:firefox   # upload to AMO as listed (requires .env.submit)
bun run typecheck        # tsc --noEmit
bun run lint             # biome check .
bun run format           # biome format --write .
bun run test             # vitest run
bun run test:watch       # vitest watch mode
bun run test:coverage    # vitest run --coverage
```

### Layout

```text
src/
├── background/        # message handlers, DI wiring, service factories
├── entrypoints/       # WXT entry points
│   ├── background.ts
│   ├── annotator.content/   # page annotator content script
│   ├── selection.content/   # click-to-lookup content script
│   ├── popup/               # toolbar popup
│   └── options/             # options page (settings, site control, wordbook)
└── shared/            # matching, dictionary, runtime messages, DOM utils
```

Key design choices:

- Aho-Corasick trie with failure links for paragraph-level scanning with
  whole-word boundary detection.
- Content-addressable translation cache keyed by SHA-256 over
  `model + paragraph + sorted words`.
- Pure-function services, dependency-injected message handlers — no
  business-logic module instantiates its own collaborators.
- Shadow DOM isolation for the selection popup card so page CSS can't leak
  in.

## Release

Published to AMO as a **listed** add-on. Submission credentials live in
`.env.submit`, which is gitignored; copy `.env.submit.example` and fill in
JWT credentials from the
[AMO Developer Hub](https://addons.mozilla.org/developers/addon/api/key/).

1. Bump `version` in `package.json`.
2. `bun run zip` — builds `.output/*-firefox.zip` and `.output/*-sources.zip`.
3. `bun run submit:firefox` — uploads to AMO; the version goes through
   review before publication.
4. After review passes, the listing page at
   `https://addons.mozilla.org/firefox/addon/word-buddy/` serves the new
   version. Installed copies auto-update via AMO.

See [`PRIVACY.md`](./PRIVACY.md) for the privacy policy linked from the AMO
listing.

## License

[MIT](./LICENSE)

Dictionary data is courtesy of
[ECDict](https://github.com/skywind3000/ECDICT) and
[lemma.en](https://github.com/skywind3000/lemma.en).
