# PostMuse

PostMuse is a local-first Chrome extension for preparing content for X. The product and
architecture specifications live in the separate `docs` repository.

## Phase 1 status

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
- Type checking, Biome checks, Vitest, and production builds.

Real Provider calls, X page UI injection, generation, history, and prompt management are
intentionally not included in Phase 1.

## Development

```bash
npm install
npm run dev
```

`npm run dev` rebuilds the extension into `dist/` when source files change.

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
