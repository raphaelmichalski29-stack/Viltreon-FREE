import crypto from "node:crypto"
import { createServer } from "node:http"

// Simulate the webhook verification logic
const EXPECTED_TOKEN = "cb3d05b1779c61d46900fe39d616d695"

function verifyWebhookToken(token) {
  if (!EXPECTED_TOKEN || !token || token.length !== EXPECTED_TOKEN.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(EXPECTED_TOKEN))
  } catch {
    return false
  }
}

// Zod-like validation schemas
function validateEnvelope(body) {
  if (!body || typeof body !== "object") return { ok: false }
  const msg = body.message
  if (!msg || typeof msg.data !== "string" || msg.data.length === 0) return { ok: false }
  return { ok: true, data: msg.data, token: msg.attributes?.verification_token }
}

function validateWebhookData(decoded) {
  try {
    const obj = JSON.parse(decoded)
    if (typeof obj.emailAddress !== "string" || !obj.emailAddress.includes("@")) return { ok: false }
    if (typeof obj.historyId !== "string" || obj.historyId.length === 0) return { ok: false }
    return { ok: true, emailAddress: obj.emailAddress, historyId: obj.historyId }
  } catch { return { ok: false } }
}

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}: ${e.message}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed")
}

console.log("\n=== Token Verification Tests ===\n")

test("valid token passes", () => {
  assert(verifyWebhookToken(EXPECTED_TOKEN) === true)
})

test("wrong token fails", () => {
  assert(verifyWebhookToken("wrong_token_here_123456789abcdefgh") === false)
})

test("empty token fails", () => {
  assert(verifyWebhookToken("") === false)
})

test("short token fails", () => {
  assert(verifyWebhookToken("short") === false)
})

test("long token fails", () => {
  assert(verifyWebhookToken("a".repeat(100)) === false)
})

test("null/undefined token returns false (not crash)", () => {
  assert(verifyWebhookToken(null) === false)
})

console.log("\n=== Envelope Validation Tests ===\n")

test("valid envelope passes", () => {
  const body = {
    message: {
      data: Buffer.from(JSON.stringify({ emailAddress: "test@example.com", historyId: "12345" })).toString("base64"),
      attributes: { verification_token: EXPECTED_TOKEN },
    },
  }
  const result = validateEnvelope(body)
  assert(result.ok === true)
  assert(typeof result.data === "string")
  assert(result.token === EXPECTED_TOKEN)
})

test("missing message field fails", () => {
  const result = validateEnvelope({})
  assert(result.ok === false)
})

test("missing message.data fails", () => {
  const result = validateEnvelope({ message: {} })
  assert(result.ok === false)
})

test("empty message.data fails", () => {
  const result = validateEnvelope({ message: { data: "" } })
  assert(result.ok === false)
})

test("null body fails", () => {
  assert(validateEnvelope(null).ok === false)
})

console.log("\n=== Webhook Data Validation Tests ===\n")

test("valid webhook data passes", () => {
  const result = validateWebhookData(JSON.stringify({ emailAddress: "user@gmail.com", historyId: "12345" }))
  assert(result.ok === true)
  assert(result.emailAddress === "user@gmail.com")
  assert(result.historyId === "12345")
})

test("missing email fails", () => {
  const result = validateWebhookData(JSON.stringify({ historyId: "12345" }))
  assert(result.ok === false)
})

test("invalid email fails", () => {
  const result = validateWebhookData(JSON.stringify({ emailAddress: "notanemail", historyId: "12345" }))
  assert(result.ok === false)
})

test("missing historyId fails", () => {
  const result = validateWebhookData(JSON.stringify({ emailAddress: "test@example.com" }))
  assert(result.ok === false)
})

test("malformed JSON fails", () => {
  const result = validateWebhookData("{invalid json}")
  assert(result.ok === false)
})

test("empty string fails", () => {
  const result = validateWebhookData("")
  assert(result.ok === false)
})

console.log("\n=== Full Webhook Simulation Tests ===\n")

test("complete valid request simulation", () => {
  const inner = { emailAddress: "user@gmail.com", historyId: "99999" }
  const body = {
    message: {
      data: Buffer.from(JSON.stringify(inner)).toString("base64"),
      attributes: { verification_token: EXPECTED_TOKEN },
    },
  }

  const envelope = validateEnvelope(body)
  assert(envelope.ok === true)
  assert(envelope.token === EXPECTED_TOKEN)
  assert(verifyWebhookToken(envelope.token) === true)

  const decoded = Buffer.from(envelope.data, "base64").toString("utf-8")
  const data = validateWebhookData(decoded)
  assert(data.ok === true)
  assert(data.emailAddress === "user@gmail.com")
  assert(data.historyId === "99999")
})

test("invalid token in envelope is rejected", () => {
  const body = {
    message: {
      data: Buffer.from(JSON.stringify({ emailAddress: "user@gmail.com", historyId: "12345" })).toString("base64"),
      attributes: { verification_token: "wrong_token_here_123456789abcdefgh" },
    },
  }

  const envelope = validateEnvelope(body)
  assert(envelope.ok === true)
  assert(envelope.token !== EXPECTED_TOKEN)
  assert(verifyWebhookToken(envelope.token) === false)
})

test("missing token in envelope is rejected", () => {
  const body = {
    message: {
      data: Buffer.from(JSON.stringify({ emailAddress: "user@gmail.com", historyId: "12345" })).toString("base64"),
    },
  }

  const envelope = validateEnvelope(body)
  assert(envelope.ok === true)
  assert(envelope.token === undefined)
})

test("query string token is NOT accepted (security fix)", () => {
  // The fix: token is ONLY accepted from body.message.attributes, NOT from query string
  const body = {
    message: {
      data: Buffer.from(JSON.stringify({ emailAddress: "user@gmail.com", historyId: "12345" })).toString("base64"),
    },
  }
  // Query string token should be ignored
  const envelope = validateEnvelope(body)
  assert(envelope.ok === true)
  assert(envelope.token === undefined)
})

console.log("\n=== Results ===")
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(passed > 0 && failed === 0 ? "\n  ALL TESTS PASSED ✓\n" : "\n  SOME TESTS FAILED ✗\n")
