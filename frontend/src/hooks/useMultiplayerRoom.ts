// ─────────────────────────────────────────────────────────────────────────────
// useMultiplayerRoom.ts
//
// Manages the full multiplayer room lifecycle via Socket.io.
//
// Reconnection model (Kahoot-style):
//   - Each browser tab has a persistent playerId (UUID in sessionStorage).
//   - On socket reconnect the server calls rejoinRoom(playerId, newSocketId).
//   - The server sends room:restored to the reconnecting client.
//   - The hook listens for room:restored and syncs state accordingly.
//   - isHost is determined by comparing our playerId to room.hostPlayerId
//     (not socket ID, so it survives reconnects).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react"
import { getSocket, connectSocket, disconnectSocket, MY_PLAYER_ID } from "../services/MultiplayerService"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoomPlayer {
  socketId:     string
  playerId:     string
  name:         string
  ready:        boolean
  score:        number
  correct:      number
  answers:      number
  disconnected: boolean
}

export interface RoomState {
  code:                 string
  hostSocketId:         string
  hostPlayerId:         string
  gameId:               string | null
  gameTitle:            string | null
  status:               "waiting" | "countdown" | "playing" | "ended"
  players:              RoomPlayer[]
  currentQuestionIndex: number
  questionCount:        number
}

export interface LeaderboardRow {
  rank:         number
  name:         string
  score:        number
  correct:      number
  answers:      number
  accuracy:     number
  disconnected?: boolean
}

