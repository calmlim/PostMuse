# Changelog

All notable user-facing changes to PostMuse are documented here. Versions follow
[Semantic Versioning](https://semver.org/), and release dates use `YYYY-MM-DD`.

## [0.2.0] - 2026-08-13

### Added

- Standalone and companion image creation through OpenAI Images and Gemini Images.
- Image style, aspect ratio, 1K/2K output, preview, download, and optional image text controls.
- Ten interface languages and a broader shared list of output languages.
- Per-task custom text targets up to 25,000 characters for posts, replies, quotes, threads, and long posts.
- X-compatible weighted character counts for CJK text, emoji, and URLs.
- Optional writing profile and configurable creation defaults.

### Changed

- Refined the X inline panel and Side Panel creation flows.
- Added live Provider connection tests, safer API-key destination binding, and permission revocation.
- Preserved complete generation settings during regeneration and reduced oversized regeneration context.
- Added bounded local history storage and safer long-content image prompting.

### Fixed

- Corrected OpenAI image aspect-ratio and final pixel-size handling.
- Fixed custom lengths above 280 and targeted regeneration through the 25,000-character boundary.
- Fixed Anthropic/Gemini sampling compatibility and Provider-specific request parameters.
- Fixed inline history synchronization, copy feedback, cancellation, and several X navigation interactions.

## [0.1.0-beta.1] - 2026-08-12

### Added

- First public developer-mode beta with BYOK text generation, X inline drafting, prompt styles,
  local history, and initial OpenAI/Gemini image generation.

[0.2.0]: https://github.com/calmlim/PostMuse/compare/v0.1.0-beta.1...v0.2.0
[0.1.0-beta.1]: https://github.com/calmlim/PostMuse/releases/tag/v0.1.0-beta.1
