import { sendAlert } from "@/lib/alert"

export async function registerNode() {
  process.on("unhandledRejection", (reason) => {
    console.error("[instrumentation] Unhandled promise rejection:", reason)
    sendAlert("Unhandled promise rejection (web)", reason)
  })

  process.on("uncaughtException", (err) => {
    console.error("[instrumentation] Uncaught exception, exiting:", err)
    if (process.env.ALERT_WEBHOOK_URL) {
      sendAlert("Uncaught exception (web), exiting", err)
      setTimeout(() => process.exit(1), 1500)
    } else {
      process.exit(1)
    }
  })

  if (process.env.NODE_ENV === "production" && process.env.RUN_INPROC_WORKER !== "1") {
    return
  }

  if (process.env.NODE_ENV !== "production" && process.env.DISABLE_INPROC_WORKER === "1") {
    console.log("[instrumentation] In-process worker disabled (DISABLE_INPROC_WORKER=1). Run `npm run worker` in a second terminal.")
    return
  }

  try {
    const { startWorker } = await import("@/lib/queue")
    await startWorker()
    console.log("[instrumentation] Worker started")
  } catch (err) {
    console.error("[instrumentation] Failed to start worker:", err)
    sendAlert("In-process worker failed to start", err)
  }
}
