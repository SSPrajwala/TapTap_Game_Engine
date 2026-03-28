const express        = require("express")
const jwt            = require("jsonwebtoken")
const { randomUUID } = require("crypto")
const db             = require("../db")

const router     = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "taptap_engine_secret_2024"

// Optional auth middleware ─────────────────────────────────────────────────────
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization
  if (auth?.startsWith("Bearer ")) {
    try { req.user = jwt.verify(auth.slice(7), JWT_SECRET) } catch {}
  }
  next()
}

// ── GET /api/leaderboard  (global top 50) ────────────────────────────────────
router.get("/", (_req, res) => {
  const scores = db.getGlobalTop(50).map(s => ({
    id:          s.id,
    playerName:  s.playerName,
    gameId:      s.gameId,
    gameTitle:   s.gameTitle,
    score:       s.score,
    accuracy:    s.accuracy,
    timeTaken:   s.timeTaken,
    difficulty:  s.difficulty,
    timestamp:   s.timestamp,
    college:     s.college ?? "",
  }))
  res.json(scores)
})

// ── GET /api/leaderboard/:gameId  (top 10 for a specific game) ───────────────
router.get("/:gameId", (req, res) => {
  const scores = db.getScoresForGame(req.params.gameId).map(s => ({
    id:          s.id,
    playerName:  s.playerName,
    gameId:      s.gameId,
    gameTitle:   s.gameTitle,
    score:       s.score,
    accuracy:    s.accuracy,
    timeTaken:   s.timeTaken,
    difficulty:  s.difficulty,
    timestamp:   s.timestamp,
    college:     s.college ?? "",
  }))
  res.json(scores)
})

// ── POST /api/leaderboard/submit ─────────────────────────────────────────────
router.post("/submit", optionalAuth, (req, res) => {
  const { playerName, gameId, gameTitle, score, accuracy, timeTaken, difficulty, timestamp } = req.body ?? {}

  if (!playerName || !gameId || score == null)
    return res.status(400).json({ error: "Missing required fields: playerName, gameId, score." })

  // Look up the submitter's college if they're logged in
  let college = ""
  if (req.user?.id) {
    const user = db.findUserById(req.user.id)
    college    = user?.college ?? ""
  }

  const entry = db.saveScore({
    id:         randomUUID(),
    userId:     req.user?.id ?? null,
    playerName: String(playerName),
    gameId:     String(gameId),
    gameTitle:  String(gameTitle ?? gameId),
    score:      Number(score),
    accuracy:   Number(accuracy ?? 0),
    timeTaken:  Number(timeTaken ?? 0),
    difficulty: String(difficulty ?? "medium"),
    timestamp:  Number(timestamp ?? Date.now()),
    college,
  })

  const rank = db.getRank(entry.score, entry.timeTaken)

  res.status(201).json({ success: true, entry, rank })
})

// ── DELETE /api/leaderboard/clear  (admin-only: clears ALL scores globally) ──
router.delete("/clear", (req, res) => {
  const { adminName, accessCode } = req.body ?? {}

  if (!adminName || !accessCode)
    return res.status(400).json({ error: "adminName and accessCode are required." })

  const admin = db.findAdminByNameAndCode(adminName, accessCode)
  if (!admin)
    return res.status(403).json({ error: "Admin name or access code is incorrect." })

  db.clearScores()
  console.log(`[Leaderboard] ALL scores cleared by admin: ${admin.name}`)
  res.json({ success: true, message: `All scores cleared by ${admin.name}.`, clearedBy: admin.name })
})

module.exports = router
