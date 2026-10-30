# Security review — UnifyWeb 1.0.0 → 1.1.0

Reviewer stance: adversarial. Scope: everything in `src/`, `scripts/`, `.github/`.

## What an attacker would want

UnifyWeb holds a WebHID handle to the user's receiver. Script running in the page can pair a rogue keyboard, unpair devices, divert buttons, and rewrite onboard-profile memory (button → keystroke mappings) on a gaming mouse. Any script execution in this origin is therefore high impact.

## Attack surfaces

| Surface | Who controls it |
| --- | --- |
| Imported rules file (`.json`) | Anyone who can get a user to import a file ("try my rules!") |
| Device-supplied data: USB product name, HID++ device name, profile names, Bolt discovery names, sizes and counts | A malicious or broken USB/HID device |
| `localStorage` (saved settings, rules) | Same-origin script, or another app on the same `github.io` origin path is **not** isolated per repo — every project page under `user.github.io` shares one origin |
| URL hash (`#/d/<id>/<tab>`) | Any link |
| Framing by another site | Any website |
| Build and deploy pipeline | GitHub Actions, npm dependencies |

## Findings

| ID | Severity | Finding | Fix | Status |
| --- | --- | --- | --- | --- |
| UW-01 | **High** | Stored XSS via imported rules. `trigger.below` and numeric rule values are interpolated into the rule editor without escaping. A crafted rules file runs script with WebHID access. | Validate imports against a strict schema; escape/coerce every interpolation. | Fixed: `src/rules/schema.js`, coercion in rule editor. Tests: unit + e2e |
| UW-02 | **High** | `localStorage` is shared by every GitHub Pages project on the same `user.github.io` origin. Another project page could plant malicious rules or settings that UnifyWeb then trusts and renders. | Treat stored data as untrusted: run the same schema validation on load; validate saved setting values before writing them to a device. | Fixed: `loadRules()` on startup, `isValidValue()` before restore. Tests: unit + e2e |
| UW-03 | Medium | No Content-Security-Policy. Any injection gets unrestricted script, network and framing. | Strict CSP meta tag with build-time SHA-256 hashes for the inline script and style; `default-src 'none'`. | Fixed: CSP with SHA-256 hashes in `scripts/build.js`. Test: e2e |
| UW-04 | Medium | Rule actions and restored settings write arbitrary values to the device (e.g. DPI 65535, Easy-Switch host 9, malformed remap tables). | Validate every value against the setting's metadata before any write. | Fixed: `src/hidpp/settings/validate.js` in `Device.setSetting`. Tests: unit + e2e |
| UW-05 | Medium | Clickjacking. Another site can frame UnifyWeb (and grant `allow="hid"`) and trick clicks into "Unpair" or "Save to mouse". GitHub Pages cannot send `X-Frame-Options`. | Refuse to run when framed; show a link that opens UnifyWeb in its own tab. | Fixed: frame guard in `src/main.js`. Test: e2e |
| UW-06 | Medium | Third-party stylesheet and fonts from Google Fonts load into a page with device access, and leak the visitor's IP to a third party. | Bundle the font into the build; no third-party requests. | Fixed: Archivo bundled (OFL), no external requests. Test: e2e |
| UW-07 | Low | Device-controlled sizes and counts drive loops and memory writes (profile sector size, profile count, name length, feature count). A hostile device can make the page issue thousands of requests. | Clamp all device-supplied sizes and counts to protocol limits. | Fixed: clamps in `device.js`, `profiles.js`, `settings/buttons.js` |
| UW-08 | Low | Lighting period and colour from storage are interpolated without coercion. | Coerce to number / validate `#rrggbb`. | Fixed: number / colour coercion in `ui/pages/device.js` |
| UW-09 | Low | Unhandled promise rejections fail silently; a failed write can leave the UI showing a value the device never accepted. | Global error and rejection handlers that log and tell the user. | Fixed: global `error` / `unhandledrejection` handlers |
| UW-10 | Low | CI supply chain: actions pinned to mutable tags, `npm ci` runs install scripts, no dependency audit or update policy. | Pin actions to commit SHAs, `--ignore-scripts`, `npm audit`, Dependabot. | Fixed: SHA-pinned actions, `--ignore-scripts`, `npm audit`, Dependabot, least-privilege job permissions |
| UW-11 | Info | Releases deploy after unit tests only; e2e tests run locally. | Documented in README. | Accepted: run `npm test` before pushing |

| UW-12 | Low | Found in pass 2. Imported rules took effect immediately, so a shared rules file could, for example, switch the mouse to another computer as soon as it was imported. | Imported rules arrive switched off. | Fixed: `ui/events.js`. Test: e2e |

## Review passes

1. **Pass 1 (adversarial):** UW-01 to UW-11 found.
2. **Fix:** each finding fixed with a regression test (`tests/unit/security.test.js`, `tests/e2e/security.test.js`).
3. **Pass 2 (adversarial, new code):** build info, update checker, About page and import flow re-audited for HTML sinks, fetch handling and validation. Found UW-12; fixed and tested.
4. **Pass 3:** no new findings. All sinks are escaped or use `textContent`; the only `innerHTML` writes are the app's own templates and the build-time icon sprite.

## Residual risk

- GitHub Pages cannot send HTTP headers, so the CSP is a `<meta>` tag (no `frame-ancestors`, no reporting). Framing is handled in script.
- `style-src-attr 'unsafe-inline'` is allowed for the templates' `style=""` attributes. Every interpolated value is escaped, so this can't be reached from outside data.
- Every project under the same `user.github.io` origin shares `localStorage`. Data read from it is validated, but hosting UnifyWeb on its own domain or user/organisation site removes the shared origin entirely.

Checked and found safe: toasts, banner and log use `textContent`; route IDs are only used for lookups; device names, Bolt names, profile names and receiver names go through `esc()`; no `eval`, `Function`, inline event handlers or `javascript:` URLs.
