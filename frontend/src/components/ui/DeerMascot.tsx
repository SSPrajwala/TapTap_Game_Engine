import React, { useState, useEffect } from "react"

export type DeerState = "idle" | "happy" | "sad" | "victory"

interface Props {
  state?:      DeerState
  /** Increment this on every trigger — forces re-animation for consecutive
   *  same-type answers (e.g. 3 correct in a row). */
  triggerKey?: number
  size?:       number
  showLabel?:  boolean
  /** Called when the mascot is clicked — used to open BlackbuckAI panel */
  onAIClick?: () => void
}

const DeerSVG: React.FC<{ state: DeerState; size: number }> = ({ state, size }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <defs>
        <filter id="happyGlow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feFlood floodColor="#22FFAA" floodOpacity="0.6" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="sadGlow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feFlood floodColor="#FF2D78" floodOpacity="0.5" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="victoryGlow">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feFlood floodColor="#FFD700" floodOpacity="0.7" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C4875A"/>
          <stop offset="100%" stopColor="#A0622A"/>
        </linearGradient>
        <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F0C090"/>
          <stop offset="100%" stopColor="#D4936A"/>
        </linearGradient>
        <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700"/>
          <stop offset="100%" stopColor="#FFA500"/>
        </linearGradient>
      </defs>

      {state === "idle" && (
        <g style={{ animation: "deerBreath 3s ease-in-out infinite", transformOrigin: "60px 100px" }}>
          <path d="M38,42 L32,22 L28,18 M32,22 L36,16 M32,22 L26,26" stroke="#6B3A1B" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          <path d="M82,42 L88,22 L92,18 M88,22 L84,16 M88,22 L94,26" stroke="#6B3A1B" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          <ellipse cx="34" cy="44" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(-20,34,44)"/>
          <ellipse cx="35" cy="44" rx="5" ry="7" fill="#E8A080" transform="rotate(-20,35,44)"/>
          <ellipse cx="86" cy="44" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(20,86,44)"/>
          <ellipse cx="85" cy="44" rx="5" ry="7" fill="#E8A080" transform="rotate(20,85,44)"/>
          <ellipse cx="60" cy="52" rx="26" ry="24" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="63" rx="14" ry="10" fill="url(#bellyGrad)"/>
          <ellipse cx="60" cy="60" rx="5" ry="4" fill="#D4605A"/>
          <circle cx="47" cy="48" r="7" fill="#1A0A00"/>
          <circle cx="73" cy="48" r="7" fill="#1A0A00"/>
          <circle cx="48" cy="46" r="2.5" fill="white"/>
          <circle cx="74" cy="46" r="2.5" fill="white"/>
          <path d="M54,68 Q60,72 66,68" stroke="#A05040" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <ellipse cx="60" cy="100" rx="28" ry="32" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="103" rx="18" ry="22" fill="url(#bellyGrad)"/>
          <ellipse cx="30" cy="98" rx="9" ry="16" fill="url(#bodyGrad)" transform="rotate(10,30,98)"/>
          <ellipse cx="90" cy="98" rx="9" ry="16" fill="url(#bodyGrad)" transform="rotate(-10,90,98)"/>
          <rect x="44" y="124" width="10" height="16" rx="5" fill="url(#bodyGrad)"/>
          <rect x="66" y="124" width="10" height="16" rx="5" fill="url(#bodyGrad)"/>
          <ellipse cx="49" cy="141" rx="6" ry="4" fill="#4A2810"/>
          <ellipse cx="71" cy="141" rx="6" ry="4" fill="#4A2810"/>
          <rect x="92" y="88" width="4" height="22" rx="2" fill="#FFEE99" transform="rotate(-20,92,88)"/>
          <polygon points="94,108 92,115 96,115" fill="#FF8C00" transform="rotate(-20,92,88)"/>
        </g>
      )}

      {state === "happy" && (
        <g filter="url(#happyGlow)" style={{ animation: "deerJump 0.6s cubic-bezier(0.34,1.56,0.64,1)", transformOrigin: "60px 100px" }}>
          <text x="8"  y="30" fontSize="12" fill="#FFD700">✦</text>
          <text x="100" y="25" fontSize="10" fill="#22FFAA">✦</text>
          <path d="M38,38 L30,16 L26,12 M30,16 L34,10 M30,16 L24,20" stroke="#6B3A1B" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          <path d="M82,38 L90,16 L94,12 M90,16 L86,10 M90,16 L96,20" stroke="#6B3A1B" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          <ellipse cx="34" cy="40" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(-20,34,40)"/>
          <ellipse cx="35" cy="40" rx="5" ry="7" fill="#E8A080" transform="rotate(-20,35,40)"/>
          <ellipse cx="86" cy="40" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(20,86,40)"/>
          <ellipse cx="85" cy="40" rx="5" ry="7" fill="#E8A080" transform="rotate(20,85,40)"/>
          <ellipse cx="60" cy="48" rx="26" ry="24" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="59" rx="14" ry="10" fill="url(#bellyGrad)"/>
          <circle cx="60" cy="56" r="6" fill="#FF4040"/>
          <path d="M41,46 Q47,40 53,46" stroke="#1A0A00" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d="M67,46 Q73,40 79,46" stroke="#1A0A00" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <circle cx="42" cy="54" r="7" fill="#FF8080" opacity="0.4"/>
          <circle cx="78" cy="54" r="7" fill="#FF8080" opacity="0.4"/>
          <path d="M50,65 Q60,75 70,65" stroke="#A05040" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <ellipse cx="60" cy="96" rx="26" ry="28" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="98" rx="16" ry="20" fill="url(#bellyGrad)"/>
          <ellipse cx="28" cy="82" rx="9" ry="16" fill="url(#bodyGrad)" transform="rotate(-50,28,82)"/>
          <ellipse cx="92" cy="82" rx="9" ry="16" fill="url(#bodyGrad)" transform="rotate(50,92,82)"/>
          <rect x="42" y="118" width="10" height="14" rx="5" fill="url(#bodyGrad)" transform="rotate(-15,42,118)"/>
          <rect x="68" y="118" width="10" height="14" rx="5" fill="url(#bodyGrad)" transform="rotate(15,68,118)"/>
          <polygon points="60,6 104,30 104,78 60,102 16,78 16,30" fill="none" stroke="#22FFAA" strokeWidth="2.5" opacity="0.7"/>
        </g>
      )}

      {state === "sad" && (
        <g filter="url(#sadGlow)" style={{ animation: "deerSadShake 0.5s ease-in-out", transformOrigin: "60px 100px" }}>
          <path d="M38,44 L34,28 L32,24 M34,28 L38,22 M34,28 L30,30" stroke="#6B3A1B" strokeWidth="3.5" strokeLinecap="round" fill="none" transform="rotate(10,40,44)"/>
          <path d="M82,44 L86,28 L88,24 M86,28 L82,22 M86,28 L90,30" stroke="#6B3A1B" strokeWidth="3.5" strokeLinecap="round" fill="none" transform="rotate(-10,80,44)"/>
          <ellipse cx="34" cy="48" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(-15,34,48)"/>
          <ellipse cx="35" cy="48" rx="5" ry="7" fill="#E8A080" transform="rotate(-15,35,48)"/>
          <ellipse cx="86" cy="48" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(15,86,48)"/>
          <ellipse cx="85" cy="48" rx="5" ry="7" fill="#E8A080" transform="rotate(15,85,48)"/>
          <ellipse cx="60" cy="56" rx="26" ry="24" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="67" rx="14" ry="10" fill="url(#bellyGrad)"/>
          <ellipse cx="60" cy="64" rx="5" ry="4" fill="#D4605A"/>
          <circle cx="47" cy="52" r="7" fill="#1A0A00"/>
          <circle cx="73" cy="52" r="7" fill="#1A0A00"/>
          <circle cx="48" cy="50" r="2.5" fill="white"/>
          <circle cx="74" cy="50" r="2.5" fill="white"/>
          <path d="M41,44 Q47,48 53,44" stroke="#6B3A1B" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M67,44 Q73,48 79,44" stroke="#6B3A1B" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M52,73 Q60,68 68,73" stroke="#A05040" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <ellipse cx="50" cy="60" rx="3" ry="4" fill="#88CCFF" style={{ animation: "tearFall 1s ease-in infinite" }}/>
          <ellipse cx="60" cy="104" rx="26" ry="28" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="107" rx="16" ry="19" fill="url(#bellyGrad)"/>
          <ellipse cx="32" cy="106" rx="9" ry="16" fill="url(#bodyGrad)" transform="rotate(20,32,106)"/>
          <ellipse cx="88" cy="106" rx="9" ry="16" fill="url(#bodyGrad)" transform="rotate(-20,88,106)"/>
          <rect x="44" y="126" width="10" height="14" rx="5" fill="url(#bodyGrad)"/>
          <rect x="66" y="126" width="10" height="14" rx="5" fill="url(#bodyGrad)"/>
          <ellipse cx="49" cy="141" rx="6" ry="4" fill="#4A2810"/>
          <ellipse cx="71" cy="141" rx="6" ry="4" fill="#4A2810"/>
          <polygon points="60,6 104,30 104,78 60,102 16,78 16,30" fill="none" stroke="#FF2D78" strokeWidth="2.5" opacity="0.6"/>
        </g>
      )}

      {state === "victory" && (
        <g filter="url(#victoryGlow)" style={{ animation: "deerVictoryDance 1s cubic-bezier(0.34,1.56,0.64,1)", transformOrigin: "60px 100px" }}>
          <rect x="15" y="20" width="5" height="8" rx="2" fill="#A855F7" transform="rotate(30,15,20)"/>
          <rect x="95" y="15" width="5" height="8" rx="2" fill="#00D4FF" transform="rotate(-20,95,15)"/>
          <text x="5"  y="40" fontSize="10" fill="#FFD700">✦</text>
          <text x="105" y="35" fontSize="12" fill="#22FFAA">✦</text>
          <path d="M38,36 L28,12 L22,6 M28,12 L32,6 M28,12 L22,16" stroke="#6B3A1B" strokeWidth="4" strokeLinecap="round" fill="none"/>
          <path d="M82,36 L92,12 L98,6 M92,12 L88,6 M92,12 L98,16" stroke="#6B3A1B" strokeWidth="4" strokeLinecap="round" fill="none"/>
          <ellipse cx="34" cy="42" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(-20,34,42)"/>
          <ellipse cx="35" cy="42" rx="5" ry="7" fill="#E8A080" transform="rotate(-20,35,42)"/>
          <ellipse cx="86" cy="42" rx="9" ry="12" fill="url(#bodyGrad)" transform="rotate(20,86,42)"/>
          <ellipse cx="85" cy="42" rx="5" ry="7" fill="#E8A080" transform="rotate(20,85,42)"/>
          <ellipse cx="60" cy="50" rx="26" ry="24" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="61" rx="14" ry="10" fill="url(#bellyGrad)"/>
          <circle cx="60" cy="58" r="6" fill="#FFD700"/>
          <text x="40" y="54" fontSize="14" fill="#FFD700" textAnchor="middle">★</text>
          <text x="80" y="54" fontSize="14" fill="#FFD700" textAnchor="middle">★</text>
          <circle cx="42" cy="57" r="7" fill="#FF8080" opacity="0.5"/>
          <circle cx="78" cy="57" r="7" fill="#FF8080" opacity="0.5"/>
          <path d="M50,67 Q60,78 70,67" stroke="#A05040" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <ellipse cx="60" cy="96" rx="26" ry="28" fill="url(#bodyGrad)"/>
          <ellipse cx="60" cy="98" rx="16" ry="20" fill="url(#bellyGrad)"/>
          <ellipse cx="90" cy="78" rx="9" ry="18" fill="url(#bodyGrad)" transform="rotate(50,90,78)"/>
          <ellipse cx="30" cy="92" rx="9" ry="16" fill="url(#bodyGrad)" transform="rotate(-30,30,92)"/>
          <g transform="translate(88,50) rotate(15)">
            <rect x="-5" y="12" width="10" height="3" rx="1.5" fill="url(#trophyGrad)"/>
            <rect x="-3" y="8" width="6" height="6" rx="1" fill="url(#trophyGrad)"/>
            <path d="M-8,0 Q-10,-8 -6,-10 Q0,-14 6,-10 Q10,-8 8,0 Z" fill="url(#trophyGrad)"/>
            <path d="M-8,0 Q-12,2 -10,6 L-8,0" fill="url(#trophyGrad)"/>
            <path d="M8,0 Q12,2 10,6 L8,0" fill="url(#trophyGrad)"/>
            <text x="0" y="-3" fontSize="6" fill="#8B5A00" textAnchor="middle" fontWeight="bold">★</text>
          </g>
          <rect x="44" y="118" width="10" height="14" rx="5" fill="url(#bodyGrad)" transform="rotate(-20,44,118)"/>
          <rect x="66" y="118" width="10" height="14" rx="5" fill="url(#bodyGrad)" transform="rotate(20,76,118)"/>
          <polygon points="60,4 106,28 106,80 60,104 14,80 14,28" fill="none" stroke="#FFD700" strokeWidth="3" opacity="0.8"/>
        </g>
      )}
    </svg>
  )
}

