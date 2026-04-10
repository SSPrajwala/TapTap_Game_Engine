/**
 * CEO / Super-Admin Routes
 *
 * POST  /api/ceo/login          verify CEO name + passcode → CEO JWT
 * GET   /api/ceo/me             check token
 * GET   /api/ceo/admins         list all admins
 * POST  /api/ceo/admins         create a new admin (name + accessCode)
 * PUT   /api/ceo/admins/:id     update admin name / accessCode
 * DELETE /api/ceo/admins/:id    delete admin
 * GET   /api/ceo/stats          full engine stats (games, sessions, users, AI gens)
 */
const express = require("express")
const jwt     = require("jsonwebtoken")
const prisma  = require("../prisma/client")

const router       = express.Router()
const CEO_SECRET   = process.env.CEO_SECRET   || "taptap_ceo_secret_2024"
const ADMIN_SECRET = process.env.ADMIN_SECRET || "taptap_admin_secret_2024"

// CEO credentials come from environment variables (never hardcoded in DB)
const CEO_NAME = process.env.CEO_NAME     || "TapTap CEO"
const CEO_PASS = process.env.CEO_PASSCODE || "taptap_ceo_master_2024"

// ── CEO auth middleware ───────────────────────────────────────────────────────
function requireCEO(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "CEO token required." })
  try {
    const payload = jwt.verify(auth.slice(7), CEO_SECRET)
    if (payload.role !== "ceo") throw new Error("not ceo")
    req.ceo = payload
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired CEO token. Please log in again." })
  }
}

// ── POST /api/ceo/login ───────────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { ceoName, passcode } = req.body ?? {}
  if (!ceoName || !passcode)
    return res.status(400).json({ error: "CEO name and passcode are required." })

  if (ceoName.trim() !== CEO_NAME || passcode !== CEO_PASS)
    return res.status(403).json({ error: "Incorrect CEO credentials." })

  const token = jwt.sign(
    { name: CEO_NAME, role: "ceo" },
    CEO_SECRET,
    { expiresIn: "4h" }
  )
  res.json({ ceo: { name: CEO_NAME }, token })
})

// ── GET /api/ceo/me ───────────────────────────────────────────────────────────
router.get("/me", requireCEO, (req, res) => {
  res.json({ name: req.ceo.name, role: "ceo" })
})

// ── GET /api/ceo/admins ───────────────────────────────────────────────────────
router.get("/admins", requireCEO, async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, accessCode: true, createdAt: true },
    })
    res.json({ admins })
  } catch (err) {
    console.error("ceo/admins error:", err)
    res.status(500).json({ error: "Failed to fetch admins." })
  }
})

// ── POST /api/ceo/admins ──────────────────────────────────────────────────────
router.post("/admins", requireCEO, async (req, res) => {
  const { name, accessCode } = req.body ?? {}
  if (!name?.trim())       return res.status(400).json({ error: "Admin name is required." })
  if (!accessCode?.trim()) return res.status(400).json({ error: "Access code is required." })

  try {
    const existing = await prisma.admin.findFirst({ where: { name: name.trim() } })
    if (existing) return res.status(409).json({ error: `Admin "${name.trim()}" already exists.` })

    const admin = await prisma.admin.create({
      data: { name: name.trim(), accessCode: accessCode.trim() },
    })
    res.status(201).json({ admin: { id: admin.id, name: admin.name, accessCode: admin.accessCode, createdAt: admin.createdAt } })
  } catch (err) {
    console.error("ceo/admins create error:", err)
    res.status(500).json({ error: "Failed to create admin." })
  }
})

// ── PUT /api/ceo/admins/:id ───────────────────────────────────────────────────
router.put("/admins/:id", requireCEO, async (req, res) => {
  const { id } = req.params
  const { name, accessCode } = req.body ?? {}
  if (!name?.trim() && !accessCode?.trim())
    return res.status(400).json({ error: "Provide at least name or accessCode to update." })

  try {
    const data = {}
    if (name?.trim())       data.name       = name.trim()
    if (accessCode?.trim()) data.accessCode = accessCode.trim()
    const admin = await prisma.admin.update({ where: { id }, data })
    res.json({ admin: { id: admin.id, name: admin.name, accessCode: admin.accessCode } })
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Admin not found." })
    console.error("ceo/admins update error:", err)
    res.status(500).json({ error: "Failed to update admin." })
  }
})

// ── DELETE /api/ceo/admins/:id ────────────────────────────────────────────────
router.delete("/admins/:id", requireCEO, async (req, res) => {
  const { id } = req.params
  try {
    const admin = await prisma.admin.delete({ where: { id } })
    res.json({ message: `Admin "${admin.name}" deleted.` })
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Admin not found." })
    console.error("ceo/admins delete error:", err)
    res.status(500).json({ error: "Failed to delete admin." })
  }
})

// ── GET /api/ceo/stats ────────────────────────────────────────────────────────
router.get("/stats", requireCEO, async (_req, res) => {
  try {
    const [gameCount, sessionCount, userCount, aiGenCount, adminCount, recentSessions] = await Promise.all([
      prisma.game.count(),
      prisma.gameSession.count(),
      prisma.user.count(),
      prisma.aiGeneration.count(),
      prisma.admin.count(),
      prisma.gameSession.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { playerName: true, gameId: true, score: true, createdAt: true },
      }),
    ])
    res.json({
      stats: { gameCount, sessionCount, userCount, aiGenCount, adminCount },
      recentSessions,
    })
  } catch (err) {
    console.error("ceo/stats error:", err)
    res.status(500).json({ error: "Failed to fetch stats." })
  }
})

module.exports = router
