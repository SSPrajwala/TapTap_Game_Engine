/**
 * TapTap Adaptive Game Engine — Backend Server v3.0
 * ─────────────────────────────────────────────────────
 * Stack  : Express · Socket.io · Prisma · Supabase PostgreSQL
 *          Gemini AI · bcryptjs · JWT · Helmet · Rate-limiting
 * Run    : node server.js  (or: npm run dev with nodemon)
 * Port   : 3001 (configurable via PORT env var)
 */

require("dotenv").config()

const express              = require("express")
const { createServer }     = require("http")
const { Server }           = require("socket.io")
const cors                 = require("cors")
const helmet               = require("helmet")
const rateLimit            = require("express-rate-limit")

const authRoutes           = require("./routes/auth")
const leaderboardRoutes    = require("./routes/leaderboard")
const adminRoutes          = require("./routes/admin")
const ceoRoutes            = require("./routes/ceo")
const gamesRoutes          = require("./routes/games")
const aiRoutes             = require("./routes/ai")
const skillsRoutes         = require("./routes/skills")
const attachSocketHandlers = require("./socketHandlers")

const app    = express()
const server = createServer(app)
const PORT   = process.env.PORT ?? 3001

// ── CORS origins ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
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

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow Vercel frontend
}))

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      ALLOWED_ORIGINS,
  credentials: true,
}))

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// ── Rate limiting ─────────────────────────────────────────────────────────────

// General API: 200 requests / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many requests. Please wait a moment and try again." },
})

// Auth endpoints: 20 requests / 15 min per IP (prevents brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many login attempts. Please wait 15 minutes." },
})

// AI endpoints: 30 requests / 15 min per IP (Gemini is free but limited)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many AI requests. Please wait a moment." },
})

app.use("/api/", generalLimiter)
app.use("/api/auth", authLimiter)
app.use("/api/ai",   aiLimiter)

// ── REST Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",        authRoutes)
app.use("/api/leaderboard", leaderboardRoutes)
app.use("/api/admin",       adminRoutes)
app.use("/api/ceo",         ceoRoutes)
app.use("/api/games",       gamesRoutes)
app.use("/api/ai",          aiRoutes)
app.use("/api/skills",      skillsRoutes)

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({
    status:     "ok",
    engine:     "TapTap Backend v3.0",
    database:   "Supabase PostgreSQL (Prisma)",
    ai:         "Groq llama-3.3-70b",
    multiplayer: true,
    timestamp:  Date.now(),
  })
)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }))

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error." })
})

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🦌  TapTap Backend v3.0 running at http://localhost:${PORT}`)
  console.log(`    Health         →  GET  /api/health`)
  console.log(`    Auth           →  POST /api/auth/register  |  POST /api/auth/login`)
  console.log(`    Games          →  GET  /api/games           |  POST /api/games`)
  console.log(`    Leaderboard    →  GET  /api/leaderboard     |  POST /api/leaderboard/submit`)
  console.log(`    Skills         →  GET  /api/skills          |  GET  /api/skills/leaderboard`)
  console.log(`    AI             →  POST /api/ai/generate/quiz|flashcard|report|explanation`)
  console.log(`    Mascot         →  POST /api/ai/mascot/chat`)
  console.log(`    Admin          →  POST /api/admin/login`)
  console.log(`    WebSocket      →  ws://localhost:${PORT}  (Socket.io multiplayer)\n`)
})
