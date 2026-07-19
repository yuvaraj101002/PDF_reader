# PDF Reader for English Learners — Product Plan

> Planning doc. Status: **MVP COMPLETE + polish passes 1–2** — M1–M6 shipped, plus: persisted reader settings, app-wide dark mode, in-book search, min-left estimate, bookmarks, notes/vocab export, import progress, page-1 covers, delete cleanup. First **APK built via EAS** (project @yuvaraj_canwin/pdf-reader; hooks compile dictionary + copy pdf.js server-side). **Remaining: device-test feedback → rebuild APK → Phase 2 (SRS flashcards first).**
> Targets: **iOS, Android, and Web** from one React Native codebase, using native RN components/gestures (no HTML-styled UI).

## Vision

A reading app where English learners upload a story, novel, or book (PDF) and improve their reading skill while reading: tap any word for meaning and pronunciation, listen to any passage read aloud, highlight and annotate, and build a personal vocabulary from what they read.

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Reading experience | **Reading Mode first** — extract text on upload, render as native reflowable text (Kindle-style). Original-PDF view is a later addition. | Learner features (tap-word, TTS tracking, highlights) need text, not page coordinates. Reflow enables font control and identical rendering on mobile + web. |
| Data & accounts | **Local-first** — MVP stores everything on-device. Accounts + cloud sync arrive in Phase 2 with the web app. | Faster to ship; no auth/backend for MVP. |
| AI (LLM) features | **No AI in the MVP** (shipped fully offline; rule-based grammar-lite done). AI is now a planned phase — see **Phase 4: AI** below. | Core app must never depend on connectivity; AI arrives as an additive online layer via the user's Microsoft stack (Entra ID + Azure OpenAI). |

## Core Architecture Concept

```
Upload PDF
   └─► Extraction pipeline
          ├─ text extraction (per page)
          ├─ structure detection: chapters → paragraphs → sentences → words
          ├─ metadata: title, cover thumbnail, word count, est. reading time
          └─ difficulty score (Flesch-Kincaid → CEFR band A1–C2)
   └─► Structured book document (JSON) stored locally
   └─► Reader renders native reflowable text from the structured document
```

- Highlights, notes, and vocabulary entries are stored as **text ranges** (chapter/paragraph/character offsets) — stable across font-size changes and ready for future cloud sync.
- Scanned (image-only) PDFs: detect and reject gracefully in MVP ("This PDF has no selectable text"). OCR is Phase 3.

## Feature Set

### Phase 1 — MVP (core loop)

**Library & Upload**
- Import PDF from device / share sheet
- Extraction pipeline (above); progress indicator during analysis
- Library grid: cover, title, difficulty badge, reading progress %, "Continue reading"

**Reader (Reading Mode)**
- Paginated and scroll modes; font size/family, line spacing, margins
- Themes: light / dark / sepia
- Table of contents, in-book search, bookmarks, auto-saved position
- Progress: "34% · 12 min left in chapter"

**Highlights & Notes**
- Select word / sentence / paragraph → highlight (multiple colors)
- Attach note to any highlight; tap highlight → note popup
- Notebook screen per book: all highlights + notes, jump-to-location, export as text

**Learner Tools**
- Tap word → popup: definition, IPA phonetics, 🔊 pronunciation audio, examples, synonyms
- Read Aloud (TTS): word / sentence / paragraph / continuous; 0.5×–2× speed; voice picker; karaoke-style word highlighting during playback
- Every looked-up word auto-saved to the Vocabulary Book with its source sentence

### Phase 2 — Learner engine + Web
- Spaced-repetition flashcards (SRS) from the Vocabulary Book; daily review
- Tap-to-translate word/sentence into user's native language (set at onboarding)
- Onboarding: native language + quick level test
- Reading stats: daily goal, streaks, minutes read, words learned
- Accounts + cloud sync (local data migrates up); web app ships here
- Export vocabulary to Anki/CSV
- Grammar-lite (offline, rule-based POS coloring) — if feasible without AI

### Phase 3 — Delight
- Pronunciation practice: user reads aloud, speech-recognition scores vs. text
- Known-word tracking → unknown words subtly marked; book-difficulty match ("92% within your vocabulary")
- Built-in free library (Project Gutenberg public-domain classics)
- EPUB and TXT import
- OCR for scanned PDFs
- Original-PDF layout view (secondary mode)
- Accessibility: dyslexia-friendly font, high-contrast mode

### Phase 4 — AI layer (planned, not started)

Owner context: user has a licensed Microsoft Copilot seat and an **Entra ID app
registration**. Reality check that shapes this plan:

- A **Copilot license (M365 or GitHub) is an end-user product — it exposes no
  API our app can call.** It cannot power in-app features.
- The **Entra app registration is the right key** — it authenticates a backend
  to **Azure OpenAI (Azure AI Foundry)**, which IS the callable API in the
  Microsoft stack. **Prerequisite to verify before any code:** access to an
  Azure subscription where an Azure OpenAI resource can be created (often
  available under a work tenant). If that's absent, the same architecture works
  with any OpenAI-compatible endpoint — only the proxy's target changes.

**Architecture (locked principles)**

