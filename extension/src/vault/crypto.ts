// At-rest encryption for the vault (WebCrypto AES-GCM).
// Key is derived from a master password via PBKDF2. The derived key never
// touches disk; only the salt + ciphertext do. When unlocked, the raw key is
// held in chrome.storage.session (memory-only) by the vault layer.

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedBlob {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 ciphertext
}

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true, // extractable: we persist the raw key in session storage while unlocked
    ["encrypt", "decrypt"],
  );
}

// Derive an unlock key from a password. Salt is generated once and persisted
// alongside the vault so future unlocks reproduce the same key.
export async function keyFromPassword(
  password: string,
  saltB64?: string,
): Promise<{ key: CryptoKey; saltB64: string }> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt);
  return { key, saltB64: toB64(salt) };
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toB64(await crypto.subtle.exportKey("raw", key));
}

export async function importKey(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromB64(rawB64) as BufferSource, "AES-GCM", true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptJSON(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = enc.encode(JSON.stringify(value)) as BufferSource;
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext,
  );
  // salt is owned by the vault (it derived the key); store iv + data here.
  return { v: 1, salt: "", iv: toB64(iv), data: toB64(cipher) };
}

export async function decryptJSON<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const iv = fromB64(blob.iv);
  const data = fromB64(blob.data);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return JSON.parse(dec.decode(plain)) as T;
}

// Quick verifier: encrypt a known token so unlock can be validated without
// touching profile records.
export const VERIFY_TOKEN = "autofill-vault-ok";
