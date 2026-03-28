/**
 * roomManager.js — In-memory multiplayer room state
 *
 * Key design decisions (Kahoot / Among Us style):
 *  - Each player has a persistent playerId (UUID from sessionStorage on client)
 *    so we can restore their room membership after a socket reconnect/refresh.
 *  - The HOST is automatically marked ready — only guests need to click Ready.
 *  - leaveRoom during "waiting" marks the player as disconnected for a 10-second
 *    grace period; rejoinRoom() restores them if they reconnect in time.
 *  - During an active game, players are marked disconnected (not removed) so
 *    scoring still works when they return.
 */

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  // no ambiguous O/0/I/1
const ROOM_TTL_MS     = 60 * 60 * 1000   // auto-remove unused rooms after 1 hour
const MAX_PLAYERS     = 8
const DISCONNECT_GRACE_MS = 12_000       // 12s to reconnect before being removed

/** @type {Map<string, Room>} */
const rooms = new Map()

/**
 * @typedef {{
 *   socketId:       string,
 *   playerId:       string,          // persistent UUID from client sessionStorage
 *   name:           string,
 *   ready:          boolean,
 *   score:          number,
 *   hits:           number,
 *   answers:        number,
 *   correct:        number,
 *   finishedQuestion: boolean,
 *   disconnected:   boolean,
 *   disconnectedAt: number | null,
 * }} Player
 *
 * @typedef {{
 *   code:                 string,
 *   hostSocketId:         string,
 *   hostPlayerId:         string,
 *   gameId:               string | null,
 *   gameTitle:            string | null,
 *   status:               "waiting" | "countdown" | "playing" | "ended",
 *   players:              Map<string, Player>,   // keyed by socketId
 *   playersByPid:         Map<string, Player>,   // keyed by playerId (for reconnect lookup)
 *   currentQuestionIndex: number,
 *   questionCount:        number,
 *   createdAt:            number,
 *   startedAt:            number | null,
 *   questionStartedAt:    number | null,
 * }} Room
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode() {
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return rooms.has(code) ? generateCode() : code
}

function makePlayer(socketId, playerId, name) {
  return {
    socketId,
    playerId:          playerId || socketId,  // fallback to socketId if no persistent id
    name:              name.trim().slice(0, 20) || "Player",
    ready:             false,
    score:             0,
    hits:              0,
    answers:           0,
    correct:           0,
    finishedQuestion:  false,
    disconnected:      false,
    disconnectedAt:    null,
  }
}

function serializeRoom(room) {
  const players = []
  for (const p of room.players.values()) {
    players.push({
      socketId:     p.socketId,
      playerId:     p.playerId,
      name:         p.name,
      ready:        p.ready,
      score:        p.score,
      correct:      p.correct,
      answers:      p.answers,
      disconnected: p.disconnected,
    })
  }
  return {
    code:                 room.code,
    hostSocketId:         room.hostSocketId,
    hostPlayerId:         room.hostPlayerId,
    gameId:               room.gameId,
    gameTitle:            room.gameTitle,
    status:               room.status,
    players,
    currentQuestionIndex: room.currentQuestionIndex,
    questionCount:        room.questionCount,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function createRoom(socketId, playerId, playerName) {
  const code = generateCode()
  const hostPlayer = makePlayer(socketId, playerId, playerName)
  hostPlayer.ready = true   // ← host is ALWAYS considered ready

  /** @type {Room} */
  const room = {
    code,
    hostSocketId:         socketId,
    hostPlayerId:         hostPlayer.playerId,
    gameId:               null,
    gameTitle:            null,
    status:               "waiting",
    players:              new Map([[socketId, hostPlayer]]),
    playersByPid:         new Map([[hostPlayer.playerId, hostPlayer]]),
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

  return { room, player: hostPlayer }
}

function joinRoom(code, socketId, playerId, playerName) {
  const room = rooms.get(code.toUpperCase())
  if (!room)                                     return { error: "Room not found." }
  if (room.status !== "waiting")                 return { error: "Game already in progress." }
  if (room.players.size >= MAX_PLAYERS)          return { error: "Room is full (max 8 players)." }
  if (room.players.has(socketId))                return { error: "Already in this room." }

  // Check if a player with the same persistent ID is already in room (unlikely on join)
  const existingByPid = room.playersByPid.get(playerId)
  if (existingByPid && !existingByPid.disconnected) {
    return { error: "You are already in this room in another tab." }
  }

  const player = makePlayer(socketId, playerId, playerName)
  room.players.set(socketId, player)
  room.playersByPid.set(player.playerId, player)
  return { room, player }
}

