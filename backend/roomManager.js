/**
 * roomManager.js — In-memory multiplayer room state
 * Rooms are transient (not persisted to disk — they last while the server is up).
 *
 * Room lifecycle:
 *   create → players join → host starts → all play → game ends → room auto-cleaned
 */

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  // no ambiguous O/0/I/1
const ROOM_TTL_MS     = 60 * 60 * 1000   // auto-remove unused rooms after 1 hour
const MAX_PLAYERS     = 8

/** @type {Map<string, Room>} */
const rooms = new Map()

// ── Types (JSDoc only, this is CommonJS) ─────────────────────────────────────
/**
 * @typedef {{
 *   code: string,
 *   hostSocketId: string,
 *   gameId: string | null,
 *   gameTitle: string | null,
 *   status: "waiting" | "countdown" | "playing" | "ended",
 *   players: Map<string, Player>,
 *   currentQuestionIndex: number,
 *   questionCount: number,
 *   createdAt: number,
 *   startedAt: number | null,
 *   questionStartedAt: number | null,
 * }} Room
 *
 * @typedef {{
 *   socketId: string,
 *   name: string,
 *   ready: boolean,
 *   score: number,
 *   hits: number,
 *   answers: number,
 *   correct: number,
 *   finishedQuestion: boolean,
 *   disconnected: boolean,
 * }} Player
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode() {
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return rooms.has(code) ? generateCode() : code
}

function makePlayer(socketId, name) {
  return {
    socketId,
    name:              name.trim().slice(0, 20) || "Player",
    ready:             false,
    score:             0,
    hits:              0,
    answers:           0,
    correct:           0,
    finishedQuestion:  false,
    disconnected:      false,
  }
}

function serializeRoom(room) {
  const players = []
  for (const [, p] of room.players) {
    players.push({
      socketId:    p.socketId,
      name:        p.name,
      ready:       p.ready,
      score:       p.score,
      correct:     p.correct,
      answers:     p.answers,
      disconnected: p.disconnected,
    })
  }
  return {
    code:                 room.code,
    hostSocketId:         room.hostSocketId,
    gameId:               room.gameId,
    gameTitle:            room.gameTitle,
    status:               room.status,
    players,
    currentQuestionIndex: room.currentQuestionIndex,
    questionCount:        room.questionCount,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function createRoom(socketId, playerName) {
  const code = generateCode()
  /** @type {Room} */
  const room = {
    code,
    hostSocketId:         socketId,
    gameId:               null,
    gameTitle:            null,
    status:               "waiting",
    players:              new Map([[socketId, makePlayer(socketId, playerName)]]),
    currentQuestionIndex: 0,
    questionCount:        0,
    createdAt:            Date.now(),
    startedAt:            null,
    questionStartedAt:    null,
  }
  rooms.set(code, room)

  // Auto-clean after TTL
  setTimeout(() => {
    if (rooms.has(code)) rooms.delete(code)
  }, ROOM_TTL_MS)

  return { room, player: room.players.get(socketId) }
}

function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code.toUpperCase())
  if (!room)                                     return { error: "Room not found." }
  if (room.status !== "waiting")                 return { error: "Game already in progress." }
  if (room.players.size >= MAX_PLAYERS)          return { error: "Room is full (max 8 players)." }
  if (room.players.has(socketId))                return { error: "Already in this room." }

  const player = makePlayer(socketId, playerName)
  room.players.set(socketId, player)
  return { room, player }
}

function leaveRoom(socketId) {
  for (const [code, room] of rooms) {
    if (!room.players.has(socketId)) continue

    const player = room.players.get(socketId)
    if (room.status === "waiting") {
      room.players.delete(socketId)
      // Reassign host if the host left
      if (room.hostSocketId === socketId && room.players.size > 0) {
        room.hostSocketId = room.players.keys().next().value
      }
      if (room.players.size === 0) rooms.delete(code)
    } else {
      // Mark as disconnected rather than removing (game is running)
      player.disconnected = true
    }
    return { code, room: rooms.get(code) ?? null }
  }
  return null
}

function setReady(socketId, ready) {
  for (const room of rooms.values()) {
    const player = room.players.get(socketId)
    if (player) { player.ready = ready; return room }
  }
  return null
}

function selectGame(socketId, gameId, gameTitle, questionCount) {
  for (const room of rooms.values()) {
    if (room.hostSocketId !== socketId) continue
    room.gameId        = gameId
    room.gameTitle     = gameTitle
    room.questionCount = questionCount
    return room
  }
  return null
}

function startGame(socketId) {
  for (const room of rooms.values()) {
    if (room.hostSocketId !== socketId)   return { error: "Only the host can start." }
    if (room.status !== "waiting")        return { error: "Game already started." }
    if (!room.gameId)                     return { error: "Select a game first." }
    if (room.players.size < 1)            return { error: "Need at least 1 player." }

    room.status               = "countdown"
    room.startedAt            = Date.now()
    room.currentQuestionIndex = 0

    // Reset all player scores
    for (const p of room.players.values()) {
      p.score             = 0
      p.correct           = 0
      p.answers           = 0
      p.finishedQuestion  = false
    }
    return { room }
  }
  return { error: "Room not found." }
}

function advanceQuestion(roomCode) {
  const room = rooms.get(roomCode)
  if (!room) return null
  room.currentQuestionIndex++
  room.questionStartedAt = Date.now()
  for (const p of room.players.values()) {
    p.finishedQuestion = false
  }
  if (room.currentQuestionIndex >= room.questionCount) {
    room.status = "ended"
  } else {
    room.status = "playing"
  }
  return room
}

function submitAnswer(socketId, roomCode, correct, pointsAwarded) {
  const room = rooms.get(roomCode)
  if (!room) return null
  const player = room.players.get(socketId)
  if (!player) return null

  player.answers++
  if (correct) player.correct++
  player.score             += pointsAwarded
  player.finishedQuestion  = true

  // Check if all (connected) players have answered
  const connected   = [...room.players.values()].filter(p => !p.disconnected)
  const allAnswered = connected.every(p => p.finishedQuestion)

  return { room, allAnswered }
}

function getLeaderboard(roomCode) {
  const room = rooms.get(roomCode)
  if (!room) return []
  return [...room.players.values()]
    .filter(p => !p.disconnected)
    .sort((a, b) => b.score - a.score || b.correct - a.correct)
    .map((p, i) => ({
      rank:      i + 1,
      name:      p.name,
      score:     p.score,
      correct:   p.correct,
      answers:   p.answers,
      accuracy:  p.answers > 0 ? Math.round((p.correct / p.answers) * 100) : 0,
    }))
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room
  }
  return null
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  setReady,
  selectGame,
  startGame,
  advanceQuestion,
  submitAnswer,
  getLeaderboard,
  getRoomBySocket,
  serializeRoom,
}
