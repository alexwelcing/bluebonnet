#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const requestedUrl = process.argv.find((arg) => arg.startsWith('--url='))?.slice('--url='.length);
const port = Number(process.env.BLUEBONNET_SMOKE_PORT ?? 4173);
const url = requestedUrl ?? `http://127.0.0.1:${port}/`;
let server;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(targetUrl, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${targetUrl}`);
}

async function serverAlreadyResponds(targetUrl) {
  try {
    const response = await fetch(targetUrl);
    return response.ok;
  } catch {
    return false;
  }
}

function startPreviewServer() {
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  server.stdout.on('data', (chunk) => process.stdout.write(`[vite-preview] ${chunk}`));
  server.stderr.on('data', (chunk) => process.stderr.write(`[vite-preview] ${chunk}`));
}

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

async function domClick(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'attached', timeout: 5000 });
  await locator.evaluate((element) => {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function main() {
  if (!requestedUrl && !(await serverAlreadyResponds(url))) startPreviewServer();
  await waitForServer(url);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      reducedMotion: 'reduce',
      viewport: { width: 1280, height: 720 },
    });
    await page.addInitScript(() => {
      // The smoke test verifies gameplay wiring, not WebAudio scheduling. Some
      // headless Chromium builds throw on overlapping AudioParam automation and
      // abort later click handlers, so force the app down its media-element
      // fallback path for deterministic CI/tooling runs.
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /insert tape/i }).click();
    await clickIfVisible(page, '.prelude-skip');
    await page.locator('.evidence-deck').waitFor({ state: 'visible' });
    await page.locator('.scene-still').waitFor({ state: 'visible' });
    await page.locator('.jog-wheel').waitFor({ state: 'visible' });

    const initialTitle = (await page.locator('h1').textContent())?.trim();
    if (!initialTitle || !/wagon interior/i.test(initialTitle)) {
      throw new Error(`Expected WAGON INTERIOR on boot, got ${JSON.stringify(initialTitle)}`);
    }

    await domClick(page, '[data-hotspot-id="flyer-clue"]');
    await page.locator('.journal-list li', { hasText: '88.7 FM' }).waitFor({ timeout: 5000 });
    await page.locator('.caption', { hasText: '88.7 FM' }).waitFor({ timeout: 5000 });
    await clickIfVisible(page, '.close-exhibit');

    await domClick(page, '[data-hotspot-id="radio"]');
    await page.locator('h1', { hasText: /scanner radio/i }).waitFor({ timeout: 5000 });
    await domClick(page, '[data-hotspot-id="tune-887"]');
    await page.locator('.dial-frequency').evaluate((dial) => {
      const input = dial;
      input.value = '88.7';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('.dial-lock').click();
    await page.locator('.caption', { hasText: 'RADIO TUNED' }).waitFor({ timeout: 5000 });

    const hasDeck = await page.locator('.timeseek-panel').isVisible();
    const hotspotCount = await page.locator('.hotspot').count();
    if (!hasDeck || hotspotCount < 1) {
      throw new Error(`Deck smoke failed: hasDeck=${hasDeck}, hotspotCount=${hotspotCount}`);
    }

    console.log('BLUEBONNET browser smoke passed: boot, insert tape, TIMESEEK deck, flyer journal, and first navigation are working.');
  } finally {
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(`BLUEBONNET browser smoke failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        server.kill('SIGTERM');
      }
    }
    process.exit(process.exitCode ?? 0);
  });
