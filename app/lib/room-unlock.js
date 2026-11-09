// The fixed login credential unwraps the existing room seed. Rotating this
// envelope does not change any room, record, photo id, or sync encryption key.
// Only authenticated ciphertext is published; never publish a password or seed.
import { keyringFromSeed, unseal } from './crypto.js?v=4420681d90';

export const WRAPPED_ROOM_SEED = '01d5bcb5c2d16e80cefd278095f1fe80440069f8e4bd6a290852a787396aff33bea5d1fc2d51b03e01cdc87f2ed03ccd10ce2bbe19c7e05aed5771988ed8f43b3cbdf8728e954e874db74e5ff6b827dd931675fa14106e43daba755b6ee4fe864376d7731b3dd73155ec26adab588031893de2';
const AAD = 'pianxin.me/room-unlock/v1';

export async function unlockRoomSeed(credential) {
  if (!/^[a-f0-9]{64}$/.test(credential || '') || !/^(?:[a-f0-9]{2})+$/.test(WRAPPED_ROOM_SEED)) return null;
  try {
    const kr = await keyringFromSeed(credential);
    const bytes = Uint8Array.from(WRAPPED_ROOM_SEED.match(/../g), (h) => parseInt(h, 16));
    const opened = await unseal(kr.key, AAD, bytes);
    const seed = opened?.header?.seed;
    return /^[a-f0-9]{64}$/.test(seed || '') ? seed : null;
  } catch {
    return null;
  }
}
