# Changelog

All notable user-facing changes to PostMuse are documented here. Versions follow
[Semantic Versioning](https://semver.org/), and release dates use `YYYY-MM-DD`.

## [Unreleased]

### Added

- Successful standalone and companion images are automatically saved to local history when history
  is enabled, with local preview, download, deletion, and bounded IndexedDB storage.
- Candidate, long-post, thread-item, raw fallback, and X inline candidate regeneration with
  target-only replacement, cancellation, and history synchronization.
- Complete image-history reuse plus paginated and lazy-loaded local history previews.

### Changed

- Provider permission summaries and revocation now exclude the required X Content Script origin.
- Packaged privacy disclosures now accurately describe optional local image history.

### Fixed

- Closing a generation panel now cancels its active Provider request.
- Image-history save failures and missing local image data now produce visible non-blocking states.

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
- Added live Provider connection tests and safer API-key destination binding.
- Reduced oversized regeneration context.
- Added bounded local history storage and safer long-content image prompting.

### Fixed

- Corrected OpenAI image aspect-ratio and final pixel-size handling.
- Fixed custom lengths above 280 and regeneration validation through the 25,000-character boundary.
- Fixed Anthropic/Gemini sampling compatibility and Provider-specific request parameters.
- Fixed inline history synchronization, copy feedback, cancellation, and several X navigation interactions.

## [0.1.0-beta.1] - 2026-08-12

### Added

- First public developer-mode beta with BYOK text generation, X inline drafting, prompt styles,
  local history, and initial OpenAI/Gemini image generation.

[0.2.0]: https://github.com/calmlim/PostMuse/compare/v0.1.0-beta.1...v0.2.0
[0.1.0-beta.1]: https://github.com/calmlim/PostMuse/releases/tag/v0.1.0-beta.1
