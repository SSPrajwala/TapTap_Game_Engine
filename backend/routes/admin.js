/**
 * Admin Routes — backed by Supabase PostgreSQL via Prisma
 *
 * POST /api/admin/login             verify name + accessCode → admin JWT
 * GET  /api/admin/me                check token validity
 * GET  /api/admin/games             list all games in DB
 * GET  /api/admin/games/:gameId     get one game config
 * PUT  /api/admin/games/:gameId     update a game config (public / admin-seeded)
 * DELETE /api/admin/games/:gameId   delete a game
 * GET  /api/admin/stats             full DB stats
 * GET  /api/admin/users             list all users (for admin panel)
 */
const express = require("express")
const jwt     = require("jsonwebtoken")
const prisma  = require("../prisma/client")

const router       = express.Router()
const ADMIN_SECRET = process.env.ADMIN_SECRET || "taptap_admin_secret_2024"
const ADMIN_EXPIRY = "8h"

// ── Admin auth middleware ─────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Admin token required." })
  try {
    const payload = jwt.verify(auth.slice(7), ADMIN_SECRET)
    if (payload.role !== "admin") throw new Error("not admin")
    req.admin = payload
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired admin token. Please log in again." })
  }
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { adminName, accessCode } = req.body ?? {}
  if (!adminName || !accessCode)
    return res.status(400).json({ error: "Admin name and access code are both required." })

  try {
    const admin = await prisma.admin.findFirst({
      where: { name: adminName, accessCode },
    })
    if (!admin) return res.status(403).json({ error: "Admin name or access code is incorrect." })

    const token = jwt.sign(
      { id: admin.id, name: admin.name, role: "admin" },
      ADMIN_SECRET,
      { expiresIn: ADMIN_EXPIRY }
    )
    res.json({ admin: { id: admin.id, name: admin.name }, token })
  } catch (err) {
    console.error("admin login error:", err)
    res.status(500).json({ error: "Server error during admin login." })
  }
})

// ── GET /api/admin/me ─────────────────────────────────────────────────────────
router.get("/me", requireAdmin, (req, res) => {
  res.json({ id: req.admin.id, name: req.admin.name, role: "admin" })
})

// ── GET /api/admin/games ──────────────────────────────────────────────────────
router.get("/games", requireAdmin, async (_req, res) => {
  try {
    const games = await prisma.game.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id:              true,
        title:           true,
        plugin:          true,
        version:         true,
        visibility:      true,
        createdBy:       true,
        learningOutcomes: true,
        aptitudeTags:    true,
        isAiGenerated:   true,
        createdAt:       true,
        config:          true,
      },
    })

    res.json(games.map(g => ({
      id:              g.id,
      title:           g.title,
      plugin:          g.plugin,
      version:         g.version,
      visibility:      g.visibility,
      createdBy:       g.createdBy ?? null,
      learningOutcomes: g.learningOutcomes,
      aptitudeTags:    g.aptitudeTags,
      isAiGenerated:   g.isAiGenerated,
      questionCount:   (g.config?.questions ?? []).length,
    })))
  } catch (err) {
    console.error("GET /api/admin/games error:", err)
    res.status(500).json({ error: "Failed to load games." })
  }
})

// ── GET /api/admin/games/:gameId ──────────────────────────────────────────────
router.get("/games/:gameId", requireAdmin, async (req, res) => {
  try {
    const game = await prisma.game.findUnique({ where: { id: req.params.gameId } })
    if (!game) return res.status(404).json({ error: "Game not found." })

    res.json({
      ...(game.config ?? {}),
      id:              game.id,
      title:           game.title,
      description:     game.description ?? "",
      plugin:          game.plugin,
      version:         game.version,
      visibility:      game.visibility,
      createdBy:       game.createdBy ?? null,
      learningOutcomes: game.learningOutcomes,
      aptitudeTags:    game.aptitudeTags,
      isAiGenerated:   game.isAiGenerated,
    })
  } catch (err) {
    console.error("GET /api/admin/games/:gameId error:", err)
    res.status(500).json({ error: "Failed to load game." })
  }
})

