import React from "react"

interface Props {
  gameCount:    number
  questionCount: number
}

export const Footer: React.FC<Props> = ({ gameCount, questionCount }) => (
  <footer style={{
    marginTop:   "48px",
    background:  "rgba(8, 6, 24, 0.7)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border:      "1px solid rgba(168,85,247,0.15)",
    borderRadius: "2px 18px 2px 18px",
    padding:     "20px 28px",
    boxShadow:   "0 -4px 30px rgba(0,0,0,0.3)",
    position:    "relative",
    overflow:    "hidden",
  }}>
    {/* Top glow line */}
    <div style={{
      position:   "absolute",
      top:        0, left: "10%", right: "10%",
      height:     "1px",
      background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.6), rgba(0,212,255,0.6), transparent)",
    }} />

    <div style={{
      display:    "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap:   "wrap",
      gap:        "12px",
    }}>
      {/* Left */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.72rem", color: "rgba(232,224,255,0.25)", letterSpacing: "0.15em" }}>
          TAPTAP ADAPTIVE GAME ENGINE
        </span>
        <span style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.72rem", color: "rgba(232,224,255,0.3)" }}>
          Built by S. S. Prajwala · Blackbucks Hackathon 2026
        </span>
      </div>

      {/* Center stats */}
      <div style={{ display: "flex", gap: "20px" }}>
        {[
          { label: "Games",     value: gameCount,     color: "#A855F7" },
          { label: "Questions", value: questionCount,  color: "#00D4FF" },
          { label: "Plugins",   value: 6,              color: "#22FFAA" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: "1rem", fontWeight: 900, color, filter: `drop-shadow(0 0 6px ${color})` }}>{value}</div>
            <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.62rem", color: "rgba(232,224,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Right */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <a href="https://github.com/SSPrajwala/taptap_adaptive_game_engine_deployed" target="_blank" rel="noreferrer"
          style={{
            color:       "rgba(232,224,255,0.4)",
            fontSize:    "0.72rem",
            fontFamily:  "Exo 2, sans-serif",
            textDecoration: "none",
            display:     "flex",
            alignItems:  "center",
            gap:         "5px",
            transition:  "color 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#A855F7")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(232,224,255,0.4)")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>

        <span style={{ color: "rgba(232,224,255,0.15)", fontSize: "0.72rem" }}>·</span>

        <span style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.68rem", color: "rgba(232,224,255,0.25)" }}>
          v2.0.0 · JSON-driven · Plugin-based
        </span>
      </div>
    </div>
  </footer>
)