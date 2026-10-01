# Changelog

All notable changes to Word Buddy are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Word Buddy now requires Firefox 140 or later.
- The extension no longer asks for the `tabs` permission; it only requests
  `storage` and `activeTab`, plus access to the pages it annotates.
- The bundled dictionary is smaller (about 15.7 MB instead of 19.1 MB) and is
  set up one part at a time, so first-time setup holds less in memory.
- Glosses are added to a paragraph when it scrolls into view rather than
  for the whole page at once, and page changes only rescan the part that
  changed.
- Coming back to a tab after the extension has been idle no longer rereads the
  whole dictionary before glosses appear.
- If dictionary setup fails, lookups report the error instead of saying the
  word has no entry. Setup is retried the next time the extension starts.
- Existing installs set up the dictionary again once after updating.

### Fixed

- Selecting a word while the dictionary was still being set up could save the
  inflected form (e.g. "went") to the wordbook instead of its base form ("go").
- Inflected forms of wordbook words (e.g. "went" for "go") were not glossed on
  pages opened during dictionary setup.
- The selection bubble showed up as a tiny unstyled "WB" label, and the notices
  on the options page had no background tint or border.
- Borders on the options page, the toolbar popup and the selection popup did
  not render, and default browser margins leaked into their layout.
- The selection popup grew or shrank with the page's base font size, so on some
  sites it was too small or did not line up with the selected text.
- Reopening the popup for the same word could show the result of an earlier
  "Add to wordbook".
- Each text selection left behind a small listener that was only released when
  the tab closed.
- Selecting text across an existing gloss saved the gloss's Chinese text into
  the word and its example sentence.
- Paragraphs already containing glosses were sent to the translation endpoint
  with the glosses included.
- Lookup context included hidden text and script content, and ran lines split
  by line breaks together.
- Selecting only non-breaking spaces opened the selection bubble.
- Text in nested blocks (such as a paragraph inside a list item) was glossed
  twice, and sections outside an article were not glossed.
- Glosses were inserted into editable areas marked `contenteditable` with a
  value other than `true`, and into pages in design mode.
- A phrase without a dictionary entry that was selected across a line break
  was saved to the wordbook with the line break kept in it.

## [0.1.1] - 2026-05-06

### Changed

- The homepage link and the privacy policy's issue tracker link point to
  <https://github.com/eigenigma/word-buddy>.
