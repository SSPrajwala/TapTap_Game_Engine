/**
 * Leaderboard Routes — backed by Supabase PostgreSQL via Prisma
 *
 * GET  /api/leaderboard              aggregated global (one row per player)
 * GET  /api/leaderboard/games        distinct game titles that have sessions
 * GET  /api/leaderboard/:gameId      aggregated per-game (one row per player)
 * POST /api/leaderboard/submit       save a completed game session
 * DELETE /api/leaderboard/clear      admin-only: clear all sessions
 *
 * Aggregation rules
 *  Global  : one entry per playerName, sorted by totalScore desc.
 *            breakdown[] lists per-game stats for the (i) popover.
 *  Per-game: one entry per playerName for that game, sorted by bestScore desc.
 *            allAttempts[] lists every play for the (i) popover.
 */
const express                       = require("express")
const prisma                        = require("../prisma/client")
const { optionalAuth }              = require("../middleware/auth")

const router = express.Router()

// ── Skill XP constants ────────────────────────────────────────────────────────
const XP_PER_LEVEL = [0, 100, 200, 350, 500]

function calcXpGain(score, accuracy, difficulty) {
  const diffMult = difficulty === "hard" ? 1.5 : difficulty === "easy" ? 0.7 : 1.0
  const base     = Math.round((score / 10) * (Number(accuracy) / 100) * diffMult)
  return Math.max(5, Math.min(base, 50))
}

function nextLevel(current, xp) {
  if (current >= 5) return { level: 5, xp }
  const needed = XP_PER_LEVEL[current]
  if (xp >= needed) return { level: current + 1, xp: xp - needed }
  return { level: current, xp }
}

// ── Helper: aggregate sessions by playerName ──────────────────────────────────
function aggregateGlobal(sessions) {
  const map = new Map()

  for (const s of sessions) {
    const key = (s.playerName ?? "Anonymous").trim()
    if (!map.has(key)) map.set(key, { playerName: key, college: s.college ?? "", list: [] })
    map.get(key).list.push(s)
  }

  const rows = []
  for (const [, player] of map) {
    const list = player.list
    const totalScore   = list.reduce((sum, x) => sum + x.score, 0)
    const avgAccuracy  = list.reduce((sum, x) => sum + Number(x.accuracy), 0) / list.length
    const uniqueGames  = new Set(list.map(x => x.gameId))
    const lastPlayed   = Math.max(...list.map(x => x.createdAt.getTime()))

    // Per-game breakdown for the (i) popover
    const gameMap = new Map()
    for (const s of list) {
      if (!gameMap.has(s.gameId)) {
        gameMap.set(s.gameId, { gameTitle: s.gameTitle ?? s.gameId, sessions: [] })
      }
      gameMap.get(s.gameId).sessions.push(s)
    }
    const breakdown = []
    for (const [, g] of gameMap) {
      const gs = g.sessions
      breakdown.push({
        gameTitle:   g.gameTitle,
        plays:       gs.length,
        bestScore:   Math.max(...gs.map(x => x.score)),
        totalScore:  gs.reduce((sum, x) => sum + x.score, 0),
        avgAccuracy: Math.round(
          (gs.reduce((sum, x) => sum + Number(x.accuracy), 0) / gs.length) * 100
        ) / 100,
        bestTime:    Math.min(...gs.map(x => x.timeTaken)),
      })
    }
    breakdown.sort((a, b) => b.bestScore - a.bestScore)

    rows.push({
      playerName:    player.playerName,
      college:       player.college,
      totalScore,
      avgAccuracy:   Math.round(avgAccuracy * 100) / 100,
      gamesPlayed:   uniqueGames.size,
      totalSessions: list.length,
      timestamp:     lastPlayed,
      breakdown,
    })
  }

  rows.sort((a, b) => b.totalScore - a.totalScore || b.avgAccuracy - a.avgAccuracy)
  return rows.slice(0, 50)
}

