/**
 * LiveRoomPage — Self-contained public live gaming lobby
 *
 * PHASES:
 *   "lobby"   — see who's online, open sessions, community chat
 *   "waiting" — joined a session, 3-min countdown, player list, host can start early
 *   "playing" — inline game questions synced across all players
 *   "results" — leaderboard, winner celebration, return to lobby
 *
 * NO redirect to MultiplayerPage. The entire live-game flow lives here.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import type { GameConfig } from "../types/engine.types"
import { pluginRegistry } from "../plugins"
import { getSocket, connectSocket, MY_PLAYER_ID } from "../services/MultiplayerService"
import { useAuth } from "../context/AuthContext"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface LivePlayer { id: string; name: string; avatar: string; joinedAt: number }
interface ChatMessage { playerId: string; playerName: string; avatar: string; message: string; timestamp: number }
interface LiveSession {
  id: string; hostId: string; hostName: string
  gameId: string; gameTitle: string; gameEmoji: string
  maxPlayers: number; players: { id: string; name: string }[]
  playerCount: number; createdAt: number
}
interface LiveGameSession {
  id: string; hostId: string; gameId: string; gameTitle: string; gameEmoji: string
  questionCount: number
  players: { socketId: string; name: string }[]
  joinDeadline: number; status: string
}
interface LeaderboardEntry { socketId: string; name: string; points: number }

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  games:  GameConfig[]
  onBack: () => void
  // Legacy prop — kept so App.tsx doesn't need a change, but never called
  onJoinRoom?: (roomCode: string, gameId: string, gameTitle: string) => void
}

const AVATARS = ["🎮","🦌","⚡","🧠","🏆","🔢","🚀","🎯","🌟","💡","🔥","🎲"]
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 10) return "Just now"
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}
function fmtTime(s: number) {
  if (s <= 0) return "0:00"
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

// ─────────────────────────────────────────────────────────────────────────────
// HostModal
// ─────────────────────────────────────────────────────────────────────────────
const HostModal: React.FC<{
  games: GameConfig[]; playerName: string
  onHost: (gameId: string, gameTitle: string, gameEmoji: string, max: number, questionCount: number) => void
  onClose: () => void
}> = ({ games, playerName, onHost, onClose }) => {
  const [selectedId, setSelectedId] = useState(games[0]?.id ?? "")
  const [maxPlayers, setMaxPlayers] = useState(10)
  const selectedGame = games.find(g => g.id === selectedId)
  const qCount = selectedGame?.questions?.length ?? 10
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position:"fixed",inset:0,zIndex:2000,background:"rgba(10,10,15,0.88)",
      backdropFilter:"blur(10px)",display:"flex",alignItems:"center",
      justifyContent:"center",padding:"20px",
    }}>
      <div style={{
        background:"#0E0E1A",border:"1px solid rgba(168,85,247,0.25)",
        borderRadius:"20px",padding:"28px",maxWidth:"480px",width:"100%",
        maxHeight:"85vh",overflowY:"auto",
      }}>
        <h3 style={{fontFamily:"Orbitron,sans-serif",color:"#E8E0FF",fontSize:"1rem",marginBottom:"4px"}}>
          🎮 Host a Live Game
        </h3>
        <p style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.75rem",color:"rgba(232,224,255,0.38)",marginBottom:"20px"}}>
          A 3-minute window opens — anyone online can join. All start together.
        </p>
        <label style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.75rem",color:"rgba(232,224,255,0.5)",display:"block",marginBottom:"6px"}}>
          Choose a Game
        </label>
        <div style={{display:"flex",flexDirection:"column",gap:"6px",maxHeight:"280px",overflowY:"auto",marginBottom:"16px"}}>
          {games.map(g => (
            <button key={g.id} onClick={() => setSelectedId(g.id)} style={{
              display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",
              borderRadius:"10px",cursor:"pointer",textAlign:"left",
              background: selectedId===g.id?"rgba(168,85,247,0.12)":"rgba(255,255,255,0.03)",
              border: selectedId===g.id?"1px solid rgba(168,85,247,0.45)":"1px solid rgba(255,255,255,0.07)",
              color: selectedId===g.id?"#C084FC":"rgba(232,224,255,0.55)",
              fontFamily:"Exo 2,sans-serif",fontSize:"0.82rem",transition:"all 0.15s",
            }}>
              <span style={{fontSize:"1.3rem",flexShrink:0}}>{g.ui?.emoji ?? "🎮"}</span>
              <div>
                <div style={{fontWeight:700}}>{g.title}</div>
                <div style={{fontSize:"0.68rem",opacity:0.6,marginTop:"1px"}}>
                  {g.plugin} · {g.questions?.length ?? 0} questions
                </div>
              </div>
            </button>
          ))}
        </div>
        <label style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.75rem",color:"rgba(232,224,255,0.5)",display:"block",marginBottom:"6px"}}>
          Max Players: <strong style={{color:"#A855F7"}}>{maxPlayers}</strong>
        </label>
        <input type="range" min={2} max={20} value={maxPlayers}
          onChange={e => setMaxPlayers(+e.target.value)}
          style={{width:"100%",accentColor:"#A855F7",marginBottom:"20px"}} />
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={onClose} style={{
            flex:1,padding:"10px",borderRadius:"8px",cursor:"pointer",
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
            color:"rgba(232,224,255,0.4)",fontFamily:"Exo 2,sans-serif",fontSize:"0.82rem",
          }}>Cancel</button>
          <button
            onClick={() => selectedGame && onHost(selectedGame.id,selectedGame.title,selectedGame.ui?.emoji??"🎮",maxPlayers,qCount)}
            disabled={!selectedGame}
            style={{
              flex:2,padding:"10px",borderRadius:"8px",cursor:"pointer",
              background:"linear-gradient(135deg,#A855F7,#6366F1)",border:"none",
              color:"#fff",fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.82rem",
            }}>
            🚀 Open Session as {playerName}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveGameQuestion — renders the current question using the plugin system
// ─────────────────────────────────────────────────────────────────────────────
const LiveGameQuestion: React.FC<{
  gameConfig:  GameConfig
  index:       number
  sessionId:   string
  isAnswered:  boolean
  onAnswer:    (correct: boolean, points: number) => void
}> = ({ gameConfig, index, sessionId, isAnswered, onAnswer }) => {
  const question = gameConfig.questions?.[index]
  // pluginRegistry is keyed by plugin id which equals question.type
  const plugin   = question ? pluginRegistry.get(question.type as string) : undefined

  if (!question || !plugin) {
    return (
      <div style={{textAlign:"center",padding:"40px",color:"rgba(232,224,255,0.4)",fontFamily:"Exo 2,sans-serif"}}>
        ⚠️ Question {index + 1} not available
      </div>
    )
  }
  const Plugin = plugin

  const scoring = (gameConfig as any).scoring ?? {
    basePoints: 10, timeBonus: false, timeBonusPerSecond: 0,
    streakBonus: false, streakBonusMultiplier: 1, maxPoints: 9999,
  }
  const emptyStats = {
    score: 0, streak: 0, accuracy: 0, averageTime: 0,
    totalAnswered: 0, correctAnswered: 0, hintsUsed: 0, difficulty: "easy" as const,
  }

  return (
    <div style={{padding:"4px 0"}}>
      <Plugin.Component
        key={`${sessionId}-q${index}`}
        question={question as any}
        config={gameConfig}
        stats={emptyStats}
        isShowingHint={false}
        onRequestHint={() => {}}
        onAnswer={result => {
          if (isAnswered) return
          const pts = Plugin.calculateScore
            ? Plugin.calculateScore(question as any, result.correct, result.timeTaken ?? 0, scoring)
            : (result.correct ? (question.points ?? 10) : 0)
          onAnswer(result.correct, pts)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export const LiveRoomPage: React.FC<Props> = ({ games, onBack }) => {
  const { user } = useAuth()
  const playerName = user?.username ?? `Guest_${MY_PLAYER_ID.slice(-4)}`
  const avatar     = useRef(AVATARS[Math.floor(Math.random() * AVATARS.length)]).current
  const mySocketId = useRef<string>("")

  // ── Lobby state ──────────────────────────────────────────────────────────
  const [connected,    setConnected]    = useState(false)
  const [players,      setPlayers]      = useState<LivePlayer[]>([])
  const [sessions,     setSessions]     = useState<LiveSession[]>([])
  const [showHost,     setShowHost]     = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput,    setChatInput]    = useState("")
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // ── Live game state ──────────────────────────────────────────────────────
  type Phase = "lobby" | "waiting" | "playing" | "results"
  const [phase,             setPhase]             = useState<Phase>("lobby")
  const [mySession,         setMySession]         = useState<LiveGameSession | null>(null)
  const [isHost,            setIsHost]            = useState(false)
  const [waitingPlayers,    setWaitingPlayers]    = useState<{socketId:string;name:string}[]>([])
  const [joinTimerSecs,     setJoinTimerSecs]     = useState(180)
  const [gameCountdown,     setGameCountdown]     = useState<number | null>(null)
  const [currentQuestion,   setCurrentQuestion]   = useState(0)
  const [answered,          setAnswered]          = useState(false)
  const [allDone,           setAllDone]           = useState(false)        // I've answered all questions
  const [questionTimeLeft,  setQuestionTimeLeft]  = useState(30)           // per-question countdown
  const [questionTimeLimit, setQuestionTimeLimit] = useState(30)           // set from server on start
  const [donePlayers,       setDonePlayers]       = useState<{id:string;name:string}[]>([])  // finished players
  const [leaderboard,       setLeaderboard]       = useState<LeaderboardEntry[]>([])
  const [finalLeaderboard,  setFinalLeaderboard]  = useState<LeaderboardEntry[]>([])
  const [mySessionId,       setMySessionId]       = useState<string | null>(null)
  // Ref so handleAnswer callback always reads the latest question index
  const currentQuestionRef = useRef(0)

  // ticker for "X min ago" labels
  const [ticker, setTicker] = useState(0)
  useEffect(() => { const t = setInterval(() => setTicker(n => n+1), 15000); return () => clearInterval(t) }, [])
  void ticker

  const notify = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }, [])

  // Current game config (looked up by gameId once game starts)
  const activeGameConfig = useMemo(
    () => mySession ? games.find(g => g.id === mySession.gameId) ?? null : null,
    [mySession, games]
  )

  // ── Socket lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    connectSocket()
    const socket = getSocket()
    mySocketId.current = socket.id ?? ""

    // ── Lobby events ──
    const onConnect = () => {
      setConnected(true)
      mySocketId.current = socket.id ?? ""
      socket.emit("lobby:enter", { playerName, avatar })
    }
    const onDisconnect = () => setConnected(false)

    const onState = ({ players: ps, sessions: ss, chatHistory }: { players: LivePlayer[], sessions: LiveSession[], chatHistory?: ChatMessage[] }) => {
      setPlayers(ps)
      setSessions(ss)
      if (chatHistory?.length) setChatMessages(chatHistory)
    }
    const onChatMessage = (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg])
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    }
    const onPlayerJoined = ({ player }: { player: LivePlayer }) => {
      setPlayers(prev => prev.some(p => p.id === player.id) ? prev : [...prev, player])
      notify(`${player.avatar} ${player.name} joined the room`)
    }
    const onPlayerLeft = ({ playerId }: { playerId: string }) => {
      setPlayers(prev => prev.filter(p => p.id !== playerId))
    }
    const onSessionOpened  = ({ session }: { session: LiveSession }) => {
      setSessions(prev => [session, ...prev])
      notify(`🎮 ${session.hostName} opened "${session.gameTitle}"`)
    }
    const onSessionClosed  = ({ sessionId }: { sessionId: string }) => {
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    }
    const onSessionUpdated = ({ session }: { session: LiveSession }) => {
      setSessions(prev => prev.map(s => s.id === session.id ? session : s))
    }

    // ── Live game events ──
    const onGameJoined = ({ session, isHost: host }: { session: LiveGameSession; isHost: boolean }) => {
      setMySession(session)
      setMySessionId(session.id)
      setIsHost(host)
      setWaitingPlayers(session.players)
      setJoinTimerSecs(Math.max(0, Math.floor((session.joinDeadline - Date.now()) / 1000)))
      setPhase("waiting")
    }
    const onGameTimer = ({ secondsLeft }: { sessionId: string; secondsLeft: number }) => {
      setJoinTimerSecs(Math.max(0, secondsLeft))
    }
    const onPlayerUpdate = ({ players: ps }: { sessionId: string; players: {socketId:string;name:string}[] }) => {
      setWaitingPlayers(ps)
    }
    const onGameCountdown = ({ seconds }: { sessionId: string; seconds: number }) => {
      setGameCountdown(seconds)
    }
    const onGameStart = ({ gameId, gameTitle, questionCount, players: ps, questionTimeLimit: qtl }: {
      sessionId: string; gameId: string; gameTitle: string; questionCount: number
      players: {socketId:string;name:string}[]; questionTimeLimit?: number
    }) => {
      const tl = qtl ?? 30
      setMySession(prev => prev ? { ...prev, gameId, gameTitle, questionCount } : prev)
      setWaitingPlayers(ps)
      setCurrentQuestion(0)
      currentQuestionRef.current = 0
      setAnswered(false)
      setAllDone(false)
      setDonePlayers([])
      setQuestionTimeLimit(tl)
      setQuestionTimeLeft(tl)
      setLeaderboard([])
      setGameCountdown(null)
      setPhase("playing")
      notify(`🚀 ${gameTitle} — GO!`)
    }
    const onGamePlayerDone = ({ playerId, name }: { sessionId: string; playerId: string; name: string }) => {
      setDonePlayers(prev => prev.some(p => p.id === playerId) ? prev : [...prev, { id: playerId, name }])
    }
    const onGameScore = ({ leaderboard: lb }: { sessionId: string; leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(lb)
    }
    const onGameEnd = ({ leaderboard: lb, hostLeft }: { sessionId: string; leaderboard: LeaderboardEntry[]; hostLeft?: boolean }) => {
      setFinalLeaderboard(lb)
      setPhase("results")
      if (hostLeft) notify("🚪 Host left — game ended")
      else notify("🏁 Game over!")
    }

    socket.on("connect",                  onConnect)
    socket.on("disconnect",               onDisconnect)
    socket.on("lobby:state",              onState)
    socket.on("lobby:player:joined",      onPlayerJoined)
    socket.on("lobby:player:left",        onPlayerLeft)
    socket.on("lobby:session:opened",     onSessionOpened)
    socket.on("lobby:session:closed",     onSessionClosed)
    socket.on("lobby:session:updated",    onSessionUpdated)
    socket.on("lobby:chat:message",       onChatMessage)
    socket.on("lobby:game:joined",        onGameJoined)
    socket.on("lobby:game:timer",         onGameTimer)
    socket.on("lobby:game:player_update", onPlayerUpdate)
    socket.on("lobby:game:countdown",     onGameCountdown)
    socket.on("lobby:game:start",         onGameStart)
    socket.on("lobby:game:player_done",   onGamePlayerDone)
    socket.on("lobby:game:score",         onGameScore)
    socket.on("lobby:game:end",           onGameEnd)

    if (socket.connected) onConnect()

    return () => {
      socket.emit("lobby:leave")
      socket.off("connect",                  onConnect)
      socket.off("disconnect",               onDisconnect)
      socket.off("lobby:state",              onState)
      socket.off("lobby:player:joined",      onPlayerJoined)
      socket.off("lobby:player:left",        onPlayerLeft)
      socket.off("lobby:session:opened",     onSessionOpened)
      socket.off("lobby:session:closed",     onSessionClosed)
      socket.off("lobby:session:updated",    onSessionUpdated)
      socket.off("lobby:chat:message",       onChatMessage)
      socket.off("lobby:game:joined",        onGameJoined)
      socket.off("lobby:game:timer",         onGameTimer)
      socket.off("lobby:game:player_update", onPlayerUpdate)
      socket.off("lobby:game:countdown",     onGameCountdown)
      socket.off("lobby:game:start",         onGameStart)
      socket.off("lobby:game:player_done",   onGamePlayerDone)
      socket.off("lobby:game:score",         onGameScore)
      socket.off("lobby:game:end",           onGameEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName])

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleHost = useCallback((gameId: string, gameTitle: string, gameEmoji: string, max: number, questionCount: number) => {
    setShowHost(false)
    getSocket().emit("lobby:session:create", { playerName, gameId, gameTitle, gameEmoji, maxPlayers: max, questionCount })
  }, [playerName])

  const handleJoin = useCallback((session: LiveSession) => {
    getSocket().emit("lobby:session:join", { sessionId: session.id, playerName })
  }, [playerName])

  const handleEarlyStart = useCallback(() => {
    if (!mySessionId) return
    getSocket().emit("lobby:game:early_start", { sessionId: mySessionId })
  }, [mySessionId])

  const handleAnswer = useCallback((correct: boolean, points: number) => {
    if (!mySessionId || answered || allDone) return
    const qIdx = currentQuestionRef.current
    setAnswered(true)
    getSocket().emit("lobby:game:answer", { sessionId: mySessionId, correct, points, questionIndex: qIdx })

    // Auto-advance to next question after brief feedback delay
    setTimeout(() => {
      const total = mySession?.questionCount ?? 0
      const next = qIdx + 1
      if (next < total) {
        currentQuestionRef.current = next
        setCurrentQuestion(next)
        setAnswered(false)
        setQuestionTimeLeft(questionTimeLimit)
      } else {
        // Finished all questions — show "waiting for others" overlay
        setAllDone(true)
      }
    }, 1500)
  }, [mySessionId, answered, allDone, mySession?.questionCount, questionTimeLimit])

  // Per-question countdown timer — auto-submits when it hits 0
  useEffect(() => {
    if (phase !== "playing" || answered || allDone) return
    if (questionTimeLeft <= 0) {
      handleAnswer(false, 0)  // time's up → auto-submit unanswered
      return
    }
    const t = setTimeout(() => setQuestionTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, answered, allDone, questionTimeLeft, handleAnswer])

  // Reset question timer whenever question index changes
  useEffect(() => {
    if (phase === "playing") setQuestionTimeLeft(questionTimeLimit)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, phase])

  const handleSendChat = useCallback(() => {
    const msg = chatInput.trim()
    if (!msg) return
    getSocket().emit("lobby:chat", { message: msg })
    setChatInput("")
  }, [chatInput])

  const handleReturnToLobby = useCallback(() => {
    setPhase("lobby")
    setMySession(null)
    setMySessionId(null)
    setIsHost(false)
    setWaitingPlayers([])
    setLeaderboard([])
    setFinalLeaderboard([])
    setGameCountdown(null)
    setCurrentQuestion(0)
    currentQuestionRef.current = 0
    setAnswered(false)
    setAllDone(false)
    setDonePlayers([])
    setQuestionTimeLeft(30)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  // ── WAITING PHASE ──────────────────────────────────────────────────────
  if (phase === "waiting" && mySession) {
    const isCountingDown = gameCountdown !== null

    return (
      <div className="page-wrap">
        {notification && <Toast msg={notification} />}
        <div className="page-header">
          <button className="back-btn" onClick={handleReturnToLobby}>← Back</button>
          <div style={{flex:1}}>
            <h1 className="page-title">{mySession.gameEmoji} {mySession.gameTitle}</h1>
            <p style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.72rem",color:"rgba(232,224,255,0.35)",margin:0}}>
              {isCountingDown ? `🚀 Starting in ${gameCountdown}…` : "Waiting room — game starts when timer ends or host starts early"}
            </p>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"18px",marginTop:"8px"}}>
          {/* Timer card */}
          <div style={{
            borderRadius:"16px",padding:"28px",textAlign:"center",
            background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",
          }}>
            {isCountingDown ? (
              <>
                <div style={{fontFamily:"Orbitron,sans-serif",fontSize:"5rem",color:"#A855F7",lineHeight:1}}>
                  {gameCountdown}
                </div>
                <div style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.85rem",color:"rgba(232,224,255,0.5)",marginTop:"8px"}}>
                  Get ready!
                </div>
              </>
            ) : (
              <>
                <div style={{fontFamily:"Orbitron,sans-serif",fontSize:"3.5rem",color:joinTimerSecs < 30 ? "#FF6090" : "#22FFAA",lineHeight:1}}>
                  {fmtTime(joinTimerSecs)}
                </div>
                <div style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.78rem",color:"rgba(232,224,255,0.4)",marginTop:"8px"}}>
                  Join window remaining
                </div>
                {isHost && (
                  <button onClick={handleEarlyStart} style={{
                    marginTop:"16px",padding:"10px 24px",borderRadius:"10px",cursor:"pointer",
                    background:"linear-gradient(135deg,#A855F7,#6366F1)",border:"none",
                    color:"#fff",fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.82rem",
                  }}>
                    ▶ Start Now
                  </button>
                )}
              </>
            )}
          </div>

          {/* Players waiting */}
          <div style={{borderRadius:"16px",border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)",fontFamily:"Orbitron,sans-serif",fontSize:"0.68rem",color:"rgba(232,224,255,0.4)",letterSpacing:"0.15em",display:"flex",justifyContent:"space-between"}}>
              PLAYERS WAITING
              <span style={{background:"rgba(34,255,170,0.12)",border:"1px solid rgba(34,255,170,0.25)",borderRadius:"99px",padding:"1px 8px",color:"#22FFAA",fontSize:"0.65rem"}}>
                {waitingPlayers.length}
              </span>
            </div>
            <div style={{padding:"8px",display:"flex",flexDirection:"column",gap:"2px",maxHeight:"240px",overflowY:"auto"}}>
              {waitingPlayers.map((p, i) => (
                <div key={p.socketId} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",borderRadius:"8px",background: p.socketId===getSocket().id?"rgba(168,85,247,0.1)":"transparent"}}>
                  <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Orbitron,sans-serif",fontSize:"0.72rem",color:"#A855F7",fontWeight:700,flexShrink:0}}>
                    {i+1}
                  </div>
                  <span style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.82rem",color: p.socketId===mySession.hostId?"#A855F7":"#E8E0FF",fontWeight:p.socketId===mySession.hostId?700:400}}>
                    {p.name}
                    {p.socketId === mySession.hostId && <span style={{fontSize:"0.65rem",opacity:0.6}}> (host)</span>}
                    {p.socketId === getSocket().id   && <span style={{fontSize:"0.65rem",opacity:0.6}}> (you)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PLAYING PHASE ──────────────────────────────────────────────────────
  if (phase === "playing" && mySession && activeGameConfig) {
    const questionCount   = mySession.questionCount
    const timerPct        = (questionTimeLeft / questionTimeLimit) * 100
    const timerColor      = questionTimeLeft <= 5 ? "#FF6090" : questionTimeLeft <= 10 ? "#FFD700" : "#22FFAA"
    const myEntry         = leaderboard.find(e => e.socketId === getSocket().id)
    const myPoints        = myEntry?.points ?? 0

    return (
      <div className="page-wrap">
        {notification && <Toast msg={notification} />}

        {/* "All Done — Waiting for Others" full-screen overlay */}
        {allDone && (
          <div style={{
            position:"fixed",inset:0,zIndex:500,
            background:"rgba(6,4,20,0.92)",backdropFilter:"blur(14px)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"20px",
          }}>
            <div style={{fontSize:"3.5rem"}}>⏳</div>
            <h2 style={{fontFamily:"Orbitron,sans-serif",color:"#22FFAA",fontSize:"1.3rem",margin:0}}>
              You finished! Waiting for others…
            </h2>
            <p style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.85rem",color:"rgba(232,224,255,0.45)",margin:0}}>
              Your score: <strong style={{color:"#A855F7"}}>{myPoints} pts</strong>
            </p>
            {/* Done players */}
            {donePlayers.length > 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:"6px",maxWidth:"320px",width:"100%"}}>
                {donePlayers.map(p => (
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",borderRadius:"10px",background:"rgba(34,255,170,0.08)",border:"1px solid rgba(34,255,170,0.2)"}}>
                    <span style={{color:"#22FFAA"}}>✓</span>
                    <span style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.82rem",color:"#E8E0FF"}}>{p.name}</span>
                    <span style={{marginLeft:"auto",fontFamily:"Exo 2,sans-serif",fontSize:"0.68rem",color:"rgba(232,224,255,0.35)"}}>done</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.72rem",color:"rgba(232,224,255,0.25)",margin:0}}>
              Results appear automatically when everyone finishes or time runs out
            </p>
          </div>
        )}

        {/* Header */}
        <div className="page-header" style={{marginBottom:"8px"}}>
          <div style={{flex:1}}>
            <h1 className="page-title" style={{fontSize:"1rem"}}>
              {mySession.gameEmoji} {mySession.gameTitle}
            </h1>
          </div>
          {/* My progress chip */}
          <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
            <div style={{padding:"5px 12px",borderRadius:"8px",background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.25)",fontFamily:"Exo 2,sans-serif",fontSize:"0.75rem",color:"#A855F7",fontWeight:700}}>
              Q {currentQuestion + 1} / {questionCount}
            </div>
            <div style={{padding:"5px 12px",borderRadius:"8px",background:"rgba(34,255,170,0.08)",border:"1px solid rgba(34,255,170,0.2)",fontFamily:"Orbitron,sans-serif",fontSize:"0.75rem",color:"#22FFAA",fontWeight:700}}>
              {myPoints} pts
            </div>
          </div>
        </div>

        {/* Per-question timer bar */}
        <div style={{height:"4px",borderRadius:"99px",background:"rgba(255,255,255,0.06)",marginBottom:"12px",overflow:"hidden"}}>
          <div style={{
            height:"100%",borderRadius:"99px",
            width:`${timerPct}%`,
            background:`linear-gradient(90deg, ${timerColor}, ${timerColor}88)`,
            transition:"width 1s linear, background 0.5s",
          }} />
        </div>
        {/* Timer text */}
        <div style={{textAlign:"right",fontFamily:"Orbitron,sans-serif",fontSize:"0.7rem",color:timerColor,marginBottom:"12px",fontWeight:700}}>
          {questionTimeLeft}s
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 240px",gap:"16px",alignItems:"start"}}>
          {/* Question area — dimmed while advancing to next */}
          <div style={{
            borderRadius:"16px",border:"1px solid rgba(168,85,247,0.15)",
            background:"rgba(168,85,247,0.04)",padding:"20px",
            opacity: answered ? 0.5 : 1,
            transition:"opacity 0.3s",
            pointerEvents: answered ? "none" : "auto",
          }}>
            {answered && !allDone && (
              <div style={{textAlign:"center",padding:"10px 0 6px",fontFamily:"Exo 2,sans-serif",fontSize:"0.78rem",color:"#22FFAA",fontWeight:700}}>
                ✓ Answered — next question loading…
              </div>
            )}
            <LiveGameQuestion
              gameConfig={activeGameConfig}
              index={currentQuestion}
              sessionId={mySession.id}
              isAnswered={answered}
              onAnswer={handleAnswer}
            />
          </div>

          {/* Live scoreboard */}
          <div style={{borderRadius:"16px",border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)"}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)",fontFamily:"Orbitron,sans-serif",fontSize:"0.62rem",color:"rgba(232,224,255,0.4)",letterSpacing:"0.15em",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>LIVE SCORES</span>
              {donePlayers.length > 0 && (
                <span style={{background:"rgba(34,255,170,0.1)",border:"1px solid rgba(34,255,170,0.2)",borderRadius:"99px",padding:"1px 7px",color:"#22FFAA",fontSize:"0.6rem"}}>
                  {donePlayers.length}/{waitingPlayers.length} done
                </span>
              )}
            </div>
            <div style={{padding:"8px",display:"flex",flexDirection:"column",gap:"4px"}}>
              {(leaderboard.length ? leaderboard : waitingPlayers.map(p => ({socketId:p.socketId,name:p.name,points:0}))).map((entry, i) => {
                const isDone = donePlayers.some(p => p.id === entry.socketId)
                return (
                  <div key={entry.socketId} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",borderRadius:"8px",background: entry.socketId===getSocket().id?"rgba(168,85,247,0.1)":"transparent"}}>
                    <span style={{fontFamily:"Orbitron,sans-serif",fontSize:"0.68rem",color: i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"rgba(232,224,255,0.3)",width:"18px",textAlign:"center",flexShrink:0}}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                    </span>
                    <span style={{flex:1,fontFamily:"Exo 2,sans-serif",fontSize:"0.75rem",color:"#E8E0FF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {entry.name}
                      {isDone && <span style={{marginLeft:"4px",fontSize:"0.6rem",color:"#22FFAA"}}>✓</span>}
                    </span>
                    <span style={{fontFamily:"Orbitron,sans-serif",fontSize:"0.75rem",color:"#A855F7",fontWeight:700,flexShrink:0}}>
                      {entry.points}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── RESULTS PHASE ──────────────────────────────────────────────────────
  if (phase === "results") {
    const winner = finalLeaderboard[0]
    const isWinner = winner?.socketId === getSocket().id

    return (
      <div className="page-wrap" style={{textAlign:"center"}}>
        {notification && <Toast msg={notification} />}
        <div style={{padding:"40px 20px"}}>
          <div style={{fontSize:"4rem",marginBottom:"16px"}}>{isWinner ? "🏆" : "🎯"}</div>
          <h1 style={{fontFamily:"Orbitron,sans-serif",color:"#E8E0FF",fontSize:"1.6rem",marginBottom:"8px"}}>
            {isWinner ? "You Won!" : winner ? `${winner.name} Wins!` : "Game Over!"}
          </h1>
          <p style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.82rem",color:"rgba(232,224,255,0.4)",marginBottom:"32px"}}>
            {mySession?.gameTitle} — Final Standings
          </p>

          <div style={{maxWidth:"400px",margin:"0 auto 32px",display:"flex",flexDirection:"column",gap:"8px"}}>
            {finalLeaderboard.map((entry, i) => (
              <div key={entry.socketId} style={{
                display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",
                borderRadius:"12px",
                background: i===0?"rgba(255,215,0,0.08)":entry.socketId===getSocket().id?"rgba(168,85,247,0.08)":"rgba(255,255,255,0.03)",
                border: i===0?"1px solid rgba(255,215,0,0.25)":entry.socketId===getSocket().id?"1px solid rgba(168,85,247,0.25)":"1px solid rgba(255,255,255,0.07)",
              }}>
                <span style={{fontFamily:"Orbitron,sans-serif",fontSize:"1.2rem",width:"32px",textAlign:"center",flexShrink:0}}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                </span>
                <span style={{flex:1,fontFamily:"Exo 2,sans-serif",fontWeight:700,color: i===0?"#FFD700":"#E8E0FF",textAlign:"left"}}>
                  {entry.name}
                  {entry.socketId === getSocket().id && <span style={{fontSize:"0.65rem",opacity:0.6,marginLeft:"6px"}}>(you)</span>}
                </span>
                <span style={{fontFamily:"Orbitron,sans-serif",fontSize:"0.9rem",color:"#A855F7",fontWeight:700}}>
                  {entry.points} pts
                </span>
              </div>
            ))}
          </div>

          <button onClick={handleReturnToLobby} style={{
            padding:"12px 32px",borderRadius:"12px",cursor:"pointer",
            background:"linear-gradient(135deg,#A855F7,#6366F1)",border:"none",
            color:"#fff",fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.9rem",
          }}>
            ← Back to Live Room
          </button>
        </div>
      </div>
    )
  }

  // ── LOBBY PHASE (default) ──────────────────────────────────────────────
  return (
    <div className="page-wrap">
      {notification && <Toast msg={notification} />}

      {/* Header */}
      <div className="page-header" style={{flexWrap:"wrap",gap:"10px"}}>
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div style={{flex:1}}>
          <h1 className="page-title" style={{display:"flex",alignItems:"center",gap:"10px"}}>
            🌐 Live Room
            <span style={{
              display:"inline-flex",alignItems:"center",gap:"5px",padding:"3px 10px",
              borderRadius:"99px",fontSize:"0.68rem",fontFamily:"Exo 2,sans-serif",fontWeight:700,
              background: connected?"rgba(34,255,170,0.12)":"rgba(255,255,255,0.06)",
              border: connected?"1px solid rgba(34,255,170,0.35)":"1px solid rgba(255,255,255,0.1)",
              color: connected?"#22FFAA":"rgba(232,224,255,0.3)",
            }}>
              <span style={{width:"7px",height:"7px",borderRadius:"50%",flexShrink:0,background:connected?"#22FFAA":"#555",animation:connected?"pulse 1.5s infinite":"none"}} />
              {connected ? `${players.length} online` : "Connecting…"}
            </span>
          </h1>
          <p style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.72rem",color:"rgba(232,224,255,0.35)",margin:0}}>
            See who's playing live · Host or join a public game session
          </p>
        </div>
        <button onClick={() => setShowHost(true)} style={{
          padding:"9px 18px",borderRadius:"10px",cursor:"pointer",
          background:"linear-gradient(135deg,#A855F7,#6366F1)",border:"none",
          color:"#fff",fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.8rem",
          display:"flex",alignItems:"center",gap:"6px",flexShrink:0,
        }}>
          + Host a Game
        </button>
      </div>

      {/* Body */}
      <div style={{display:"grid",gridTemplateColumns:"clamp(200px,30%,280px) 1fr",gap:"18px",alignItems:"start"}}>

        {/* Left: Who's Online */}
        <div style={{borderRadius:"16px",overflow:"hidden",border:"1px solid rgba(168,85,247,0.15)",background:"rgba(168,85,247,0.04)"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(168,85,247,0.12)",fontFamily:"Orbitron,sans-serif",fontSize:"0.7rem",color:"rgba(232,224,255,0.45)",letterSpacing:"0.15em",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            WHO'S ONLINE
            <span style={{background:"rgba(34,255,170,0.12)",border:"1px solid rgba(34,255,170,0.25)",borderRadius:"99px",padding:"1px 8px",color:"#22FFAA",fontSize:"0.65rem"}}>
              {players.length}
            </span>
          </div>
          <div style={{padding:"8px",display:"flex",flexDirection:"column",gap:"2px",maxHeight:"calc(100vh - 280px)",overflowY:"auto"}}>
            {players.length === 0 ? (
              <div style={{padding:"20px",textAlign:"center",fontFamily:"Exo 2,sans-serif",fontSize:"0.78rem",color:"rgba(232,224,255,0.2)"}}>
                {connected ? "You're the first one here!" : "Connecting…"}
              </div>
            ) : players.map(p => {
              const isMe = p.id === getSocket().id
              return (
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",borderRadius:"8px",background:isMe?"rgba(168,85,247,0.1)":"transparent"}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <div style={{width:"32px",height:"32px",borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>
                      {p.avatar}
                    </div>
                    <span style={{position:"absolute",bottom:0,right:0,width:"9px",height:"9px",borderRadius:"50%",background:"#22FFAA",border:"1.5px solid #0A0A0F"}} />
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"Exo 2,sans-serif",fontWeight:isMe?700:500,fontSize:"0.8rem",color:isMe?"#C084FC":"#E8E0FF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {p.name} {isMe && <span style={{fontSize:"0.6rem",opacity:0.6}}>(you)</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Open Sessions */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
            <h2 style={{fontFamily:"Orbitron,sans-serif",fontSize:"0.78rem",color:"rgba(232,224,255,0.5)",letterSpacing:"0.15em",margin:0}}>
              OPEN SESSIONS
              {sessions.length > 0 && <span style={{marginLeft:"8px",color:"#A855F7"}}>{sessions.length}</span>}
            </h2>
          </div>
          {sessions.length === 0 ? (
            <div style={{padding:"48px 32px",borderRadius:"16px",textAlign:"center",border:"1px dashed rgba(168,85,247,0.2)",background:"rgba(168,85,247,0.03)"}}>
              <div style={{fontSize:"2.5rem",marginBottom:"12px"}}>🎮</div>
              <div style={{fontFamily:"Orbitron,sans-serif",fontSize:"0.82rem",color:"rgba(232,224,255,0.4)",marginBottom:"8px"}}>No open sessions yet</div>
              <div style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.75rem",color:"rgba(232,224,255,0.25)",marginBottom:"20px"}}>Be the first to host a game — anyone can join!</div>
              <button onClick={() => setShowHost(true)} style={{padding:"10px 22px",borderRadius:"10px",cursor:"pointer",background:"linear-gradient(135deg,#A855F7,#6366F1)",border:"none",color:"#fff",fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.82rem"}}>
                + Host the First Game
              </button>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:"12px"}}>
              {sessions.map(session => {
                const isFull = session.playerCount >= session.maxPlayers
                return (
                  <div key={session.id} style={{borderRadius:"14px",padding:"18px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",transition:"all 0.2s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                      <span style={{fontSize:"1.8rem",flexShrink:0}}>{session.gameEmoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"Exo 2,sans-serif",fontWeight:700,color:"#E8E0FF",fontSize:"0.88rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {session.gameTitle}
                        </div>
                        <div style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.7rem",color:"rgba(232,224,255,0.38)",marginTop:"2px"}}>
                          hosted by <strong style={{color:"rgba(168,85,247,0.8)"}}>{session.hostName}</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{marginBottom:"12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                        <span style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.7rem",color:"rgba(232,224,255,0.4)"}}>Players</span>
                        <span style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.7rem",fontWeight:700,color:isFull?"#FF6090":"#22FFAA"}}>
                          {session.playerCount} / {session.maxPlayers}
                        </span>
                      </div>
                      <div style={{height:"5px",borderRadius:"99px",background:"rgba(255,255,255,0.07)",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:"99px",transition:"width 0.4s",width:`${(session.playerCount/session.maxPlayers)*100}%`,background:isFull?"linear-gradient(90deg,#FF6090,#FF2D78)":"linear-gradient(90deg,#22FFAA,#00D4FF)"}} />
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontFamily:"Exo 2,sans-serif",fontSize:"0.68rem",color:"rgba(232,224,255,0.28)"}}>🕐 {timeAgo(session.createdAt)}</span>
                      <button onClick={() => handleJoin(session)} disabled={isFull} style={{
                        padding:"7px 18px",borderRadius:"8px",cursor:isFull?"not-allowed":"pointer",
                        background:isFull?"rgba(255,255,255,0.04)":"linear-gradient(135deg,#A855F7,#6366F1)",
                        border:isFull?"1px solid rgba(255,255,255,0.08)":"none",
                        color:isFull?"rgba(232,224,255,0.25)":"#fff",
                        fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.78rem",
                      }}>
                        {isFull ? "Full" : "Join →"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Community Chat */}
      <div style={{marginTop:"18px",borderRadius:"16px",overflow:"hidden",border:"1px solid rgba(0,212,255,0.15)",background:"rgba(0,212,255,0.03)"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(0,212,255,0.1)",fontFamily:"Orbitron,sans-serif",fontSize:"0.7rem",color:"rgba(232,224,255,0.45)",letterSpacing:"0.15em",display:"flex",alignItems:"center",gap:"8px"}}>
          💬 COMMUNITY CHAT
          <span style={{fontSize:"0.6rem",color:"rgba(232,224,255,0.25)",fontFamily:"Exo 2,sans-serif",letterSpacing:0,fontWeight:400}}>— all online players can see this</span>
        </div>
        <div style={{padding:"10px 12px",maxHeight:"220px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"}}>
          {chatMessages.length === 0 ? (
            <div style={{padding:"20px",textAlign:"center",fontFamily:"Exo 2,sans-serif",fontSize:"0.75rem",color:"rgba(232,224,255,0.2)"}}>No messages yet — say hi! 👋</div>
          ) : chatMessages.map((m, i) => {
            const isMe = m.playerId === getSocket().id
            return (
              <div key={i} style={{display:"flex",gap:"8px",alignItems:"flex-start",flexDirection:isMe?"row-reverse":"row"}}>
                <span style={{fontSize:"1.1rem",flexShrink:0,marginTop:"1px"}}>{m.avatar}</span>
                <div style={{maxWidth:"72%"}}>
                  <div style={{fontSize:"0.62rem",color:"rgba(232,224,255,0.35)",fontFamily:"Exo 2,sans-serif",marginBottom:"2px",textAlign:isMe?"right":"left"}}>
                    {isMe ? "You" : m.playerName}
                  </div>
                  <div style={{padding:"7px 12px",borderRadius:isMe?"12px 4px 12px 12px":"4px 12px 12px 12px",background:isMe?"rgba(168,85,247,0.18)":"rgba(255,255,255,0.06)",border:isMe?"1px solid rgba(168,85,247,0.3)":"1px solid rgba(255,255,255,0.08)",color:"#E8E0FF",fontFamily:"Exo 2,sans-serif",fontSize:"0.82rem",wordBreak:"break-word"}}>
                    {m.message}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={chatBottomRef} />
        </div>
        <div style={{padding:"10px 12px",borderTop:"1px solid rgba(0,212,255,0.08)",display:"flex",gap:"8px"}}>
          <input
            value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSendChat()}
            placeholder={connected ? "Type a message… (Enter to send)" : "Connect to chat…"}
            disabled={!connected} maxLength={300}
            style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"8px",padding:"8px 12px",color:"#E8E0FF",fontFamily:"Exo 2,sans-serif",fontSize:"0.82rem",outline:"none"}}
          />
          <button onClick={handleSendChat} disabled={!connected || !chatInput.trim()} style={{
            padding:"8px 16px",borderRadius:"8px",cursor:"pointer",
            background:chatInput.trim()?"linear-gradient(135deg,#00D4FF,#A855F7)":"rgba(255,255,255,0.04)",
            border:"none",color:chatInput.trim()?"#fff":"rgba(232,224,255,0.2)",
            fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.8rem",transition:"all 0.15s",
          }}>
            Send
          </button>
        </div>
      </div>

      {showHost && (
        <HostModal games={games} playerName={playerName} onHost={handleHost} onClose={() => setShowHost(false)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast helper
// ─────────────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{
    position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",
    zIndex:3000,padding:"10px 20px",borderRadius:"99px",
    background:"rgba(168,85,247,0.18)",backdropFilter:"blur(12px)",
    border:"1px solid rgba(168,85,247,0.35)",color:"#C084FC",
    fontFamily:"Exo 2,sans-serif",fontWeight:700,fontSize:"0.8rem",
    animation:"slideDown 0.3s ease",whiteSpace:"nowrap",
  }}>
    {msg}
  </div>
)
