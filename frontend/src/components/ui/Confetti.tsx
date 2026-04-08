import React, { useMemo } from "react"

interface Props {
  active: boolean
  count?: number
}

const COLORS = ["#A855F7", "#00D4FF", "#22FFAA", "#FF2D78", "#FFD700", "#FFEE99"]

// Generates static random particle data outside render to satisfy purity rules.
// Called once per useMemo invocation (only when count changes).
function buildParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id:          i,
    left:        `${Math.random() * 100}%`,
    color:       COLORS[Math.floor(Math.random() * COLORS.length)],
    duration:    `${0.8 + Math.random() * 1.2}s`,
    delay:       `${Math.random() * 0.8}s`,
    size:        `${6 + Math.random() * 8}px`,
    rotation:    `${Math.random() * 360}deg`,
    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
  }))
}

export const Confetti: React.FC<Props> = ({ active, count = 30 }) => {
  const particles = useMemo(() => buildParticles(count), [count])

  if (!active) return null

  return (
    <div className="confetti-wrap" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left:              p.left,
            top:               "-10px",
            width:             p.size,
            height:            p.size,
            background:        p.color,
            boxShadow:         `0 0 6px ${p.color}`,
            animationDuration: p.duration,
            animationDelay:    p.delay,
            borderRadius:      p.borderRadius,
            transform:         `rotate(${p.rotation})`,
          }}
        />
      ))}
    </div>
  )
}