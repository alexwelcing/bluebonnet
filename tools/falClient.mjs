import fs from 'node:fs';
import path from 'node:path';

function loadApiKey() {
  if (process.env.FAL_API_KEY) return process.env.FAL_API_KEY;
  const envPath = new URL('../.env', import.meta.url);
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/^FAL_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  }
  throw new Error('FAL_API_KEY not found in environment or .env');
}

const API_KEY = loadApiKey();

// Rough per-call cost estimates (USD) for the ledger; reconcile against the
// fal dashboard periodically. Unknown models log 0 and a warning.
const COST_ESTIMATES = {
  'fal-ai/flux-2-pro': 0.03,
  'fal-ai/flux-2-pro/edit': 0.04,
  'fal-ai/sam-3/image': 0.01,
  'fal-ai/veo3.1/first-last-frame-to-video': 1.3,
};
const LEDGER_PATH = new URL('./generation-ledger.json', import.meta.url);

function appendLedger(modelId, ok) {
  let ledger = { budgetUsd: 100, entries: [] };
  try {
    ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch {
    // first write
  }
  const estimatedUsd = COST_ESTIMATES[modelId] ?? 0;
  if (!(modelId in COST_ESTIMATES)) console.warn(`ledger: no cost estimate for ${modelId}`);
  ledger.entries.push({ at: new Date().toISOString(), model: modelId, estimatedUsd, ok });
  ledger.estimatedSpentUsd = Math.round(ledger.entries.reduce((sum, entry) => sum + entry.estimatedUsd, 0) * 100) / 100;
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
}

export async function falRun(modelId, input, { retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    if (response.ok) {
      appendLedger(modelId, true);
      return response.json();
    }
    lastError = `${response.status} ${await response.text().catch(() => '')}`.slice(0, 400);
    if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error(`fal.run/${modelId} failed: ${lastError}`);
}

export function imageToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

export async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed ${response.status}: ${url}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}
