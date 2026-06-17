import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getQueue } from "@/lib/queue"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params

  const token = await getToken({ req: _request })
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const queue = await getQueue()
    const status = await queue.getStatus(jobId)

    if (!status) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (status.userId !== token.sub) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json(status)
  } catch {
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 })
  }
}