```
RN app (web + native)
   └─► our tiny proxy backend (Azure Functions, Entra-authenticated)
          ├─ holds ALL credentials (managed identity → Azure OpenAI; zero secrets in the app bundle)
          ├─ per-device rate limits + daily caps (cost control)
          └─ prompt templates live server-side (tunable without app releases)
   └─► Azure OpenAI deployment (gpt-4o-mini class — cheap, fast, plenty for learner tasks)
```

- **Offline-first is preserved:** every AI feature is additive; buttons hide
  when offline; nothing existing regresses.
- **Cache aggressively:** responses stored locally keyed by
  `(feature, sha256(text))` — a re-tapped sentence is free and works offline
  afterwards.
- **Privacy:** only the selected snippet (+ ≤1 neighboring sentence) leaves the
  device. Settings gains an "AI features (online)" toggle, off until consented.
  Full-book upload only for opt-in Ask-the-book indexing (A4).

**Feature roadmap (each slots into existing UI)**

| Stage | Feature | Where it plugs in |
|---|---|---|
| A1 | **"✨ Explain simply"** — simplify a sentence + plain-English grammar notes ("why 'have been going'?") | Selection sheet, next to 🎨 Grammar |
| A1 | **Meaning in THIS sentence** — context-aware sense pick above the WordNet senses | Word sheet definition panel |
| A2 | **Tap-to-translate** word/sentence into the user's native language (asked once at onboarding) | Selection sheet + word sheet |
| A2 | **Chapter preview** — 3-sentence summary + 5 key words before starting a chapter | TOC sheet / chapter header |
| A3 | **Auto-quizzes** — cloze questions + distractors generated from saved vocab, graded into the existing SM-2 scheduler | Review screen (new "Quiz" mode) |
| A4 | **Ask the book** — RAG Q&A over the current book (embed our existing paragraph chunks, retrieve, answer with citations that tap-to-jump) | New sheet in the reader |

**Build order when we start:** verify Azure OpenAI access → Functions proxy +
Entra wiring + rate limits → `src/ai/` client module (online detection, cache,
typed per-feature calls) → A1 features → consent/onboarding toggle → A2 → A3 → A4.

## Screens (MVP)

1. **Library** — book grid, import button, progress badges
2. **Reader** — the core screen; selection popover (Highlight / Note / Speak / Define), TTS mini-player
3. **Word popup** — bottom sheet: definition, IPA, audio, examples, save state
4. **Notebook** — highlights & notes list per book
5. **Vocabulary Book** — saved words across all books
6. **Book details** — metadata, difficulty, TOC, reading stats
7. **Settings** — reader defaults, TTS voice/speed, theme

## Non-negotiable UX rules

- Full mobile-native behavior: gesture-driven selection, bottom sheets, haptics, momentum scrolling — no HTML-styled web UI on mobile.
- Dictionary and TTS must work offline (bundled/on-device where possible).
- Reader must stay 60fps with highlights rendered inline.

## Approved Stack

| Slot | Choice | Notes |
|---|---|---|
| Framework | **Expo (current SDK) + expo-router + TypeScript**, EAS dev builds | One codebase → iOS/Android/Web (`react-native-web` built in). Not limited to Expo Go. |
| UI layer | RN primitives + `react-native-gesture-handler` + `reanimated` + `@gorhom/bottom-sheet` + `@shopify/flash-list` | Native sheets/gestures/haptics; virtualized lists for reader & library. |
| State | Zustand | Light, works on all targets. |
| PDF extraction | **pdf.js everywhere** — directly on web, inside a hidden `react-native-webview` on mobile | One extractor, one output format, Apache-2.0. Own JS pipeline on top: heading heuristics → chapters, line grouping → paragraphs, `sbd` → sentences, `syllable` → Flesch-Kincaid → CEFR. |
| Dictionary | **Bundled SQLite** compiled by our build script (`scripts/build-dictionary/`) | WordNet (defs/examples/synonyms) + CMUdict→IPA + open frequency list + lemma table. Fully offline. Pronunciation audio = TTS speaking the word. |
| TTS | **expo-speech** first; `react-native-tts` fallback if Android word-boundary events are unreliable | Karaoke highlighting needs word-timing events — spike early. Cloud TTS = Phase 2 premium option only. |
| Local DB | **expo-sqlite + Drizzle ORM** | Same engine for app data + dictionary. UUID + `updated_at` + soft-delete on every row → Phase 2 sync-ready. Web via WASM backend. |
| Grammar-lite (Phase 2) | `compromise` or `wink-nlp` | Offline POS tagging, MIT — no AI API needed. |

**Known risks:** reader perf with per-word tap targets (spike: FlashList + nested Text spans; scroll mode before pagination) · Android TTS boundary events (week-1 spike) · chapter-detection heuristics on messy PDFs (ship manual "edit chapters" escape hatch) · dictionary build effort (one-time Node script).

**MVP build order:** scaffold → extraction spike → **offline pdf.js bundling** (spike ships with a CDN shortcut; bundle pdf.js as a local asset so import works with zero internet — must land before reader work starts) → reader core → highlights/notes → dictionary → TTS/karaoke → library polish.

> Offline rule: the entire app — including PDF import — must work with no connectivity. The CDN load in the extraction WebView is a spike-only shortcut, tracked as Milestone 2.5.
