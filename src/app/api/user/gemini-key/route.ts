import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { prisma } from "@/lib/db"
import { encrypt } from "@/lib/encryption"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"
import { z } from "zod"

const schema = z.object({
  // Groq keys are ~56 chars ("gsk_..."); 256 leaves headroom for other
  // providers while rejecting megabyte-sized garbage before it's encrypted
  // and written to the DB.
  key: z.string().trim().min(1, "API key is required").max(256, "API key is too long"),
})

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(rateLimitKey(token.sub, "gemini-key"), {
      maxRequests: 5,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { id: token.sub }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const encrypted = encrypt(parsed.data.key)

    await prisma.user.update({
      where: { id: token.sub },
      data: { geminiKeyEnc: encrypted },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, "user/gemini-key")
  }
}
