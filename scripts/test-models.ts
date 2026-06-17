import "dotenv/config"
import { decrypt } from "../src/lib/encryption"
import { prisma } from "../src/lib/db"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

const MODELS = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
]

const TEST_SYSTEM = `You are an expert email classifier. Classify the email into exactly ONE of the following labels:
- Work (ID: Label_1)
- Personal (ID: Label_2)

Return ONLY valid JSON: {"labelId":"<label ID>","confidence":0.0-1.0,"reason":"<why this label fits>"}`

const TEST_USER = `Sender: alice@company.com
Subject: Q3 budget review
Body: Hi team, the Q3 budget review is scheduled for Friday. Please have your department's projections ready by Thursday EOD. We'll be going over marketing spend, headcount changes, and infrastructure costs.`

async function testModel(apiKey: string, model: string): Promise<string> {
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: TEST_SYSTEM },
      { role: "user", content: TEST_USER },
    ],
    response_format: { type: "json_object" },
    max_tokens: 512,
  })

  const start = Date.now()
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })
    const elapsed = Date.now() - start

    if (!res.ok) {
      const text = await res.text()
      return `✗ ${model} — HTTP ${res.status} (${elapsed}ms): ${text.substring(0, 100)}`
    }

    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content || ""
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return `✗ ${model} — no JSON in response (${elapsed}ms)`

    const parsed = JSON.parse(jsonMatch[0])
    return `✓ ${model} — confidence=${parsed.confidence}, labelId="${parsed.labelId}" (${elapsed}ms)`
  } catch (err: any) {
    return `✗ ${model} — Network error: ${err.message}`
  }
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { geminiKeyEnc: { not: null } },
    orderBy: { createdAt: "desc" },
  })

  if (!user?.geminiKeyEnc) {
    console.error("No user with Groq API key found in DB")
    await prisma.$disconnect()
    process.exit(1)
  }

  const apiKey = decrypt(user.geminiKeyEnc)
  const masked = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4)
  console.log(`Testing with user: ${user.email || user.id}`)
  console.log(`API key: ${masked}`)
  console.log("")

  for (const model of MODELS) {
    const result = await testModel(apiKey, model)
    console.log(result)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
