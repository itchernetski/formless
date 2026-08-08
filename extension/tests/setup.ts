// Test environment shims.
// jsdom doesn't ship WebCrypto subtle or IndexedDB; supply Node's webcrypto and
// fake-indexeddb so the vault/crypto layers run unchanged.
import { webcrypto } from "node:crypto";
import "fake-indexeddb/auto";

if (!globalThis.crypto?.subtle) {
  (globalThis as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}
