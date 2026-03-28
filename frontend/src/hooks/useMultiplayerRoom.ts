// ─────────────────────────────────────────────────────────────────────────────
// useMultiplayerRoom.ts
// Manages the full multiplayer room lifecycle via Socket.io.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react"
import { getSocket, connectSocket, disconnectSocket } from "../services/MultiplayerService"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoomPlayer {
  socketId:    string
  name:        string
  ready:       boolean
  score:       number
  correct:     number
  answers:     number
  disconnected: boolean
}

export interface RoomState {
  code:                 string
  hostSocketId:         string
  gameId:               string | null
  gameTitle:            string | null
  status:               "waiting" | "countdown" | "playing" | "ended"
  players:              RoomPlayer[]
  currentQuestionIndex: number
  questionCount:        number
}

export interface LeaderboardRow {
  rank:     number
  name:     string
  score:    number
  correct:  number
  answers:  number
  accuracy: number
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
  const [phase,        setPhase]        = useState<RoomPhase>("idle")
  const [room,         setRoom]         = useState<RoomState | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [countdown,    setCountdown]    = useState<number>(3)
  const [questionIdx,  setQuestionIdx]  = useState<number>(0)
  const [leaderboard,  setLeaderboard]  = useState<LeaderboardRow[]>([])
  const [mySocketId,   setMySocketId]   = useState<string>("")
  const [connected,    setConnected]    = useState(false)

  const roomCodeRef = useRef<string>("")

  // ── Register socket listeners once ────────────────────────────────────────
  useEffect(() => {
    const s = getSocket()

    const onConnect    = () => { setConnected(true);  setMySocketId(s.id ?? "") }
    const onDisconnect = () => { setConnected(false) }

    const onCreated  = ({ room: r }: { room: RoomState }) => {
      setRoom(r); roomCodeRef.current = r.code; setPhase("lobby")
    }
    const onJoined   = ({ room: r }: { room: RoomState }) => {
      setRoom(r); roomCodeRef.current = r.code; setPhase("lobby")
    }
    const onUpdated  = ({ room: r }: { room: RoomState }) => {
      setRoom(r)
      if (r.status === "ended") setPhase("ended")
    }
    const onError    = ({ message }: { message: string }) => setError(message)

    const onCountdown = ({ seconds }: { seconds: number }) => {
      setCountdown(seconds); setPhase("countdown")
    }
    const onStart    = ({ room: r }: { room: RoomState }) => {
      setRoom(r); setPhase("playing")
    }
    const onQuestion = ({ index }: { index: number }) => {
      setQuestionIdx(index); setPhase("playing")
    }
    const onScore    = ({ leaderboard: lb }: { leaderboard: LeaderboardRow[] }) => {
      setLeaderboard(lb)
    }
    const onEnd      = ({ leaderboard: lb }: { leaderboard: LeaderboardRow[] }) => {
      setLeaderboard(lb); setPhase("ended")
    }

    s.on("connect",          onConnect)
    s.on("disconnect",       onDisconnect)
    s.on("room:created",     onCreated)
    s.on("room:joined",      onJoined)
    s.on("room:updated",     onUpdated)
    s.on("room:error",       onError)
    s.on("game:countdown",   onCountdown)
    s.on("game:start",       onStart)
    s.on("game:question",    onQuestion)
    s.on("game:scoreUpdate", onScore)
    s.on("game:end",         onEnd)

    return () => {
      s.off("connect",          onConnect)
      s.off("disconnect",       onDisconnect)
      s.off("room:created",     onCreated)
      s.off("room:joined",      onJoined)
      s.off("room:updated",     onUpdated)
      s.off("room:error",       onError)
      s.off("game:countdown",   onCountdown)
      s.off("game:start",       onStart)
      s.off("game:question",    onQuestion)
      s.off("game:scoreUpdate", onScore)
      s.off("game:end",         onEnd)
    }
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    setPhase("connecting"); setError(null); connectSocket()
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

  const leaveRoom = useCallback(() => {
    getSocket().emit("room:leave")
    disconnectSocket()
    setRoom(null); setPhase("idle"); setLeaderboard([])
    roomCodeRef.current = ""
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const isHost = room ? room.hostSocketId === mySocketId : false

  return {
    phase,
    room,
    error,
    countdown,
    questionIdx,
    leaderboard,
    mySocketId,
    connected,
    isHost,
    // actions
    connect,
    createRoom,
    joinRoom,
    setReady,
    selectGame,
    startGame,
    submitAnswer,
    leaveRoom,
    clearError,
  }
}
