// Board codes: save the current board behind a short, typeable code.
//
// The code is a single 16-character secret. Both the server lookup id and the
// AES key are derived from it in the browser, so the secret itself is never
// transmitted — the API only ever sees an opaque id, an IV and ciphertext, and
// cannot read the boards it stores.
//
//   secret        16 chars, Crockford base32 (80 bits)
//   lookupId      HKDF-SHA256(secret, "charge-tool/id")  -> 16 bytes -> base64url
//   encryptionKey HKDF-SHA256(secret, "charge-tool/key") -> AES-GCM 256

const SCHEMA_VERSION = 1;
const SECRET_CHARS = 16;
const API_URL = '/api/board';

// Crockford base32: no I, L, O or U, so a code can be read aloud or copied off
// a whiteboard without the usual transcription mix-ups.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export class BoardCodeError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'BoardCodeError';
    this.kind = kind;
  }
}

const MESSAGES = {
  malformed: "That doesn't look like a board code — it should be 16 letters and numbers.",
  not_found: 'No board found for that code. Codes expire after 30 days.',
  decrypt: "That code didn't unlock this board — check for a mistyped character.",
  network: "Couldn't reach the server. Check your connection and try again.",
  future_version: 'This board was saved by a newer version of the tool. Refresh the page and try again.',
  too_large: 'This board is too large to save.',
  rate_limited: 'Too many saves in a row — wait a minute and try again.',
  corrupt: 'That board is damaged and could not be opened.',
  unsupported: 'This browser is missing the security features needed to save boards.',
  unconfigured: 'Board saving is not set up on this deployment yet.',
};

const fail = (kind) => {
  throw new BoardCodeError(kind, MESSAGES[kind] || MESSAGES.corrupt);
};

// --- encoding helpers -------------------------------------------------------

const toBase64Url = (bytes) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (str) => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

// --- secrets ----------------------------------------------------------------

/** A fresh 16-character Crockford base32 code (80 bits of entropy). */
export function generateSecret() {
  const bytes = new Uint8Array(10); // 80 bits
  crypto.getRandomValues(bytes);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < 80; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

/** Display form: K7M2-QX9V-3HTB-P5RN */
export function formatSecret(secret) {
  return (secret.match(/.{1,4}/g) || []).join('-');
}

/**
 * Accepts a bare code, a dashed/spaced code, any casing, or a full share URL,
 * and returns the canonical 16-character secret. Applies the Crockford
 * substitutions (I/L -> 1, O -> 0) so common transcription slips still resolve.
 */
export function normalizeSecret(input) {
  if (typeof input !== 'string') fail('malformed');
  let s = input.trim();
  const hash = s.indexOf('#c=');
  if (hash >= 0) s = s.slice(hash + 3);
  s = s
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (s.length !== SECRET_CHARS || !/^[0-9A-HJKMNP-TV-Z]+$/.test(s)) fail('malformed');
  return s;
}

// --- key derivation ---------------------------------------------------------

async function deriveBits(secret, info, byteLength) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    key,
    byteLength * 8,
  );
  return new Uint8Array(bits);
}

async function deriveLookupId(secret) {
  return toBase64Url(await deriveBits(secret, 'charge-tool/id', 16));
}

