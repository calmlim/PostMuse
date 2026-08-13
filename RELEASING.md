# Releasing PostMuse

PostMuse uses Semantic Versioning. Git tags and GitHub Release titles use the same version:

- Tag: `vX.Y.Z`
- Title: `PostMuse vX.Y.Z`
- Chrome manifest and npm package version: `X.Y.Z`
- Archive: `postmuse-X.Y.Z-chrome.zip`

Use a minor version for new user-facing capabilities, a patch version for compatible fixes, and a
major version for incompatible behavior or data-contract changes. Pre-release tags use
`vX.Y.Z-beta.N` and must be marked as a GitHub pre-release.

## Release checklist

1. Update `package.json`, `package-lock.json`, `public/manifest.json`, and `CHANGELOG.md`.
2. Run `npm run check`, `npm audit --omit=dev`, and `npm run package:release`.
3. Confirm the release audit passes and `release/SHA256SUMS` matches the Chrome archive.
4. Commit and push the version change to `main`.
5. Create the annotated `vX.Y.Z` tag from that commit and push it.
6. Create the GitHub Release with `postmuse-X.Y.Z-chrome.zip` and `SHA256SUMS`.

## Release notes structure

Every GitHub Release uses these headings in order:

1. Highlights
2. What’s changed
3. Installation
4. Upgrade notes
5. Verification
6. Known limitations

Release notes must state that PostMuse is BYOK, Provider calls may cost money, publishing remains
manual, and the X Content Script is not authorized or endorsed by X.
