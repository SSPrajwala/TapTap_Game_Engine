// ─────────────────────────────────────────────────────────────────────────────
// HowToPlayModal.tsx
// Floating modal showing game instructions. Used by all plugin components.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react"

export interface HowToPlayStep {
  icon:  string
  title: string
  desc:  string
}

interface Props {
  open:    boolean
  onClose: () => void
  title:   string
  emoji:   string
  steps:   HowToPlayStep[]
  tips?:   string[]
  accentColor?: string
}

export const HowToPlayModal: React.FC<Props> = ({
  open, onClose, title, emoji, steps, tips, accentColor = "#A855F7"
}) => {
  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        zIndex:         9999,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "20px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:     "linear-gradient(160deg,rgba(10,6,28,0.98),rgba(4,2,18,0.98))",
          border:         `1px solid ${accentColor}55`,
          borderRadius:   "20px",
          padding:        "28px 32px",
          maxWidth:       "480px",
          width:          "100%",
          boxShadow:      `0 0 60px ${accentColor}33, 0 24px 60px rgba(0,0,0,0.6)`,
          maxHeight:      "88vh",
          overflowY:      "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "2.2rem" }}>{emoji}</span>
            <div>
              <div style={{ fontFamily: "Orbitron, monospace", fontSize: "1rem", fontWeight: 800,
                color: accentColor, letterSpacing: "0.04em" }}>How to Play</div>
              <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem",
                color: "rgba(232,224,255,0.55)", marginTop: "2px" }}>{title}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${accentColor}44`,
              borderRadius: "8px", color: "rgba(232,224,255,0.5)", cursor: "pointer",
              fontFamily: "Orbitron, monospace", fontSize: "0.75rem", padding: "6px 12px" }}
          >
            GOT IT ✕
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display:      "flex",
              alignItems:   "flex-start",
              gap:          "14px",
              background:   `${accentColor}0D`,
              border:       `1px solid ${accentColor}22`,
              borderRadius: "12px",
              padding:      "12px 16px",
            }}>
              <div style={{
                fontSize: "1.5rem",
                flexShrink: 0,
                width: "36px",
                textAlign: "center",
              }}>{s.icon}</div>
              <div>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: "0.75rem",
                  fontWeight: 700, color: accentColor, marginBottom: "4px",
                  letterSpacing: "0.04em" }}>{s.title}</div>
                <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.84rem",
                  color: "rgba(232,224,255,0.72)", lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        {tips && tips.length > 0 && (
          <div style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: "12px", padding: "12px 16px" }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: "0.72rem", color: "#FFD700",
              fontWeight: 700, marginBottom: "8px", letterSpacing: "0.06em" }}>💡 PRO TIPS</div>
            <ul style={{ margin: 0, paddingLeft: "18px", listStyle: "disc" }}>
              {tips.map((tip, i) => (
                <li key={i} style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem",
                  color: "rgba(232,224,255,0.65)", lineHeight: 1.65 }}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onClose}
          style={{
            marginTop:    "20px",
            width:        "100%",
            background:   `linear-gradient(135deg,${accentColor},#3B82F6)`,
            border:       "none",
            borderRadius: "12px",
            color:        "#fff",
            cursor:       "pointer",
            fontFamily:   "Orbitron, monospace",
            fontSize:     "0.9rem",
            fontWeight:   700,
            padding:      "13px",
            letterSpacing: "0.05em",
          }}
        >
          🚀 LET'S GO!
        </button>
      </div>
    </div>
  )
}

// ── Floating help button ──────────────────────────────────────────────────────

export const HelpButton: React.FC<{ onClick: () => void; color?: string }> = ({
  onClick, color = "#A855F7"
}) => (
  <button
    onClick={onClick}
    title="How to Play"
    style={{
      position:     "fixed",
      bottom:       "24px",
      right:        "24px",
      zIndex:       9000,
      width:        "44px",
      height:       "44px",
      borderRadius: "50%",
      background:   `linear-gradient(135deg,${color},#3B82F6)`,
      border:       "none",
      color:        "#fff",
      cursor:       "pointer",
      fontSize:     "1.15rem",
      fontWeight:   900,
      boxShadow:    `0 0 18px ${color}66`,
      display:      "flex",
      alignItems:   "center",
      justifyContent: "center",
      transition:   "transform 0.15s, box-shadow 0.15s",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)"
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"
    }}
  >
    ?
  </button>
)
