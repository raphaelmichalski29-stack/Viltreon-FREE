const next = require("next/dist/server/next/next-server")
const http = require("http")
const { parse } = require("url")

const app = next({ dev: false, dir: process.cwd() })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  http.createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  }).listen(3000, "127.0.0.1", () => {
    console.log(`Server ready on http://127.0.0.1:3000`)
  })
})
