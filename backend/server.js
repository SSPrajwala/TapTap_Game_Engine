/**
 * TapTap Adaptive Game Engine – Backend Server
 * ─────────────────────────────────────────────
 * Stack : Express · Socket.io · bcryptjs · jsonwebtoken · JSON file DB
 * Run   : node server.js  (or: npm run dev with nodemon)
 * Port  : 3001 (configurable via PORT env var)
 */

const express              = require("express")
const { createServer }     = require("http")
const { Server }           = require("socket.io")
const cors                 = require("cors")
const authRoutes           = require("./routes/auth")
const leaderboardRoutes    = require("./routes/leaderboard")
const adminRoutes          = require("./routes/admin")
const gamesRoutes          = require("./routes/games")
const attachSocketHandlers = require("./socketHandlers")

const app    = express()
const server = createServer(app)   // HTTP server wraps Express
const PORT   = process.env.PORT ?? 3001

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,        // set this in production
].filter(Boolean)

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:      ALLOWED_ORIGINS,
    methods:     ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
})

attachSocketHandlers(io)

// ── Express Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin:      ALLOWED_ORIGINS,
  credentials: true,
}))
app.use(express.json({ limit: "10mb" }))

// ── REST Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",        authRoutes)
app.use("/api/leaderboard", leaderboardRoutes)
app.use("/api/admin",       adminRoutes)
app.use("/api/games",       gamesRoutes)

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", engine: "TapTap Backend v2.0", multiplayer: true, timestamp: Date.now() })
)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }))

// ── Start (use server.listen, NOT app.listen — Socket.io needs the raw server) ─
server.listen(PORT, () => {
  console.log(`\n🎮  TapTap Backend v2.0 running at http://localhost:${PORT}`)
  console.log(`    Health       →  GET  /api/health`)
  console.log(`    Auth         →  POST /api/auth/register  |  POST /api/auth/login`)
  console.log(`    Scores       →  GET  /api/leaderboard    |  POST /api/leaderboard/submit`)
  console.log(`    Games        →  GET  /api/games`)
  console.log(`    Admin        →  POST /api/admin/login`)
  console.log(`    WebSocket    →  ws://localhost:${PORT}  (Socket.io multiplayer)\n`)
})
