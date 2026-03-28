// ─────────────────────────────────────────────────────────────────────────────
// MultiplayerPage.tsx
// Full multiplayer lobby + in-game view.
// Phases: idle → connecting → lobby → countdown → playing → ended
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react"
import { useMultiplayerRoom }          from "../hooks/useMultiplayerRoom"
import { GameRenderer }                from "../components/GameRenderer"
import type { GameConfig }             from "../types/engine.types"

interface Props {
  games:  GameConfig[]
  onBack: () => void
}

// ── Small reusable components ─────────────────────────────────────────────────

const GlassCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background:    "rgba(10, 8, 30, 0.75)",
    backdropFilter: "blur(20px)",
    border:        "1px solid rgba(168,85,247,0.3)",
    borderRadius:  "18px",
    padding:       "28px 32px",
    ...style,
  }}>
    {children}
  </div>
)

const PrimaryBtn: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode; color?: string }> =
  ({ onClick, disabled, children, color = "#A855F7" }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background:   disabled ? "rgba(168,85,247,0.15)" : `linear-gradient(135deg,${color},#3B82F6)`,
        border:       "none",
        borderRadius: "10px",
        color:        disabled ? "rgba(232,224,255,0.35)" : "#fff",
        cursor:       disabled ? "not-allowed" : "pointer",
        fontFamily:   "Orbitron, monospace",
        fontSize:     "0.82rem",
        padding:      "11px 26px",
        fontWeight:   700,
        letterSpacing: "0.05em",
        transition:   "opacity 0.2s, transform 0.1s",
      }}
    >
      {children}
    </button>
  )

const Input: React.FC<{
  value: string; onChange: (v: string) => void; placeholder: string;
  maxLength?: number; style?: React.CSSProperties
}> = ({ value, onChange, placeholder, maxLength, style }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    style={{
      background:   "rgba(168,85,247,0.08)",
      border:       "1px solid rgba(168,85,247,0.3)",
      borderRadius: "10px",
      color:        "#E8E0FF",
      fontFamily:   "Exo 2, sans-serif",
      fontSize:     "0.92rem",
      padding:      "10px 14px",
      outline:      "none",
      width:        "100%",
      boxSizing:    "border-box",
      ...style,
    }}
  />
)

// ── Phase: Idle (Entry Screen) ────────────────────────────────────────────────

const IdleScreen: React.FC<{
  onConnect: () => void
  onBack: () => void
}> = ({ onConnect, onBack }) => (
  <div style={{ maxWidth: "520px", margin: "0 auto", paddingTop: "40px" }}>
    <button onClick={onBack} style={{ background: "transparent", border: "none",
      color: "rgba(232,224,255,0.45)", cursor: "pointer", fontSize: "0.82rem",
      marginBottom: "24px", display: "flex", alignItems: "center", gap: "6px" }}>
      ← Back to library
    </button>

    <GlassCard>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>🌐</div>
        <h2 style={{ fontFamily: "Orbitron, monospace", color: "#A855F7", fontSize: "1.4rem", margin: 0 }}>
          Multiplayer Rooms
        </h2>
        <p style={{ color: "rgba(232,224,255,0.45)", fontSize: "0.82rem", marginTop: "8px" }}>
          Create a room or join a friend's code · Up to 8 players · Real-time scoring
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {[
          { icon: "🎯", text: "Any game type supported — quiz, memory, TapBlitz, and more" },
          { icon: "⚡", text: "All players answer the same question simultaneously" },
          { icon: "🏆", text: "Live leaderboard updates after every answer" },
          { icon: "🔑", text: "Share a 6-character room code to let friends join" },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: "12px",
            fontSize: "0.84rem", color: "rgba(232,224,255,0.6)" }}>
            <span style={{ fontSize: "1.2rem" }}>{icon}</span> {text}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "28px" }}>
        <PrimaryBtn onClick={onConnect}>
          Connect to Multiplayer
        </PrimaryBtn>
      </div>
    </GlassCard>
  </div>
)

// ── Phase: Connecting ─────────────────────────────────────────────────────────

