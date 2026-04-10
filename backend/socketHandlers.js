/**
 * socketHandlers.js — Socket.io event handlers
 *
 * Reconnect recovery:
 *   On every connection we check socket.handshake.auth.playerId.
 *   If a player with that persistent ID is already in a room, we restore them
 *   (update their socketId, clear disconnected flag, re-join the Socket.io room).
 *   This handles browser refresh, brief network drops, and auto-reconnect.
 *
 * Event contract (client → server):
 *   room:create    { playerName }
 *   room:join      { code, playerName }
 *   room:ready     { ready: boolean }
 *   room:selectGame{ gameId, gameTitle, questionCount }
 *   room:start     {}
 *   room:sync      {}                       ← request current room state
 *   game:answer    { roomCode, correct, pointsAwarded }
 *   room:leave     {}
 *
 * Event contract (server → client):
 *   room:created   { room }                 → only to creator
 *   room:joined    { room }                 → only to joiner
 *   room:updated   { room }                 → broadcast to ALL in room
 *   room:error     { message }              → only to sender
 *   room:restored  { room }                 → sent to reconnecting player only
 *   game:countdown { seconds }              → broadcast, fires 3-2-1
 *   game:start     { room }                 → broadcast, game begins
 *   game:question  { index }                → broadcast, advance question
 *   game:scoreUpdate { leaderboard }        → broadcast after each answer
 *   game:end       { leaderboard }          → broadcast, game over
 *   player:joined  { name }                 → broadcast when player enters lobby
 *   player:left    { name, disconnected }   → broadcast when player leaves
 *
 * ── LIVE ROOM events (client → server):
 *   lobby:enter    { playerName, avatar }   ← player enters live lobby
 *   lobby:leave    {}                       ← player leaves live lobby
 *   lobby:session:create { playerName, gameId, gameTitle, gameEmoji, maxPlayers }
 *   lobby:session:join   { sessionId, playerName }
 *   lobby:session:close  { sessionId }      ← host closes their session
 *
 * ── LIVE ROOM events (server → client):
 *   lobby:state    { players, sessions }    → full lobby state snapshot
 *   lobby:player:joined  { player }         → broadcast when someone enters
 *   lobby:player:left    { playerId }       → broadcast when someone leaves
 *   lobby:session:opened { session }        → broadcast when new session created
 *   lobby:session:closed { sessionId }      → broadcast when session closes
 *   lobby:session:updated{ session }        → broadcast when player count changes
 *   lobby:session:redirect { roomCode }     → to joiner, go join that room code
 */

const rm = require("./roomManager")

// ── In-memory Live Room state (survives per process lifetime) ─────────────────
const lobbyPlayers    = new Map()   // socketId → { id, name, avatar, joinedAt }
const lobbySessions   = new Map()   // sessionId → lobby display entry (no room code!)
const lobbyChatHistory = []          // last 100 chat messages for new arrivals

// ── Self-contained Live Game Sessions ─────────────────────────────────────────
// Completely independent of the MultiplayerPage room system.
// sessionId → {
//   id, hostId, hostName, gameId, gameTitle, gameEmoji,
//   maxPlayers, questionCount,
//   players: [{ socketId, name }],
//   status: 'waiting' | 'countdown' | 'playing' | 'ended',
//   joinDeadline: timestamp,
//   scores: { socketId: { name, points } },
//   currentQuestion: number,
//   answeredThisRound: Set<socketId>,
//   joinTimerHandle: interval handle,
//   countdownHandle: timeout handle,
// }
const liveGameSessions = new Map()

const LIVE_JOIN_SECONDS    = 180   // 3 minutes to join
const LIVE_GAME_COUNTDOWN  = 3     // 3-2-1 before questions start
const LIVE_QUESTION_TIME   = 30   // seconds each player gets per question (client enforced + server timeout backup)
const LIVE_QUESTION_BUFFER = 5    // extra seconds per question in server timeout buffer

// Room name for a live session's socket.io room
const liveRoom = id => `__live__${id}`

