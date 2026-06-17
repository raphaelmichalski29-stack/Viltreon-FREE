import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const KEY = process.env.ENCRYPTION_KEY
const SALT = process.env.ENCRYPTION_SALT
if (!KEY) throw new Error("ENCRYPTION_KEY environment variable is not set")
if (!SALT) throw new Error("ENCRYPTION_SALT environment variable is not set")
// Reject the previous default sentinel. A static, repo-known salt removes
// scrypt's per-deployment brute-force resistance; require something random.
if (SALT === "gmail-ai-sorter-salt" || SALT.length < 16) {
  throw new Error(
    "ENCRYPTION_SALT must be a high-entropy random value (>=16 chars). Generate with: openssl rand -hex 32",
  )
}

// scrypt is intentionally slow (~100ms). Derive once at module load and reuse.
const DERIVED_KEY: Buffer = crypto.scryptSync(KEY, SALT, 32)

function getKey(): Buffer {
  return DERIVED_KEY
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const key = getKey()
  const parts = encryptedText.split(":")
  if (parts.length !== 3) throw new Error("Invalid encrypted text format")
  const [ivHex, authTagHex, encrypted] = parts
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}