// ── PUT /api/admin/games/:gameId ──────────────────────────────────────────────
// Admin can update ANY game (including system-seeded public games)
router.put("/games/:gameId", requireAdmin, async (req, res) => {
  const { gameId } = req.params
  const body       = req.body ?? {}

  if (!body.id)
    return res.status(400).json({ error: "Game config must include an id field." })
  if (body.id !== gameId)
    return res.status(400).json({ error: `ID mismatch: URL says "${gameId}", body says "${body.id}".` })

  try {
    const { _savedAt, visibility, learningOutcomes, aptitudeTags, ...configData } = body

    // Build the stored config (clean of DB-specific fields)
    const cleanConfig = { ...configData }

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        title:           body.title ?? undefined,
        description:     body.description ?? undefined,
        plugin:          body.plugin ?? undefined,
        version:         body.version ?? undefined,
        config:          cleanConfig,
        visibility:      visibility ?? undefined,
        learningOutcomes: learningOutcomes ?? undefined,
        aptitudeTags:    aptitudeTags ?? undefined,
        updatedAt:       new Date(),
      },
    })

    console.log(`[Admin] ${req.admin.name} saved game: ${gameId} (${(updated.config?.questions ?? []).length} questions)`)
    res.json({
      success:       true,
      gameId,
      savedBy:       req.admin.name,
      questionCount: (updated.config?.questions ?? []).length,
    })
  } catch (err) {
    console.error("PUT /api/admin/games/:gameId error:", err)
    res.status(500).json({ error: "Failed to update game." })
  }
})

// ── DELETE /api/admin/games/:gameId ───────────────────────────────────────────
router.delete("/games/:gameId", requireAdmin, async (req, res) => {
  try {
    await prisma.game.delete({ where: { id: req.params.gameId } })
    console.log(`[Admin] ${req.admin.name} deleted game: ${req.params.gameId}`)
    res.json({ success: true, message: "Game deleted." })
  } catch (err) {
    console.error("DELETE /api/admin/games/:gameId error:", err)
    res.status(500).json({ error: "Failed to delete game." })
  }
})

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get("/users", requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take:    100,
      include: { profile: true },
    })

    res.json(users.map(u => ({
      id:        u.id,
      username:  u.username,
      email:     u.email,
      role:      u.role,
      college:   u.profile?.college ?? "",
      branch:    u.profile?.branch ?? "",
      createdAt: u.createdAt,
    })))
  } catch (err) {
    console.error("GET /api/admin/users error:", err)
    res.status(500).json({ error: "Failed to load users." })
  }
})

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const [userCount, sessionCount, gameCount, recentUsers, topSessions] = await Promise.all([
      prisma.user.count(),
      prisma.gameSession.count({ where: { completed: true } }),
      prisma.game.count(),
      prisma.user.findMany({
        take:    5,
        orderBy: { createdAt: "desc" },
        include: { profile: true },
      }),
      prisma.gameSession.findMany({
        where:   { completed: true },
        orderBy: { score: "desc" },
        take:    5,
      }),
    ])

    const games = await prisma.game.findMany({
      select: {
        id: true, title: true, plugin: true, visibility: true, config: true,
      },
    })

    res.json({
      database: {
        users:    userCount,
        sessions: sessionCount,
        games:    gameCount,
      },
      games: games.map(g => ({
        id:         g.id,
        title:      g.title,
        plugin:     g.plugin,
        visibility: g.visibility,
        questions:  (g.config?.questions ?? []).length,
      })),
      topSessions: topSessions.map(s => ({
        id:         s.id,
        playerName: s.playerName,
        gameTitle:  s.gameTitle,
        score:      s.score,
        accuracy:   Number(s.accuracy),
        timeTaken:  s.timeTaken,
        college:    s.college ?? "",
        createdAt:  s.createdAt,
      })),
      recentUsers: recentUsers.map(u => ({
        id:       u.id,
        username: u.username,
        email:    u.email,
        college:  u.profile?.college ?? "",
        joinedAt: u.createdAt,
      })),
    })
  } catch (err) {
    console.error("GET /api/admin/stats error:", err)
    res.status(500).json({ error: "Failed to load stats." })
  }
})

module.exports = router

// ── POST /api/admin/games ─────────────────────────────────────────────────────
// Admin publishes an AI-generated game to the global public library
router.post("/games", requireAdmin, async (req, res) => {
  try {
    const { id, title, description, plugin, version, config, isAiGenerated, learningOutcomes, aptitudeTags } = req.body
    if (!id || !title || !plugin || !config)
      return res.status(400).json({ error: "id, title, plugin, config are required." })

    const game = await prisma.game.create({
      data: {
        id,
        title,
        description:      description ?? "",
        plugin,
        version:          version ?? "1.0.0",
        config,
        visibility:       "public",
        isAiGenerated:    isAiGenerated ?? true,
        createdBy:        null,
        learningOutcomes: learningOutcomes ?? [],
        aptitudeTags:     aptitudeTags ?? [],
      },
    })
    res.status(201).json({ success: true, game })
  } catch (err) {
    console.error("POST /api/admin/games error:", err)
    res.status(500).json({ error: "Failed to publish game." })
  }
})
