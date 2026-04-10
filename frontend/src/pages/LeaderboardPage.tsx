import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  LeaderboardService,
  type GlobalPlayerEntry,
  type GamePlayerEntry,
  type GameListItem,
  type GameBreakdown,
  type AttemptDetail,
} from "../engine/LeaderboardService"

interface Props { onBack: () => void }

// ── Small helper: format seconds ─────────────────────────────────────────────
function fmtTime(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ── Small helper: format ms epoch to short date ───────────────────────────────
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

// ── Difficulty colour ─────────────────────────────────────────────────────────
const DIFF_COLOR: Record<string, string> = {
  easy:   "#22FFAA",
  medium: "#FFD700",
  hard:   "#FF2D78",
}

// ── Medal helpers ─────────────────────────────────────────────────────────────
const MEDALS = ["🥇", "🥈", "🥉"]
function rankLabel(i: number) { return MEDALS[i] ?? `#${i + 1}` }

// ── Accuracy bar colour ────────────────────────────────────────────────────────
function accColor(pct: number): string {
  if (pct >= 85) return "#22FFAA"
  if (pct >= 60) return "#FFD700"
  return "#FF6B6B"
}

// ─────────────────────────────────────────────────────────────────────────────
// Info popover — rendered inside a fixed overlay, positions near trigger button.
// ─────────────────────────────────────────────────────────────────────────────

interface GlobalPopoverProps {
  player: GlobalPlayerEntry
  onClose: () => void
  anchorRect: DOMRect
}
const GlobalPopover: React.FC<GlobalPopoverProps> = ({ player, onClose, anchorRect }) => {
  const ref = useRef<HTMLDivElement>(null)
  const top  = Math.min(anchorRect.bottom + 6, window.innerHeight - 320)
  const left = Math.min(anchorRect.right  - 260, window.innerWidth  - 278)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 8000, pointerEvents: "none" }}>
      <div
        ref={ref}
        style={{
          position:     "absolute",
          top:          `${top}px`,
          left:         `${Math.max(8, left)}px`,
          width:        "260px",
          background:   "linear-gradient(145deg,rgba(10,10,31,0.98),rgba(20,10,45,0.98))",
          border:       "1px solid rgba(168,85,247,0.35)",
          borderRadius: "12px",
          padding:      "14px",
          boxShadow:    "0 8px 32px rgba(0,0,0,0.6)",
          fontFamily:   "Exo 2, sans-serif",
          pointerEvents: "all",
          maxHeight:    "300px",
          overflowY:    "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>
            {player.playerName}'s Game Breakdown
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(232,224,255,0.5)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
          >✕</button>
        </div>

        {player.breakdown.length === 0 ? (
          <p style={{ color: "rgba(232,224,255,0.4)", fontSize: "0.75rem", margin: 0 }}>No breakdown available.</p>
        ) : player.breakdown.map((g: GameBreakdown, i: number) => (
          <div key={i} style={{
            marginBottom: "8px",
            padding:      "8px 10px",
            background:   "rgba(168,85,247,0.07)",
            borderRadius: "8px",
            border:       "1px solid rgba(168,85,247,0.15)",
          }}>
            <div style={{ fontWeight: 600, fontSize: "0.78rem", color: "#E8E0FF", marginBottom: "4px" }}>
              🎮 {g.gameTitle}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: "0.7rem", color: "rgba(232,224,255,0.65)" }}>
              <span>Plays: <b style={{ color: "#fff" }}>{g.plays}</b></span>
              <span>Best: <b style={{ color: "#00D4FF" }}>{g.bestScore.toLocaleString()}</b></span>
              <span>Total: <b style={{ color: "#fff" }}>{g.totalScore.toLocaleString()}</b></span>
              <span>Acc: <b style={{ color: accColor(g.avgAccuracy) }}>{g.avgAccuracy}%</b></span>
              <span>Best Time: <b style={{ color: "#fff" }}>{fmtTime(g.bestTime)}</b></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface GamePopoverProps {
  player: GamePlayerEntry
  onClose: () => void
  anchorRect: DOMRect
}
const GamePopover: React.FC<GamePopoverProps> = ({ player, onClose, anchorRect }) => {
  const ref  = useRef<HTMLDivElement>(null)
  const top  = Math.min(anchorRect.bottom + 6, window.innerHeight - 320)
  const left = Math.min(anchorRect.right  - 260, window.innerWidth  - 278)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 8000, pointerEvents: "none" }}>
      <div
        ref={ref}
        style={{
          position:     "absolute",
          top:          `${top}px`,
          left:         `${Math.max(8, left)}px`,
          width:        "256px",
          background:   "linear-gradient(145deg,rgba(10,10,31,0.98),rgba(20,10,45,0.98))",
          border:       "1px solid rgba(0,212,255,0.35)",
          borderRadius: "12px",
          padding:      "14px",
          boxShadow:    "0 8px 32px rgba(0,0,0,0.6)",
          fontFamily:   "Exo 2, sans-serif",
          pointerEvents: "all",
          maxHeight:    "300px",
          overflowY:    "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>
            {player.playerName}'s Attempts
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(232,224,255,0.5)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
          >✕</button>
        </div>

        {player.allAttempts.length === 0 ? (
          <p style={{ color: "rgba(232,224,255,0.4)", fontSize: "0.75rem", margin: 0 }}>No attempts available.</p>
        ) : player.allAttempts.map((a: AttemptDetail, i: number) => (
          <div key={i} style={{
            marginBottom: "6px",
            padding:      "7px 10px",
            background:   i === 0 ? "rgba(0,212,255,0.08)" : "rgba(168,85,247,0.06)",
            borderRadius: "7px",
            border:       `1px solid ${i === 0 ? "rgba(0,212,255,0.25)" : "rgba(168,85,247,0.12)"}`,
            display:      "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap:          "2px 8px",
            fontSize:     "0.69rem",
            color:        "rgba(232,224,255,0.65)",
          }}>
            <span style={{ gridColumn: "1/-1", fontWeight: 600, fontSize: "0.74rem", color: i === 0 ? "#00D4FF" : "#E8E0FF", marginBottom: "2px" }}>
              {i === 0 ? "⭐ Best" : `Attempt ${i + 1}`} · {fmtDate(a.timestamp)}
            </span>
            <span>Score: <b style={{ color: "#fff" }}>{a.score.toLocaleString()}</b></span>
            <span>Acc: <b style={{ color: accColor(a.accuracy) }}>{a.accuracy}%</b></span>
            <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              Time: <b style={{ color: "#fff" }}>{fmtTime(a.timeTaken)}</b>
              <span style={{ marginLeft: "4px", fontSize: "0.65rem", color: DIFF_COLOR[a.difficulty] ?? "#A855F7", textTransform: "capitalize" }}>
                {a.difficulty}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Leaderboard Page
// ─────────────────────────────────────────────────────────────────────────────

export const LeaderboardPage: React.FC<Props> = ({ onBack }) => {
  const [activeTab,     setActiveTab]     = useState<"global" | string>("global")
  const [gameList,      setGameList]      = useState<GameListItem[]>([])
  const [globalRows,    setGlobalRows]    = useState<GlobalPlayerEntry[]>([])
  const [gameRows,      setGameRows]      = useState<GamePlayerEntry[]>([])
  const [loading,       setLoading]       = useState(true)
  const [isLive,        setIsLive]        = useState(true)

  // Popover state
  const [globalPopover, setGlobalPopover] = useState<{ player: GlobalPlayerEntry; rect: DOMRect } | null>(null)
  const [gamePopover,   setGamePopover]   = useState<{ player: GamePlayerEntry;   rect: DOMRect } | null>(null)

  // Admin clear dialog
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearName,       setClearName]       = useState("")
  const [clearCode,       setClearCode]       = useState("")
  const [clearError,      setClearError]      = useState("")
  const [clearLoading,    setClearLoading]    = useState(false)
  const [clearSuccess,    setClearSuccess]    = useState("")

  // ── Load game list once ───────────────────────────────────────────────────
  useEffect(() => {
    void LeaderboardService.fetchGameList().then(list => setGameList(list))
  }, [])

  // ── Load rows whenever tab changes ────────────────────────────────────────
  const loadRows = useCallback(async () => {
    setLoading(true)
    setGlobalPopover(null)
    setGamePopover(null)
    try {
      if (activeTab === "global") {
        const rows = await LeaderboardService.fetchGlobal()
        setGlobalRows(rows)
        setIsLive(rows.length > 0)
      } else {
        const rows = await LeaderboardService.fetchForGame(activeTab)
        setGameRows(rows)
        setIsLive(rows.length > 0)
        // Also refresh game list in background (new games may have appeared)
        LeaderboardService.fetchGameList().then(list => setGameList(list)).catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { void loadRows() }, [loadRows])

  // ── Admin clear ───────────────────────────────────────────────────────────
  const handleClearConfirm = async () => {
    if (!clearName.trim() || !clearCode.trim()) {
      setClearError("Both Admin Name and Access Code are required.")
      return
    }
    setClearLoading(true)
    setClearError("")
    const result = await LeaderboardService.clearAll(clearName.trim(), clearCode.trim())
    setClearLoading(false)
    if (!result.success) { setClearError(result.message); return }
    setClearSuccess(result.message)
    setTimeout(() => {
      setShowClearDialog(false)
      setClearName(""); setClearCode(""); setClearError(""); setClearSuccess("")
      void loadRows()
      LeaderboardService.fetchGameList().then(list => setGameList(list)).catch(() => {})
    }, 1800)
  }

  // ── Popover openers ───────────────────────────────────────────────────────
  const openGlobalPopover = (player: GlobalPlayerEntry, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
    setGamePopover(null)
    setGlobalPopover(prev => prev?.player.playerName === player.playerName ? null : { player, rect })
  }

  const openGamePopover = (player: GamePlayerEntry, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
    setGlobalPopover(null)
    setGamePopover(prev => prev?.player.playerName === player.playerName ? null : { player, rect })
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const infoBtn: React.CSSProperties = {
    background:   "rgba(168,85,247,0.1)",
    border:       "1px solid rgba(168,85,247,0.25)",
    borderRadius: "50%",
    width:        "22px",
    height:       "22px",
    cursor:       "pointer",
    color:        "rgba(168,85,247,0.8)",
    fontSize:     "0.7rem",
    fontWeight:   700,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    flexShrink:   0,
    transition:   "background 0.2s, border-color 0.2s",
    fontFamily:   "Exo 2, sans-serif",
  }

  const isGlobal  = activeTab === "global"
  const emptyRows = loading ? false : isGlobal ? globalRows.length === 0 : gameRows.length === 0

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 className="page-title">Leaderboard</h1>
        <button
          className="btn-danger-sm"
          onClick={() => { setClearError(""); setClearSuccess(""); setShowClearDialog(true) }}
        >
          🗑 Clear All
        </button>
      </div>

      {/* Admin clear dialog ─────────────────────────────────────────────── */}
      {showClearDialog && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background:   "linear-gradient(145deg,rgba(10,10,31,0.97),rgba(20,10,45,0.97))",
            border:       "1px solid rgba(168,85,247,0.35)",
            borderRadius: "16px", padding: "30px 28px",
            width:        "min(420px, 90vw)",
            boxShadow:    "0 0 40px rgba(168,85,247,0.25)",
            fontFamily:   "Exo 2, sans-serif",
          }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "6px", textAlign: "center" }}>🗑</div>
            <h3 style={{ textAlign: "center", color: "#fff", margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 700 }}>
              Clear Entire Leaderboard
            </h3>
            <p style={{ textAlign: "center", color: "rgba(255,45,120,0.7)", fontSize: "0.75rem", margin: "0 0 18px" }}>
              This will permanently delete ALL scores for ALL users. Admin credentials required.
            </p>

            {clearSuccess ? (
              <div style={{ textAlign: "center", color: "#22FFAA", fontSize: "0.88rem", padding: "12px", background: "rgba(34,255,170,0.08)", borderRadius: "8px", border: "1px solid rgba(34,255,170,0.2)" }}>
                ✓ {clearSuccess}
              </div>
            ) : (
              <>
                <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(232,224,255,0.5)", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "4px" }}>
                  ADMIN NAME
                </label>
                <input
                  className="admin-input"
                  placeholder="e.g. Engine Owner"
                  value={clearName}
                  style={{ marginBottom: "10px" }}
                  onChange={e => setClearName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void handleClearConfirm()}
                />
                <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(232,224,255,0.5)", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "4px" }}>
                  ACCESS CODE
                </label>
                <input
                  className="admin-input"
                  type="password"
                  placeholder="Enter access code"
                  value={clearCode}
                  style={{ marginBottom: "10px" }}
                  onChange={e => setClearCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void handleClearConfirm()}
                />
                {clearError && (
                  <div style={{ color: "#FF6090", fontSize: "0.78rem", marginBottom: "12px", padding: "8px 10px", background: "rgba(255,45,120,0.07)", borderRadius: "6px", border: "1px solid rgba(255,45,120,0.2)" }}>
                    ⚠️ {clearError}
                  </div>
                )}
                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button
                    onClick={() => { setShowClearDialog(false); setClearName(""); setClearCode(""); setClearError("") }}
                    style={{ flex: 1, padding: "9px", background: "rgba(232,224,255,0.05)", border: "1px solid rgba(232,224,255,0.12)", borderRadius: "8px", color: "rgba(232,224,255,0.6)", cursor: "pointer", fontFamily: "Exo 2, sans-serif", fontSize: "0.83rem" }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleClearConfirm()}
                    disabled={clearLoading}
                    style={{ flex: 1, padding: "9px", background: clearLoading ? "rgba(255,45,120,0.1)" : "linear-gradient(135deg,#FF2D78,#A855F7)", border: "none", borderRadius: "8px", color: "#fff", cursor: clearLoading ? "not-allowed" : "pointer", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.83rem" }}>
                    {clearLoading ? "Verifying…" : "Confirm Clear"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Status bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
        <p className="lb-subtitle" style={{ margin: 0, fontSize: "0.75rem" }}>
          {isGlobal
            ? "One row per player · sorted by total score across all games"
            : "One row per player · sorted by best score in this game"}
        </p>
        <span style={{
          fontSize:     "0.7rem",
          fontFamily:   "Exo 2, sans-serif",
          padding:      "2px 8px",
          borderRadius: "99px",
          background:   isLive ? "rgba(34,255,170,0.1)"  : "rgba(255,215,0,0.1)",
          border:       isLive ? "1px solid rgba(34,255,170,0.3)" : "1px solid rgba(255,215,0,0.3)",
          color:        isLive ? "#22FFAA" : "#FFD700",
        }}>
          {isLive ? "🌐 Live" : "💾 Local"}
        </span>
        <button
          onClick={() => void loadRows()}
          style={{
            background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: "6px", padding: "3px 10px", color: "rgba(168,85,247,0.7)",
            fontSize: "0.72rem", fontFamily: "Exo 2, sans-serif", cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Game filter tabs ────────────────────────────────────────────────── */}
      <div className="filter-tabs" style={{ overflowX: "auto", paddingBottom: "2px" }}>
        <button
          className={`filter-tab${activeTab === "global" ? " active" : ""}`}
          onClick={() => setActiveTab("global")}
        >
          🌐 Global
        </button>
        {gameList.map(g => (
          <button
            key={g.gameId}
            className={`filter-tab${activeTab === g.gameId ? " active" : ""}`}
            onClick={() => setActiveTab(g.gameId)}
          >
            {g.gameTitle}
          </button>
        ))}
      </div>

      {/* Content ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <p>Loading scores…</p>
        </div>
      ) : emptyRows ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <p>No scores yet. Play a game to appear here!</p>
        </div>
      ) : isGlobal ? (
        /* ── GLOBAL TABLE ─────────────────────────────────────────────── */
        <div className="lb-list">
          {/* Header */}
          <div className="lb-header-row" style={{ gridTemplateColumns: "44px 1fr 90px 80px 64px 44px" }}>
            <div className="lb-col-rank">#</div>
            <div className="lb-col-name">Player</div>
            <div className="lb-col-score">Total Score</div>
            <div className="lb-col-acc">Avg Acc</div>
            <div style={{ textAlign: "center", fontSize: "0.7rem" }}>Games</div>
            <div style={{ textAlign: "center", fontSize: "0.7rem" }}>ⓘ</div>
          </div>

          {globalRows.map((row, i) => (
            <div key={row.playerName} className={`lb-row${i < 3 ? " lb-top" : ""}`}
              style={{ gridTemplateColumns: "44px 1fr 90px 80px 64px 44px" }}>

              {/* Rank */}
              <div className="lb-col-rank">{rankLabel(i)}</div>

              {/* Player name + college */}
              <div className="lb-col-name">
                <div className="lb-name">{row.playerName}</div>
                {row.college && (
                  <div className="lb-game" style={{ opacity: 0.55, fontSize: "0.67rem" }}>
                    {row.college}
                  </div>
                )}
                <div className="lb-game" style={{ fontSize: "0.66rem", color: "rgba(232,224,255,0.4)" }}>
                  {row.totalSessions} session{row.totalSessions !== 1 ? "s" : ""}
                  {" · "}last {fmtDate(row.timestamp)}
                </div>
              </div>

              {/* Total Score */}
              <div className="lb-col-score">
                <span className="lb-score">{row.totalScore.toLocaleString()}</span>
              </div>

              {/* Avg Accuracy */}
              <div className="lb-col-acc">
                <span className="lb-acc" style={{ color: accColor(row.avgAccuracy) }}>
                  {row.avgAccuracy}%
                </span>
              </div>

              {/* Games Played */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#00D4FF" }}>
                  {row.gamesPlayed}
                </span>
              </div>

              {/* Info button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  style={infoBtn}
                  title="View per-game breakdown"
                  onClick={e => openGlobalPopover(row, e)}
                >
                  ⓘ
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── PER-GAME TABLE ───────────────────────────────────────────── */
        <div className="lb-list">
          {/* Header */}
          <div className="lb-header-row" style={{ gridTemplateColumns: "44px 1fr 90px 80px 60px 44px" }}>
            <div className="lb-col-rank">#</div>
            <div className="lb-col-name">Player</div>
            <div className="lb-col-score">Best Score</div>
            <div className="lb-col-acc">Avg Acc</div>
            <div style={{ textAlign: "center", fontSize: "0.7rem" }}>Tries</div>
            <div style={{ textAlign: "center", fontSize: "0.7rem" }}>ⓘ</div>
          </div>

          {gameRows.map((row, i) => (
            <div key={row.playerName} className={`lb-row${i < 3 ? " lb-top" : ""}`}
              style={{ gridTemplateColumns: "44px 1fr 90px 80px 60px 44px" }}>

              {/* Rank */}
              <div className="lb-col-rank">{rankLabel(i)}</div>

              {/* Player name + college */}
              <div className="lb-col-name">
                <div className="lb-name">{row.playerName}</div>
                {row.college && (
                  <div className="lb-game" style={{ opacity: 0.55, fontSize: "0.67rem" }}>
                    {row.college}
                  </div>
                )}
                <div className="lb-game" style={{ fontSize: "0.66rem", color: "rgba(232,224,255,0.4)" }}>
                  last {fmtDate(row.timestamp)}
                </div>
              </div>

              {/* Best Score */}
              <div className="lb-col-score">
                <span className="lb-score">{row.bestScore.toLocaleString()}</span>
                {row.attempts > 1 && (
                  <div style={{ fontSize: "0.65rem", color: "rgba(232,224,255,0.35)", marginTop: "1px" }}>
                    total {row.totalScore.toLocaleString()}
                  </div>
                )}
              </div>

              {/* Avg Accuracy */}
              <div className="lb-col-acc">
                <span className="lb-acc" style={{ color: accColor(row.avgAccuracy) }}>
                  {row.avgAccuracy}%
                </span>
              </div>

              {/* Attempts */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#A855F7" }}>
                  {row.attempts}
                </span>
              </div>

              {/* Info button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  style={{ ...infoBtn, borderColor: "rgba(0,212,255,0.25)", color: "rgba(0,212,255,0.8)", background: "rgba(0,212,255,0.08)" }}
                  title="View all attempts"
                  onClick={e => openGamePopover(row, e)}
                >
                  ⓘ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Popovers ────────────────────────────────────────────────────────── */}
      {globalPopover && (
        <GlobalPopover
          player={globalPopover.player}
          anchorRect={globalPopover.rect}
          onClose={() => setGlobalPopover(null)}
        />
      )}
      {gamePopover && (
        <GamePopover
          player={gamePopover.player}
          anchorRect={gamePopover.rect}
          onClose={() => setGamePopover(null)}
        />
      )}
    </div>
  )
}
