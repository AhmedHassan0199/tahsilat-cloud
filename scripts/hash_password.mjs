import { webcrypto } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error("Usage: node scripts/hash_password.mjs YourPassword123");
  process.exit(1);
}

const crypto = webcrypto;
const iterations = Number(process.argv[3] || 20000);
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations },
  key,
  256
);

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

console.log(`pbkdf2$${iterations}$${b64(salt)}$${b64(new Uint8Array(bits))}`);
