/**
 * socketHandlers.js — Socket.io event handlers
 *
 * Event contract (client → server):
 *   room:create    { playerName }
 *   room:join      { code, playerName }
 *   room:ready     { ready: boolean }
 *   room:selectGame { gameId, gameTitle, questionCount }
 *   room:start     {}
 *   game:answer    { roomCode, correct: boolean, pointsAwarded: number }
 *   room:leave     {}
 *
 * Event contract (server → client):
 *   room:created   { room }           — only to creator
 *   room:joined    { room, player }   — only to joiner
 *   room:updated   { room }           — broadcast to all in room
 *   room:error     { message }        — only to sender
 *   game:countdown { seconds }        — broadcast, fires 3-2-1 then GO
 *   game:start     { room }           — broadcast, game begins
 *   game:question  { index }          — broadcast, advance question
 *   game:scoreUpdate { leaderboard }  — broadcast after each answer
 *   game:end       { leaderboard }    — broadcast, game over
 *   player:left    { socketId, name } — broadcast when player disconnects
 */

const rm = require("./roomManager")

const COUNTDOWN_SECONDS = 3

module.exports = function attachSocketHandlers(io) {

  io.on("connection", (socket) => {
    console.log(`[Socket] connected: ${socket.id}`)

    // ── Create room ─────────────────────────────────────────────────────────
    socket.on("room:create", ({ playerName } = {}) => {
      if (!playerName?.trim()) {
        return socket.emit("room:error", { message: "Player name is required." })
      }
      const { room } = rm.createRoom(socket.id, playerName)
      socket.join(room.code)
      socket.emit("room:created", { room: rm.serializeRoom(room) })
      console.log(`[Room] ${room.code} created by ${playerName}`)
    })

    // ── Join room ───────────────────────────────────────────────────────────
    socket.on("room:join", ({ code, playerName } = {}) => {
      if (!code?.trim() || !playerName?.trim()) {
        return socket.emit("room:error", { message: "Room code and name required." })
      }
      const result = rm.joinRoom(code, socket.id, playerName)
      if (result.error) {
        return socket.emit("room:error", { message: result.error })
      }
      const { room, player } = result
      socket.join(room.code)
      socket.emit("room:joined", { room: rm.serializeRoom(room), player })
      // Tell everyone else a new player arrived
      socket.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })
      console.log(`[Room] ${playerName} joined ${room.code}`)
    })

    // ── Ready toggle ────────────────────────────────────────────────────────
    socket.on("room:ready", ({ ready } = {}) => {
      const room = rm.setReady(socket.id, !!ready)
      if (!room) return
      io.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })
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
      io.to(room.code).emit("room:updated", { room: rm.serializeRoom(room) })

      // Countdown 3-2-1 then emit game:start
      let count = COUNTDOWN_SECONDS
      const tick = setInterval(() => {
        io.to(room.code).emit("game:countdown", { seconds: count })
        count--
        if (count < 0) {
          clearInterval(tick)
          const started = rm.advanceQuestion(room.code)  // sets status = "playing", index = 0
          if (!started) return
          io.to(room.code).emit("game:start", { room: rm.serializeRoom(started) })
          io.to(room.code).emit("game:question", { index: started.currentQuestionIndex })
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

      // Broadcast live score update to everyone
      io.to(room.code).emit("game:scoreUpdate", { leaderboard: lb })

      // If everyone answered, auto-advance
      if (allAnswered) {
        setTimeout(() => {
          const next = rm.advanceQuestion(room.code)
          if (!next) return

          if (next.status === "ended") {
            io.to(room.code).emit("game:end", { leaderboard: rm.getLeaderboard(roomCode) })
          } else {
            io.to(room.code).emit("game:question", { index: next.currentQuestionIndex })
          }
        }, 1500)   // 1.5s pause so players see the result
      }
    })

    // ── Explicit leave ──────────────────────────────────────────────────────
    socket.on("room:leave", () => handleLeave(socket))

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[Socket] disconnected: ${socket.id}`)
      handleLeave(socket)
    })

    function handleLeave(socket) {
      const result = rm.leaveRoom(socket.id)
      if (!result) return
      const { code, room } = result
      socket.leave(code)
      if (room) {
        io.to(code).emit("room:updated", { room: rm.serializeRoom(room) })
        io.to(code).emit("player:left",  { socketId: socket.id })
      }
    }
  })
}
