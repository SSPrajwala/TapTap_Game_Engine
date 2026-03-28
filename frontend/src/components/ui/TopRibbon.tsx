import React, { useState } from "react"
import type { AuthUser } from "../../context/AuthContext"
import logoSrc from "../../assets/logo.png"

interface Props {
  onSearchGame?:  (query: string) => void
  onShowDocs?:    () => void
  onShowAbout?:   () => void
  onShowSignIn?:  () => void
  onShowProfile?: () => void
  user?:          AuthUser | null
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "?"
}

export const TopRibbon: React.FC<Props> = ({
  onSearchGame, onShowDocs, onShowAbout, onShowSignIn, onShowProfile, user,
}) => {
  const [searchVal,   setSearchVal]   = useState("")
  const [searchFocus, setSearchFocus] = useState(false)

  const [docsHover,   setDocsHover]   = useState(false)
  const [aboutHover,  setAboutHover]  = useState(false)
  const [signinHover, setSigninHover] = useState(false)
  const [signupHover, setSignupHover] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearchGame?.(searchVal)
  }

  const navStyle = (hovered: boolean): React.CSSProperties => ({
    background:   hovered ? "rgba(168,85,247,0.1)" : "transparent",
    color:        hovered ? "#E8E0FF" : "rgba(232,224,255,0.55)",
    fontSize:     "0.78rem",
    padding:      "6px 12px",
    borderRadius: "8px",
    fontFamily:   "Exo 2, sans-serif",
    fontWeight:   600,
    border:       "none",
    cursor:       "pointer",
    display:      "flex",
    alignItems:   "center",
    gap:          "5px",
    transition:   "all 0.2s",
  })

  return (
    <header style={{
      position:       "sticky",
      top:            0,
      zIndex:         500,
      background:     "rgba(8,6,24,0.75)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom:   "1px solid rgba(168,85,247,0.2)",
      boxShadow:      "0 4px 30px rgba(0,0,0,0.4)",
      padding:        "0 24px",
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", height: "60px", display: "flex", alignItems: "center", gap: "16px" }}>

        {/* ── Logo ──────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <img
            src={logoSrc}
            alt="TapTap Game Engine"
            style={{
              width:  "42px",
              height: "42px",
              objectFit: "contain",
              filter: "drop-shadow(0 0 8px rgba(168,85,247,0.7))",
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{
              fontFamily: "Orbitron, monospace",
              fontSize:   "0.88rem",
              fontWeight: 900,
              background: "linear-gradient(135deg, #C0C0D8 0%, #E8E8FF 40%, #A855F7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor:  "transparent",
              backgroundClip: "text",
              letterSpacing: "0.05em",
            }}>
              TapTaP
            </span>
            <span style={{
              fontFamily:    "Orbitron, monospace",
              fontSize:      "0.46rem",
              color:         "rgba(168,85,247,0.55)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}>
              Game Engine
            </span>
          </div>
        </div>

        {/* ── Search ────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: "340px", margin: "0 auto" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: searchFocus ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.06)",
            border: `1px solid ${searchFocus ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.2)"}`,
            borderRadius: "99px", padding: "6px 14px", transition: "all 0.2s",
            boxShadow: searchFocus ? "0 0 16px rgba(168,85,247,0.25)" : "none",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={searchVal}
              onChange={e => { setSearchVal(e.target.value); onSearchGame?.(e.target.value) }}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search games..."
              style={{ background: "transparent", border: "none", outline: "none", color: "#E8E0FF", fontSize: "0.82rem", fontFamily: "Exo 2,sans-serif", width: "100%" }}
            />
            {searchVal && (
              <button type="button" onClick={() => { setSearchVal(""); onSearchGame?.("") }}
                style={{ background: "transparent", color: "rgba(232,224,255,0.4)", fontSize: "0.8rem", padding: "0 2px", border: "none", cursor: "pointer", lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>
        </form>

        {/* ── Nav ───────────────────────────────────────────────────────────── */}
        <nav style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>

          {/* Docs */}
          <button onClick={onShowDocs} style={navStyle(docsHover)}
            onMouseEnter={() => setDocsHover(true)} onMouseLeave={() => setDocsHover(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
            Docs
          </button>

          {/* About */}
          <button onClick={onShowAbout} style={navStyle(aboutHover)}
            onMouseEnter={() => setAboutHover(true)} onMouseLeave={() => setAboutHover(false)}>
            About
          </button>

          <div style={{ width: "1px", height: "20px", background: "rgba(168,85,247,0.2)", margin: "0 4px" }} />

          {/* ── LOGGED OUT: Sign In + Sign Up ──────────────────────────────── */}
          {!user && (
            <>
              <button
                onClick={onShowSignIn}
                style={{
                  ...navStyle(signinHover),
                  border: `1px solid ${signinHover ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.2)"}`,
                }}
                onMouseEnter={() => setSigninHover(true)}
                onMouseLeave={() => setSigninHover(false)}
              >
                Sign In
              </button>

              <button
                onClick={onShowSignIn}
                style={{
                  background:   signupHover
                    ? "linear-gradient(135deg,#9333EA,#2563EB)"
                    : "linear-gradient(135deg,#A855F7,#3B82F6)",
                  color:        "#fff",
                  fontSize:     "0.78rem",
                  padding:      "7px 16px",
                  borderRadius: "8px",
                  fontFamily:   "Exo 2,sans-serif",
                  fontWeight:   700,
                  border:       "none",
                  cursor:       "pointer",
                  boxShadow:    signupHover ? "0 0 24px rgba(168,85,247,0.6)" : "0 0 14px rgba(168,85,247,0.4)",
                  transform:    signupHover ? "scale(1.05)" : "scale(1)",
                  transition:   "all 0.2s",
                }}
                onMouseEnter={() => setSignupHover(true)}
                onMouseLeave={() => setSignupHover(false)}
              >
                Sign Up
              </button>
            </>
          )}

          {/* ── LOGGED IN: User avatar + name ─────────────────────────────── */}
          {user && (
            <button
              onClick={onShowProfile}
              title={`${user.name} — View profile`}
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          "8px",
                background:   "rgba(168,85,247,0.08)",
                border:       "1px solid rgba(168,85,247,0.25)",
                borderRadius: "99px",
                padding:      "4px 12px 4px 4px",
                cursor:       "pointer",
                transition:   "all 0.2s",
                marginLeft:   "4px",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.16)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.5)"
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.08)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.25)"
              }}
            >
              {/* Avatar circle */}
              <div style={{
                width:        "28px",
                height:       "28px",
                borderRadius: "50%",
                background:   "linear-gradient(135deg,#A855F7,#3B82F6)",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                fontFamily:   "Orbitron,monospace",
                fontSize:     "0.65rem",
                fontWeight:   900,
                color:        "#fff",
                flexShrink:   0,
              }}>
                {initials(user.name)}
              </div>
              {/* Name */}
              <span style={{
                fontFamily:  "Exo 2, sans-serif",
                fontSize:    "0.78rem",
                fontWeight:  600,
                color:       "#E8E0FF",
                maxWidth:    "90px",
                overflow:    "hidden",
                textOverflow:"ellipsis",
                whiteSpace:  "nowrap",
              }}>
                {user.name.split(" ")[0]}
              </span>
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
