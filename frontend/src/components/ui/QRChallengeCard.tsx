/**
 * QRChallengeCard
 *
 * Renders a printable / shareable "Challenge Card" for any game.
 * Opens as a full-screen modal from the game card QR button.
 *
 * UI:
 *  ┌──────────────────────────────────┐
 *  │  🔢  Pattern Puzzle              │  ← game emoji + title
 *  │  TapTap Adaptive Game Engine     │  ← brand
 *  │  ┌────────────┐                  │
 *  │  │  QR CODE   │  Scan to play!   │
 *  │  └────────────┘  Copy Link       │
 *  │  🎯 Pattern Recognition          │  ← learning outcome
 *  │  [Download Card]  [Print]        │
 *  └──────────────────────────────────┘
 *
 * QR is generated via the free, zero-dependency api.qrserver.com image API.
 * No npm packages required.
 */
import React, { useState, useRef, useCallback } from "react"
import type { GameConfig } from "../../types/engine.types"

interface Props {
  game:    GameConfig
  onClose: () => void
}

const PLUGIN_COLOR: Record<string, string> = {
  quiz:        "#A855F7",
  puzzle:      "#00D4FF",
  flashcard:   "#FF2D78",
  memory:      "#22FFAA",
  sudoku:      "#FFD700",
  wordbuilder: "#EC4899",
  tapblitz:    "#FFD700",
  binaryrunner:"#00D4FF",
}
const PLUGIN_LABEL: Record<string, string> = {
  quiz:        "Quiz",
  puzzle:      "Pattern Puzzle",
  flashcard:   "Flashcard",
  memory:      "Memory Match",
  sudoku:      "Sudoku",
  wordbuilder: "Word Builder",
  tapblitz:    "TapBlitz",
  binaryrunner:"Binary Runner",
}