/**
 * Reconnect: player with persistent playerId returns after socket drop.
 * Updates their socketId and returns room state for re-sync.
 */
function rejoinRoom(playerId, newSocketId) {
  for (const room of rooms.values()) {
    const player = room.playersByPid.get(playerId)
    if (!player) continue

    const oldSocketId = player.socketId

    // Update socket ID in players map
    room.players.delete(oldSocketId)
    player.socketId       = newSocketId
    player.disconnected   = false
    player.disconnectedAt = null
    room.players.set(newSocketId, player)
    // playersByPid entry stays valid (same player object)

    // Update room's host reference if this was the host
    if (room.hostSocketId === oldSocketId) {
      room.hostSocketId = newSocketId
    }

    return { room, player }
  }
  return null
}

/**
 * Mark player as disconnected. During "waiting", schedule removal after grace.
 * Returns { code, room } or null if not in any room.
 */
function leaveRoom(socketId) {
  for (const [code, room] of rooms) {
    if (!room.players.has(socketId)) continue

    const player = room.players.get(socketId)
    player.disconnected   = true
    player.disconnectedAt = Date.now()

    // Reassign host to next connected player if needed
    if (room.hostSocketId === socketId) {
      const next = [...room.players.values()].find(p => !p.disconnected && p.socketId !== socketId)
      if (next) {
        room.hostSocketId = next.socketId
        room.hostPlayerId = next.playerId
      }
    }

    if (room.status === "waiting") {
      // Grace period — if they reconnect (via rejoinRoom), disconnected flag clears.
      // After DISCONNECT_GRACE_MS, remove them permanently if still disconnected.
      setTimeout(() => {
        const p = room.players.get(socketId)
        if (!p || !p.disconnected) return   // already reconnected
        room.players.delete(socketId)
        room.playersByPid.delete(p.playerId)
        // If room is now empty, delete it
        const connected = [...room.players.values()].filter(x => !x.disconnected)
        if (connected.length === 0) rooms.delete(code)
      }, DISCONNECT_GRACE_MS)
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
  // First find the room this socket belongs to, THEN verify host.
  // (The old loop used `return` on the first non-matching room — wrong if
  //  multiple rooms exist in memory, e.g. from previous TTL-pending sessions.)
  const room = getRoomBySocket(socketId)
  if (!room)                            return { error: "Room not found." }
  if (room.hostSocketId !== socketId)   return { error: "Only the host can start." }
  if (room.status !== "waiting")        return { error: "Game already started." }
  if (!room.gameId)                     return { error: "Select a game first." }

  const connected = [...room.players.values()].filter(p => !p.disconnected)
  if (connected.length < 1)            return { error: "Need at least 1 connected player." }

  room.status               = "countdown"
  room.startedAt            = Date.now()
  room.currentQuestionIndex = 0

  for (const p of room.players.values()) {
    p.score            = 0
    p.correct          = 0
    p.answers          = 0
    p.finishedQuestion = false
  }
  return { room }
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
  player.score            += pointsAwarded
  player.finishedQuestion  = true

  const connected   = [...room.players.values()].filter(p => !p.disconnected)
  const allAnswered = connected.every(p => p.finishedQuestion)

  return { room, allAnswered }
}

function getLeaderboard(roomCode) {
  const room = rooms.get(roomCode)
  if (!room) return []
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score || b.correct - a.correct)
    .map((p, i) => ({
      rank:         i + 1,
      name:         p.name,
      score:        p.score,
      correct:      p.correct,
      answers:      p.answers,
      accuracy:     p.answers > 0 ? Math.round((p.correct / p.answers) * 100) : 0,
      disconnected: p.disconnected,
    }))
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room
  }
  return null
}

function getRoomByCode(code) {
  return rooms.get(code.toUpperCase()) ?? null
}

module.exports = {
  createRoom,
  joinRoom,
  rejoinRoom,
  leaveRoom,
  setReady,
  selectGame,
  startGame,
  advanceQuestion,
  submitAnswer,
  getLeaderboard,
  getRoomBySocket,
  getRoomByCode,
  serializeRoom,
}