function _liveLeaderboard(session) {
  return Object.entries(session.scores)
    .map(([socketId, s]) => ({ socketId, name: s.name, points: s.points }))
    .sort((a, b) => b.points - a.points)
}

function _endLiveGame(io, sessionId) {
  const session = liveGameSessions.get(sessionId)
  if (!session) return
  clearInterval(session.joinTimerHandle)
  clearTimeout(session.countdownHandle)
  clearTimeout(session.gameTimeout)
  session.status = "ended"
  io.to(liveRoom(sessionId)).emit("lobby:game:end", {
    sessionId,
    leaderboard: _liveLeaderboard(session),
  })
  // Remove from lobby display
  lobbySessions.delete(sessionId)
  io.to("__lobby__").emit("lobby:session:closed", { sessionId })
  // Keep liveGameSessions entry briefly so results screen can read it, then clean up
  setTimeout(() => liveGameSessions.delete(sessionId), 60000)
}

function _startLiveGame(io, sessionId) {
  const session = liveGameSessions.get(sessionId)
  if (!session || session.status === "ended") return
  session.status = "playing"

  // Per-player progress — each player advances questions independently
  session.playerProgress = {}
  session.players.forEach(p => {
    session.playerProgress[p.socketId] = { questionsAnswered: 0, done: false }
  })

  // Server-side timeout: (questionTime + buffer) × questionCount + 15s grace
  const totalMs = (LIVE_QUESTION_TIME + LIVE_QUESTION_BUFFER) * session.questionCount * 1000 + 15000
  session.gameTimeout = setTimeout(() => {
    if (session.status === "playing") {
      console.log(`[Live] ${sessionId} — game timeout, ending game`)
      _endLiveGame(io, sessionId)
    }
  }, totalMs)

  io.to(liveRoom(sessionId)).emit("lobby:game:start", {
    sessionId,
    gameId:            session.gameId,
    gameTitle:         session.gameTitle,
    questionCount:     session.questionCount,
    players:           session.players,
    questionTimeLimit: LIVE_QUESTION_TIME,   // each client uses this for their per-question countdown
  })
  // Clients start at question 0 automatically — no lobby:game:question emit needed
}

function _startLiveCountdown(io, sessionId) {
  const session = liveGameSessions.get(sessionId)
  if (!session) return
  clearInterval(session.joinTimerHandle)
  session.status = "countdown"
  let count = LIVE_GAME_COUNTDOWN
  const tick = setInterval(() => {
    io.to(liveRoom(sessionId)).emit("lobby:game:countdown", { sessionId, seconds: count })
    count--
    if (count < 0) {
      clearInterval(tick)
      _startLiveGame(io, sessionId)
    }
  }, 1000)
}

function broadcastLobbyState(io) {
  const players  = [...lobbyPlayers.values()]
  const sessions = [...lobbySessions.values()].map(s => ({
    ...s,
    playerCount: s.players.length,
  }))
  io.to("__lobby__").emit("lobby:state", { players, sessions })
}

const COUNTDOWN_SECONDS = 3