async function deriveKey(secret) {
  const raw = await deriveBits(secret, 'charge-tool/key', 32);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// --- compression ------------------------------------------------------------
// Deflate before encrypting — ciphertext is incompressible, so the order
// matters. Cuts a full board from ~6.8KB to ~640 bytes.

const canCompress = () => typeof CompressionStream !== 'undefined';

async function deflate(bytes) {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// --- board normalization ----------------------------------------------------

const cleanAcuity = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : '';
};

/** Strip the board down to the fields worth persisting. */
function packBoard({ nurses, rooms, shiftMode, cnaCount }) {
  return {
    v: SCHEMA_VERSION,
    shiftMode: shiftMode === 'night' ? 'night' : 'day',
    cnaCount: Math.max(1, Math.min(4, parseInt(cnaCount, 10) || 1)),
    nurses: nurses.map((n) => ({
      name: String(n.name ?? ''),
      noChemo: !!n.noChemo,
      noIec: !!n.noIec,
      locked: !!n.locked,
    })),
    rooms: rooms.map((r) => ({
      room: r.room,
      tx: String(r.tx ?? '').trim(),
      acuity: cleanAcuity(r.acuity),
      admit: !!r.admit,
      discharge: !!r.discharge,
      transplant: !!r.transplant,
      imc: !!r.imc,
      cna: !!r.cna,
      chemo: !!r.chemo,
      iec: !!r.iec,
      notIndep: !!r.notIndep,
      rn: String(r.rn ?? '-'),
      locked: !!r.locked,
    })),
  };
}

/** Validate a decoded payload and rebuild app-shaped state. Never partial. */
function unpackBoard(payload) {
  if (!payload || typeof payload !== 'object') fail('corrupt');
  if (payload.v > SCHEMA_VERSION) fail('future_version');
  if (!Array.isArray(payload.nurses) || !Array.isArray(payload.rooms)) fail('corrupt');
  if (payload.rooms.length !== 32) fail('corrupt');

  const nurses = payload.nurses.map((n, i) => ({
    // ids are only React keys; reassign so imported boards can't collide with
    // the Date.now() ids the app hands to nurses added at runtime.
    id: i + 1,
    name: String(n?.name ?? ''),
    noChemo: !!n?.noChemo,
    noIec: !!n?.noIec,
    locked: !!n?.locked,
  }));

  const knownNames = new Set(nurses.map((n) => n.name).filter((n) => n.trim() !== ''));

  const rooms = payload.rooms.map((r, i) => {
    const room = Number(r?.room);
    if (room !== i + 1) fail('corrupt');
    const rn = String(r?.rn ?? '-');
    return {
      room,
      tx: String(r?.tx ?? ''),
      acuity: cleanAcuity(r?.acuity),
      admit: !!r?.admit,
      discharge: !!r?.discharge,
      transplant: !!r?.transplant,
      imc: !!r?.imc,
      cna: !!r?.cna,
      chemo: !!r?.chemo,
      iec: !!r?.iec,
      notIndep: !!r?.notIndep,
      // Assignments are stored by nurse name; drop any that no longer resolve
      // so a board can't come back with phantom assignments.
      rn: knownNames.has(rn) ? rn : '-',
      locked: !!r?.locked,
    };
  });

  return {
    nurses,
    rooms,
    shiftMode: payload.shiftMode === 'night' ? 'night' : 'day',
    cnaCount: Math.max(1, Math.min(4, parseInt(payload.cnaCount, 10) || 1)),
  };
}

// --- public API -------------------------------------------------------------

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    fail('network');
  }
  if (res.status === 404) fail('not_found');
  if (res.status === 413) fail('too_large');
  if (res.status === 429) fail('rate_limited');
  if (res.status === 503) fail('unconfigured');
  if (!res.ok) fail('network');
  try {
    return await res.json();
  } catch {
    fail('network');
  }
}

/**
 * Encrypt the board and store it. Returns the 16-character code, which is the
 * only thing that can decrypt it.
 */
export async function saveBoard(state) {
  if (!crypto?.subtle) fail('unsupported');

  const secret = generateSecret();
  const plaintext = new TextEncoder().encode(JSON.stringify(packBoard(state)));

  const compressed = canCompress();
  const body = compressed ? await deflate(plaintext) : plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(secret), body),
  );

  await request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: await deriveLookupId(secret),
      iv: toBase64Url(iv),
      data: toBase64Url(ciphertext),
      z: compressed,
    }),
  });

  return secret;
}

/** Fetch and decrypt the board behind a code. Accepts a code or a share URL. */
export async function loadBoard(code) {
  if (!crypto?.subtle) fail('unsupported');

  const secret = normalizeSecret(code);
  const stored = await request(`${API_URL}?id=${encodeURIComponent(await deriveLookupId(secret))}`);

  if (!stored || typeof stored.iv !== 'string' || typeof stored.data !== 'string') fail('corrupt');

  let body;
  try {
    // A wrong key or tampered ciphertext fails the GCM auth tag here rather
    // than decrypting to garbage.
    body = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64Url(stored.iv) },
        await deriveKey(secret),
        fromBase64Url(stored.data),
      ),
    );
  } catch {
    fail('decrypt');
  }

  if (stored.z) {
    if (typeof DecompressionStream === 'undefined') fail('unsupported');
    try {
      body = await inflate(body);
    } catch {
      fail('corrupt');
    }
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    fail('corrupt');
  }

  return unpackBoard(payload);
}

/** Full share URL for a code — the secret rides in the hash, never the query. */
export function shareUrl(secret) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#c=${formatSecret(secret)}`;
}

/** Read a code out of the current URL hash, or null. */
export function codeFromHash(hash) {
  const match = /[#&]c=([^&]+)/.exec(hash || '');
  return match ? decodeURIComponent(match[1]) : null;
}
