import { validateLookup, lookupAccount } from '../social.mjs';

const MAX_BODY_BYTES = 5000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 6;
const MAX_CLIENTS = 1000;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    throw new RangeError('Request too large.');
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError('Request too large.');
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export function createAudienceHandler({
  lookup = lookupAccount,
  clientKey = () => 'local',
  now = Date.now,
} = {}) {
  // Best-effort protection per warm instance, not a distributed/global quota.
  const limits = new Map();

  return async function handleAudience(request) {
    if (request.method !== 'POST') {
      return json({ error: 'Use POST.' }, 405, { Allow: 'POST' });
    }
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) {
      return json({ error: 'Invalid request origin.' }, 403);
    }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ error: 'Expected JSON.' }, 415);
    }

    const key = clientKey(request) || 'unknown';
    const time = now();
    for (const [ip, entry] of limits) {
      if (time - entry.start >= WINDOW_MS) limits.delete(ip);
    }
    const current = limits.get(key);
    if (current?.count >= MAX_REQUESTS) {
      const retry = Math.ceil((WINDOW_MS - (time - current.start)) / 1000);
      return json({ error: 'Please wait a minute before trying again.' }, 429, { 'Retry-After': String(retry) });
    }
    if (!current && limits.size >= MAX_CLIENTS) limits.delete(limits.keys().next().value);
    limits.set(key, current ? { ...current, count: current.count + 1 } : { start: time, count: 1 });

    let accounts;
    try {
      const input = JSON.parse(await readBody(request));
      accounts = validateLookup(input?.accounts);
    } catch (error) {
      return json({ error: error instanceof RangeError ? 'Request too large.' : 'Enter one to five valid, distinct social accounts.' }, error instanceof RangeError ? 413 : 400);
    }
    try {
      return json({ accounts: await Promise.all(accounts.map(account => lookup(account))) });
    } catch {
      return json({ error: 'Lookup is temporarily unavailable. Please try again.' }, 503);
    }
  };
}
