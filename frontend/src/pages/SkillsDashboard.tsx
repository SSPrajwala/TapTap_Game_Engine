/**
 * SkillsDashboard — full-page skills & progress tracker
 * Shows: summary stats, radar chart, per-skill XP bars, global leaderboard
 */
import React, { useEffect, useState, useCallback } from "react"
import { useAuth }                                  from "../context/AuthContext"
import {
  SkillService,
  SKILL_LABELS,
  SKILL_EMOJIS,
} from "../services/SkillService"
import type {
  SkillSummary,
  SkillProgress,
  SkillLeaderboardEntry,
} from "../services/SkillService"
import { SkillRadar, SkillProgressBar } from "../components/ui/SkillRadar"

// ── helpers ───────────────────────────────────────────────────────────────────

function getLevelHex(level: number): string {
  if (level >= 5) return "#FFD700"
  if (level >= 4) return "#C084FC"
  if (level >= 3) return "#60A5FA"
  if (level >= 2) return "#4ADE80"
  return "#9CA3AF"
}

function getLevelBg(level: number): string {
  if (level >= 5) return "rgba(255,215,0,0.12)"
  if (level >= 4) return "rgba(192,132,252,0.12)"
  if (level >= 3) return "rgba(96,165,250,0.12)"
  if (level >= 2) return "rgba(74,222,128,0.12)"
  return "rgba(156,163,175,0.08)"
}

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"]

// ── sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: string; label: string; value: string | number; sub?: string; color?: string
}> = ({ icon, label, value, sub, color = "#00D4FF" }) => (
  <div style={{
    background:   "rgba(255,255,255,0.04)",
    border:       `1px solid rgba(255,255,255,0.08)`,
    borderRadius: 16,
    padding:      "20px 24px",
    display:      "flex",
    alignItems:   "center",
    gap:          16,
    flex:         1,
    minWidth:     160,
  }}>
    <div style={{
      fontSize: "2rem", lineHeight: 1,
      background: `radial-gradient(circle, ${color}22, transparent)`,
      borderRadius: "50%", padding: 10,
    }}>{icon}</div>
    <div>
      <div style={{ color, fontFamily: "Orbitron, monospace", fontSize: "1.5rem", fontWeight: 900, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.68rem", marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
)

const LevelBadge: React.FC<{ level: number; large?: boolean }> = ({ level, large }) => {
  const label = SkillService.levelLabel(level)
  const color = getLevelHex(level)
  const bg    = getLevelBg(level)
  return (
    <span style={{
      display:      "inline-flex", alignItems: "center", gap: 6,
      background:   bg,
      border:       `1px solid ${color}44`,
      borderRadius: 99,
      padding:      large ? "6px 18px" : "3px 10px",
      fontSize:     large ? "0.85rem" : "0.7rem",
      fontFamily:   "Orbitron, monospace", fontWeight: 700,
      color,
    }}>
      <span style={{ fontSize: large ? "1rem" : "0.8rem" }}>
        {level >= 5 ? "🏆" : level >= 4 ? "💎" : level >= 3 ? "⭐" : level >= 2 ? "🔥" : "🌱"}
      </span>
      {label} · L{level}
    </span>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
}

export const SkillsDashboard: React.FC<Props> = ({ onBack }) => {
  const { user, token, isLoggedIn } = useAuth()

  const [summary,     setSummary]     = useState<SkillSummary | null>(null)
  const [leaderboard, setLeaderboard] = useState<SkillLeaderboardEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<"skills" | "leaderboard">("skills")
  const [error,       setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [sum, lb] = await Promise.all([
        SkillService.getMySkills(token),
        SkillService.getLeaderboard(),
      ])
      setSummary(sum)
      setLeaderboard(lb)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load skills.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // ── not logged in ───────────────────────────────────────────────────────────
  if (!isLoggedIn) return (
    <div style={pageStyle}>
      <Header onBack={onBack} title="Skills Dashboard" />
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <div style={{ fontSize: "3rem" }}>🔒</div>
        <div style={{ color: "rgba(255,255,255,0.5)", marginTop: 16 }}>
          Sign in to track your skill progress
        </div>
      </div>
    </div>
  )

  // ── loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={pageStyle}>
      <Header onBack={onBack} title="Skills Dashboard" />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 80 }}>
        <div style={{ color: "#00D4FF", fontFamily: "Orbitron", fontSize: "0.85rem", letterSpacing: 2 }}>
          LOADING SKILLS...
        </div>
      </div>
    </div>
  )

  // ── error ───────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={pageStyle}>
      <Header onBack={onBack} title="Skills Dashboard" />
      <div style={{ textAlign: "center", marginTop: 80, color: "rgba(255,80,80,0.8)" }}>
        {error}
        <button onClick={load} style={{ marginLeft: 12, color: "#00D4FF", background: "none", border: "none", cursor: "pointer" }}>
          Retry
        </button>
      </div>
    </div>
  )

  const s    = summary!
  const myRank = leaderboard.findIndex(e => e.userId === user?.id) + 1

  return (
    <div style={pageStyle}>
      <Header onBack={onBack} title="Skills Dashboard" />

      {/* ── User hero ── */}
      <div style={{
        background:    "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.08))",
        border:        "1px solid rgba(0,212,255,0.15)",
        borderRadius:  20,
        padding:       "28px 32px",
        marginBottom:  24,
        display:       "flex",
        alignItems:    "center",
        gap:           24,
        flexWrap:      "wrap",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg, #00D4FF, #A855F7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.8rem", fontWeight: 900,
          color: "#fff", flexShrink: 0,
        }}>
          {(user?.username ?? "?")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontFamily: "Orbitron, monospace", fontSize: "1.2rem", fontWeight: 800 }}>
            {user?.username ?? "Player"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.78rem", marginTop: 4 }}>
            {user?.profile?.college ?? "TapTap Learner"} · {user?.profile?.targetCompany ? `Target: ${user.profile.targetCompany}` : ""}
          </div>
          <div style={{ marginTop: 8 }}>
            <LevelBadge level={s.summary.overallLevel} large />
          </div>
        </div>
        {myRank > 0 && (
          <div style={{
            textAlign: "center",
            background: "rgba(255,215,0,0.07)",
            border: "1px solid rgba(255,215,0,0.2)",
            borderRadius: 14, padding: "12px 20px",
          }}>
            <div style={{ color: "#FFD700", fontFamily: "Orbitron", fontSize: "1.6rem", fontWeight: 900 }}>
              #{myRank}
            </div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}>GLOBAL RANK</div>
          </div>
        )}
      </div>

      {/* ── Summary stat cards ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <StatCard icon="⚡" label="Total XP"      value={s.summary.totalXp.toLocaleString()} sub="across all skills" color="#00D4FF" />
        <StatCard icon="🎮" label="Games Played"  value={s.summary.totalGames}  sub="sessions completed"  color="#A855F7" />
        <StatCard icon="🎯" label="Active Skills" value={s.summary.activeSkills} sub="skill areas unlocked" color="#4ADE80" />
        <StatCard icon="🏅" label="Overall Level" value={`L${s.summary.overallLevel}`} sub={SkillService.levelLabel(s.summary.overallLevel)} color={getLevelHex(s.summary.overallLevel)} />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["skills", "leaderboard"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding:      "9px 22px",
            borderRadius: 99,
            cursor:       "pointer",
            fontFamily:   "Orbitron, monospace",
            fontSize:     "0.7rem",
            fontWeight:   700,
            letterSpacing: 1,
            background:   activeTab === tab ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
            color:        activeTab === tab ? "#00D4FF"              : "rgba(255,255,255,0.4)",
            border:       activeTab === tab ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
          }}>
            {tab === "skills" ? "📊 MY SKILLS" : "🏆 LEADERBOARD"}
          </button>
        ))}
      </div>

      {/* ── Skills tab ── */}
      {activeTab === "skills" && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>

          {/* Radar chart */}
          <div style={{
            background:   "rgba(255,255,255,0.03)",
            border:       "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: 24,
            display:      "flex", flexDirection: "column", alignItems: "center", gap: 12,
            minWidth:     300,
          }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontFamily: "Orbitron", letterSpacing: 2 }}>
              SKILL RADAR
            </div>
            <SkillRadar skills={s.skills} size={300} showLabels={true} />
          </div>

          {/* XP Progress bars */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: 24,
            }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", fontFamily: "Orbitron", letterSpacing: 2, marginBottom: 20 }}>
                XP PROGRESS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {s.skills.length === 0 ? (
                  <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "20px 0" }}>
                    Play some games to unlock skill tracking!
                  </div>
                ) : (
                  [...s.skills]
                    .sort((a, b) => b.xp - a.xp)
                    .map(skill => (
                      <SkillProgressBar key={skill.skillArea} skill={skill} />
                    ))
                )}
              </div>
            </div>

            {/* Skill detail cards */}
            {s.skills.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                {s.skills.map(skill => (
                  <SkillChip key={skill.skillArea} skill={skill} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Leaderboard tab ── */}
      {activeTab === "leaderboard" && (
        <div style={{
          background:   "rgba(255,255,255,0.03)",
          border:       "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20, overflow: "hidden",
        }}>
          {leaderboard.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
              No players on the leaderboard yet. Play games to appear here!
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,212,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["RANK", "PLAYER", "COLLEGE", "TOTAL XP", "AVG LEVEL", "GAMES"].map(h => (
                    <th key={h} style={{
                      padding: "14px 20px", textAlign: "left",
                      color: "rgba(255,255,255,0.35)", fontSize: "0.65rem",
                      fontFamily: "Orbitron, monospace", letterSpacing: 1.5, fontWeight: 700,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => {
                  const isMe = entry.userId === user?.id
                  const rankColor = RANK_COLORS[idx] ?? "rgba(255,255,255,0.5)"
                  return (
                    <tr key={entry.userId} style={{
                      borderBottom:  "1px solid rgba(255,255,255,0.04)",
                      background:    isMe ? "rgba(0,212,255,0.05)" : "transparent",
                      transition:    "background 0.2s",
                    }}>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{
                          color: rankColor, fontFamily: "Orbitron", fontWeight: 900, fontSize: "0.85rem",
                        }}>
                          {idx < 3 ? ["🥇","🥈","🥉"][idx] : `#${entry.rank}`}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: `linear-gradient(135deg, ${rankColor}44, #A855F744)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.9rem", fontWeight: 800, color: "#fff",
                          }}>
                            {entry.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ color: isMe ? "#00D4FF" : "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
                              {entry.username} {isMe && <span style={{ color: "#00D4FF", fontSize: "0.65rem" }}>← YOU</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px", color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>
                        {entry.college || "—"}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ color: "#00D4FF", fontFamily: "Orbitron", fontWeight: 700, fontSize: "0.85rem" }}>
                          {entry.totalXp.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <LevelBadge level={Math.round(entry.avgLevel)} />
                      </td>
                      <td style={{ padding: "16px 20px", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
                        {entry.gamesPlayed}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* bottom padding */}
      <div style={{ height: 60 }} />
    </div>
  )
}

// ── Skill chip ─────────────────────────────────────────────────────────────────

const SkillChip: React.FC<{ skill: SkillProgress }> = ({ skill }) => {
  const color = getLevelHex(skill.level)
  const bg    = getLevelBg(skill.level)
  const emoji = SKILL_EMOJIS[skill.skillArea] ?? "⭐"
  const label = SKILL_LABELS[skill.skillArea] ?? skill.skillArea

  return (
    <div style={{
      background:   bg,
      border:       `1px solid ${color}33`,
      borderRadius: 12, padding: "10px 14px",
      minWidth:     140,
    }}>
      <div style={{ fontSize: "1.2rem" }}>{emoji}</div>
      <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.72rem", marginTop: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ color, fontFamily: "Orbitron", fontSize: "0.7rem", fontWeight: 800 }}>L{skill.level}</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>{skill.gamesPlayed} games</span>
      </div>
      <div style={{
        height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", marginTop: 6, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${SkillService.xpProgress(skill.level, skill.xp)}%`,
          background: color, borderRadius: 99,
        }} />
      </div>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

const Header: React.FC<{ onBack: () => void; title: string }> = ({ onBack, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
    <button onClick={onBack} style={{
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)",
      cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6,
    }}>
      ← Back
    </button>
    <h1 style={{
      margin: 0, color: "#fff", fontFamily: "Orbitron, monospace",
      fontSize: "clamp(1rem, 3vw, 1.4rem)", fontWeight: 900, letterSpacing: 2,
    }}>
      📊 {title.toUpperCase()}
    </h1>
  </div>
)

// ── page style ────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight:   "100vh",
  background:  "#0A1628",
  padding:     "clamp(16px, 4vw, 40px)",
  color:       "#fff",
  fontFamily:  "'Inter', 'Segoe UI', sans-serif",
  boxSizing:   "border-box",
}
