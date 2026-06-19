export async function registerNode() {
  process.on("unhandledRejection", (reason) => {
    console.error("[instrumentation] Unhandled promise rejection:", reason)
  })

  process.on("uncaughtException", (err) => {
    console.error("[instrumentation] Uncaught exception, exiting:", err)
    process.exit(1)
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
  }
}
