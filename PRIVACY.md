# Privacy Policy

_Last updated: 2026-04-21_

Word Buddy is a Firefox extension that inlines glosses for infrequent
English words, lets you collect unknown words into a personal wordbook, and
offers click-to-lookup backed by a local dictionary plus an OpenAI-compatible
LLM endpoint of your choice.

## What Word Buddy processes

- **Page text you are reading.** When annotation or click-to-lookup needs a
  translation, the paragraph containing the target words and the list of
  target words are sent to the LLM endpoint you configured.
- **Your wordbook.** Words you save, plus metadata from the bundled
  dictionary (lemma, phonetic, BNC frequency band, definition).
- **Settings.** LLM endpoint URL, API key, model name, and the per-host
  blocklist you maintain in Options.

## Where data lives

All of the above is stored locally on your device:

- Settings and per-host blocklist: `browser.storage.local`.
- Wordbook and LLM translation cache: IndexedDB (via Dexie).

Nothing is synchronized to any server controlled by the extension author.
The author operates no backend and receives none of your data.

## Where data is sent

The **only** network traffic Word Buddy initiates is to the
OpenAI-compatible LLM endpoint **you configure yourself** in Options. For
example:

- OpenAI (`https://api.openai.com/v1`).
- A local model server (`http://127.0.0.1:11434/v1` for Ollama, a
  `llama.cpp` server, etc.).
- Any other OpenAI-compatible endpoint you point the extension at.

Each translation request sends:

- The paragraph containing the words to gloss.
- The list of words requiring a gloss.
- Your configured model name and API key, as required by the endpoint.

Whoever operates the endpoint you pointed to receives this data. Consult
that provider's privacy policy. Word Buddy itself never sends data to any
other destination.

## What Word Buddy does not do

- No telemetry, analytics, or crash reporting.
- No advertising identifiers or third-party trackers.
- No background network activity; traffic happens only while annotating a
  page or performing a lookup.

## Your controls

- **Per-host pause.** The toolbar popup toggles annotation for the current
  host.
- **Site blocklist.** Options → Site Control persistently disables
  annotation on listed hosts.
- **Wordbook management.** Options → Wordbook lets you search, edit,
  delete, and export entries to CSV.
- **Uninstalling** the extension removes all of its local storage.

## Source

Word Buddy is open source under the MIT license. The source tree is
mirrored on GitHub at <https://github.com/a322655/word-buddy>.

## Contact

Questions or concerns: open an issue at
<https://github.com/a322655/word-buddy/issues>.