export const DeerMascot: React.FC<Props> = ({ state = "idle", triggerKey = 0, size = 90, showLabel = false, onAIClick }) => {
  const [currentState, setCurrentState] = useState<DeerState>(state)

  useEffect(() => {
    // triggerKey is an extra dependency — it increments on every trigger from
    // useDeerMascot, so even consecutive same-type answers re-run this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentState(state)
    if (state !== "idle") {
      const duration = state === "victory" ? 2000 : state === "happy" ? 1200 : 900
      const timer = setTimeout(() => setCurrentState("idle"), duration)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, triggerKey])

  // Fills: idle has a subtle tint; reactions are nearly transparent so the
  // mascot artwork is clearly visible (ring + glow carry the colour signal).
  const hexColors: Record<DeerState, string> = {
    idle:    "rgba(0,212,255,0.10)",
    happy:   "rgba(34,255,170,0.05)",
    sad:     "rgba(255,45,120,0.05)",
    victory: "rgba(255,215,0,0.07)",
  }

  const hexBorders: Record<DeerState, string> = {
    idle: "#00D4FF", happy: "#22FFAA", sad: "#FF2D78", victory: "#FFD700",
  }

  // For non-idle states, render an animated outer ring instead of a filled overlay.
  const ringAnimStyle: React.CSSProperties | undefined =
    currentState !== "idle"
      ? {
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          border: `3px solid ${hexBorders[currentState]}`,
          boxShadow: `0 0 16px ${hexBorders[currentState]}, 0 0 40px ${hexBorders[currentState]}80`,
          animation: "ringPulse 0.5s ease-out",
          pointerEvents: "none",
        }
      : undefined

  const labels: Record<DeerState, string> = {
    idle: "", happy: "CORRECT! ✓", sad: "WRONG ✗", victory: "WINNER! 🏆",
  }

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      {showLabel && currentState !== "idle" && (
        <div style={{
          background: hexColors[currentState],
          border: `1px solid ${hexBorders[currentState]}`,
          borderRadius: "99px", padding: "4px 12px",
          fontSize: "0.68rem", fontFamily: "Orbitron, monospace",
          fontWeight: 800, color: hexBorders[currentState],
          letterSpacing: "0.1em",
          boxShadow: `0 0 14px ${hexColors[currentState]}`,
          animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          whiteSpace: "nowrap",
        }}>
          {labels[currentState]}
        </div>
      )}

      {/* AI hint tooltip — shown above the mascot when onAIClick is set */}
      {onAIClick && currentState === "idle" && (
        <div
          title="Chat with Blackbuck AI"
          style={{
            background: "rgba(0,212,255,0.15)",
            border: "1px solid rgba(0,212,255,0.4)",
            borderRadius: "99px", padding: "3px 10px",
            fontSize: "0.62rem", fontFamily: "Orbitron, monospace",
            fontWeight: 700, color: "#00D4FF",
            letterSpacing: "0.08em", cursor: "pointer",
            whiteSpace: "nowrap",
            animation: "pulse 2.5s ease-in-out infinite",
          }}
          onClick={onAIClick}
        >
          🤖 ASK AI
        </div>
      )}

      <div
        onClick={onAIClick}
        style={{
          position: "relative", width: size + 20, height: size + 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: onAIClick ? "pointer" : "default",
          transition: "transform 0.2s",
        }}
        title={onAIClick ? "Click to chat with Blackbuck AI" : undefined}
      >
        {/* Ring flash — replaces the full-fill colour overlay on reactions */}
        {ringAnimStyle && <div key={currentState} style={ringAnimStyle} />}

        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg">
          <polygon points="55,5 100,30 100,80 55,105 10,80 10,30"
            fill={hexColors[currentState]}
            stroke={hexBorders[currentState]}
            strokeWidth={currentState !== "idle" ? "3.5" : "2.5"}
            style={{
              filter: currentState !== "idle"
                ? `drop-shadow(0 0 14px ${hexBorders[currentState]})`
                : `drop-shadow(0 0 8px ${hexBorders[currentState]})`,
              transition: "all 0.3s",
            }}
          />
        </svg>
        <DeerSVG state={currentState} size={size} />
      </div>
    </div>
  )
}

// useDeerMascot hook lives in hooks/useDeerMascot.ts to keep this file component-only.