import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://api.worldlabs.ai';
const LEDGER_PATH = new URL('./generation-ledger.json', import.meta.url);

function loadApiKey() {
  if (process.env.WORLD_API_KEY) return process.env.WORLD_API_KEY;
  const envPath = new URL('../.env', import.meta.url);
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/^WORLD_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  }
  throw new Error('WORLD_API_KEY not found in environment or .env');
}

const API_KEY = loadApiKey();

function headers(extra = {}) {
  return {
    'WLT-Api-Key': API_KEY,
    ...extra,
  };
}

function appendLedger(entry) {
  let ledger = { budgetUsd: 100, entries: [] };
  try {
    ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch {
    // first write
  }
  ledger.entries.push({
    at: new Date().toISOString(),
    provider: 'worldlabs',
    ...entry,
  });
  ledger.estimatedSpentUsd = Math.round(
    ledger.entries.reduce((sum, e) => sum + (e.estimatedUsd ?? 0), 0) * 100
  ) / 100;
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
}

export async function request(method, endpoint, body, extraHeaders = {}) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: headers(
      body ? { 'Content-Type': 'application/json', ...extraHeaders } : extraHeaders
    ),
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`World Labs ${method} ${endpoint} failed ${response.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

export async function getCredits() {
  return request('GET', '/marble/v1/credits');
}

export async function prepareMediaUpload(fileName, kind, extension) {
  return request('POST', '/marble/v1/media-assets:prepare_upload', {
    file_name: fileName,
    kind,
    extension,
  });
}

export async function uploadToSignedUrl(uploadUrl, filePath, requiredHeaders = {}) {
  const data = fs.readFileSync(filePath);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: requiredHeaders,
    body: data,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Upload failed ${response.status}: ${text.slice(0, 400)}`);
  }
  return true;
}

export async function uploadMedia(filePath, kind, extension) {
  const fileName = path.basename(filePath);
  const { media_asset, upload_info } = await prepareMediaUpload(fileName, kind, extension);
  await uploadToSignedUrl(upload_info.upload_url, filePath, upload_info.required_headers);
  return media_asset.media_asset_id;
}

export async function generateWorld({ displayName, model = 'marble-1.1', worldPrompt }) {
  const result = await request('POST', '/marble/v1/worlds:generate', {
    display_name: displayName,
    model,
    world_prompt: worldPrompt,
  });
  appendLedger({
    model,
    operationId: result.operation_id,
    estimatedUsd: model === 'marble-1.1-plus' ? 2.5 : 1.5,
    ok: true,
    displayName,
  });
  return result;
}

export async function generateWorldFromImage({ displayName, model = 'marble-1.1', imagePath, textPrompt, isPano = false }) {
  const ext = path.extname(imagePath).slice(1).toLowerCase();
  const mediaAssetId = await uploadMedia(imagePath, 'image', ext);
  return generateWorld({
    displayName,
    model,
    worldPrompt: {
      type: 'image',
      image_prompt: {
        source: 'media_asset',
        media_asset_id: mediaAssetId,
      },
      is_pano: isPano,
      text_prompt: textPrompt,
    },
  });
}

export async function generateWorldFromMultiImage({ displayName, model = 'marble-1.1', images, textPrompt }) {
  const multiImagePrompt = [];
  for (const { filePath, azimuth } of images) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mediaAssetId = await uploadMedia(filePath, 'image', ext);
    multiImagePrompt.push({
      azimuth,
      content: { source: 'media_asset', media_asset_id: mediaAssetId },
    });
  }
  return generateWorld({
    displayName,
    model,
    worldPrompt: {
      type: 'multi-image',
      multi_image_prompt: multiImagePrompt,
      text_prompt: textPrompt,
    },
  });
}

export async function getOperation(operationId) {
  return request('GET', `/marble/v1/operations/${operationId}`);
}

export async function pollOperation(operationId, { intervalMs = 10000, maxAttempts = 60 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const op = await getOperation(operationId);
    if (op.done) {
      if (op.error) throw new Error(`Operation ${operationId} failed: ${JSON.stringify(op.error)}`);
      return op;
    }
    const status = op.metadata?.progress?.status ?? 'unknown';
    console.log(`  [${attempt + 1}/${maxAttempts}] ${status}: ${op.metadata?.progress?.description ?? ''}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Operation ${operationId} timed out after ${maxAttempts} attempts`);
}

export async function getWorld(worldId) {
  const result = await request('GET', `/marble/v1/worlds/${worldId}`);
  return result.world ?? result;
}

export async function listWorlds({ pageSize = 20, pageToken } = {}) {
  const params = new URLSearchParams();
  params.set('page_size', String(pageSize));
  if (pageToken) params.set('page_token', pageToken);
  return request('GET', `/marble/v1/worlds?${params.toString()}`);
}

export async function deleteWorld(worldId) {
  return request('DELETE', `/marble/v1/worlds/${worldId}`);
}

export async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

export async function downloadWorldAssets(world, outDir) {
  const worldId = world.world_id ?? world.id;
  if (!worldId) throw new Error('World object missing world_id/id');
  const assets = world.assets ?? {};
  const splats = assets.splats?.spz_urls ?? {};
  const files = [];
  for (const [res, url] of Object.entries(splats)) {
    if (!url) continue;
    const dest = path.join(outDir, `${worldId}__${res}.spz`);
    files.push(await downloadFile(url, dest));
  }
  if (assets.mesh?.collider_mesh_url) {
    files.push(await downloadFile(assets.mesh.collider_mesh_url, path.join(outDir, `${worldId}__mesh.glb`)));
  }
  if (assets.imagery?.pano_url) {
    files.push(await downloadFile(assets.imagery.pano_url, path.join(outDir, `${worldId}__pano.jpg`)));
  }
  if (assets.thumbnail_url) {
    files.push(await downloadFile(assets.thumbnail_url, path.join(outDir, `${worldId}__thumb.jpg`)));
  }
  const semantics = assets.splats?.semantics_metadata;
  if (semantics) {
    fs.writeFileSync(path.join(outDir, `${worldId}__semantics.json`), JSON.stringify(semantics, null, 2) + '\n');
    files.push(path.join(outDir, `${worldId}__semantics.json`));
  }
  return files;
}