module.exports = function attachSocketHandlers(io) {

  io.on("connection", (socket) => {
    const playerId = socket.handshake.auth?.playerId || null
    console.log(`[Socket] connected: ${socket.id}  playerId: ${playerId ?? "none"}`)

    // ── Reconnect recovery ──────────────────────────────────────────────────
    // If this playerId is already in a room (e.g. after a refresh / auto-reconnect),
    // restore their membership immediately without requiring them to re-join.
    if (playerId) {
      const restored = rm.rejoinRoom(playerId, socket.id)
      if (restored) {
        const { room } = restored
        socket.join(room.code)
        // Tell the reconnecting client their room state
        socket.emit("room:restored", { room: rm.serializeRoom(room) })
        // Tell everyone else this player is back
        socket.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })
        console.log(`[Room] ${room.code} — player ${restored.player.name} reconnected`)
      }
    }

    // ── Create room ─────────────────────────────────────────────────────────
    socket.on("room:create", ({ playerName } = {}) => {
      if (!playerName?.trim()) {
        return socket.emit("room:error", { message: "Player name is required." })
      }
      const pid = playerId || socket.id
      const { room } = rm.createRoom(socket.id, pid, playerName)
      socket.join(room.code)
      socket.emit("room:created", { room: rm.serializeRoom(room) })
      console.log(`[Room] ${room.code} created by ${playerName}`)
    })

    // ── Join room ───────────────────────────────────────────────────────────
    socket.on("room:join", ({ code, playerName } = {}) => {
      if (!code?.trim() || !playerName?.trim()) {
        return socket.emit("room:error", { message: "Room code and name required." })
      }
      const pid    = playerId || socket.id
      const result = rm.joinRoom(code, socket.id, pid, playerName)
      if (result.error) {
        return socket.emit("room:error", { message: result.error })
      }
      const { room, player } = result
      socket.join(room.code)
      // Tell the joiner their room state
      socket.emit("room:joined", { room: rm.serializeRoom(room) })
      // Tell everyone in the room (including the joiner via broadcast) the update
      io.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })
      io.to(room.code).emit("player:joined", { name: player.name })
      console.log(`[Room] ${player.name} joined ${room.code}`)
    })

    // ── Ready toggle ────────────────────────────────────────────────────────
    socket.on("room:ready", ({ ready } = {}) => {
      const room = rm.setReady(socket.id, !!ready)
      if (!room) return
      io.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })
    })

    // ── Sync (force-request current room state) ─────────────────────────────
    socket.on("room:sync", () => {
      const room = rm.getRoomBySocket(socket.id)
      if (room) {
        socket.emit("room:updated", { room: rm.serializeRoom(room) })
      }
    })

    // ── Host selects game ───────────────────────────────────────────────────
    socket.on("room:selectGame", ({ gameId, gameTitle, questionCount } = {}) => {
      const room = rm.selectGame(socket.id, gameId, gameTitle, questionCount || 0)
      if (!room) return socket.emit("room:error", { message: "You are not the host." })
      io.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })
    })

    // ── Start game ──────────────────────────────────────────────────────────
    socket.on("room:start", () => {
      const result = rm.startGame(socket.id)
      if (result.error) {
        return socket.emit("room:error", { message: result.error })
      }
      const { room } = result
      // Broadcast updated room (status = countdown)
      io.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })

      // Countdown 3 … 2 … 1 … GO  then start first question
      let count = COUNTDOWN_SECONDS
      const tick = setInterval(() => {
        io.to(room.code).emit("game:countdown", { seconds: count })
        count--
        if (count < 0) {
          clearInterval(tick)
          // advanceQuestion sets index=1 and status="playing"
          const started = rm.advanceQuestion(room.code)
          if (!started) return
          // Reset index to 0 for first question
          started.currentQuestionIndex = 0
          started.status = "playing"
          io.to(room.code).emit("game:start",    { room: rm.serializeRoom(started) })
          io.to(room.code).emit("game:question", { index: 0 })
        }
      }, 1000)
    })

    // ── Player submits answer ───────────────────────────────────────────────
    socket.on("game:answer", ({ roomCode, correct, pointsAwarded } = {}) => {
      if (!roomCode) return
      const result = rm.submitAnswer(socket.id, roomCode, !!correct, pointsAwarded || 0)
      if (!result) return

      const { room, allAnswered } = result
      const lb = rm.getLeaderboard(roomCode)

      io.to(room.code).emit("game:scoreUpdate", { leaderboard: lb })

      if (allAnswered) {
        setTimeout(() => {
          const next = rm.advanceQuestion(room.code)
          if (!next) return

          if (next.status === "ended") {
            io.to(room.code).emit("game:end", { leaderboard: rm.getLeaderboard(roomCode) })
          } else {
            io.to(room.code).emit("game:question", { index: next.currentQuestionIndex })
          }
        }, 1500)
      }
    })

    // ══ LIVE ROOM ════════════════════════════════════════════════════════════

    // ── Enter lobby ─────────────────────────────────────────────────────────
    socket.on("lobby:enter", ({ playerName, avatar } = {}) => {
      if (!playerName?.trim()) return
      const player = { id: socket.id, name: playerName.trim(), avatar: avatar || "🎮", joinedAt: Date.now() }
      lobbyPlayers.set(socket.id, player)
      socket.join("__lobby__")
      // Send full state + chat history to new entrant
      socket.emit("lobby:state", {
        players:     [...lobbyPlayers.values()],
        sessions:    [...lobbySessions.values()],
        chatHistory: lobbyChatHistory.slice(-50),  // last 50 messages
      })
      // Tell everyone else
      socket.to("__lobby__").emit("lobby:player:joined", { player })
      console.log(`[Lobby] ${playerName} entered (${lobbyPlayers.size} online)`)
    })

    // ── Leave lobby ─────────────────────────────────────────────────────────
    socket.on("lobby:leave", () => {
      _leaveLobby(socket)
    })

    // ── Create public live game session ─────────────────────────────────────
    // Completely self-contained — never touches the MultiplayerPage room system.
    socket.on("lobby:session:create", ({ playerName, gameId, gameTitle, gameEmoji, maxPlayers, questionCount } = {}) => {
      if (!gameId || !playerName?.trim()) return
      const name      = playerName.trim()
      const qCount    = Math.max(1, Number(questionCount ?? 10))
      const sessionId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const joinDeadline = Date.now() + LIVE_JOIN_SECONDS * 1000

      const session = {
        id:             sessionId,
        hostId:         socket.id,
        hostName:       name,
        gameId,
        gameTitle:      gameTitle || "Unknown Game",
        gameEmoji:      gameEmoji || "🎮",
        maxPlayers:     Math.min(Number(maxPlayers ?? 10), 20),
        questionCount:  qCount,
        players:        [{ socketId: socket.id, name }],
        status:         "waiting",
        joinDeadline,
        scores:          { [socket.id]: { name, points: 0 } },
        currentQuestion: 0,
        playerProgress:  null,   // populated in _startLiveGame
        gameTimeout:     null,   // server-side total game timeout
        joinTimerHandle: null,
        countdownHandle: null,
      }
      liveGameSessions.set(sessionId, session)

      // Join the live game's private socket.io room
      socket.join(liveRoom(sessionId))

      // Lobby display entry (no roomCode — pure live game)
      const lobbyEntry = {
        id: sessionId, hostId: socket.id, hostName: name,
        gameId, gameTitle: session.gameTitle, gameEmoji: session.gameEmoji,
        maxPlayers: session.maxPlayers, players: [{ id: socket.id, name }],
        playerCount: 1, createdAt: Date.now(),
      }
      lobbySessions.set(sessionId, lobbyEntry)
      io.to("__lobby__").emit("lobby:session:opened", { session: lobbyEntry })

      // Tell host they're in the waiting room
      socket.emit("lobby:game:joined", { session: { ...session, playerProgress: undefined, joinTimerHandle: undefined, countdownHandle: undefined, gameTimeout: undefined }, isHost: true })

      // Per-second join timer countdown
      let secondsLeft = LIVE_JOIN_SECONDS
      session.joinTimerHandle = setInterval(() => {
        secondsLeft--
        io.to(liveRoom(sessionId)).emit("lobby:game:timer", { sessionId, secondsLeft })
        if (secondsLeft <= 0) {
          _startLiveCountdown(io, sessionId)
        }
      }, 1000)

      console.log(`[Live] ${name} opened live session "${session.gameTitle}" (${sessionId})`)
    })

    // ── Join live game session ───────────────────────────────────────────────
    socket.on("lobby:session:join", ({ sessionId, playerName } = {}) => {
      const session = liveGameSessions.get(sessionId)
      if (!session || session.status === "ended")
        return socket.emit("room:error", { message: "Session not found or already ended." })
      if (session.status === "playing" || session.status === "countdown")
        return socket.emit("room:error", { message: "Game already in progress." })
      if (session.players.length >= session.maxPlayers)
        return socket.emit("room:error", { message: "Session is full." })

      const name = playerName?.trim() || "Guest"

      // Add to session
      session.players.push({ socketId: socket.id, name })
      session.scores[socket.id] = { name, points: 0 }
      socket.join(liveRoom(sessionId))

      // Update lobby display
      const lobbyEntry = lobbySessions.get(sessionId)
      if (lobbyEntry) {
        lobbyEntry.players.push({ id: socket.id, name })
        lobbyEntry.playerCount = session.players.length
        io.to("__lobby__").emit("lobby:session:updated", {
          session: { ...lobbyEntry, playerCount: lobbyEntry.playerCount },
        })
      }

      // Tell joiner they're in the waiting room
      socket.emit("lobby:game:joined", {
        session: { ...session, playerProgress: undefined, joinTimerHandle: undefined, countdownHandle: undefined, gameTimeout: undefined },
        isHost:  false,
      })

      // Broadcast updated player list to everyone waiting
      io.to(liveRoom(sessionId)).emit("lobby:game:player_update", {
        sessionId,
        players: session.players,
        scores:  session.scores,
      })

      console.log(`[Live] ${name} joined live session "${session.gameTitle}" (${sessionId})`)
    })

    // ── Host starts game early ───────────────────────────────────────────────
    socket.on("lobby:game:early_start", ({ sessionId } = {}) => {
      const session = liveGameSessions.get(sessionId)
      if (!session || session.hostId !== socket.id) return
      if (session.status !== "waiting") return
      _startLiveCountdown(io, sessionId)
    })

    // ── Player submits live game answer (independent per-player flow) ──────────
    // Each player manages their own question index on the client.
    // questionIndex tells us which question they just answered so we can
    // validate ordering and prevent double-counting.
    socket.on("lobby:game:answer", ({ sessionId, correct, points, questionIndex } = {}) => {
      const session = liveGameSessions.get(sessionId)
      if (!session || session.status !== "playing") return

      const progress = session.playerProgress?.[socket.id]
      if (!progress || progress.done) return

      // Only accept the answer for the question we expect next
      const expectedQ = progress.questionsAnswered
      if (Number(questionIndex) !== expectedQ) return

      progress.questionsAnswered++

      if (correct && session.scores[socket.id]) {
        session.scores[socket.id].points += Math.max(0, Number(points) || 0)
      }

      // Broadcast updated leaderboard to all players in this session
      const lb = _liveLeaderboard(session)
      io.to(liveRoom(sessionId)).emit("lobby:game:score", { sessionId, leaderboard: lb })

      // Check if this player finished all questions
      if (progress.questionsAnswered >= session.questionCount) {
        progress.done = true
        io.to(liveRoom(sessionId)).emit("lobby:game:player_done", {
          sessionId,
          playerId: socket.id,
          name:     session.scores[socket.id]?.name ?? "?",
        })
        console.log(`[Live] ${session.scores[socket.id]?.name} finished all questions in ${sessionId}`)

        // End game when all active players are done
        const activePlayers = session.players.filter(p => !p.disconnected)
        const allDone = activePlayers.every(p => session.playerProgress[p.socketId]?.done)
        if (allDone) {
          console.log(`[Live] All players done — ending ${sessionId}`)
          clearTimeout(session.gameTimeout)
          setTimeout(() => _endLiveGame(io, sessionId), 2000)
        }
      }
    })

    // ── Community chat ───────────────────────────────────────────────────────
    socket.on("lobby:chat", ({ message } = {}) => {
      if (!message?.trim()) return
      const player = lobbyPlayers.get(socket.id)
      if (!player) return   // must be in lobby to chat
      const payload = {
        playerId:   socket.id,
        playerName: player.name,
        avatar:     player.avatar,
        message:    message.trim().slice(0, 300),  // cap at 300 chars
        timestamp:  Date.now(),
      }
      // Store in recent history (keep last 100 messages)
      lobbyChatHistory.push(payload)
      if (lobbyChatHistory.length > 100) lobbyChatHistory.shift()
      // Broadcast to everyone in the lobby room
      io.to("__lobby__").emit("lobby:chat:message", payload)
    })

    // ── Close session (host only) ────────────────────────────────────────────
    socket.on("lobby:session:close", ({ sessionId } = {}) => {
      const session = lobbySessions.get(sessionId)
      if (!session || session.hostId !== socket.id) return
      lobbySessions.delete(sessionId)
      io.to("__lobby__").emit("lobby:session:closed", { sessionId })
    })

    // ── Explicit leave ──────────────────────────────────────────────────────
    socket.on("room:leave", () => handleLeave(socket, true))

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`[Socket] disconnected: ${socket.id}  reason: ${reason}`)
      _leaveLobby(socket)
      _leaveLiveSession(io, socket)
      // Only handle as permanent leave for explicit close; transport errors may reconnect
      handleLeave(socket, false)
    })

    function handleLeave(socket, explicit) {
      const result = rm.leaveRoom(socket.id)
      if (!result) return
      const { code, room } = result

      if (explicit) {
        socket.leave(code)
        if (_socket) {
          // clean up singleton on explicit leave so re-opening the page gets a fresh socket
        }
      }

      if (room) {
        const player = [...room.players.values()].find(p => p.socketId === socket.id)
        io.to(code).emit("room:updated", { room: rm.serializeRoom(room) })
        if (player) {
          io.to(code).emit("player:left", {
            name:         player.name,
            disconnected: !explicit,   // true = may reconnect, false = left intentionally
          })
        }
      }
    }
  })
}

