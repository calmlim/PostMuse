# PostMuse

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/calmlim/PostMuse?include_prereleases)](https://github.com/calmlim/PostMuse/releases)

PostMuse is a local-first, bring-your-own-key Chrome extension for drafting better content for X.
Rewrite a visible post, prepare a reply or quote, build a thread or long post, and optionally create
a companion image without giving PostMuse access to an account or publishing automatically.

> PostMuse is currently early-stage software. Install it manually only if you are comfortable using Chrome
> Developer mode and configuring your own AI Provider API key.

## Highlights

- Compose posts, replies, quotes, threads, and Premium long posts.
- Rewrite a user-selected visible X post from a compact inline panel.
- Choose output language, writing style, length, intent, audience, goal, tone, and advanced rules.
- Manage built-in and custom prompt styles plus an optional writing profile.
- Generate editable text candidates through OpenAI-compatible, Anthropic, Gemini, or xAI APIs.
- Generate optional companion images through OpenAI Images or Gemini Images.
- Edit, copy, regenerate, and keep up to 100 local history records.
- Use the interface in English, Simplified or Traditional Chinese, Japanese, Korean, Vietnamese,
  Spanish, Brazilian Portuguese, French, or German.
- Keep the workflow manual: PostMuse never fills X's composer or clicks a publish control.

## Install the latest release

PostMuse is not currently distributed through the Chrome Web Store.

1. Open [GitHub Releases](https://github.com/calmlim/PostMuse/releases) and select the latest release.
2. Download `postmuse-x.x.x-chrome.zip` and verify its checksum if desired.
3. Extract the ZIP to a permanent folder. Do not delete that folder after installation.
4. Open `chrome://extensions` in Chrome.
5. Enable **Developer mode**.
6. Select **Load unpacked** and choose the extracted folder that contains `manifest.json`.
7. Pin PostMuse, then click its toolbar icon to open the Side Panel.

Chrome may periodically remind you that Developer mode extensions are installed. This is expected
for manually loaded software.

### Update a manual installation

1. Download and extract the newer release.
2. Replace the contents of the existing PostMuse installation folder while keeping the same folder
   path.
3. Open `chrome://extensions` and click **Reload** on PostMuse.

Keeping the same installation path helps Chrome retain the same unpacked extension identity and
local data. Back up anything important before replacing a build.

## Configure a Provider

Open **Settings** in the Side Panel and configure a text Provider, model, and API key. Image
generation has a separate optional Provider configuration.

PostMuse supports:

- Text: OpenAI-compatible endpoints, Anthropic, Gemini, and xAI.
- Images: OpenAI Images and Gemini Images.
- Custom HTTPS Base URLs for OpenAI-compatible services.

For a custom Base URL, Chrome asks for access only to the exact Provider origin selected by the
user. The release manifest declares a broad optional HTTPS range so runtime-discovered Providers
can work, but it does not grant access to every HTTPS site at installation time. Provider access can
be revoked from **Settings → Privacy & local data**.

Connection tests make a small live request containing fixed synthetic text. They do not include a
draft, history record, custom prompt, or writing profile, but the Provider may still charge a small
amount.

## Privacy and security model

- PostMuse has no developer-operated backend.
- API keys are stored in Chrome-managed extension storage, either for the browser session or
  persistently when the user chooses that option.
- Drafts, selected visible X content, prompts, and generated media are sent directly from the
  extension to the Provider chosen by the user, and only after an explicit action.
- Local history uses IndexedDB and can be disabled, cleared, or deleted record by record.
- Generated image bytes remain in the current UI session; history stores image metadata only.
- PostMuse does not request X OAuth, collect an X account, analyze an account, or publish content.

Each AI Provider has its own billing, retention, training, safety, and regional policies. Review the
chosen Provider's terms before sending sensitive material. Persistent local keys can be accessed by
someone who controls the same browser profile or device.

See the packaged Privacy page and the separate
[product documentation](https://github.com/calmlim/PostMuse-docs) for the complete data-flow and
permission disclosures.

## X integration notice

The optional X experience injects a small Content Script into `https://x.com/*`. It observes page
structure to place a PostMuse button and reads only the visible post selected by the user when that
button is clicked. It does not bulk-scroll, scrape accounts, fill a composer, or publish.

X's current terms prohibit unauthorized scraping and non-API website automation. Installing this
software manually does not grant permission from X or guarantee that the integration complies with
X's terms in every jurisdiction or use case. Review the current X terms and use the integration at
your own discretion. The Side Panel can still be used as a standalone writing tool.

## Build from source

Requirements:

- Node.js 20 or newer.
- npm.
- A current Chromium-based browser with Side Panel support.

```bash
git clone https://github.com/calmlim/PostMuse.git
cd PostMuse
npm install
npm run build
```

Then load the generated `dist/` directory from `chrome://extensions`.

For active development:

```bash
npm run dev
```

This watches the source and rebuilds `dist/`. Reload the extension after a rebuild.

## Quality checks and packaging

```bash
npm run check
npm audit --omit=dev
npm run package:store
```

`npm run check` runs TypeScript, Biome, all Vitest tests, a production build, and the development
release audit. `npm run package:store` creates an audited Chrome ZIP under the ignored `release/`
directory, keeps the minimal X Content Script, and removes development-only HTTP localhost origins.

Automated fixtures do not replace live testing with user-owned Provider keys. Never commit or post
an API key in an issue, log, screenshot, or pull request.

## Current limitations

- Manual Chrome installation and updates only.
- Provider availability, model access, billing, and output quality depend on the user's account.
- No reference-image editing, video generation, X account analytics, cloud sync, or subscriptions.
- No X composer fill, automatic posting, likes, reposts, follows, or other account automation.
- X may change its DOM or policies, which can temporarily break or restrict the inline panel.

## Documentation and support

- [Product and architecture documentation](https://github.com/calmlim/PostMuse-docs)
- [Issues and bug reports](https://github.com/calmlim/PostMuse/issues)
- [GitHub Releases](https://github.com/calmlim/PostMuse/releases)

When reporting a Provider problem, include the Provider name, model, sanitized Base URL, PostMuse
version, and redacted diagnostics. Never include the API key or private draft content.

## License

Copyright 2026 PostMuse contributors.

Licensed under the [Apache License 2.0](LICENSE).
