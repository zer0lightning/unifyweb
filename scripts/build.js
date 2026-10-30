// Builds dist/: a single self-contained HTML file plus version.json for update checks.
//   npm run build        one-off build
//   npm run watch        rebuild whenever src/ changes
import * as esbuild from 'esbuild';
import { readFile, readdir, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');
const dist = join(root, 'dist');
const FONT_DIR = join(root, 'node_modules', '@fontsource-variable', 'archivo');

// ---- build metadata ----------------------------------------------------------
function git(...args) { try { return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } }
async function buildInfo() {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const commitFull = process.env.GITHUB_SHA || git('rev-parse', 'HEAD');
  const dirty = !process.env.GITHUB_SHA && git('status', '--porcelain') !== '';
  const repo = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}` : '';
  return {
    version: pkg.version,
    commit: commitFull ? commitFull.slice(0, 7) + (dirty ? '-dirty' : '') : 'local',
    commitFull: /^[0-9a-f]{40}$/.test(commitFull) ? commitFull : '',
    time: new Date().toISOString(),
    id: randomUUID(),
    run: process.env.GITHUB_RUN_NUMBER || '',
    repo: /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+$/.test(repo) ? repo : ''
  };
}

// ---- icons: `import ICONS from 'virtual:icons'` -------------------------------
const iconsPlugin = {
  name: 'icons',
  setup(build) {
    build.onResolve({ filter: /^virtual:icons$/ }, () => ({ path: 'icons', namespace: 'virtual' }));
    build.onLoad({ filter: /.*/, namespace: 'virtual' }, async () => {
      const dir = join(src, 'icons');
      const files = (await readdir(dir)).filter(f => f.endsWith('.svg')).sort();
      const icons = {};
      for (const f of files) {
        const svg = await readFile(join(dir, f), 'utf8');
        if (/<script|on\w+=|javascript:|href="(?!#)/i.test(svg)) throw new Error(`icon ${f} contains script or external references`);
        icons[basename(f, '.svg')] = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim().replace(/\s*\n\s*/g, '');
      }
      return { contents: `export default ${JSON.stringify(icons)};`, loader: 'js', watchFiles: files.map(f => join(dir, f)) };
    });
  }
};

// ---- styles, with the Archivo variable font inlined (no third-party requests) --
async function styles() {
  const font = (await readFile(join(FONT_DIR, 'files', 'archivo-latin-wdth-normal.woff2'))).toString('base64');
  const face = `/* Archivo (SIL Open Font License 1.1), see fonts-LICENSE.txt */
@font-face { font-family:"Archivo"; font-style:normal; font-display:swap; font-weight:100 900; font-stretch:62% 125%;
  src:url(data:font/woff2;base64,${font}) format("woff2-variations"); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }\n`;
  const dir = join(src, 'styles');
  const files = (await readdir(dir)).filter(f => f.endsWith('.css')).sort();
  return face + (await Promise.all(files.map(f => readFile(join(dir, f), 'utf8')))).join('\n');
}

const sha256 = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function build() {
  const t0 = performance.now();
  const info = await buildInfo();
  const result = await esbuild.build({
    entryPoints: [join(src, 'main.js')],
    bundle: true, format: 'iife', target: ['chrome100', 'edge100'],
    write: false, minify: false, legalComments: 'none',
    define: { __BUILD__: JSON.stringify(info) },
    loader: { '.md': 'text' },
    plugins: [iconsPlugin], logLevel: 'warning'
  });
  const js = '\n' + result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '\n';
  const css = '\n' + await styles() + '\n';
  const themeBoot = '\n' + (await readFile(join(src, 'theme-boot.js'), 'utf8')).trim() + '\n';
  // UW-03: strict CSP. Inline code is allowed only by hash; nothing loads from anywhere else.
  const csp = [
    "default-src 'none'",
    `script-src ${sha256(js)} ${sha256(themeBoot)}`,
    `style-src-elem ${sha256(css)}`,
    "style-src-attr 'unsafe-inline'",
    'img-src data:',
    'font-src data:',
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "manifest-src 'none'",
    "worker-src 'none'"
  ].join('; ');
  let html = await readFile(join(src, 'index.html'), 'utf8');
  for (const marker of ['<!--! CSP -->', '<!--! BUILD-META -->', '/*! THEME */', '/*! STYLES */', '/*! SCRIPT */']) if (!html.includes(marker)) throw new Error(`index.html is missing ${marker}`);
  html = html
    .replace('<!--! CSP -->', () => `<meta http-equiv="Content-Security-Policy" content="${attr(csp)}">`)
    .replace('<!--! BUILD-META -->', () => `<meta name="unifyweb-version" content="${attr(info.version)}">\n<meta name="unifyweb-build" content="${attr(`${info.commit} ${info.time} ${info.id}`)}">`)
    .replace('\n/*! THEME */\n', () => themeBoot)
    .replace('\n/*! STYLES */\n', () => css)
    .replace('\n/*! SCRIPT */\n', () => js);
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, 'unifyweb.html'), html);
  await writeFile(join(dist, 'index.html'), html);
  const { version, commit, time, id } = info;
  await writeFile(join(dist, 'version.json'), JSON.stringify({ version, commit, time, id }, null, 2) + '\n');
  await copyFile(join(FONT_DIR, 'LICENSE'), join(dist, 'fonts-LICENSE.txt'));
  await copyFile(join(root, 'LICENSE'), join(dist, 'LICENSE.txt'));
  console.log(`built dist/  ${(html.length / 1024).toFixed(0)} KB  ${info.version} ${info.commit}  build ${info.id}  in ${Math.round(performance.now() - t0)} ms`);
}

await build();
if (process.argv.includes('--watch')) {
  let timer;
  watch(src, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => build().catch(e => console.error(e.message)), 80); });
  console.log('watching src/ …');
}
