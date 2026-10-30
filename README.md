# UnifyWeb

Pair, tune and automate Logitech receivers and devices from the browser. A WebHID replacement for Logitech Unifying Software: Unifying, Lightspeed and Bolt pairing, battery, DPI, scrolling, keyboard, lighting, button remapping, onboard profiles and a rules engine.

Runs in **Chrome or Edge** on Windows, macOS, Linux and ChromeOS. Nothing to install.

## Use it

```sh
npm install
npm run build        # → dist/unifyweb.html
```

Open `dist/unifyweb.html` by double-clicking it, or host the `dist/` folder anywhere static. WebHID needs a secure context: `https://` or a local file both work.

On Linux, give your user access to the receiver first:

```
# /etc/udev/rules.d/42-logitech.rules
KERNEL=="hidraw*", ATTRS{idVendor}=="046d", MODE="0660", TAG+="uaccess"
```

## Deploy to GitHub Pages

The repository includes `.github/workflows/pages.yml`. On every push to `main` it installs dependencies, runs the audit, lint and unit tests, builds, and publishes `dist/` to GitHub Pages. If any step fails, nothing is published and the live site stays as it was.

One-time setup:

1. Create an empty repository on GitHub (no README or licence).
2. Push this code:
   ```sh
   git remote add origin https://github.com/YOUR-USERNAME/unifyweb.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab, choose **Deploy to GitHub Pages**, and click **Run workflow** (the first push may have run before Pages was switched on).
5. Your site is at `https://YOUR-USERNAME.github.io/unifyweb/`. The address is also shown in the finished run and under Settings → Pages.

After that, every push to `main` deploys automatically within about a minute.

**Custom domain (optional):** add it under Settings → Pages → Custom domain. Then create a DNS record with your registrar: a CNAME pointing to `YOUR-USERNAME.github.io` for a subdomain, or GitHub's A records (listed on that page) for a bare domain. Keep **Enforce HTTPS** on; WebHID only works on secure pages. A custom domain also gives UnifyWeb its own origin, so its saved data isn't shared with your other `github.io` projects.

**Which build is live?** The sidebar shows the version, commit and how long ago it was built; Help → About this build shows the full build ID and time. `https://YOUR-USERNAME.github.io/unifyweb/version.json` returns the same details. When a newer build is published, open pages offer a reload.

## Develop

| Command | What it does |
| --- | --- |
| `npm run watch` | Rebuild `dist/unifyweb.html` whenever `src/` changes |
| `npm run lint` | ESLint (catches undefined names and unused imports) |
| `npm test` | Unit tests, build, then end-to-end tests in headless Chromium |

The end-to-end tests run the built app against a simulated receiver and mouse (`tests/support/mock-receiver.js`), so no hardware is needed. They use Playwright; install it with `npm i -D playwright && npx playwright install chromium` if it isn't already on your machine.

## How the code is organised

```
src/
  main.js              entry point: wires the layers together
  index.html           page shell (styles and script are inlined at build time)
  core/                no DOM, no protocol: events bus, log, storage, registry, helpers
  hidpp/               the Logitech HID++ protocol
    transport.js       WebHID I/O, request queue, reply matching
    receiver.js        Unifying / Lightspeed lock pairing, Bolt passkey pairing
    device.js          HID++ 2.0 feature discovery, identity, battery, settings
    profiles.js        onboard profile memory (0x8100), CRC, button encoding
    battery.js         battery parsing (0x1000, 0x1001, 0x1004)
    settings/          one file per group: pointer, scrolling, keyboard, lighting, buttons, connection
  rules/               rules engine, rule schema validation, audio/notification feedback
  app/                 connecting devices (connect.js) and update checks (updates.js)
  ui/                  router, app shell, components, pages/, delegated events, icons
  icons/*.svg          the icon set, one file per icon (24px grid, 1.75 stroke, currentColor)
  styles/*.css         design tokens first, then components; concatenated in filename order
scripts/build.js       esbuild bundle → dist/: single HTML file, index.html, version.json, font licence;
                       adds the CSP (with hashes) and build info (version, commit, time, build ID)
tests/unit             pure protocol helpers (node:test)
tests/e2e              the whole app in Chromium against the simulator
```

**Layering.** `core` and `hidpp` never touch the DOM or import from `ui`. Devices, receivers and the rules engine report changes through the event bus in `core/events.js` (`changed()`, `toast()`, `emit('device-removed')`). `main.js` subscribes the UI to those events. This keeps protocol work testable on its own, and means UI changes can't break pairing.

### Adding a device setting

Add an object to the right file in `src/hidpp/settings/`:

```js
{ key: 'my-setting', features: [0x1234], label: 'My setting', help: 'What it does, in plain words.',
  setup: async (d, f) => ({ type: 'toggle' }),          // or choice / range / flags
  read:  async (d, f) => !!(await d.call(f, 0))[0],
  write: (d, f, v) => d.call(f, 1, [v ? 1 : 0]) }
```

It appears automatically under its group, can be used in rules, and is saved and re-applied on reconnect.

### Adding an icon

Drop a 24×24 SVG into `src/icons/` using `stroke="currentColor"`, then use `ic('name')` in the UI.

## Privacy, support and disclaimer

- [Privacy policy](PRIVACY.md): UnifyWeb collects no data; settings and rules stay in your browser.
- [Support](SUPPORT.md): no support is offered.
- [Disclaimer](DISCLAIMER.md): not affiliated with Logitech; provided as is; use at your own risk.
- [Credits](CREDITS.md): Solaar, Logitech's own tools, libratbag and the open-source projects UnifyWeb is built with.

The same text appears in the app under **Privacy & legal**.

## Security

See [SECURITY.md](SECURITY.md) for how to report a problem and how the app protects you, and [docs/security-review.md](docs/security-review.md) for the full review.

## Not supported yet

- Saving and restoring all of a device's settings as a file.
- A built-in low-battery alert (a rule with the "Battery drops below" trigger does this today).
- Editing macros and per-key RGB lighting on gaming keyboards.
- Installing as an offline app.
- Receiver and device firmware updates. These are left out on purpose: a failed update can make hardware unusable.

## License

[MIT](LICENSE). The bundled Archivo font is under the SIL Open Font License 1.1; its licence ships with every build as `dist/fonts-LICENSE.txt`.

## Limits

- Rules run only while the page is open. Browsers can't send keystrokes to other apps or see the active window, so rule actions change device settings, show a notification or play a sound. Gaming mice can send keyboard shortcuts through onboard profiles instead.
- Bolt pairing, lighting effects and profile writing follow the published protocol but have been tested against the simulator only.