export const QRChallengeCard: React.FC<Props> = ({ game, onClose }) => {
  const [copied,    setCopied]    = useState(false)
  const [qrError,   setQrError]   = useState(false)
  const cardRef  = useRef<HTMLDivElement>(null)

  const gameUrl  = `${window.location.origin}?game=${encodeURIComponent(game.id)}`
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(gameUrl)}&color=A855F7&bgcolor=0D0D1A&margin=8`
  const color    = PLUGIN_COLOR[game.plugin] ?? "#A855F7"
  const label    = PLUGIN_LABEL[game.plugin] ?? game.plugin
  const emoji    = game.ui?.emoji ?? "🎮"

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(gameUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }, [gameUrl])

  const shareCard = useCallback(async () => {
    const text = `🎮 Challenge accepted? Play "${game.title}" on TapTap — a next-gen adaptive game engine!\n👉 ${gameUrl}`
    if (navigator.share) {
      try { await navigator.share({ title: game.title, text, url: gameUrl }); return } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [game.title, gameUrl])

  const printCard = useCallback(() => {
    window.print()
  }, [])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}>
      <div ref={cardRef} style={{
        background: "linear-gradient(145deg, #0D0D1A 0%, #13132A 100%)",
        border: `1.5px solid ${color}40`,
        borderRadius: "24px",
        padding: "32px 28px",
        maxWidth: "400px", width: "100%",
        position: "relative",
        boxShadow: `0 0 60px ${color}18, 0 24px 48px rgba(0,0,0,0.6)`,
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: "14px", right: "14px",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "50%", width: "30px", height: "30px",
          color: "rgba(232,224,255,0.45)", cursor: "pointer", fontSize: "0.85rem",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>

        <div style={{
          display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px",
        }}>
          <div style={{
            padding: "4px 10px", borderRadius: "99px", fontSize: "0.65rem",
            fontFamily: "Orbitron, sans-serif", fontWeight: 700, letterSpacing: "0.15em",
            background: `${color}18`, border: `1px solid ${color}40`, color,
          }}>
            {label}
          </div>
          <span style={{ fontSize: "0.62rem", fontFamily: "Exo 2, sans-serif", color: "rgba(232,224,255,0.3)", letterSpacing: "0.1em" }}>
            TAPTAP ENGINE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "14px", flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.8rem",
          }}>
            {emoji}
          </div>
          <div>
            <h2 style={{
              fontFamily: "Orbitron, sans-serif", color: "#E8E0FF",
              fontSize: "1.05rem", fontWeight: 900, margin: 0, lineHeight: 1.2,
            }}>
              {game.title}
            </h2>
            <p style={{
              fontFamily: "Exo 2, sans-serif", fontSize: "0.72rem",
              color: "rgba(232,224,255,0.38)", margin: "4px 0 0",
              overflow: "hidden", maxHeight: "2.8em",
            }}>
              {game.description}
            </p>
          </div>
        </div>

        <div style={{
          display: "flex", gap: "20px", alignItems: "center", marginBottom: "20px",
        }}>
          <div style={{
            borderRadius: "16px", overflow: "hidden",
            border: `2px solid ${color}40`,
            background: "#0D0D1A",
            flexShrink: 0, width: "110px", height: "110px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {qrError ? (
              <div style={{ textAlign: "center", padding: "8px" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>📱</div>
                <div style={{ fontSize: "0.6rem", fontFamily: "Exo 2, sans-serif", color: "rgba(232,224,255,0.3)" }}>
                  QR unavailable offline
                </div>
              </div>
            ) : (
              <img
                src={qrUrl}
                alt={`QR code for ${game.title}`}
                width={110} height={110}
                style={{ display: "block", borderRadius: "14px" }}
                onError={() => setQrError(true)}
              />
            )}
          </div>

          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: "Exo 2, sans-serif", fontSize: "0.78rem",
              color: "rgba(232,224,255,0.6)", lineHeight: 1.6, marginBottom: "12px",
            }}>
              📱 <strong style={{ color: "#E8E0FF" }}>Scan to play!</strong><br/>
              Share this card with students, friends or classmates.
            </p>

            <button onClick={copyLink} style={{
              width: "100%", padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
              background: copied ? "rgba(34,255,170,0.12)" : "rgba(255,255,255,0.05)",
              border: copied ? "1px solid rgba(34,255,170,0.35)" : "1px solid rgba(255,255,255,0.12)",
              color: copied ? "#22FFAA" : "rgba(232,224,255,0.55)",
              fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.75rem",
              transition: "all 0.25s",
            }}>
              {copied ? "✓ Copied!" : "🔗 Copy Link"}
            </button>
          </div>
        </div>

        {Boolean((game as unknown as Record<string, unknown>).learningOutcomes) && (
          <div style={{
            padding: "10px 12px", borderRadius: "10px", marginBottom: "16px",
            background: `${color}08`, border: `1px solid ${color}20`,
            fontFamily: "Exo 2, sans-serif", fontSize: "0.72rem", color: `${color}CC`,
          }}>
            🎯 <strong>Skills:</strong>{" "}
            {((game as unknown as Record<string, unknown>).learningOutcomes as string[]).join(" · ") || label}
          </div>
        )}

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "20px",
        }}>
          {[
            { icon: "❓", label: "Questions", val: game.questions?.length ?? 0 },
            { icon: "🏆", label: "Levels",    val: game.levels?.length ?? 1 },
            { icon: "⚡", label: "Adaptive",  val: "Yes" },
          ].map(({ icon, label: lbl, val }) => (
            <div key={lbl} style={{
              textAlign: "center", padding: "8px 4px", borderRadius: "8px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ fontSize: "1rem", marginBottom: "2px" }}>{icon}</div>
              <div style={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#E8E0FF" }}>{val}</div>
              <div style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.58rem", color: "rgba(232,224,255,0.3)", marginTop: "1px" }}>{lbl}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={shareCard} style={{
            flex: 1, padding: "11px 8px", borderRadius: "10px", cursor: "pointer",
            background: `linear-gradient(135deg, ${color}, ${color}99)`,
            border: "none", color: "#fff",
            fontFamily: "Exo 2, sans-serif", fontWeight: 800, fontSize: "0.8rem",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
          <button onClick={printCard} style={{
            flex: 1, padding: "11px 8px", borderRadius: "10px", cursor: "pointer",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(232,224,255,0.6)",
            fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.8rem",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}>
            🖨 Print Card
          </button>
        </div>

        <div style={{
          textAlign: "center", marginTop: "16px",
          fontFamily: "Orbitron, sans-serif", fontSize: "0.55rem",
          color: "rgba(232,224,255,0.15)", letterSpacing: "0.2em",
        }}>
          TAPTAP ADAPTIVE GAME ENGINE · AI-POWERED LEARNING
        </div>
      </div>
    </div>
  )
}
