import React, { useState } from "react"

const ADMIN_API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001/api") + "/admin"

interface Props {
  open:      boolean
  onClose:   () => void
  onSuccess: (adminToken: string, adminName: string) => void
}

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width:        "100%",
  background:   "rgba(168,85,247,0.07)",
  border:       `1px solid ${hasError ? "rgba(255,45,120,0.4)" : "rgba(168,85,247,0.25)"}`,
  borderRadius: "10px",
  padding:      "12px 14px",
  color:        "#E8E0FF",
  fontFamily:   "Exo 2, sans-serif",
  fontSize:     "0.88rem",
  outline:      "none",
  boxSizing:    "border-box" as const,
  transition:   "border-color 0.2s",
})

const labelStyle: React.CSSProperties = {
  display:       "block",
  fontFamily:    "Exo 2, sans-serif",
  fontSize:      "0.72rem",
  fontWeight:    600,
  color:         "rgba(232,224,255,0.45)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom:  "7px",
}

export const AdminAuthOverlay: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [adminName,   setAdminName]   = useState("")
  const [accessCode,  setAccessCode]  = useState("")
  const [error,       setError]       = useState("")
  const [loading,     setLoading]     = useState(false)

  if (!open) return null

  const handleVerify = async () => {
    setError("")
    if (!adminName.trim())  { setError("Please enter your admin name."); return }
    if (!accessCode.trim()) { setError("Please enter your access code."); return }

    setLoading(true)
    try {
      const res  = await fetch(`${ADMIN_API}/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ adminName: adminName.trim(), accessCode: accessCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Invalid name or code.")
        setLoading(false)
        return
      }
      setAdminName("")
      setAccessCode("")
      onSuccess(data.token, data.admin.name)
      onClose()
    } catch {
      setError("Cannot reach backend. Is the server running on port 3001?")
    }
    setLoading(false)
  }

  const handleClose = () => {
    setAdminName(""); setAccessCode(""); setError("")
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: "fixed", inset: 0, zIndex: 950,
        background:     "rgba(4,2,16,0.85)",
        backdropFilter: "blur(8px)",
        animation:      "overlayFadeIn 0.2s ease",
      }} />

      {/* Modal */}
      <div style={{
        position:       "fixed",
        top:            "50%",
        left:           "50%",
        transform:      "translate(-50%,-50%)",
        zIndex:         951,
        width:          "min(440px, 92vw)",
        background:     "rgba(9,6,26,0.97)",
        backdropFilter: "blur(40px)",
        border:         "1px solid rgba(168,85,247,0.3)",
        borderRadius:   "18px",
        padding:        "36px 32px",
        boxShadow:      "0 0 80px rgba(0,0,0,0.9), 0 0 30px rgba(168,85,247,0.2)",
        animation:      "slideInCenter 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>

        {/* Icon + title */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            display: "inline-flex", width: "56px", height: "56px",
            borderRadius: "14px",
            background:   "linear-gradient(135deg,rgba(168,85,247,0.2),rgba(59,130,246,0.2))",
            border:       "1px solid rgba(168,85,247,0.3)",
            alignItems:   "center", justifyContent: "center",
            fontSize: "1.6rem", marginBottom: "14px",
          }}>🔐</div>
          <div style={{
            fontFamily: "Orbitron, monospace", fontSize: "1rem", fontWeight: 800,
            background: "linear-gradient(135deg,#C0C0D8,#E8E8FF,#A855F7)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>Admin Access</div>
          <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.8rem", color: "rgba(232,224,255,0.4)", marginTop: "6px" }}>
            Both name and code must match the database
          </div>
        </div>

        {/* Admin Name field */}
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Admin Name <span style={{ color: "#FF2D78" }}>*</span></label>
          <input
            type="text"
            value={adminName}
            onChange={e => { setAdminName(e.target.value); setError("") }}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
            placeholder="Enter your registered admin name"
            autoFocus
            style={inputStyle(!!error && !adminName.trim())}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(168,85,247,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.12)" }}
            onBlur={e =>  { e.currentTarget.style.borderColor = "rgba(168,85,247,0.25)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        {/* Access Code field */}
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Access Code <span style={{ color: "#FF2D78" }}>*</span></label>
          <input
            type="password"
            value={accessCode}
            onChange={e => { setAccessCode(e.target.value); setError("") }}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
            placeholder="••••••••••••••"
            style={{ ...inputStyle(!!error && !accessCode.trim()), fontFamily: "monospace", fontSize: "1rem", letterSpacing: "0.2em" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(168,85,247,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.12)" }}
            onBlur={e =>  { e.currentTarget.style.borderColor = "rgba(168,85,247,0.25)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.3)",
            borderRadius: "8px", padding: "9px 12px",
            color: "#FF6090", fontFamily: "Exo 2, sans-serif", fontSize: "0.8rem",
            marginBottom: "14px",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleClose} style={{
            flex: 1, padding: "11px",
            background: "transparent", border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: "10px", color: "rgba(232,224,255,0.45)",
            fontFamily: "Exo 2, sans-serif", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={handleVerify} disabled={loading} style={{
            flex: 2, padding: "11px",
            background:   loading ? "rgba(168,85,247,0.3)" : "linear-gradient(135deg,#A855F7,#3B82F6)",
            border:       "none", borderRadius: "10px", color: "#fff",
            fontFamily:   "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.9rem",
            cursor:       loading ? "not-allowed" : "pointer",
            boxShadow:    loading ? "none" : "0 0 20px rgba(168,85,247,0.4)",
          }}>
            {loading ? "Verifying…" : "Enter Admin Panel →"}
          </button>
        </div>

        {/* Info */}
        <div style={{
          marginTop: "18px", padding: "10px 12px",
          background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.1)", borderRadius: "8px",
          color: "rgba(232,224,255,0.25)", fontFamily: "Exo 2, sans-serif", fontSize: "0.7rem", lineHeight: 1.6,
        }}>
          🔒 Demo credentials — Name: <code style={{ color: "rgba(168,85,247,0.5)" }}>Engine Owner</code>&nbsp; Code: <code style={{ color: "rgba(168,85,247,0.5)" }}>TAPTAP-ADMIN-2024</code><br />
          All changes are saved to the game JSON files and logged with your admin name.
        </div>
      </div>
    </>
  )
}
