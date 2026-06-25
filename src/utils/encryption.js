import crypto from "crypto";

const ENCRYPTION_KEY = process.env.BETTER_AUTH_SECRET;
if (!ENCRYPTION_KEY) {
  console.error("FATAL: BETTER_AUTH_SECRET is not set. Encryption will fail.");
}
const ALGORITHM = "aes-256-cbc";

export function encryptPassword(password) {
  if (!ENCRYPTION_KEY) {
    throw new Error("Cannot encrypt: BETTER_AUTH_SECRET is not configured");
  }
  const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || !encryptedPassword.includes(":")) {
    return encryptedPassword;
  }
  if (!ENCRYPTION_KEY) {
    throw new Error("Cannot decrypt: BETTER_AUTH_SECRET is not configured");
  }
  const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  const parts = encryptedPassword.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
