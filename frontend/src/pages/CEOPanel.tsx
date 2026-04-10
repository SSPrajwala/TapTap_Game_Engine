/**
 * CEOPanel — Super-Admin control room
 *
 * NOT linked from the main navigation.
 * Access: click the TapTap logo 5 times rapidly (within 2 seconds) from
 * the game library screen.  A discreet login modal appears.
 *
 * Powers:
 *  • View all admins + their access codes
 *  • Add a new admin (name + access code set here)
 *  • Edit an existing admin's name / access code
 *  • Delete an admin
 *  • View live engine stats (games, sessions, AI gens, users)
 */
import React, { useState, useEffect } from "react"

const CEO_API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001/api") + "/ceo"

interface AdminRow {
  id:         string
  name:       string
  accessCode: string
  createdAt:  string
}

interface EngineStats {
  gameCount:    number
  sessionCount: number
  userCount:    number
  aiGenCount:   number
  adminCount:   number
}

interface RecentSession {
  playerName: string
  gameId:     string
  score:      number
  createdAt:  string
}

interface Props {
  onBack: () => void
}

// ── CEO Login Screen ──────────────────────────────────────────────────────────
const CEOLogin: React.FC<{ onLogin: (token: string) => void; onClose: () => void }> = ({ onLogin, onClose }) => {
  const [name,     setName]     = useState("")
  const [pass,     setPass]     = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  const handleLogin = async () => {
    if (!name.trim() || !pass.trim()) { setError("Both fields are required."); return }
    setLoading(true); setError("")
    try {
      const res = await fetch(`${CEO_API}/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ceoName: name.trim(), passcode: pass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      onLogin(data.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(10,10,15,0.92)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0E0E1A", border: "1px solid rgba(168,85,247,0.3)", borderRadius: "20px",
        padding: "36px 32px", maxWidth: "380px", width: "100%", textAlign: "center",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>👑</div>
        <h2 style={{ fontFamily: "Orbitron, sans-serif", color: "#E8E0FF", fontSize: "1.1rem", marginBottom: "4px" }}>
          CEO Control Room
        </h2>
        <p style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.75rem", color: "rgba(232,224,255,0.35)", marginBottom: "24px" }}>
          Restricted access — authorised personnel only
        </p>

        <input
          placeholder="CEO Name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          autoFocus
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "8px", marginBottom: "10px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.2)",
            color: "#E8E0FF", fontFamily: "Exo 2, sans-serif", fontSize: "0.88rem", boxSizing: "border-box",
          }}
        />
        <input
          type="password"
          placeholder="Master Passcode"
          value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.2)",
            color: "#E8E0FF", fontFamily: "Exo 2, sans-serif", fontSize: "0.88rem", boxSizing: "border-box",
          }}
        />
        {error && (
          <div style={{ color: "#FF6090", fontFamily: "Exo 2, sans-serif", fontSize: "0.78rem", marginBottom: "12px" }}>
            ⚠️ {error}
          </div>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(232,224,255,0.4)", fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem",
          }}>
            Cancel
          </button>
          <button onClick={handleLogin} disabled={loading} style={{
            flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
            background: "linear-gradient(135deg,#A855F7,#6366F1)", border: "none",
            color: "#fff", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.82rem",
          }}>
            {loading ? "Verifying…" : "👑 Enter"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ icon: string; label: string; value: number; color: string }> = ({ icon, label, value, color }) => (
  <div style={{
    padding: "16px 18px", borderRadius: "12px", textAlign: "center",
    background: `${color}10`, border: `1px solid ${color}30`,
  }}>
    <div style={{ fontSize: "1.6rem", marginBottom: "4px" }}>{icon}</div>
    <div style={{ fontFamily: "Orbitron, sans-serif", fontSize: "1.4rem", fontWeight: 900, color }}>{value.toLocaleString()}</div>
    <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.72rem", color: "rgba(232,224,255,0.45)", marginTop: "2px" }}>{label}</div>
  </div>
)

// ── Main CEO Panel ────────────────────────────────────────────────────────────
export const CEOPanel: React.FC<Props> = ({ onBack }) => {
  const [token,          setToken]          = useState<string | null>(() => sessionStorage.getItem("ceo_token"))
  const [admins,         setAdmins]         = useState<AdminRow[]>([])
  const [stats,          setStats]          = useState<EngineStats | null>(null)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [loadingAdmins,  setLoadingAdmins]  = useState(false)
  const [loadingStats,   setLoadingStats]   = useState(false)
  const [globalError,    setGlobalError]    = useState("")
  const [ceoName,        setCeoName]        = useState("")

  // Add / Edit form state
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [formName,     setFormName]     = useState("")
  const [formCode,     setFormCode]     = useState("")
  const [formLoading,  setFormLoading]  = useState(false)
  const [formError,    setFormError]    = useState("")
  const [formSuccess,  setFormSuccess]  = useState("")

  // Delete confirm
  const [deleteId,      setDeleteId]      = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const authHeader = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }

  const fetchAdmins = async () => {
    setLoadingAdmins(true)
    try {
      const res = await fetch(`${CEO_API}/admins`, { headers: authHeader })
      if (res.status === 401) { setToken(null); sessionStorage.removeItem("ceo_token"); return }
      const data = await res.json()
      setAdmins(data.admins ?? [])
    } catch { setGlobalError("Could not load admins.") }
    finally  { setLoadingAdmins(false) }
  }

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(`${CEO_API}/stats`, { headers: authHeader })
      const data = await res.json()
      setStats(data.stats)
      setRecentSessions(data.recentSessions ?? [])
    } catch { /* stats failure is non-critical */ }
    finally  { setLoadingStats(false) }
  }

  useEffect(() => {
    if (!token) return
    // Verify token and get name
    fetch(`${CEO_API}/me`, { headers: authHeader })
      .then(r => r.json())
      .then(d => { if (d.name) setCeoName(d.name) })
      .catch(() => {})
    fetchAdmins()
    fetchStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleLogin = (newToken: string) => {
    sessionStorage.setItem("ceo_token", newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    sessionStorage.removeItem("ceo_token")
    setToken(null)
    onBack()
  }

  const openAdd = () => {
    setEditingId(null); setFormName(""); setFormCode(""); setFormError(""); setFormSuccess(""); setShowAddForm(true)
  }

  const openEdit = (a: AdminRow) => {
    setEditingId(a.id); setFormName(a.name); setFormCode(a.accessCode); setFormError(""); setFormSuccess(""); setShowAddForm(true)
  }

  const handleFormSubmit = async () => {
    if (!formName.trim()) { setFormError("Admin name is required."); return }
    if (!formCode.trim()) { setFormError("Access code is required."); return }
    setFormLoading(true); setFormError(""); setFormSuccess("")
    try {
      const url    = editingId ? `${CEO_API}/admins/${editingId}` : `${CEO_API}/admins`
      const method = editingId ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: authHeader,
        body:    JSON.stringify({ name: formName.trim(), accessCode: formCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setFormSuccess(editingId ? `✓ "${formName.trim()}" updated!` : `✓ Admin "${formName.trim()}" created!`)
      await fetchAdmins()
      setTimeout(() => { setShowAddForm(false); setFormSuccess("") }, 1500)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Operation failed.")
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      const res  = await fetch(`${CEO_API}/admins/${deleteId}`, { method: "DELETE", headers: authHeader })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setAdmins(prev => prev.filter(a => a.id !== deleteId))
      setDeleteId(null)
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Delete failed.")
      setDeleteId(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Not logged in → show login ────────────────────────────────────────────
  if (!token) {
    return <CEOLogin onLogin={handleLogin} onClose={onBack} />
  }

  // ── Main panel ────────────────────────────────────────────────────────────
  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div>
          <h1 className="page-title" style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            👑 CEO Control Room
          </h1>
          <div style={{ fontSize: "0.72rem", color: "rgba(168,85,247,0.6)", fontFamily: "Exo 2, sans-serif" }}>
            {ceoName} · Super Admin
          </div>
        </div>
        <button onClick={handleLogout}
          style={{ padding: "7px 16px", background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.25)",
            borderRadius: "8px", color: "#FF6090", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
          🔓 Logout
        </button>
      </div>

      {globalError && (
        <div style={{ padding: "10px 16px", borderRadius: "8px", background: "rgba(255,45,120,0.08)", border: "1px solid rgba(255,45,120,0.2)",
          color: "#FF6090", fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem", marginBottom: "12px" }}>
          ⚠️ {globalError}
        </div>
      )}

      {/* ── Engine Stats ── */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.85rem", color: "rgba(232,224,255,0.5)", letterSpacing: "0.15em", marginBottom: "12px" }}>
          ENGINE STATS
        </h2>
        {loadingStats ? (
          <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem", color: "rgba(232,224,255,0.3)" }}>Loading stats…</div>
        ) : stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
            <StatCard icon="🎮" label="Games"     value={stats.gameCount}    color="#A855F7" />
            <StatCard icon="🎯" label="Sessions"  value={stats.sessionCount} color="#00D4FF" />
            <StatCard icon="👤" label="Users"     value={stats.userCount}    color="#22FFAA" />
            <StatCard icon="🤖" label="AI Gens"   value={stats.aiGenCount}   color="#EC4899" />
            <StatCard icon="🛡" label="Admins"    value={stats.adminCount}   color="#FFD700" />
          </div>
        ) : (
          <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.8rem", color: "rgba(232,224,255,0.25)" }}>
            Stats unavailable (backend may not be running).
          </div>
        )}
      </div>

      {/* ── Admin Management ── */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.85rem", color: "rgba(232,224,255,0.5)", letterSpacing: "0.15em" }}>
            ADMIN ACCOUNTS
          </h2>
          <button onClick={openAdd}
            style={{ padding: "7px 16px", background: "linear-gradient(135deg,#A855F7,#6366F1)", border: "none",
              borderRadius: "8px", color: "#fff", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
            + Add Admin
          </button>
        </div>

        {loadingAdmins ? (
          <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem", color: "rgba(232,224,255,0.3)" }}>Loading…</div>
        ) : admins.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px", fontFamily: "Exo 2, sans-serif", fontSize: "0.85rem", color: "rgba(232,224,255,0.3)" }}>
            No admins yet. Add one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {admins.map(admin => (
              <div key={admin.id} style={{
                display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
                padding: "14px 16px", borderRadius: "12px",
                background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)",
              }}>
                <div style={{ flex: "0 0 28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(135deg,#A855F7,#6366F1)", fontFamily: "Orbitron, sans-serif", fontSize: "0.7rem", color: "#fff", fontWeight: 900 }}>
                  {admin.name.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Exo 2, sans-serif", fontWeight: 700, color: "#E8E0FF", fontSize: "0.88rem" }}>
                    {admin.name}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "rgba(232,224,255,0.35)", marginTop: "2px" }}>
                    Created {new Date(admin.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {/* Access code — blurred, click to reveal & copy */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "6px", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)",
                    fontFamily: "monospace", fontSize: "0.78rem", color: "#FFD700",
                    letterSpacing: copiedId === admin.id ? "0.05em" : "0.25em",
                    filter: copiedId === admin.id ? "none" : "blur(4px)", cursor: "pointer", transition: "filter 0.3s",
                    userSelect: "none",
                  }}
                    title="Click to reveal & copy access code"
                    onClick={() => copyCode(admin.accessCode, admin.id)}>
                    {copiedId === admin.id ? "✓ Copied!" : admin.accessCode}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => openEdit(admin)}
                    style={{ padding: "6px 10px", borderRadius: "6px", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)",
                      color: "#C084FC", cursor: "pointer", fontFamily: "Exo 2, sans-serif", fontSize: "0.75rem" }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => setDeleteId(admin.id)}
                    style={{ padding: "6px 10px", borderRadius: "6px", background: "rgba(255,45,120,0.08)", border: "1px solid rgba(255,45,120,0.2)",
                      color: "#FF6090", cursor: "pointer", fontFamily: "Exo 2, sans-serif", fontSize: "0.75rem" }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Activity ── */}
      {recentSessions.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.85rem", color: "rgba(232,224,255,0.5)", letterSpacing: "0.15em", marginBottom: "12px" }}>
            RECENT SESSIONS
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recentSessions.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "10px",
                background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.1)", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "Exo 2, sans-serif", fontWeight: 700, color: "#E8E0FF", fontSize: "0.82rem", flex: 1 }}>
                  {s.playerName}
                </span>
                <span style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.75rem", color: "rgba(232,224,255,0.35)" }}>
                  {s.gameId}
                </span>
                <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.82rem", color: "#22FFAA", fontWeight: 700 }}>
                  {s.score.toLocaleString()} pts
                </span>
                <span style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.7rem", color: "rgba(232,224,255,0.25)" }}>
                  {new Date(s.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add / Edit Admin Modal ── */}
      {showAddForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,10,15,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddForm(false) }}>
          <div style={{ background: "#12121A", border: "1px solid rgba(168,85,247,0.25)", borderRadius: "16px",
            padding: "28px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ fontFamily: "Orbitron, sans-serif", color: "#E8E0FF", fontSize: "1rem", marginBottom: "18px" }}>
              {editingId ? "✏️ Edit Admin" : "➕ Add New Admin"}
            </h3>
            <label style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.75rem", color: "rgba(232,224,255,0.5)", display: "block", marginBottom: "4px" }}>
              Admin Name <span style={{ color: "#FF2D78" }}>*</span>
            </label>
            <input
              placeholder="e.g. Professor Ravi"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.2)",
                color: "#E8E0FF", fontFamily: "Exo 2, sans-serif", fontSize: "0.88rem" }}
            />
            <label style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.75rem", color: "rgba(232,224,255,0.5)", display: "block", marginBottom: "4px" }}>
              Access Code <span style={{ color: "#FF2D78" }}>*</span>
              <span style={{ marginLeft: "8px", color: "rgba(232,224,255,0.25)", fontSize: "0.68rem" }}>(the password the admin uses to log in)</span>
            </label>
            <input
              placeholder="e.g. RAVI2024"
              value={formCode}
              onChange={e => setFormCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleFormSubmit()}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", marginBottom: "16px", boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(168,85,247,0.2)",
                color: "#E8E0FF", fontFamily: "Exo 2, sans-serif", fontSize: "0.88rem", letterSpacing: "0.05em" }}
            />
            {formError   && <div style={{ color: "#FF6090", fontFamily: "Exo 2", fontSize: "0.78rem", marginBottom: "10px" }}>⚠️ {formError}</div>}
            {formSuccess  && <div style={{ color: "#22FFAA", fontFamily: "Exo 2", fontSize: "0.78rem", marginBottom: "10px" }}>{formSuccess}</div>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddForm(false)}
                style={{ padding: "9px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px", color: "rgba(232,224,255,0.4)", cursor: "pointer", fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem" }}>
                Cancel
              </button>
              <button onClick={handleFormSubmit} disabled={formLoading}
                style={{ padding: "9px 20px", background: "linear-gradient(135deg,#A855F7,#6366F1)", border: "none",
                  borderRadius: "8px", color: "#fff", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.82rem",
                  cursor: formLoading ? "not-allowed" : "pointer" }}>
                {formLoading ? "Saving…" : editingId ? "Update" : "Create Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,10,15,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={e => { if (e.target === e.currentTarget && !deleteLoading) setDeleteId(null) }}>
          <div style={{ background: "#12121A", border: "1px solid rgba(255,45,120,0.3)", borderRadius: "16px",
            padding: "28px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ fontFamily: "Orbitron, sans-serif", color: "#FF6090", fontSize: "1rem", marginBottom: "8px" }}>
              Remove Admin?
            </h3>
            <p style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem", color: "rgba(232,224,255,0.55)", marginBottom: "20px" }}>
              <strong style={{ color: "#E8E0FF" }}>{admins.find(a => a.id === deleteId)?.name}</strong> will immediately lose access to the Admin Panel. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => setDeleteId(null)} disabled={deleteLoading}
                style={{ padding: "9px 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px", color: "rgba(232,224,255,0.45)", cursor: "pointer", fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem" }}>
                Keep
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                style={{ padding: "9px 20px", background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.4)",
                  borderRadius: "8px", color: "#FF6090", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.82rem",
                  cursor: deleteLoading ? "not-allowed" : "pointer" }}>
                {deleteLoading ? "Removing…" : "🗑 Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
