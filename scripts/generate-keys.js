import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const keysDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "keys");
if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding:  { type: "spki",  format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

fs.writeFileSync(path.join(keysDir, "private.pem"), privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(keysDir, "public.pem"),  publicKey);
fs.writeFileSync(path.join(keysDir, ".gitignore"), "private.pem\n*.pem\n!public.pem\n");

console.log("✅ Keys generated in backend/keys/");
console.log("⚠️  Add to backend .env:");
console.log("    JWT_PRIVATE_KEY_PATH=./keys/private.pem");
console.log("    JWT_PUBLIC_KEY_PATH=./keys/public.pem");
console.log("⚠️  Delete keys/ from frontend — backend owns the keys now.");
