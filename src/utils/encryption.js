import crypto from "crypto";
const ENCRYPTION_KEY = process.env.BETTER_AUTH_SECRET || "default-encryption-key-change-this"; // Must be handled carefully in prod
const ALGORITHM = "aes-256-cbc";

export function encryptPassword(password) {
  try {
    // key must be 32 bytes for aes-256
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    return password;
  }
}

export function decryptPassword(encryptedPassword) {
  try {
    if (!encryptedPassword || !encryptedPassword.includes(":")) {
      return encryptedPassword;
    }
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const parts = encryptedPassword.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return encryptedPassword;
  }
}