function aggregateForGame(sessions) {
  const map = new Map()

  for (const s of sessions) {
    const key = (s.playerName ?? "Anonymous").trim()
    if (!map.has(key)) map.set(key, { playerName: key, college: s.college ?? "", list: [] })
    map.get(key).list.push(s)
  }

  const rows = []
  for (const [, player] of map) {
    const list = player.list
    const bestScore  = Math.max(...list.map(x => x.score))
    const totalScore = list.reduce((sum, x) => sum + x.score, 0)
    const avgAcc     = list.reduce((sum, x) => sum + Number(x.accuracy), 0) / list.length

    const allAttempts = list
      .map(x => ({
        score:      x.score,
        accuracy:   Math.round(Number(x.accuracy) * 100) / 100,
        timeTaken:  x.timeTaken,
        difficulty: x.difficulty ?? "medium",
        timestamp:  x.createdAt.getTime(),
      }))
      .sort((a, b) => b.score - a.score)

    rows.push({
      playerName:  player.playerName,
      college:     player.college,
      bestScore,
      totalScore,
      avgAccuracy: Math.round(avgAcc * 100) / 100,
      attempts:    list.length,
      allAttempts,
      timestamp:   Math.max(...list.map(x => x.createdAt.getTime())),
    })
  }

  rows.sort((a, b) => b.bestScore - a.bestScore || b.avgAccuracy - a.avgAccuracy)
  return rows.slice(0, 50)
}

// ── GET /api/leaderboard  ─────────────────────────────────────────────────────
// Returns one aggregated row per player (sorted by total score).
router.get("/", async (_req, res) => {
  try {
    const sessions = await prisma.gameSession.findMany({
      where:   { completed: true },
      orderBy: [{ createdAt: "desc" }],
    })
    res.json(aggregateGlobal(sessions))
  } catch (err) {
    console.error("GET /api/leaderboard error:", err)
    res.status(500).json({ error: "Failed to load leaderboard." })
  }
})

// ── GET /api/leaderboard/games ────────────────────────────────────────────────
// Returns distinct { gameId, gameTitle } pairs that have at least 1 session.
router.get("/games", async (_req, res) => {
  try {
    const rows = await prisma.gameSession.findMany({
      where:    { completed: true },
      select:   { gameId: true, gameTitle: true },
      distinct: ["gameId"],
      orderBy:  [{ gameTitle: "asc" }],
    })
    res.json(rows.map(r => ({ gameId: r.gameId, gameTitle: r.gameTitle ?? r.gameId })))
  } catch (err) {
    res.status(500).json({ error: "Failed to load game list." })
  }
})

// ── GET /api/leaderboard/:gameId ──────────────────────────────────────────────
// Returns one aggregated row per player for this game (sorted by best score).
// "submit" is reserved — avoid matching it as a gameId.
router.get("/:gameId", async (req, res) => {
  if (req.params.gameId === "submit" || req.params.gameId === "clear" || req.params.gameId === "games")
    return res.status(400).json({ error: "Invalid gameId." })
  try {
    const sessions = await prisma.gameSession.findMany({
      where:   { gameId: req.params.gameId, completed: true },
      orderBy: [{ createdAt: "desc" }],
    })
    res.json(aggregateForGame(sessions))
  } catch (err) {
    console.error("GET /api/leaderboard/:gameId error:", err)
    res.status(500).json({ error: "Failed to load game leaderboard." })
  }
})

