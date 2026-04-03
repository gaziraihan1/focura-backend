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
fs.writeFileSync(path.join(keysDir, ".gitignore"), "*.pem\n");

const privateKeyB64 = Buffer.from(privateKey).toString("base64");
const publicKeyB64  = Buffer.from(publicKey).toString("base64");

// Write directly into .env — no copy-paste errors
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
let env = fs.readFileSync(envPath, "utf-8");

// Replace or append JWT keys
const updateEnv = (content, key, value) => {
  const regex = new RegExp(`^${key}=.*$`, "m");
  return regex.test(content)
    ? content.replace(regex, `${key}=${value}`)
    : content + `\n${key}=${value}`;
};

env = updateEnv(env, "JWT_PRIVATE_KEY", privateKeyB64);
env = updateEnv(env, "JWT_PUBLIC_KEY",  publicKeyB64);

fs.writeFileSync(envPath, env);

console.log("✅ Keys generated and written directly to .env");
console.log("✅ PEM files saved to keys/ for development use");