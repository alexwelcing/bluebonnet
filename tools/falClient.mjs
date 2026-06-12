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
    if (response.ok) return response.json();
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
