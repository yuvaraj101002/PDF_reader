# Dictionary build script (one-time, dev machine only)

Node script that compiles the bundled offline dictionary (`dictionary.db`, SQLite):

- **WordNet** → definitions, examples, synonyms
- **CMUdict** → ARPABET → **IPA** pronunciations
- **Open word-frequency list** → difficulty ranking / known-word features
- **Lemma table** → inflected form → dictionary form (`running` → `run`)

Output is bundled as an app asset and queried read-only by `src/dictionary/`.

Status: not yet implemented (MVP milestone 5).
