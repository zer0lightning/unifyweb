# Changelog

## 1.2.3

### Changed
- Removed comparisons with Solaar from the app and docs; Solaar is credited in `CREDITS.md`.

## 1.2.2

### Added
- Credits (`CREDITS.md` and in the app under Privacy & legal → Credits) for Solaar, Logitech Unifying Software and Logi Web Connect, libratbag, the Archivo typeface, and the tools UnifyWeb is built with.

## 1.2.1

### Added
- MIT License (`LICENSE`), referenced from the disclaimer, README and `package.json`.

## 1.2.0

### Added
- Theme switch: System, Light or Dark, from the top bar or Help → Preferences. The choice is remembered and applied before the page draws, so there's no flash.
- Privacy policy, support statement (no support is offered) and disclaimer, as `PRIVACY.md`, `SUPPORT.md` and `DISCLAIMER.md` and in the app under **Privacy & legal**. Links in the sidebar and on the welcome screen.

## 1.1.1

### Changed
- Calmer type: the logo, welcome headline and page titles use a slightly narrower width, a lighter weight and smaller sizes, so they no longer dominate the page.

## 1.1.0

### Added
- Build information in the app: version, commit, build time ("Built 2 hours ago") and a unique build ID, at the bottom of the sidebar and under Help → About this build.
- Update notice: hosted copies check `version.json` and offer a reload when a newer build is published.
- `dist/index.html` and `dist/version.json` are produced by the build, so GitHub Pages serves the app at the site root.
- Global error handling: unexpected errors are logged and shown instead of failing silently.

### Security
Fixes from an adversarial review (see `docs/security-review.md`):
- Strict schema validation for imported and stored rules (stored XSS, UW-01/02).
- Every setting value is validated against the device's limits before it is written (UW-04).
- Content Security Policy with build-time hashes (UW-03).
- Refuses to run inside a frame (UW-05).
- Archivo font bundled; no third-party requests (UW-06).
- Device-supplied sizes and counts are clamped (UW-07).
- Imported rules arrive switched off (UW-12).
- Release workflow hardened: SHA-pinned actions, no install scripts, `npm audit`, Dependabot, least-privilege permissions (UW-10).

### Changed
- Headline and page-title type: near-normal width and balanced line breaks.

## 1.0.0
- First modular release: Unifying, Lightspeed and Bolt pairing; battery; DPI, scrolling, keyboard, lighting and button settings; onboard profiles; rules engine.