const ConnectingScreen: React.FC = () => (
  <div style={{ textAlign: "center", paddingTop: "80px" }}>
    <div style={{ fontSize: "2.5rem", animation: "spin 1s linear infinite", display: "inline-block" }}>⚡</div>
    <p style={{ fontFamily: "Orbitron, monospace", color: "#00D4FF", marginTop: "16px" }}>Connecting…</p>
  </div>
)

// ── Phase: Lobby (join/create form + player list) ─────────────────────────────

const LobbyEntryForm: React.FC<{
  onCreate: (name: string) => void
  onJoin:   (code: string, name: string) => void
  error:    string | null
  onClearError: () => void
}> = ({ onCreate, onJoin, error, onClearError }) => {
  const [name, setName]       = useState("")
  const [code, setCode]       = useState("")
  const [tab,  setTab]        = useState<"create" | "join">("create")

  const handleCreate = () => { if (name.trim()) onCreate(name.trim()) }
  const handleJoin   = () => { if (name.trim() && code.trim().length === 6) onJoin(code, name.trim()) }

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", paddingTop: "40px" }}>
      <GlassCard>
        <h2 style={{ fontFamily: "Orbitron, monospace", color: "#A855F7",
          fontSize: "1.2rem", margin: "0 0 20px" }}>
          🌐 Join the Battle
        </h2>

        {error && (
          <div onClick={onClearError} style={{ background: "rgba(255,45,120,0.1)",
            border: "1px solid rgba(255,45,120,0.4)", borderRadius: "8px",
            padding: "10px 14px", fontSize: "0.82rem", color: "#FF2D78",
            marginBottom: "16px", cursor: "pointer" }}>
            ⚠ {error} (click to dismiss)
          </div>
        )}

        <div style={{ display: "flex", marginBottom: "20px", borderBottom: "1px solid rgba(168,85,247,0.2)" }}>
          {(["create", "join"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "transparent", border: "none",
              borderBottom: tab === t ? "2px solid #A855F7" : "2px solid transparent",
              color:        tab === t ? "#A855F7" : "rgba(232,224,255,0.4)",
              cursor: "pointer", fontFamily: "Orbitron, monospace",
              fontSize: "0.78rem", padding: "8px 16px", marginBottom: "-1px",
            }}>
              {t === "create" ? "Create Room" : "Join Room"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Input value={name} onChange={setName} placeholder="Your name" maxLength={20} />

          {tab === "join" && (
            <Input value={code} onChange={v => setCode(v.toUpperCase())}
              placeholder="6-char room code (e.g. XKT9Q2)" maxLength={6}
              style={{ fontFamily: "Orbitron, monospace", letterSpacing: "0.2em", textAlign: "center" }} />
          )}

          <PrimaryBtn
            onClick={tab === "create" ? handleCreate : handleJoin}
            disabled={!name.trim() || (tab === "join" && code.trim().length !== 6)}
          >
            {tab === "create" ? "Create Room →" : "Join Room →"}
          </PrimaryBtn>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Phase: Lobby Room (after joining) ─────────────────────────────────────────

const LobbyRoom: React.FC<{
  room:         import("../hooks/useMultiplayerRoom").RoomState
  isHost:       boolean
  myPlayerId:   string
  games:        GameConfig[]
  onSelectGame: (gameId: string, gameTitle: string, questionCount: number) => void
  onReady:      (ready: boolean) => void
  onStart:      () => void
  onLeave:      () => void
  error:        string | null
  onClearError: () => void
  notification: string | null
}> = ({ room, isHost, myPlayerId, games, onSelectGame, onReady, onStart, onLeave, error, onClearError, notification }) => {
  // Identify "me" by persistent playerId (survives socket reconnects)
  const me = room.players.find(p => p.playerId === myPlayerId)

  // canStart: all non-host connected players must be ready
  // (host is auto-marked ready on the server, but we double-check here too)
  const connected       = room.players.filter(p => !p.disconnected)
  const nonHostConn     = connected.filter(p => p.playerId !== room.hostPlayerId)
  const allNonHostReady = nonHostConn.length === 0 || nonHostConn.every(p => p.ready)
  const canStart        = isHost && allNonHostReady && !!room.gameId && connected.length >= 1

  // Why can't we start yet?
  const startBlockReason = !room.gameId
    ? "Select a game above first"
    : !allNonHostReady
    ? `Waiting for ${nonHostConn.filter(p => !p.ready).map(p => p.name).join(", ")} to ready up`
    : null

  return (
    <div style={{ maxWidth: "660px", margin: "0 auto", paddingTop: "24px" }}>
      {/* Toast notification */}
      {notification && (
        <div style={{ background: "rgba(34,255,170,0.1)", border: "1px solid rgba(34,255,170,0.3)",
          borderRadius: "8px", padding: "9px 14px", fontSize: "0.82rem", color: "#22FFAA",
          marginBottom: "12px", textAlign: "center", fontFamily: "Exo 2, sans-serif" }}>
          {notification}
        </div>
      )}
      {error && (
        <div onClick={onClearError} style={{ background: "rgba(255,45,120,0.1)",
          border: "1px solid rgba(255,45,120,0.4)", borderRadius: "8px",
          padding: "10px 14px", fontSize: "0.82rem", color: "#FF2D78",
          marginBottom: "12px", cursor: "pointer" }}>
          ⚠ {error} · click to dismiss
        </div>
      )}

      {/* Room code banner */}
      <GlassCard style={{ marginBottom: "14px", textAlign: "center" }}>
        <div style={{ color: "rgba(232,224,255,0.45)", fontSize: "0.7rem",
          fontFamily: "Orbitron, monospace", letterSpacing: "0.1em", marginBottom: "4px" }}>
          ROOM CODE — SHARE WITH FRIENDS
        </div>
        <div style={{ fontFamily: "Orbitron, monospace", fontSize: "2.4rem", letterSpacing: "0.4em",
          color: "#00D4FF", textShadow: "0 0 24px rgba(0,212,255,0.6)" }}>
          {room.code}
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(232,224,255,0.35)", marginTop: "4px" }}>
          Other players: go to Multiplayer → Connect → Join Room → type this code
        </div>
      </GlassCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

        {/* Players list */}
        <GlassCard>
          <h3 style={{ fontFamily: "Orbitron, monospace", color: "#A855F7",
            fontSize: "0.78rem", margin: "0 0 12px", display: "flex",
            justifyContent: "space-between", alignItems: "center" }}>
            <span>PLAYERS</span>
            <span style={{ color: "rgba(232,224,255,0.4)" }}>{connected.length}/{room.players.length} online</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {room.players.map(p => {
              const isMe   = p.playerId === myPlayerId
              const isHost_ = p.playerId === room.hostPlayerId
              return (
                <div key={p.playerId ?? p.socketId} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px",
                  background: isMe ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.03)",
                  borderRadius: "8px", fontSize: "0.84rem",
                  border: isMe ? "1px solid rgba(168,85,247,0.4)" : "1px solid transparent",
                  opacity: p.disconnected ? 0.45 : 1,
                }}>
                  <span style={{ fontSize: "1rem", minWidth: "1.2rem", textAlign: "center" }}>
                    {isHost_ ? "👑" : p.ready ? "✅" : "⏳"}
                  </span>
                  <span style={{ flex: 1, color: "#E8E0FF", fontWeight: isMe ? 700 : 400 }}>
                    {p.name}
                    {isMe && <span style={{ color: "rgba(168,85,247,0.7)", fontSize: "0.75rem" }}> (you)</span>}
                    {isHost_ && !isMe && <span style={{ color: "rgba(232,200,50,0.7)", fontSize: "0.72rem" }}> host</span>}
                  </span>
                  {p.disconnected && (
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,45,120,0.6)" }}>offline</span>
                  )}
                  {!p.disconnected && !isHost_ && (
                    <span style={{ fontSize: "0.72rem",
                      color: p.ready ? "#22FFAA" : "rgba(232,224,255,0.3)" }}>
                      {p.ready ? "ready" : "not ready"}
                    </span>
                  )}
                  {isHost_ && (
                    <span style={{ fontSize: "0.72rem", color: "#FFD700" }}>host</span>
                  )}
                </div>
              )
            })}
          </div>
        </GlassCard>

        {/* Game select + controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <GlassCard>
            <h3 style={{ fontFamily: "Orbitron, monospace", color: "#A855F7",
              fontSize: "0.78rem", margin: "0 0 10px" }}>
              {isHost ? "👑 SELECT GAME" : "SELECTED GAME"}
            </h3>
            {isHost ? (
              <>
                <select
                  value={room.gameId ?? ""}
                  onChange={e => {
                    const g = games.find(g => g.id === e.target.value)
                    if (g) onSelectGame(g.id, g.title, g.questions.length)
                  }}
                  style={{ width: "100%", background: "#0D0B1E",
                    border: "1px solid rgba(168,85,247,0.45)", borderRadius: "8px",
                    color: "#E8E0FF", fontFamily: "Exo 2, sans-serif",
                    fontSize: "0.84rem", padding: "9px 12px",
                    WebkitAppearance: "none", appearance: "none",
                    cursor: "pointer", marginBottom: "8px" }}
                >
                  <option value="" style={{ background: "#0D0B1E", color: "rgba(232,224,255,0.5)" }}>
                    — pick a game —
                  </option>
                  {games.map(g => (
                    <option key={g.id} value={g.id}
                      style={{ background: "#0D0B1E", color: "#E8E0FF" }}>
                      {g.ui?.emoji ?? "🎮"} {g.title} ({g.plugin})
                    </option>
                  ))}
                </select>
                {room.gameId && (
                  <div style={{ fontSize: "0.75rem", color: "#22FFAA" }}>
                    ✓ {room.gameTitle} selected · {room.questionCount} questions
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: room.gameId ? "#22FFAA" : "rgba(232,224,255,0.35)",
                fontSize: "0.84rem" }}>
                {room.gameId
                  ? `✓ ${room.gameTitle}`
                  : "Waiting for host to select a game…"}
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Guests: Mark Ready toggle */}
              {!isHost && (
                <PrimaryBtn onClick={() => onReady(!me?.ready)}
                  color={me?.ready ? "#22FFAA" : "#A855F7"}>
                  {me?.ready ? "✅ You are Ready!" : "⚡ Mark Ready"}
                </PrimaryBtn>
              )}
              {/* Host: Start Game */}
              {isHost && (
                <>
                  <PrimaryBtn onClick={onStart} disabled={!canStart}>
                    {canStart ? "🚀 Start Game!" : "⏳ Waiting…"}
                  </PrimaryBtn>
                  {startBlockReason && (
                    <div style={{ fontSize: "0.72rem", color: "rgba(232,224,255,0.4)",
                      textAlign: "center", fontFamily: "Exo 2, sans-serif" }}>
                      {startBlockReason}
                    </div>
                  )}
                </>
              )}
              <button onClick={onLeave} style={{ background: "transparent",
                border: "1px solid rgba(255,45,120,0.3)", borderRadius: "8px",
                color: "rgba(255,45,120,0.6)", cursor: "pointer",
                fontSize: "0.78rem", padding: "8px" }}>
                Leave Room
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

// ── Phase: Countdown ──────────────────────────────────────────────────────────

const CountdownScreen: React.FC<{ seconds: number; gameTitle: string }> = ({ seconds, gameTitle }) => (
  <div style={{ textAlign: "center", paddingTop: "80px" }}>
    <p style={{ color: "rgba(232,224,255,0.5)", fontFamily: "Orbitron, monospace",
      fontSize: "0.9rem", marginBottom: "12px" }}>{gameTitle}</p>
    <div style={{ fontSize: "7rem", fontFamily: "Orbitron, monospace",
      color: "#A855F7", textShadow: "0 0 60px rgba(168,85,247,0.7)",
      animation: "pulse 0.5s ease-in-out", lineHeight: 1 }}>
      {seconds > 0 ? seconds : "GO!"}
    </div>
    <p style={{ color: "rgba(232,224,255,0.3)", fontSize: "0.8rem", marginTop: "16px" }}>
      Get ready…
    </p>
  </div>
)

// ── Phase: Live Leaderboard sidebar ──────────────────────────────────────────

const LiveLeaderboard: React.FC<{
  leaderboard: import("../hooks/useMultiplayerRoom").LeaderboardRow[]
  myName: string
}> = ({ leaderboard, myName }) => (
  <div style={{ position: "fixed", top: "80px", right: "16px", width: "200px",
    background: "rgba(4,2,18,0.9)", backdropFilter: "blur(16px)",
    border: "1px solid rgba(168,85,247,0.25)", borderRadius: "14px",
    padding: "14px", zIndex: 100 }}>
    <div style={{ fontFamily: "Orbitron, monospace", fontSize: "0.68rem",
      color: "#A855F7", marginBottom: "10px" }}>LIVE SCORES</div>
    {leaderboard.map(p => (
      <div key={p.name} style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "5px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        color: p.name === myName ? "#22FFAA" : "rgba(232,224,255,0.7)",
        fontSize: "0.78rem" }}>
        <span>{p.rank}. {p.name}</span>
        <span style={{ fontFamily: "Orbitron, monospace" }}>{p.score}</span>
      </div>
    ))}
  </div>
)

