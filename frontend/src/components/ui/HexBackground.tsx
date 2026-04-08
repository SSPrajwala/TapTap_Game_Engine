import React from "react"

// Lightweight CSS-only background — no canvas, no heavy libraries
// Just divs with keyframe animations for maximum performance

export const HexBackground: React.FC = () => {
  return (
    <>
      {/* Hex grid pattern */}
      <div className="hex-bg" aria-hidden="true" />

      {/* Floating orbs */}
      <div className="orb-cyan" aria-hidden="true" />
      <div className="orb-green" aria-hidden="true" />

      {/* Floating hex particles */}
      {[
        { top: "15%",  left: "8%",   size: 20, delay: "0s",   duration: "8s",  opacity: 0.15 },
        { top: "70%",  left: "5%",   size: 14, delay: "2s",   duration: "10s", opacity: 0.10 },
        { top: "30%",  right: "6%",  size: 18, delay: "1s",   duration: "9s",  opacity: 0.12 },
        { top: "80%",  right: "8%",  size: 24, delay: "3s",   duration: "12s", opacity: 0.08 },
        { top: "50%",  left: "3%",   size: 12, delay: "4s",   duration: "7s",  opacity: 0.14 },
        { top: "20%",  right: "12%", size: 16, delay: "0.5s", duration: "11s", opacity: 0.10 },
      ].map((p, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: "fixed",
            top:      p.top,
            left:     "left"  in p ? (p as { left: string }).left   : undefined,
            right:    "right" in p ? (p as { right: string }).right : undefined,
            width:    p.size,
            height:   p.size,
            opacity:  p.opacity,
            animation: `hexFloat${(i % 3) + 1} ${p.duration} ease-in-out ${p.delay} infinite`,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polygon
              points="12,2 22,7 22,17 12,22 2,17 2,7"
              fill="none"
              stroke="rgba(168,85,247,0.8)"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      ))}

      {/* Inline keyframes for hex particles */}
      <style>{`
        @keyframes hexFloat1 {
          0%,100% { transform: translateY(0) rotate(0deg); }
          33%     { transform: translateY(-15px) rotate(30deg); }
          66%     { transform: translateY(-8px) rotate(-15deg); }
        }
        @keyframes hexFloat2 {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%     { transform: translateY(-20px) rotate(45deg); }
        }
        @keyframes hexFloat3 {
          0%,100% { transform: translateY(0) rotate(0deg); }
          25%     { transform: translateY(-10px) rotate(-20deg); }
          75%     { transform: translateY(-18px) rotate(25deg); }
        }
      `}</style>
    </>
  )
}