type RoomPhase =
  | "idle"
  | "connecting"
  | "lobby"
  | "countdown"
  | "playing"
  | "ended"

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMultiplayerRoom() {
  const [phase,       setPhase]       = useState<RoomPhase>("idle")
  const [room,        setRoom]        = useState<RoomState | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [notification,setNotification]= useState<string | null>(null)
  const [countdown,   setCountdown]   = useState<number>(3)
  const [questionIdx, setQuestionIdx] = useState<number>(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [mySocketId,  setMySocketId]  = useState<string>("")
  const [connected,   setConnected]   = useState(false)

  const roomCodeRef = useRef<string>("")

  // Transient notification: auto-clear after 3 seconds
  const showNotification = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // ── Register socket listeners once ────────────────────────────────────────
  useEffect(() => {
    const s = getSocket()

    // ── Connection events ──────────────────────────────────────────────────
    const onConnect = () => {
      setConnected(true)
      setMySocketId(s.id ?? "")
      // If we were in connecting phase, move to lobby
      setPhase(prev => prev === "connecting" ? "lobby" : prev)
      // If we already had a room, request a sync to get fresh state
      // (handles the case where socket briefly disconnected and reconnected)
      if (roomCodeRef.current) {
        s.emit("room:sync")
      }
    }

    const onDisconnect = (reason: string) => {
      setConnected(false)
      // If the server terminated the connection, reset to idle
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        setPhase("idle")
        setRoom(null)
        roomCodeRef.current = ""
      }
      // For transport errors: show error but keep phase — we may auto-reconnect
      if (reason === "transport close" || reason === "transport error") {
        setError("Connection lost — trying to reconnect…")
      }
    }

    const onConnectError = () => {
      setPhase("idle")
      setError("Cannot reach multiplayer server. Make sure the backend is running (npm run dev in /backend).")
    }

    const onReconnect = () => {
      setConnected(true)
      setMySocketId(s.id ?? "")
      setError(null)
      // room:restored or room:updated will arrive from server if we were in a room
    }

    // ── Room events ────────────────────────────────────────────────────────
    const onCreated = ({ room: r }: { room: RoomState }) => {
      setRoom(r)
      roomCodeRef.current = r.code
      setPhase("lobby")
      setError(null)
    }

    const onJoined = ({ room: r }: { room: RoomState }) => {
      setRoom(r)
      roomCodeRef.current = r.code
      setPhase("lobby")
      setError(null)
    }

    // room:restored is sent by server when a socket reconnects and is already in a room
    const onRestored = ({ room: r }: { room: RoomState }) => {
      setRoom(r)
      roomCodeRef.current = r.code
      setConnected(true)
      setMySocketId(s.id ?? "")
      setError(null)
      // Restore correct phase based on room status
      switch (r.status) {
        case "waiting":   setPhase("lobby");    break
        case "countdown": setPhase("countdown");break
        case "playing":   setPhase("playing");  break
        case "ended":     setPhase("ended");    break
      }
    }

    const onUpdated = ({ room: r }: { room: RoomState }) => {
      setRoom(r)
      roomCodeRef.current = r.code   // keep ref in sync (needed after restoreRoom)
      // Sync phase with room status changes
      if (r.status === "ended")    setPhase("ended")
      if (r.status === "playing")  setPhase(prev => prev === "lobby" || prev === "countdown" ? "playing" : prev)
      // Allow idle/connecting → lobby so restoreRoom (Live Room redirect) works
      if (r.status === "waiting")  setPhase(prev => prev === "playing" || prev === "countdown" || prev === "ended" ? prev : "lobby")
    }

    const onError = ({ message }: { message: string }) => setError(message)

    // ── Lobby social events ────────────────────────────────────────────────
    const onPlayerJoined = ({ name }: { name: string }) => {
      showNotification(`${name} joined the room!`)
    }
    const onPlayerLeft = ({ name, disconnected: dc }: { name: string; disconnected: boolean }) => {
      showNotification(dc ? `${name} disconnected (may rejoin)` : `${name} left the room`)
    }

    // ── Game events ────────────────────────────────────────────────────────
    const onCountdown = ({ seconds }: { seconds: number }) => {
      setCountdown(seconds)
      setPhase("countdown")
    }

    const onStart = ({ room: r }: { room: RoomState }) => {
      setRoom(r)
      setPhase("playing")
      setQuestionIdx(0)
    }

    const onQuestion = ({ index }: { index: number }) => {
      setQuestionIdx(index)
      setPhase("playing")
    }

    const onScore = ({ leaderboard: lb }: { leaderboard: LeaderboardRow[] }) => {
      setLeaderboard(lb)
    }

    const onEnd = ({ leaderboard: lb }: { leaderboard: LeaderboardRow[] }) => {
      setLeaderboard(lb)
      setPhase("ended")
    }

    // ── Register ───────────────────────────────────────────────────────────
    s.on("connect",          onConnect)
    s.on("disconnect",       onDisconnect)
    s.on("connect_error",    onConnectError)
    s.io.on("reconnect",     onReconnect)
    s.on("room:created",     onCreated)
    s.on("room:joined",      onJoined)
    s.on("room:restored",    onRestored)
    s.on("room:updated",     onUpdated)
    s.on("room:error",       onError)
    s.on("player:joined",    onPlayerJoined)
    s.on("player:left",      onPlayerLeft)
    s.on("game:countdown",   onCountdown)
    s.on("game:start",       onStart)
    s.on("game:question",    onQuestion)
    s.on("game:scoreUpdate", onScore)
    s.on("game:end",         onEnd)

    // ── Sync if socket is already connected (e.g. component re-mounts) ─────
    if (s.connected) {
      setConnected(true)
      setMySocketId(s.id ?? "")
      if (roomCodeRef.current) s.emit("room:sync")
    }

    return () => {
      s.off("connect",          onConnect)
      s.off("disconnect",       onDisconnect)
      s.off("connect_error",    onConnectError)
      s.io.off("reconnect",     onReconnect)
      s.off("room:created",     onCreated)
      s.off("room:joined",      onJoined)
      s.off("room:restored",    onRestored)
      s.off("room:updated",     onUpdated)
      s.off("room:error",       onError)
      s.off("player:joined",    onPlayerJoined)
      s.off("player:left",      onPlayerLeft)
      s.off("game:countdown",   onCountdown)
      s.off("game:start",       onStart)
      s.off("game:question",    onQuestion)
      s.off("game:scoreUpdate", onScore)
      s.off("game:end",         onEnd)
    }
  }, [showNotification])

  // ── Actions ────────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    setPhase("connecting")
    setError(null)
    connectSocket()
  }, [])

  const createRoom = useCallback((playerName: string) => {
    setError(null)
    getSocket().emit("room:create", { playerName })
  }, [])

  const joinRoom = useCallback((code: string, playerName: string) => {
    setError(null)
    getSocket().emit("room:join", { code: code.toUpperCase(), playerName })
  }, [])

  const setReady = useCallback((ready: boolean) => {
    getSocket().emit("room:ready", { ready })
  }, [])

  const selectGame = useCallback((gameId: string, gameTitle: string, questionCount: number) => {
    getSocket().emit("room:selectGame", { gameId, gameTitle, questionCount })
  }, [])

  const startGame = useCallback(() => {
    getSocket().emit("room:start")
  }, [])

  const submitAnswer = useCallback((correct: boolean, pointsAwarded: number) => {
    getSocket().emit("game:answer", {
      roomCode: roomCodeRef.current,
      correct,
      pointsAwarded,
    })
  }, [])

  // ── Restore into an existing room (used when redirected from Live Room) ──────
  // Sets the room code ref and emits room:sync so the server sends back room:updated,
  // which transitions phase from idle → lobby automatically.
  const restoreRoom = useCallback((code: string) => {
    roomCodeRef.current = code
    setError(null)
    setPhase("connecting")
    const s = getSocket()
    connectSocket()            // no-op if already connected
    if (s.connected) {
      s.emit("room:sync")
    }
    // If not yet connected, onConnect will fire room:sync once connected
    // (roomCodeRef.current is already set, so the onConnect handler will emit it)
  }, [])

  const leaveRoom = useCallback(() => {
    getSocket().emit("room:leave")
    disconnectSocket()
    setRoom(null)
    setPhase("idle")
    setLeaderboard([])
    setError(null)
    roomCodeRef.current = ""
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // isHost is based on persistent playerId — survives socket reconnects
  const isHost = room ? room.hostPlayerId === MY_PLAYER_ID : false

  return {
    phase,
    room,
    error,
    notification,
    countdown,
    questionIdx,
    leaderboard,
    mySocketId,
    myPlayerId:  MY_PLAYER_ID,
    connected,
    isHost,
    // actions
    connect,
    createRoom,
    joinRoom,
    restoreRoom,
    setReady,
    selectGame,
    startGame,
    submitAnswer,
    leaveRoom,
    clearError,
  }
}
