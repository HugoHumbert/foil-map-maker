// Lance les tests : node tests/run.mjs
// Injecte tests/smoke.js dans index.html, ouvre la page dans Edge / Chrome sans fenêtre,
// puis lit les résultats et les erreurs JavaScript de la console.
// Navigateur personnalisé : variable d'environnement BROWSER=chemin/vers/chrome
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean);
const browser = candidates.find(p => existsSync(p));
if (!browser) { console.error('Aucun navigateur Chromium trouvé. Définis BROWSER=chemin/vers/chrome'); process.exit(2); }

const dir = mkdtempSync(join(tmpdir(), 'foil-test-'));
const page = join(dir, 'test.html');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const tests = readFileSync(join(root, 'tests', 'smoke.js'), 'utf8');
if (!html.includes('</body>')) { console.error('index.html sans </body>'); process.exit(2); }
writeFileSync(page, html.replace('</body>', `<script>\n${tests}\n</script>\n</body>`));

const res = spawnSync(browser, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1400,900', `--user-data-dir=${join(dir, 'profile')}`,
  '--enable-logging=stderr', '--virtual-time-budget=30000', '--dump-dom', pathToFileURL(page).href,
], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });

const dom = res.stdout || '';
// Le bloc de résultats est le dernier <pre id="testout"> du DOM (la source du script injecté le mentionne aussi)
const start = dom.lastIndexOf('<pre id="testout">');
const body = start < 0 ? '' : dom.slice(start + 18, dom.indexOf('</pre>', start));
const lines = body.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
// Erreurs JS de la page (on ignore les extensions du navigateur)
const jsErrors = (res.stderr || '').split('\n')
  .filter(l => /CONSOLE/.test(l) && /Uncaught|Error/.test(l) && !/chrome-extension:/.test(l));

let fail = 0, pass = 0;
for (const l of lines) {
  if (l.startsWith('PASS')) { pass++; console.log('  \x1b[32m✔\x1b[0m ' + l.slice(5)); }
  else if (l.startsWith('FAIL')) { fail++; console.log('  \x1b[31m✘ ' + l.slice(5) + '\x1b[0m'); }
}
for (const e of jsErrors) { fail++; console.log('  \x1b[31m✘ erreur JS : ' + e.replace(/^.*CONSOLE[^\]]*\]\s*/, '') + '\x1b[0m'); }
if (!lines.includes('END')) { fail++; console.log('  \x1b[31m✘ les tests ne sont pas allés au bout (page plantée ou trop lente)\x1b[0m'); }

console.log(`\n${pass} réussi(s), ${fail} échec(s)`);
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
