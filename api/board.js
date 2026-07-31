// Board code storage.
//
// Holds encrypted board blobs keyed by an opaque id. Both the id and the
// encryption key are derived in the browser from a secret this endpoint never
// receives, so the contents here cannot be read back by the server — the blob
// is ciphertext and nothing stored alongside it can decrypt it.

import { Redis } from '@upstash/redis';

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days; boards are shift-scoped
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT = 20; // writes per window
const RATE_WINDOW = 60; // seconds

const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const B64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

async function isRateLimited(req) {
  const key = `rl:${clientIp(req)}`;
  const hits = await redis.incr(key);
  if (hits === 1) await redis.expire(key, RATE_WINDOW);
  return hits > RATE_LIMIT;
}

export default async function handler(req, res) {
  if (!redis) {
    return res.status(503).json({ error: 'Board storage is not configured.' });
  }

  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch {
    // Never echo request contents or internal detail back to the caller.
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}

async function handleGet(req, res) {
  const id = req.query?.id;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    return res.status(400).json({ error: 'Bad request.' });
  }

  const stored = await redis.get(`b:${id}`);
  if (!stored) return res.status(404).json({ error: 'Not found.' });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(stored);
}

async function handlePost(req, res) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload too large.' });
  }

  if (await isRateLimited(req)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Bad request.' });
  }

  const { id, iv, data, z } = body;
  if (
    typeof id !== 'string' || !ID_PATTERN.test(id) ||
    typeof iv !== 'string' || !B64URL_PATTERN.test(iv) || iv.length > 32 ||
    typeof data !== 'string' || !B64URL_PATTERN.test(data)
  ) {
    return res.status(400).json({ error: 'Bad request.' });
  }

  // Re-check the real size; content-length can be absent or wrong.
  if (data.length + iv.length > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload too large.' });
  }

  // nx: a code is written once and never overwritten, so a handed-out code
  // can't change under whoever holds it.
  const written = await redis.set(
    `b:${id}`,
    { iv, data, z: !!z },
    { nx: true, ex: TTL_SECONDS },
  );
  if (written === null) return res.status(409).json({ error: 'Already exists.' });

  return res.status(201).json({ ok: true });
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
