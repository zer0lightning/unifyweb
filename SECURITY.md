# Security policy

UnifyWeb runs in your browser and talks to Logitech receivers over WebHID. Script running in its page could pair devices, unpair them, or rewrite a gaming mouse's onboard memory, so we treat any script injection as high severity.

## Reporting a vulnerability

Please report privately through **GitHub → Security → Report a vulnerability** on this repository rather than opening a public issue. Include steps to reproduce and, if you can, a rules file or device data that triggers it. UnifyWeb is an unpaid project with no support (see [SUPPORT.md](SUPPORT.md)), so there is no guaranteed response time, but security reports are read first.

## How the app protects you

- **No third-party code or requests.** Fonts, icons, styles and script are all inside the one HTML file. The page only ever fetches its own `version.json`.
- **Strict Content Security Policy.** Only the exact inline script and stylesheet from the build may run, identified by SHA-256 hash.
- **Validated input.** Rules files and stored data are checked against a strict schema; every value is checked against the device's limits before it is written.
- **Imported rules start switched off.** Review them before turning them on.
- **No framing.** UnifyWeb refuses to run inside another site's frame.
- **Hardened release pipeline.** GitHub Actions pinned to commit SHAs, dependencies installed without scripts, `npm audit` on every build, Dependabot for updates.

The full review, findings and fixes are in [docs/security-review.md](docs/security-review.md).

## Supported versions

Only the latest release on the `main` branch receives fixes. The version you're running is shown at the bottom of the sidebar and on the Help page.
