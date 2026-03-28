import React, { useEffect, useState } from "react"
import sublogoSrc from "../../assets/sublogo.png"

interface Props {
  onComplete: () => void
}

// Five cinematic phases:
//  dormant   → logo fades in + sharpens
//  reveal    → holographic shimmer sweeps across logo
//  title     → "ADAPTIVE GAME ENGINE" text slides up
//  electric  → neon rings pulse outward + particles burst
//  exit      → everything flares white → fade out
type Phase = "dormant" | "reveal" | "title" | "electric" | "exit"

export const SplashScreen: React.FC<Props> = ({ onComplete }) => {
  const [phase,   setPhase]   = useState<Phase>("dormant")
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t0 = setTimeout(() => setPhase("reveal"),   200)
    const t1 = setTimeout(() => setPhase("title"),    900)
    const t2 = setTimeout(() => setPhase("electric"), 1600)
    const t3 = setTimeout(() => setPhase("exit"),     2900)
    const t4 = setTimeout(() => setVisible(false),    3400)
    const t5 = setTimeout(() => onComplete(),         3900)
    return () => { [t0,t1,t2,t3,t4,t5].forEach(clearTimeout) }
  }, [onComplete])

  const isRevealed  = phase !== "dormant"
  const showTitle   = phase === "title" || phase === "electric" || phase === "exit"
  const showElec    = phase === "electric" || phase === "exit"
  const isExiting   = phase === "exit"

  /* ── Particle positions (fixed so no re-render jitter) ── */
  const PARTICLES = [
    { x: 15, y: 22, d: 0.0 }, { x: 82, y: 18, d: 0.1 }, { x: 92, y: 55, d: 0.2 },
    { x: 75, y: 85, d: 0.3 }, { x: 25, y: 80, d: 0.4 }, { x: 8,  y: 60, d: 0.5 },
    { x: 50, y: 8,  d: 0.15},{ x: 50, y: 92, d: 0.25}, { x: 5,  y: 38, d: 0.35},
    { x: 95, y: 38, d: 0.45},{ x: 38, y: 5,  d: 0.55},{ x: 62, y: 5,  d: 0.0 },
  ]

  return (
    <div style={{
      position:   "fixed",
      inset:      0,
      background: "#030208",
      display:    "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex:     9999,
      opacity:    visible ? 1 : 0,
      transition: "opacity 0.55s cubic-bezier(0.4,0,0.2,1)",
      overflow:   "hidden",
    }}>

      {/* ── Deep space background gradient ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          radial-gradient(ellipse 60% 40% at 50% 30%, rgba(168,85,247,0.14) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 80% 70%, rgba(0,212,255,0.10) 0%, transparent 60%),
          radial-gradient(ellipse 30% 25% at 20% 65%, rgba(34,255,170,0.07) 0%, transparent 60%)
        `,
      }} />

      {/* ── Hex tile grid (very faint) ── */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.05,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='69'%3E%3Cpolygon points='30,2 58,17 58,52 30,67 2,52 2,17' fill='none' stroke='rgba(168,85,247,1)' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: "60px 69px",
        animation: "splashHexDrift 25s linear infinite",
      }} />

      {/* ── Scan-line overlay (subtle CRT feel) ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
        zIndex: 2,
      }} />

      {/* ══ LOGO STAGE ══════════════════════════════════════════════════ */}
      <div style={{
        position: "relative",
        display:  "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex:   10,
      }}>

        {/* ── Outer glow ring (expands during electric phase) ── */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width:  showElec ? "380px" : "260px",
          height: showElec ? "380px" : "260px",
          borderRadius: "50%",
          background: "transparent",
          border: showElec
            ? "2px solid rgba(168,85,247,0.5)"
            : "1px solid rgba(168,85,247,0.15)",
          boxShadow: showElec
            ? "0 0 60px rgba(168,85,247,0.4), inset 0 0 60px rgba(168,85,247,0.08), 0 0 120px rgba(0,212,255,0.15)"
            : "none",
          transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)",
          animation: showElec ? "splashPulseRing 2s ease-in-out infinite" : "none",
        }} />

        {/* ── Second expanding ring — kept inside logo area only ── */}
        {showElec && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "260px", height: "260px",
            borderRadius: "50%",
            border: "1px solid rgba(0,212,255,0.2)",
            animation: "splashRingExpand 2.5s ease-out infinite",
            pointerEvents: "none",
          }} />
        )}

        {/* ── Particle sparkles around logo ── */}
        {showElec && PARTICLES.map((p, i) => (
          <div key={i} style={{
            position: "absolute",
            top:  `calc(50% + ${(p.y - 50) * 2.6}px)`,
            left: `calc(50% + ${(p.x - 50) * 2.6}px)`,
            width:  i % 3 === 0 ? "4px" : "3px",
            height: i % 3 === 0 ? "4px" : "3px",
            borderRadius: "50%",
            background: ["#A855F7","#00D4FF","#22FFAA","#FF2D78","#FFD700"][i % 5],
            boxShadow: `0 0 8px ${["#A855F7","#00D4FF","#22FFAA","#FF2D78","#FFD700"][i % 5]}`,
            animation: `splashParticle${(i % 3) + 1} 1.8s ease-out ${p.d}s infinite`,
          }} />
        ))}

        {/* ── The logo image ── */}
        <div style={{
          position: "relative",
          width:  "220px",
          height: "220px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {/* Holographic shimmer — sweeps left-to-right across the logo */}
          <div style={{
            position: "absolute", inset: 0,
            borderRadius: "8px",
            overflow: "hidden",
            background: isRevealed
              ? "linear-gradient(105deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.22) 45%, rgba(168,85,247,0.12) 55%, rgba(255,255,255,0) 75%)"
              : "none",
            animation: isRevealed ? "splashShimmer 2.5s ease-in-out infinite" : "none",
            zIndex: 3,
            pointerEvents: "none",
          }} />

          <img
            src={sublogoSrc}
            alt="TapTap Game Engine"
            style={{
              width:  "210px",
              height: "210px",
              objectFit: "contain",
              opacity:   isRevealed ? 1 : 0,
              transform: isRevealed
                ? (isExiting ? "scale(1.08)" : showElec ? "scale(1.04)" : "scale(1)")
                : "scale(0.7)",
              transition: "opacity 0.7s cubic-bezier(0.4,0,0.2,1), transform 0.7s cubic-bezier(0.34,1.56,0.64,1), filter 0.5s",
              filter: isExiting
                ? "drop-shadow(0 0 32px rgba(255,255,255,0.9)) drop-shadow(0 0 48px rgba(168,85,247,1)) brightness(1.4)"
                : showElec
                  ? "drop-shadow(0 0 20px rgba(168,85,247,0.9)) drop-shadow(0 0 40px rgba(0,212,255,0.5)) brightness(1.08)"
                  : isRevealed
                    ? "drop-shadow(0 0 12px rgba(168,85,247,0.5)) brightness(1.04)"
                    : "none",
              position: "relative",
              zIndex: 2,
            }}
          />
        </div>

        {/* ── Tagline block ── */}
        <div style={{
          display:    "flex",
          flexDirection: "column",
          alignItems: "center",
          gap:        "6px",
          marginTop:  "-4px",
          opacity:    showTitle ? 1 : 0,
          transform:  showTitle ? "translateY(0)" : "translateY(28px)",
          transition: "opacity 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        }}>

          {/* Top rule lines — use rgba(...,0) not 'transparent' to avoid black-flash */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(168,85,247,0), rgba(168,85,247,0.6))" }} />
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#A855F7", boxShadow: "0 0 10px #A855F7" }} />
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, rgba(168,85,247,0), rgba(168,85,247,0.6))" }} />
          </div>

          {/* "TAP TAP" wordmark — background is FIXED (never changes to avoid repaint flash) */}
          <div style={{
            fontFamily:    "Orbitron, monospace",
            fontSize:      "clamp(1.6rem, 5vw, 2.2rem)",
            fontWeight:    900,
            letterSpacing: "0.18em",
            background:    "linear-gradient(135deg, #E0D8FF 0%, #C8B8FF 40%, #A855F7 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor:  "transparent",
            backgroundClip: "text",
            filter:        showElec ? "drop-shadow(0 0 14px rgba(168,85,247,0.9))" : "drop-shadow(0 0 0px rgba(168,85,247,0))",
            transition:    "filter 0.6s ease",
          }}>
            TAP TAP
          </div>

          {/* "GAME ENGINE" subtitle — background is FIXED */}
          <div style={{
            fontFamily:    "Orbitron, monospace",
            fontSize:      "clamp(0.75rem, 2vw, 0.95rem)",
            fontWeight:    700,
            letterSpacing: "0.38em",
            textTransform: "uppercase",
            background:    "linear-gradient(135deg, #8855CC 0%, #0099BB 60%, #22DDAA 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor:  "transparent",
            backgroundClip: "text",
            filter:        showElec ? "drop-shadow(0 0 10px rgba(0,212,255,0.85))" : "drop-shadow(0 0 0px rgba(0,212,255,0))",
            transition:    "filter 0.6s ease",
          }}>
            GAME ENGINE
          </div>

          {/* Bottom rule lines — use rgba(...,0) not 'transparent' */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(0,212,255,0), rgba(0,212,255,0.5))" }} />
            <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 8px #00D4FF" }} />
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, rgba(0,212,255,0), rgba(0,212,255,0.5))" }} />
          </div>
        </div>

        {/* ── Loading indicator ── */}
        <div style={{
          display:    "flex",
          gap:        "7px",
          marginTop:  "28px",
          opacity:    showElec ? 1 : 0,
          transition: "opacity 0.4s",
        }}>
          {[
            { c: "#A855F7", d: "0s"   },
            { c: "#00D4FF", d: "0.15s" },
            { c: "#22FFAA", d: "0.3s"  },
          ].map((dot, i) => (
            <div key={i} style={{
              width: "8px", height: "8px",
              borderRadius: "50%",
              background: dot.c,
              boxShadow:  `0 0 12px ${dot.c}`,
              animation: `splashDot 0.9s ease-in-out ${dot.d} infinite`,
            }} />
          ))}
        </div>
      </div>

      {/* ── Bottom build tag ── */}
      <div style={{
        position:   "absolute",
        bottom:     "24px",
        left:       "50%",
        transform:  "translateX(-50%)",
        fontFamily: "Exo 2, sans-serif",
        fontSize:   "0.62rem",
        fontWeight: 500,
        letterSpacing: "0.25em",
        color:      "rgba(168,85,247,0.3)",
        textTransform: "uppercase",
        opacity:    showTitle ? 1 : 0,
        transition: "opacity 0.8s 0.3s",
        whiteSpace: "nowrap",
      }}>
        Hackathon Build · 2025
      </div>

      {/* ── All splash-specific keyframes ── */}
      <style>{`
        @keyframes splashHexDrift {
          0%   { background-position: 0px 0px; }
          100% { background-position: 60px 138px; }
        }
        @keyframes splashShimmer {
          0%   { background-position: -300px 0; }
          60%  { background-position: 400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes splashPulseRing {
          0%,100% { box-shadow: 0 0 40px rgba(168,85,247,0.35), inset 0 0 40px rgba(168,85,247,0.05); }
          50%     { box-shadow: 0 0 70px rgba(168,85,247,0.55), inset 0 0 60px rgba(168,85,247,0.1), 0 0 120px rgba(0,212,255,0.2); }
        }
        @keyframes splashRingExpand {
          0%   { transform: translate(-50%,-50%) scale(0.85); opacity: 0.5; }
          100% { transform: translate(-50%,-50%) scale(1.3);  opacity: 0; }
        }
        @keyframes splashParticle1 {
          0%   { transform: scale(1) translate(0,0); opacity: 1; }
          50%  { transform: scale(1.6) translate(-8px,-10px); opacity: 0.8; }
          100% { transform: scale(0.5) translate(4px,6px); opacity: 0; }
        }
        @keyframes splashParticle2 {
          0%   { transform: scale(1) translate(0,0); opacity: 1; }
          50%  { transform: scale(2) translate(10px,-8px); opacity: 0.7; }
          100% { transform: scale(0.4) translate(-6px,4px); opacity: 0; }
        }
        @keyframes splashParticle3 {
          0%   { transform: scale(0.8) translate(0,0); opacity: 1; }
          40%  { transform: scale(1.8) translate(-6px,12px); opacity: 0.9; }
          100% { transform: scale(0.3) translate(8px,-4px); opacity: 0; }
        }
        @keyframes splashDot {
          0%,100% { transform: scale(1) translateY(0); opacity: 0.5; }
          50%     { transform: scale(1.6) translateY(-4px); opacity: 1; }
        }
        @keyframes hexScale {
          0%   { transform: scale(0) rotate(60deg); opacity: 0; }
          60%  { transform: scale(1.08) rotate(-4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes flashPulse {
          0%   { opacity: 0.5; }
          100% { opacity: 0; }
        }
        @keyframes ttPulse {
          0%   { filter: drop-shadow(0 0 8px #A855F7); }
          100% { filter: drop-shadow(0 0 20px #A855F7) drop-shadow(0 0 40px #00D4FF); }
        }
        @keyframes wireRotate1 {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wireRotate2 {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wireRotate3 {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wireDash {
          0%   { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -46; }
        }
        @keyframes wireFlicker {
          0%,100% { opacity: 1; }
          30%     { opacity: 0.4; }
          60%     { opacity: 0.8; }
          75%     { opacity: 0.2; }
        }
        @keyframes pulsRing {
          0%   { r: 100; opacity: 0.6; }
          100% { r: 145; opacity: 0; }
        }
        @keyframes neonPulse {
          0%   { filter: drop-shadow(0 0 6px #A855F7) drop-shadow(0 0 12px #00D4FF); }
          100% { filter: drop-shadow(0 0 16px #A855F7) drop-shadow(0 0 32px #00D4FF); }
        }
        @keyframes loadingDot {
          0%,100% { transform: scale(1); opacity: 0.5; }
          50%     { transform: scale(1.5); opacity: 1; }
        }
        @keyframes hexIdle {
          0%,100% { opacity: 0.7; }
          50%     { opacity: 1; }
        }
        @keyframes deerBreath {
          0%,100% { transform: scaleY(1); }
          50%     { transform: scaleY(1.03); }
        }
        @keyframes deerJump {
          0%   { transform: translateY(0) scale(1); }
          30%  { transform: translateY(-40px) scale(1.15) rotate(8deg); }
          60%  { transform: translateY(-16px) scale(1.08) rotate(-4deg); }
          100% { transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes deerSadShake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          20%     { transform: translateX(-10px) rotate(-4deg); }
          40%     { transform: translateX(10px) rotate(4deg); }
          60%     { transform: translateX(-6px) rotate(-2deg); }
          80%     { transform: translateX(6px) rotate(2deg); }
        }
        @keyframes deerVictoryDance {
          0%   { transform: scale(0.8) rotate(-10deg); }
          20%  { transform: scale(1.25) rotate(8deg) translateY(-20px); }
          40%  { transform: scale(1.15) rotate(-6deg) translateY(-30px); }
          60%  { transform: scale(1.2) rotate(5deg) translateY(-15px); }
          80%  { transform: scale(1.05) rotate(-2deg) translateY(-5px); }
          100% { transform: scale(1) rotate(0deg) translateY(0); }
        }
        @keyframes hexGlow {
          0%   { opacity: 0.5; filter: drop-shadow(0 0 4px currentColor); }
          100% { opacity: 1; filter: drop-shadow(0 0 16px currentColor); }
        }
        @keyframes noseGlow {
          0%   { filter: drop-shadow(0 0 4px currentColor); }
          100% { filter: drop-shadow(0 0 14px currentColor); }
        }
        @keyframes tearFall {
          0%   { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(20px); opacity: 0; }
        }
        @keyframes starSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(60px) rotate(360deg); opacity: 0; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