// ── Lobby leave helper (also called on disconnect) ────────────────────────────
function _leaveLobby(socket) {
  if (!lobbyPlayers.has(socket.id)) return
  lobbyPlayers.delete(socket.id)
  socket.leave("__lobby__")

  // Close any sessions this player was hosting
  for (const [sid, session] of lobbySessions) {
    if (session.hostId === socket.id) {
      lobbySessions.delete(sid)
      socket.broadcast.to("__lobby__").emit("lobby:session:closed", { sessionId: sid })
    }
  }

  socket.broadcast.to("__lobby__").emit("lobby:player:left", { playerId: socket.id })
}

// ── Live session leave / disconnect ──────────────────────────────────────────
function _leaveLiveSession(io, socket) {
  for (const [sessionId, session] of liveGameSessions) {
    const idx = session.players.findIndex(p => p.socketId === socket.id)
    if (idx === -1) continue

    if (session.hostId === socket.id) {
      // Host left — end the game immediately
      clearInterval(session.joinTimerHandle)
      session.status = "ended"
      io.to(liveRoom(sessionId)).emit("lobby:game:end", {
        sessionId,
        leaderboard: _liveLeaderboard(session),
        hostLeft: true,
      })
      lobbySessions.delete(sessionId)
      io.to("__lobby__").emit("lobby:session:closed", { sessionId })
      liveGameSessions.delete(sessionId)
    } else {
      // Non-host player left
      session.players[idx].disconnected = true
      session.scores[socket.id] = session.scores[socket.id] ?? { name: session.players[idx].name, points: 0 }
      io.to(liveRoom(sessionId)).emit("lobby:game:player_update", {
        sessionId,
        players: session.players.filter(p => !p.disconnected),
        scores:  session.scores,
      })
      // Update lobby display
      const le = lobbySessions.get(sessionId)
      if (le) {
        le.players = le.players.filter(p => p.id !== socket.id)
        le.playerCount = le.players.length
        io.to("__lobby__").emit("lobby:session:updated", { session: { ...le } })
      }
      // If all remaining active players are done, end the game now
      const active = session.players.filter(p => !p.disconnected)
      if (session.status === "playing" && active.length > 0) {
        const allDone = active.every(p => session.playerProgress?.[p.socketId]?.done)
        if (allDone) {
          clearTimeout(session.gameTimeout)
          setTimeout(() => _endLiveGame(io, sessionId), 2000)
        }
      }
    }
    break
  }
}

// (not used server-side but avoids lint warning in template)
const _socket = null
void _socket
