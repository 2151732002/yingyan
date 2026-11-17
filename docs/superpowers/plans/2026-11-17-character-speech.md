# Character Speech Implementation Plan

**Goal:** Let users bind a voice to each character, generate and audition individual saved dialogue lines, and revisit durable task history.

**Architecture:** Java owns voice bindings, immutable speech input snapshots, database job claims and private WAV assets. Next.js adds a 配音 workspace using saved project versions. DeepSeek TTS uses the existing key only when the configured text base is DeepSeek; explicit speech environment variables override it. Character.voiceId remains the existing creative voice description, with actual provider bindings stored separately.

**Approved scope:** The user accepted character selection/audition, per-line generation, revisions/staleness and durable background tasks. No lip sync, video rendering, billing UI or cloned voices.

**Provider constraints:** https://api-docs.deepseek.com/guides/tts/ (checked 2026-11-17): stella/tide, WAV, no speed/emotion controls. Generate only speed=1; preserve emotion notes but clearly state they are not applied. No automatic paid retries. Interrupted in-flight jobs fail after their lease; queued jobs survive restart.

- [x] Write failing integration tests for queue snapshots, voice CAS, stale versions, failures, ownership, duplicate requests and restart recovery; protocol tests for WAV validation and provider errors.
- [x] Add SpeechModels/Mapper/Service/Worker/Provider/Controller; additive tables and backend-only configuration. Bounded queue and response sizes, claim tokens, private playback and immutable history.
- [x] Add 配音 tab: explicitly saved voice bindings, previews, per-line generation/history, task polling, staleness, browser sequence audition with pauses and mobile layout. Disable generation for unsaved drafts and show conflict/reload actions.
- [x] Run H2 and isolated MySQL tests; frontend lint/typecheck/build and browser flows including real Java speech queue using a local provider protocol fixture. Never label fixture audio as real synthesis.
- [x] If configured, synthesize only fictional QA text for a live provider check; keep keys and user stories private.
- [ ] Document setup/API/limits/evidence, commit/push to the authorized repository, pull/restart the independent desktop checkout and verify existing data remains intact.

