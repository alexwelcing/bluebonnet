// Visual playthrough: boot the built app in a real browser and screenshot the
// boot-into-image flow + each realigned hero plate as the deck actually renders it.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const port = 4173;
const url = `http://127.0.0.1:${port}/`;
const OUT = '/tmp/playview';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function up(u, t = 30000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(u)).ok) return; } catch {} await wait(400); }
  throw new Error('server timeout');
}
async function responds(u) { try { return (await fetch(u)).ok; } catch { return false; } }

let server;
if (!(await responds(url))) {
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
}
await up(url);

const browser = await chromium.launch({ headless: true });
const snap = (node, window) => JSON.stringify({ currentNodeId: node, activeWindow: window, completedPuzzles: [], flags: {}, vhsIntensity: 0.72, captionsEnabled: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // keep audio on the deterministic media-element path
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
  });

  // --- A) fresh boot: verify boot-into-image (drawer closed, frame breathing) ---
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/01-boot-card.png` });
  await page.getByRole('button', { name: /insert tape/i }).click();
  // skip the prelude broadcast if present
  const skip = page.locator('.prelude-skip').first();
  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) await skip.click();
  await page.locator('.scene-still').waitFor({ state: 'visible' });
  await wait(900);
  const drawerOpen = await page.locator('.deck-controls').evaluate((el) => el.classList.contains('open'));
  await page.screenshot({ path: `${OUT}/02-first-node-drawer-${drawerOpen ? 'OPEN' : 'closed'}.png` });
  // open the deck (D)
  await page.keyboard.press('d');
  await wait(500);
  await page.screenshot({ path: `${OUT}/03-deck-open.png` });

  // --- B) jump to each hero plate and screenshot the rendered stage ---
  const shots = [
    ['wagon-exterior', '20:17-20:26', '04-wagon-exterior-c2'],
    ['field-threshold', '20:17-20:26', '05-field-threshold-c2'],
    ['field-left-row', '20:17-20:26', '06-field-left-row-c2'],
    ['field-gate', '20:17-20:26', '07-field-gate-c2'],
    ['culvert-throat', '20:17-20:26', '08-culvert-throat'],
    ['near-car', '20:26-20:35', '09-near-car-climax'],
    ['final-choice', '20:26-20:35', '10-final-choice'],
  ];
  for (const [node, window, name] of shots) {
    await page.evaluate(([k, v]) => localStorage.setItem('bluebonnet.engine.snapshot.v1', v), ['x', snap(node, window)]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /insert tape/i }).click().catch(() => {});
    const s2 = page.locator('.prelude-skip').first();
    if (await s2.isVisible({ timeout: 1000 }).catch(() => false)) await s2.click();
    await page.locator('.scene-still').waitFor({ state: 'visible' });
    await wait(700);
    const title = (await page.locator('.readout h1').textContent().catch(() => ''))?.trim();
    await page.locator('.tape-stage').screenshot({ path: `${OUT}/${name}.png` });
    console.log(`shot ${name}: node=${node} title=${JSON.stringify(title)}`);
  }
  console.log('playview done ->', OUT);
} finally {
  await browser.close();
  if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); } }
}