// ── POST /api/leaderboard/submit ──────────────────────────────────────────────
router.post("/submit", optionalAuth, async (req, res) => {
  const {
    playerName, gameId, gameTitle,
    score, accuracy, timeTaken,
    totalAnswered, correctCount,
    difficulty, learningOutcomes,
  } = req.body ?? {}

  if (!playerName || !gameId || score == null)
    return res.status(400).json({ error: "playerName, gameId, and score are required." })

  try {
    let college = ""
    if (req.user?.id) {
      const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.id } })
      college = profile?.college ?? ""
    }

    const session = await prisma.gameSession.create({
      data: {
        userId:        req.user?.id ?? null,
        gameId:        String(gameId),
        score:         Number(score),
        accuracy:      Number(accuracy ?? 0),
        totalAnswered: Number(totalAnswered ?? 0),
        correctCount:  Number(correctCount ?? 0),
        timeTaken:     Number(timeTaken ?? 0),
        difficulty:    String(difficulty ?? "medium"),
        completed:     true,
        playerName:    String(playerName),
        college,
        gameTitle:     String(gameTitle ?? gameId),
      },
    })

    // Update skill progress if user is logged in + game has learning outcomes
    if (req.user?.id && Array.isArray(learningOutcomes) && learningOutcomes.length > 0) {
      const xpGain = calcXpGain(Number(score), Number(accuracy ?? 0), String(difficulty ?? "medium"))
      for (const skillArea of learningOutcomes) {
        const existing = await prisma.userSkillProgress.findUnique({
          where: { userId_skillArea: { userId: req.user.id, skillArea } },
        })
        const currentLevel = existing?.level ?? 1
        const currentXp    = (existing?.xp ?? 0) + xpGain
        const { level: newLevel, xp: newXp } = nextLevel(currentLevel, currentXp)
        const newAccuracy = existing
          ? ((Number(existing.accuracy) * existing.gamesPlayed) + Number(accuracy ?? 0)) / (existing.gamesPlayed + 1)
          : Number(accuracy ?? 0)

        await prisma.userSkillProgress.upsert({
          where:  { userId_skillArea: { userId: req.user.id, skillArea } },
          update: { level: newLevel, xp: newXp, gamesPlayed: { increment: 1 }, accuracy: Math.round(newAccuracy * 100) / 100 },
          create: { userId: req.user.id, skillArea, level: newLevel, xp: newXp, gamesPlayed: 1, accuracy: Number(accuracy ?? 0) },
        })
      }
    }

    // Rank = how many players in this game have a higher best score
    const allSessions = await prisma.gameSession.findMany({
      where: { gameId: String(gameId), completed: true },
    })
    const aggregated = aggregateForGame(allSessions)
    const rank = aggregated.findIndex(r => r.playerName === String(playerName)) + 1

    res.status(201).json({
      success: true,
      session: {
        id:         session.id,
        playerName: session.playerName,
        gameId:     session.gameId,
        gameTitle:  session.gameTitle,
        score:      session.score,
        accuracy:   Number(session.accuracy),
        timeTaken:  session.timeTaken,
        difficulty: session.difficulty,
        college:    session.college,
        timestamp:  session.createdAt.getTime(),
      },
      rank: rank > 0 ? rank : aggregated.length,
    })
  } catch (err) {
    console.error("POST /api/leaderboard/submit error:", err)
    res.status(500).json({ error: "Failed to save score." })
  }
})

// ── DELETE /api/leaderboard/clear ─────────────────────────────────────────────
router.delete("/clear", async (req, res) => {
  const { adminName, accessCode } = req.body ?? {}
  if (!adminName || !accessCode)
    return res.status(400).json({ error: "adminName and accessCode are required." })
  try {
    const admin = await prisma.admin.findFirst({ where: { name: adminName, accessCode } })
    if (!admin) return res.status(403).json({ error: "Admin name or access code is incorrect." })
    const { count } = await prisma.gameSession.deleteMany({})
    console.log(`[Leaderboard] ALL ${count} sessions cleared by admin: ${admin.name}`)
    res.json({ success: true, message: `Cleared ${count} sessions.`, clearedBy: admin.name })
  } catch (err) {
    console.error("DELETE /api/leaderboard/clear error:", err)
    res.status(500).json({ error: "Failed to clear leaderboard." })
  }
})

module.exports = router
