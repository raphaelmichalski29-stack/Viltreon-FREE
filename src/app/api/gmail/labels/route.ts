import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getGmailClient, fetchUserLabels, buildLabelTree, createGmailLabel, updateGmailLabel, deleteGmailLabel } from "@/lib/gmail"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"
import { z } from "zod"

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "labels-list"), {
      maxRequests: 60,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const gmail = await getGmailClient(token.sub)
    const labels = await fetchUserLabels(gmail)

    const existingLabels = await prisma.userLabel.findMany({
      where: { userId: token.sub },
    })
    const existingMap = new Map(existingLabels.map((l) => [l.gmailLabelId, l]))
    const gmailIds = new Set(labels.map((l) => l.id))

    const toDelete = existingLabels.filter((l) => !gmailIds.has(l.gmailLabelId))
    if (toDelete.length > 0) {
      await prisma.userLabel.deleteMany({
        where: { id: { in: toDelete.map((l) => l.id) } },
      })
    }

    const keptDbLabels = existingLabels.filter((l) => gmailIds.has(l.gmailLabelId))
    const keptMap = new Map(keptDbLabels.map((l) => [l.gmailLabelId, l]))

    for (const label of labels) {
      const parts = label.name.split("/")
      let parentId: string | null = null

      if (parts.length > 1) {
        const parentName = parts.slice(0, -1).join("/")
        const parent = keptDbLabels.find((l) => l.name === parentName)
        if (parent) parentId = parent.id
      }

      const existing = existingMap.get(label.id)
      if (existing) {
        if (existing.name !== label.name || existing.parentId !== parentId) {
          await prisma.userLabel.update({
            where: { id: existing.id },
            data: { name: label.name, parentId },
          })
        }
      } else {
        const created = await prisma.userLabel.create({
          data: {
            userId: token.sub,
            gmailLabelId: label.id,
            name: label.name,
            type: label.type,
            parentId,
          },
        })
        keptMap.set(label.id, created)
        keptDbLabels.push(created)
      }
    }

    const dbMap = new Map(keptDbLabels.map((l) => [l.gmailLabelId, l]))
    const enriched = labels.map((l) => {
      const db = dbMap.get(l.id)
      return { ...l, aiVisible: db?.aiVisible ?? true, description: db?.description ?? undefined }
    })

    return NextResponse.json({ labels: enriched, tree: buildLabelTree(enriched) })
  } catch (err) {
    return apiError(err, "gmail/labels/GET")
  }
}

const createSchema = z.object({
  name: z.string().min(1, "Label name is required").max(100),
  parentGmailId: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "labels-create"), {
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const gmail = await getGmailClient(token.sub)

    let parentName: string | undefined
    let dbParentId: string | null = null
    if (parsed.data.parentGmailId) {
      const parent = await prisma.userLabel.findFirst({
        where: { gmailLabelId: parsed.data.parentGmailId, userId: token.sub },
      })
      if (parent) {
        parentName = parent.name
        dbParentId = parent.id
      }
    }

    const gmailLabel = await createGmailLabel(gmail, parsed.data.name, parentName)

    const dbLabel = await prisma.userLabel.create({
      data: {
        userId: token.sub,
        gmailLabelId: gmailLabel.id,
        name: gmailLabel.name,
        type: "user",
        parentId: dbParentId,
      },
    })

    return NextResponse.json({ label: { ...gmailLabel, dbId: dbLabel.id } })
  } catch (err) {
    return apiError(err, "gmail/labels/POST")
  }
}

const updateSchema = z.object({
  gmailLabelId: z.string().min(1),
  name: z.string().min(1).max(100),
})

export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "labels-update"), {
      maxRequests: 20,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const dbLabel = await prisma.userLabel.findFirst({
      where: { gmailLabelId: parsed.data.gmailLabelId, userId: token.sub },
    })
    if (!dbLabel) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 })
    }

    const gmail = await getGmailClient(token.sub)
    const updated = await updateGmailLabel(gmail, parsed.data.gmailLabelId, parsed.data.name)

    const parts = updated.name.split("/")
    let parentId: string | null = null
    if (parts.length > 1) {
      const parentName = parts.slice(0, -1).join("/")
      const parentLabel = await prisma.userLabel.findFirst({
        where: { userId: token.sub, name: parentName },
      })
      if (parentLabel) parentId = parentLabel.id
    }

    await prisma.userLabel.update({
      where: { id: dbLabel.id },
      data: { name: updated.name, parentId },
    })

    return NextResponse.json({ label: updated })
  } catch (err) {
    return apiError(err, "gmail/labels/PUT")
  }
}

const patchSchema = z.object({
  gmailLabelId: z.string().min(1),
  aiVisible: z.boolean().optional(),
  description: z.string().max(250).nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "labels-update-ai"), {
      maxRequests: 20,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const dbLabel = await prisma.userLabel.findFirst({
      where: { gmailLabelId: parsed.data.gmailLabelId, userId: token.sub },
    })
    if (!dbLabel) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.aiVisible !== undefined) data.aiVisible = parsed.data.aiVisible
    if (parsed.data.description !== undefined) data.description = parsed.data.description

    if (Object.keys(data).length > 0) {
      await prisma.userLabel.update({
        where: { id: dbLabel.id },
        data,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, "gmail/labels/PATCH")
  }
}

const deleteSchema = z.object({
  gmailLabelId: z.string().min(1, "gmailLabelId is required"),
})

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "labels-delete"), {
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = deleteSchema.safeParse({ gmailLabelId: searchParams.get("gmailLabelId") })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { gmailLabelId } = parsed.data

    const dbLabel = await prisma.userLabel.findFirst({
      where: { gmailLabelId, userId: token.sub },
    })
    if (!dbLabel) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 })
    }

    const gmail = await getGmailClient(token.sub)
    await deleteGmailLabel(gmail, gmailLabelId)

    // Orphan children in DB (Gmail cascades deletion to children)
    await prisma.userLabel.updateMany({
      where: { parentId: dbLabel.id },
      data: { parentId: null },
    })

    await prisma.userLabel.delete({
      where: { id: dbLabel.id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, "gmail/labels/DELETE")
  }
}
