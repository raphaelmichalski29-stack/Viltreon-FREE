// pm2 process config, tuned for a single 4-core VPS (e.g. Oracle Ampere A1 or
// Hetzner CX32, 8-24 GB RAM) serving up to ~5000 users. The app is I/O-bound
// (Gmail + Groq + Neon), so even at 5000 users the host is mostly waiting on
// network, not burning CPU.
//
// Scale up on a bigger box with WEB_INSTANCES / WORKER_INSTANCES env vars
// before `pm2 reload` — no file edit needed.

const webInstances = process.env.WEB_INSTANCES
  ? parseInt(process.env.WEB_INSTANCES)
  : 2

const workerInstances = process.env.WORKER_INSTANCES
  ? parseInt(process.env.WORKER_INSTANCES)
  : 6

module.exports = {
  apps: [
    {
      name: "inbox-ai-web",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      cwd: __dirname,
      // 2 clustered instances: ample for the HTTP load at 5000 users (mostly
      // Gmail webhook POSTs at single-digit req/sec) and gives `pm2 reload` a
      // peer to roll against for true zero-downtime restarts.
      instances: webInstances,
      exec_mode: "cluster",
      max_memory_restart: "1536M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "inbox-ai-worker",
      script: "src/worker.ts",
      interpreter: "npx",
      interpreter_args: "tsx",
      cwd: __dirname,
      instances: workerInstances,
      exec_mode: "fork",
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/worker-error.log",
      out_file: "logs/worker-out.log",
      merge_logs: true,
      env_production: {
        NODE_ENV: "production",
        // 6 workers x 10 concurrent jobs = 60 in-flight sorts. At a
        // conservative ~3s/job that is ~20 jobs/sec sustained, which clears the
        // business-hours peak at 5000 users (~15-18/sec) with headroom; average
        // load is far lower (~6/sec). Memory footprint fits an 8 GB box
        // (~3 GB for workers in practice). Set WORKER_INSTANCES=8-10 on the
        // 24 GB Oracle Ampere box if you want even more burst capacity.
        WORKER_CONCURRENCY: "10",
        // Per-process Gmail API token bucket. 6 x 200/s = 1200/s aggregate cap,
        // well above any realistic rate. CONCURRENCY is the real governor.
        WORKER_MAX_RATE: "200",
      },
    },
  ],
}