// ── Phase: Game Over ──────────────────────────────────────────────────────────

const GameOverScreen: React.FC<{
  leaderboard: import("../hooks/useMultiplayerRoom").LeaderboardRow[]
  myName: string
  onPlayAgain: () => void
  onLeave: () => void
}> = ({ leaderboard, myName, onPlayAgain, onLeave }) => {
  const myRank = leaderboard.find(p => p.name === myName)

  return (
    <div style={{ maxWidth: "540px", margin: "0 auto", paddingTop: "40px" }}>
      <GlassCard>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "2.5rem" }}>
            {myRank?.rank === 1 ? "🏆" : myRank?.rank === 2 ? "🥈" : myRank?.rank === 3 ? "🥉" : "🎮"}
          </div>
          <h2 style={{ fontFamily: "Orbitron, monospace", color: "#A855F7", margin: "8px 0 4px" }}>
            Game Over!
          </h2>
          {myRank && (
            <p style={{ color: "rgba(232,224,255,0.5)", fontSize: "0.84rem" }}>
              You finished #{myRank.rank} with {myRank.score} points
            </p>
          )}
        </div>

        {/* Final leaderboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
          {leaderboard.map(p => (
            <div key={p.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: "10px",
              background: p.name === myName
                ? "rgba(168,85,247,0.15)"
                : p.rank === 1 ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
              border: p.name === myName ? "1px solid rgba(168,85,247,0.4)" : "1px solid transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontFamily: "Orbitron, monospace", fontSize: "1rem" }}>
                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}
                </span>
                <span style={{ color: "#E8E0FF", fontSize: "0.88rem" }}>{p.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Orbitron, monospace", color: "#A855F7", fontSize: "0.95rem" }}>
                  {p.score}
                </div>
                <div style={{ fontSize: "0.68rem", color: "rgba(232,224,255,0.35)" }}>
                  {p.correct}/{p.answers} correct · {p.accuracy}%
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <PrimaryBtn onClick={onPlayAgain} color="#22FFAA">Play Again</PrimaryBtn>
          <button onClick={onLeave} style={{ background: "transparent",
            border: "1px solid rgba(168,85,247,0.3)", borderRadius: "10px",
            color: "rgba(232,224,255,0.5)", cursor: "pointer",
            fontSize: "0.82rem", padding: "10px 20px" }}>
            Leave
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export const MultiplayerPage: React.FC<Props> = ({ games, onBack }) => {
  const mp = useMultiplayerRoom()

  // Track player name for leaderboard highlighting
  const [myName, setMyName] = useState("")

  // When in lobby room, find our name (use persistent playerId — survives reconnects)
  useEffect(() => {
    if (mp.room && mp.myPlayerId) {
      const me = mp.room.players.find(p => p.playerId === mp.myPlayerId)
      if (me) setMyName(me.name)
    }
  }, [mp.room, mp.myPlayerId])

  // Active game config (for multiplayer game rendering)
  const activeGame = mp.room?.gameId ? games.find(g => g.id === mp.room!.gameId) ?? null : null

  // ── Playing phase: render GameRenderer but intercept onAnswer ─────────────
  if (mp.phase === "playing" && activeGame) {
    return (
      <div style={{ minHeight: "60vh" }}>
        {/* Live sidebar leaderboard */}
        {mp.leaderboard.length > 0 && (
          <LiveLeaderboard leaderboard={mp.leaderboard} myName={myName} />
        )}

        {/* Question info */}
        <div style={{ textAlign: "center", marginBottom: "10px",
          fontFamily: "Orbitron, monospace", fontSize: "0.72rem", color: "rgba(232,224,255,0.4)" }}>
          MULTIPLAYER — {activeGame.title} — Q {mp.questionIdx + 1}/{mp.room?.questionCount ?? "?"}
        </div>

        {/* Render via GameRenderer in "multiplayer passthrough" mode:
            We wrap it so we can intercept answer events and forward to server */}
        <MultiplayerGameAdapter
          config={activeGame}
          questionIdx={mp.questionIdx}
          onAnswer={(correct, pts) => mp.submitAnswer(correct, pts)}
          onLeave={() => { mp.leaveRoom(); onBack() }}
        />
      </div>
    )
  }

  if (mp.phase === "ended") {
    return (
      <GameOverScreen
        leaderboard={mp.leaderboard}
        myName={myName}
        onPlayAgain={() => {
          // Reset to lobby phase — user needs to start a new game
          mp.leaveRoom()
        }}
        onLeave={() => { mp.leaveRoom(); onBack() }}
      />
    )
  }

  if (mp.phase === "countdown") {
    return (
      <CountdownScreen
        seconds={mp.countdown}
        gameTitle={mp.room?.gameTitle ?? ""}
      />
    )
  }

  if (mp.phase === "lobby" && mp.room) {
    return (
      <LobbyRoom
        room={mp.room}
        isHost={mp.isHost}
        myPlayerId={mp.myPlayerId}
        games={games}
        onSelectGame={mp.selectGame}
        onReady={mp.setReady}
        onStart={mp.startGame}
        onLeave={() => { mp.leaveRoom(); onBack() }}
        error={mp.error}
        onClearError={mp.clearError}
        notification={mp.notification}
      />
    )
  }

  if (mp.phase === "lobby" && !mp.room) {
    // Connected but not in a room yet
    return (
      <LobbyEntryForm
        onCreate={name => mp.createRoom(name)}
        onJoin={(code, name) => mp.joinRoom(code, name)}
        error={mp.error}
        onClearError={mp.clearError}
      />
    )
  }

  if (mp.phase === "connecting") return <ConnectingScreen />

  return (
    <IdleScreen
      onConnect={mp.connect}
      onBack={onBack}
    />
  )
}

// ── Multiplayer Game Adapter ──────────────────────────────────────────────────
// Renders the real GameRenderer but intercepts onAnswer to also sync with server.
// We give each question a fresh key so the engine re-mounts for each new question.

const MultiplayerGameAdapter: React.FC<{
  config:      GameConfig
  questionIdx: number
  onAnswer:    (correct: boolean, pointsAwarded: number) => void
  onLeave:     () => void
}> = ({ config, questionIdx, onAnswer, onLeave }) => {
  // We render the full GameRenderer — it handles the plugin, scoring, everything.
  // onLeave is wired to the "← Library" back button so it actually navigates away.
  return (
    <div key={`q-${questionIdx}`}>
      <GameRenderer
        config={config}
        onBack={onLeave}
        onCorrect={() => onAnswer(true,  100)}
        onWrong={() =>  onAnswer(false,  0)}
      />
    </div>
  )
}
