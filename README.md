# PostMuse

PostMuse is a local-first Chrome extension for preparing content for X. The product and
architecture specifications live in the separate `docs` repository.

## Phase 7 status

The current implementation contains:

- A Chrome Manifest V3 extension shell.
- A React and TypeScript Side Panel.
- English and Simplified Chinese interface loading.
- A persisted interface language preference.
- Background and X content-script entry boundaries.
- Versioned local settings and provider profiles.
- Session-only or opt-in persistent API key storage, restricted to trusted extension contexts.
- Runtime-validated messages with a trusted-sender guard.
- Exact, user-triggered Provider origin permissions.
- Quick and Advanced model settings for OpenAI-compatible, Anthropic, Gemini, and xAI.
- A local-only setup check that sends no Provider request.
- A default Create workflow for posts, replies, quotes, threads, and Premium long posts.
- Independent output-language, built-in style, length, audience, goal, and tone controls.
- Direct BYOK text generation through OpenAI-compatible Chat Completions, Anthropic Messages,
  Gemini generateContent, and xAI Chat Completions.
- Structured-output parsing with deterministic repair and an editable raw-text fallback.
- Editable candidates and threads with character counts and clipboard copy.
- Local `.txt` and `.md` input with a 1 MiB file limit.
- Request cancellation, a 60-second timeout, bounded retries, and stable error mapping.
- A versioned library of 10 built-in writing styles with stable IDs.
- Local custom styles, built-in overrides, hiding, ordering, individual restore, and restore all.
- Create automatically reflects prompt changes while preserving the current draft.
- User-editable style instructions remain isolated from product policy, output schema, and source data.
- IndexedDB history keeps the latest 100 structured generations with search, edit, copy, reuse,
  delete, clear, and an opt-out for new saves.
- A low-intrusion X action-bar trigger reads only the user-selected visible Post and opens an
  isolated Shadow DOM panel for Rewrite, Reply, or Quote drafts.
- Related quoted context is shown locally and enters a request only after explicit opt-in.
- The inline panel can hand a one-shot input to the Side Panel; it never fills a composer or
  clicks an X publish control.
- X DOM observation is batched and idempotent, with cleanup for virtual-list node removal.
- Content-script messages are limited to inline bootstrap/generation/cancel/open operations;
  Provider keys stay in trusted extension contexts.
- Settings schema v2 keeps image Provider profiles and secrets separate from text generation while
  migrating existing schema v1 settings without losing the active text profile.
- Editable image prompts can be created from a candidate, one Thread post, or raw fallback text,
  with visual style, aspect ratio, resolution, and optional in-image text controls.
- Direct BYOK image generation uses OpenAI Images and Gemini Interactions adapters with one-image
  responses, cancellation, bounded retries, and the same exact-origin permission boundary.
- Generated image bytes stay in the current UI session as a Blob URL for preview and download;
  object URLs are revoked and history stores metadata only.
- Type checking, Biome checks, Vitest, and production builds.

Composer Fill was skipped at its policy gate. Reference images, image editing, account analytics,
and publishing automation are intentionally not included. Successful real-Provider smoke tests
require user-owned API keys and remain manual Phase 2/Phase 7 acceptance steps. A live
English/Chinese x.com smoke test also remains manual after loading the unpacked `dist/` extension.

## Development

```bash
npm install
npm run dev
```

`npm run dev` rebuilds the extension into `dist/` when source files change.

X inline context is enabled by default for the author/development build. Build with
`VITE_X_INLINE_ENABLED=false npm run build` to produce an inert Content Script while keeping the
Side Panel available. Reassess the X policy release gate before any public store build.

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked and select this repository's `dist/` directory.
5. Pin PostMuse, then click its toolbar action to open the Side Panel.

## Checks

```bash
npm run check
```

This runs TypeScript, Biome lint and formatting checks, Vitest, and the production build.
