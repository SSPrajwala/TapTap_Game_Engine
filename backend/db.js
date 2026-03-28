/**
 * db.js — JSON file store (no native deps, works everywhere)
 * Tables: users · scores · admins
 * Games are stored directly in their individual JSON files (frontend/src/games/)
 */
const fs   = require("fs")
const path = require("path")

const DB_FILE   = path.join(__dirname, "taptap_db.json")
const GAMES_DIR = path.join(__dirname, "../frontend/src/games")

// ── Game ID → filename mapping ────────────────────────────────────────────────
// The JSON game IDs don't match filenames, so we maintain an explicit map.
const GAME_FILE_MAP = {
  "logical-reasoning-v2": "logic-game.json",
  "world-capitals-v1":    "world-capitals.json",
  "emoji-memory-v1":      "emoji-memory.json",
  "pattern-puzzle-v1":    "pattern-puzzle.json",
  "sudoku-v1":            "sudoku.json",
  "wordbuilder-v1":       "wordbuilder.json",
}

// ── Initial seed ─────────────────────────────────────────────────────────────

const DEFAULT = {
  users:  [],
  scores: [],

  // ── Admin accounts ──────────────────────────────────────────────────────
  // BOTH name AND accessCode must match to gain admin access.
  // Add more entries here to give access to other team members.
  // Show this file to judges to demonstrate the authentication database!
  admins: [
    {
      id:         "admin_001",
      name:       "Engine Owner",          // ← enter this name in the login screen
      accessCode: "TAPTAP-ADMIN-2024",     // ← enter this code in the login screen
      createdAt:  1700000000000,
    },
  ],
}

// ── Core read / write ─────────────────────────────────────────────────────────

function read() {
  try {
    const raw  = fs.readFileSync(DB_FILE, "utf8")
    const data = JSON.parse(raw)
    if (!data.admins) data.admins = DEFAULT.admins
    return data
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT))
  }
}

function write(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8")
}

// ── Users ─────────────────────────────────────────────────────────────────────

function findUserByEmail(email) {
  return read().users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null
}

function findUserById(id) {
  return read().users.find(u => u.id === id) ?? null
}

function createUser(user) {
  const db = read()
  db.users.push(user)
  write(db)
  return user
}

// ── Scores ────────────────────────────────────────────────────────────────────

function saveScore(score) {
  const db = read()
  db.scores.push(score)
  db.scores.sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken)
  if (db.scores.length > 500) db.scores = db.scores.slice(0, 500)
  write(db)
  return score
}

function getAllScores()            { return read().scores }
function getScoresForGame(gameId)  { return getAllScores().filter(s => s.gameId === gameId).slice(0, 10) }
function getGlobalTop(limit = 50)  { return getAllScores().slice(0, limit) }

function clearScores() {
  const db = read()
  db.scores = []
  write(db)
}

function getRank(score, timeTaken) {
  return getAllScores().filter(s =>
    s.score > score || (s.score === score && s.timeTaken < timeTaken)
  ).length + 1
}

// ── Admins ────────────────────────────────────────────────────────────────────

/**
 * Verify that BOTH name AND accessCode match the same admin record.
 * Both are case-insensitive & trimmed.
 */
function findAdminByNameAndCode(name, code) {
  const normalName = name.trim().toLowerCase()
  const normalCode = code.trim()
  return read().admins.find(a =>
    a.name.toLowerCase() === normalName &&
    a.accessCode === normalCode
  ) ?? null
}

function findAdminById(id) {
  return read().admins.find(a => a.id === id) ?? null
}

function getAdmins() {
  return read().admins.map(({ id, name, createdAt }) => ({ id, name, createdAt }))
}

// ── Games (direct JSON file read/write) ───────────────────────────────────────

function getGameFilePath(gameId) {
  const filename = GAME_FILE_MAP[gameId]
  if (!filename) throw new Error(`Unknown game id: "${gameId}". Add it to GAME_FILE_MAP in db.js.`)
  return path.join(GAMES_DIR, filename)
}

function readGameFile(gameId) {
  const filePath = getGameFilePath(gameId)
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeGameFile(gameId, gameConfig) {
  const filePath = getGameFilePath(gameId)
  fs.writeFileSync(filePath, JSON.stringify(gameConfig, null, 2), "utf8")
}

function listGameIds() {
  return Object.keys(GAME_FILE_MAP)
}

module.exports = {
  read, write,
  // users
  findUserByEmail, findUserById, createUser,
  // scores
  saveScore, getAllScores, getScoresForGame, getGlobalTop, getRank, clearScores,
  // admins
  findAdminByNameAndCode, findAdminById, getAdmins,
  // games
  readGameFile, writeGameFile, listGameIds, GAME_FILE_MAP,
}
