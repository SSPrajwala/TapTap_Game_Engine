import React, { useState, useEffect, useCallback } from "react"
import type { LeaderboardEntry } from "../types/engine.types"
import { LeaderboardService } from "../engine/LeaderboardService"

interface Props { onBack: () => void }

type Source = "backend" | "local"

export const LeaderboardPage: React.FC<Props> = ({ onBack }) => {
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([])
  const [filter,  setFilter]    = useState<"global" | string>("global")
  const [games,   setGames]     = useState<string[]>([])
  const [loading, setLoading]   = useState(true)
  const [source,  setSource]    = useState<Source>("backend")

  // ── Clear-leaderboard admin auth dialog ───────────────────────────────────
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearName,       setClearName]       = useState("")
  const [clearCode,       setClearCode]       = useState("")
  const [clearError,      setClearError]      = useState("")
  const [clearLoading,    setClearLoading]    = useState(false)
  const [clearSuccess,    setClearSuccess]    = useState("")

  const loadScores = useCallback(async () => {
    setLoading(true)
    try {
      const all = await LeaderboardService.fetchGlobal()
      // Merge local scores only if backend is empty (offline fallback)
      // Deduplicate by playerName+gameId+score+timeTaken fingerprint
      const local = all.length === 0 ? LeaderboardService.getAll() : []
      const merged = [...all]
      const seen = new Set(all.map(e => `${e.playerName}|${e.gameId}|${e.score}|${e.timeTaken}`))
      for (const lEntry of local) {
        const key = `${lEntry.playerName}|${lEntry.gameId}|${lEntry.score}|${lEntry.timeTaken}`
        if (!seen.has(key)) { seen.add(key); merged.push(lEntry) }
      }
      merged.sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken)

      const uniqueGames = [...new Set(merged.map(e => e.gameTitle))]
      const filtered = filter === "global"
        ? merged.slice(0, 50)
        : merged
            .filter(e => e.gameTitle === filter)
            .slice(0, 20)

      setGames(uniqueGames)
      setEntries(filtered)
      setSource(all.length > 0 ? "backend" : "local")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void loadScores() }, [loadScores])

  const handleFilterChange = (f: string) => {
    setFilter(f)
  }

  const handleClearConfirm = async () => {
    if (!clearName.trim() || !clearCode.trim()) {
      setClearError("Both Admin Name and Access Code are required.")
      return
    }
    setClearLoading(true)
    setClearError("")
    const result = await LeaderboardService.clearAll(clearName.trim(), clearCode.trim())
    setClearLoading(false)
    if (!result.success) {
      setClearError(result.message)
      return
    }
    setClearSuccess(result.message)
    setTimeout(() => {
      setShowClearDialog(false)
      setClearName(""); setClearCode(""); setClearError(""); setClearSuccess("")
      void loadScores()
    }, 1800)
  }

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  const medals = ["🥇", "🥈", "🥉"]

  const DIFF_COLOR: Record<string, string> = {
    easy:   "#22FFAA",
    medium: "#FFD700",
    hard:   "#FF2D78",
  }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 className="page-title">Leaderboard</h1>
        <button className="btn-danger-sm" onClick={() => { setClearError(""); setClearSuccess(""); setShowClearDialog(true) }}>
          🗑 Clear All
        </button>
      </div>

      {/* ── Admin auth dialog for clearing leaderboard ────────────────────── */}
      {showClearDialog && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "linear-gradient(145deg,rgba(10,10,31,0.97),rgba(20,10,45,0.97))",
            border:     "1px solid rgba(168,85,247,0.35)",
            borderRadius: "16px", padding: "30px 28px",
            width: "min(420px, 90vw)",
            boxShadow: "0 0 40px rgba(168,85,247,0.25)",
            fontFamily: "Exo 2, sans-serif",
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

      {/* Source indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <p className="lb-subtitle" style={{ margin: 0 }}>
          Sorted by score · ties broken by fastest time
        </p>
        <span style={{
          fontSize:   "0.7rem",
          fontFamily: "Exo 2, sans-serif",
          padding:    "2px 8px",
          borderRadius: "99px",
          background: source === "backend" ? "rgba(34,255,170,0.1)" : "rgba(255,215,0,0.1)",
          border:     source === "backend" ? "1px solid rgba(34,255,170,0.3)" : "1px solid rgba(255,215,0,0.3)",
          color:      source === "backend" ? "#22FFAA" : "#FFD700",
        }}>
          {source === "backend" ? "🌐 Live" : "💾 Local"}
        </span>
        <button
          onClick={() => void loadScores()}
          style={{
            background:   "rgba(168,85,247,0.08)",
            border:       "1px solid rgba(168,85,247,0.2)",
            borderRadius: "6px",
            padding:      "3px 10px",
            color:        "rgba(168,85,247,0.7)",
            fontSize:     "0.72rem",
            fontFamily:   "Exo 2, sans-serif",
            cursor:       "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        <button className={`filter-tab${filter === "global" ? " active" : ""}`} onClick={() => handleFilterChange("global")}>
          🌐 Global
        </button>
        {games.map(g => (
          <button key={g} className={`filter-tab${filter === g ? " active" : ""}`} onClick={() => handleFilterChange(g)}>
            {g}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <p>Loading scores…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <p>No scores yet. Play a game to appear here!</p>
        </div>
      ) : (
        <div className="lb-list">
          {/* Header row */}
          <div className="lb-header-row">
            <div className="lb-col-rank">#</div>
            <div className="lb-col-name">Player</div>
            <div className="lb-col-score">Score</div>
            <div className="lb-col-time">Time</div>
            <div className="lb-col-acc">Acc</div>
            <div className="lb-col-date">Date</div>
          </div>

          {entries.map((entry, i) => (
            <div key={entry.id} className={`lb-row${i < 3 ? " lb-top" : ""}`}>
              <div className="lb-col-rank">{medals[i] ?? `#${i + 1}`}</div>
              <div className="lb-col-name">
                <div className="lb-name">{entry.playerName}</div>
                <div className="lb-game">
                  {entry.gameTitle}
                  {entry.difficulty && (
                    <span style={{ color: DIFF_COLOR[entry.difficulty] ?? "#A855F7", marginLeft: "6px", fontSize: "0.68rem" }}>
                      {entry.difficulty}
                    </span>
                  )}
                </div>
              </div>
              <div className="lb-col-score">
                <span className="lb-score">{entry.score.toLocaleString()}</span>
              </div>
              <div className="lb-col-time">
                <span className="lb-time">{formatTime(entry.timeTaken)}</span>
              </div>
              <div className="lb-col-acc">
                <span className="lb-acc">{Math.round(entry.accuracy * 100)}%</span>
              </div>
              <div className="lb-col-date">
                <span className="lb-date">{formatDate(entry.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
