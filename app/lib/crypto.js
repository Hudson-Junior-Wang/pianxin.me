// 偏心我 · end-to-end encryption helpers (WebCrypto only).
// Everything that leaves the device is sealed with AES-256-GCM using a key
// derived from the couple's shared passphrase. Topic names are derived from
// the key as well, so the brokers never see the passphrase or any content.

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = globalThis.crypto.subtle;

export const FP_EMOJI = [
  '🐰', '🐻', '🐱', '🐶', '🦊', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐤', '🦄',
  '🐝', '🦋', '🐢', '🐬', '🐳', '🦀', '🐙', '🦔', '🌸', '🌻', '🌷', '🍀', '🍄', '🌙', '⭐', '🌈',
  '☀️', '⛄', '🔥', '💧', '🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🍒', '🥝', '🍍', '🥥', '🥑',
  '🍔', '🍟', '🍕', '🌮', '🍣', '🍙', '🍩', '🍪', '🎂', '🍰', '🍫', '🍬', '🍭', '☕', '🧋', '🎈',
];

export const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

const hkdf = (info) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode(info) });

/** Stretch the passphrase into a 256-bit seed (slow on purpose). Returns hex. */
export async function deriveSeed(passphrase) {
  const norm = String(passphrase).normalize('NFKC').trim();
  const base = await subtle.importKey('raw', te.encode(norm), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: te.encode('pianxin.me/room/v1'), iterations: 300000 },
    base,
    256,
  );
  return hex(new Uint8Array(bits));
}

const unhex = (s) => Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));

/** Expand a seed into the shared keyring (fast). */
export async function keyringFromSeed(seedHex) {
  const bits = unhex(seedHex);
  if (bits.length !== 32) throw new Error('bad seed');
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey', 'deriveBits']);
  const key = await subtle.deriveKey(hkdf('enc/v1'), hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const room = hex(new Uint8Array(await subtle.deriveBits(hkdf('room/v1'), hk, 96)));
  const fpb = new Uint8Array(await subtle.deriveBits(hkdf('fp/v1'), hk, 32));
  const fp = Array.from(fpb, (b) => FP_EMOJI[b % 64]).join('');
  // secret salt used to hash topic names / blob ids (never leaves the device)
  const salt = new Uint8Array(await subtle.deriveBits(hkdf('salt/v1'), hk, 128));
  return { key, room, fp, salt, v: 1 };
}

/** Keyed short hash used for topic names and blob ids. */
export async function keyedHash(salt, data, len = 24) {
  const bytes = typeof data === 'string' ? te.encode(data) : data;
  const buf = new Uint8Array(salt.length + bytes.length);
  buf.set(salt, 0);
  buf.set(bytes, salt.length);
  return hex(new Uint8Array(await subtle.digest('SHA-256', buf))).slice(0, len);
}

export const CAN_ZIP = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function zip(bytes, compress) {
  const stream = new Blob([bytes]).stream().pipeThrough(compress ? new CompressionStream('deflate') : new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Seal a JSON header (+ optional binary attachment).
 * Wire format: [ver=1][iv 12][AES-GCM( [flags][u32 headerLen][header][bin] )]
 * The relative topic is bound as additional authenticated data.
 */
export async function seal(key, aad, header, bin) {
  let hb = te.encode(JSON.stringify(header));
  let flags = 0;
  if (CAN_ZIP && hb.length > 900) {
    const zb = await zip(hb, true);
    if (zb.length < hb.length) { hb = zb; flags |= 1; }
  }
  const binLen = bin ? bin.length : 0;
  const pt = new Uint8Array(5 + hb.length + binLen);
  pt[0] = flags;
  new DataView(pt.buffer).setUint32(1, hb.length);
  pt.set(hb, 5);
  if (bin) pt.set(bin, 5 + hb.length);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, pt));
  const out = new Uint8Array(13 + ct.length);
  out[0] = 1;
  out.set(iv, 1);
  out.set(ct, 13);
  return out;
}

export async function unseal(key, aad, data) {
  if (!data || data.length < 30 || data[0] !== 1) return null;
  try {
    const iv = data.slice(1, 13);
    const ct = data.slice(13);
    const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, key, ct));
    const flags = pt[0];
    const hl = new DataView(pt.buffer, pt.byteOffset, pt.byteLength).getUint32(1);
    let hb = pt.subarray(5, 5 + hl);
    if (flags & 1) {
      if (!CAN_ZIP) return null;
      hb = await zip(hb, false);
    }
    const header = JSON.parse(td.decode(hb));
    const bin = pt.length > 5 + hl ? pt.slice(5 + hl) : null;
    return { header, bin };
  } catch {
    return null;
  }
}

export async function sha256hex(bytes) {
  return hex(new Uint8Array(await subtle.digest('SHA-256', bytes))).slice(0, 40);
}
