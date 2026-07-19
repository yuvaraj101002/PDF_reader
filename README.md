# PDF Reader — for English Learners

A reading app where English learners import a story, novel, or book (PDF) and improve while reading: tap any word for its meaning and pronunciation, listen to passages read aloud karaoke-style, highlight and annotate, and build a personal vocabulary from what they read.

**One React Native codebase → Android, iOS, and Web** (Expo SDK 57, expo-router). Fully **offline**: extraction, dictionary, and speech all run on-device.

## Features

- 📖 **Reading Mode** — PDFs are analyzed on import (pdf.js, bundled offline) into reflowable text: chapters, paragraphs, sentences. Kindle-style reader with light/sepia/dark themes, font-size control, TOC, in-book search, bookmarks, and position memory ("~N min left").
- 📊 **Analysis** — word count, page count, Flesch-Kincaid grade → CEFR band (A1–C2), page-1 cover thumbnail.
- 🖍 **Highlights & notes** — tap a word or long-press a sentence; 4 colors; notes attach to highlights (underline cue); Notebook view with tap-to-jump and text export.
- 🔊 **Read-aloud** — sentence-by-sentence TTS with karaoke highlighting (word-level where the platform reports boundaries), speed control (0.65×–1.25×), floating mini player.
- 📚 **Offline dictionary** — WordNet definitions/examples/synonyms + CMUdict-derived IPA, compiled into a bundled 16 MB SQLite; lemmatized lookups (*running → run*); definitions appear on every word tap.
- ⭐ **Vocabulary Book** — every looked-up word auto-saved with its source sentence; CSV export (Anki-friendly).

## Development

```bash
npm install               # postinstall copies pdf.js into assets/pdfjs/
npm run build:dictionary  # one-time: compiles assets/dictionary/dictionary.db (~16 MB)
npm run web               # dev server (web)
npm start                 # dev server (Expo Go / dev build)
```

> Both `assets/pdfjs/` and `assets/dictionary/` are generated and gitignored.
> EAS builds regenerate them server-side via the `postinstall` and
> `eas-build-post-install` hooks.

### Android APK (EAS)

```bash
npx eas-cli build --platform android --profile preview
```

## Architecture notes

- **Extraction**: pdf.js everywhere — directly on web, inside a hidden WebView on native (engine delivered as chunked messages from bundled assets; no network).
- **Storage**: repository interface with two backends — Drizzle + expo-sqlite (native), IndexedDB (web). Rows carry UUID / `updatedAt` / soft-delete for future cloud sync.
- **Text addressing**: highlights, notes, bookmarks, and reading position are stored as chapter index + character offsets into extracted chapter text — stable across font changes and ready to sync.

See [PLAN.md](PLAN.md) for the full product plan, milestones, and roadmap (Phase 2: SRS flashcards, stats, translation, accounts/sync).
