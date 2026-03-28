// ─────────────────────────────────────────────────────────────────────────────
// TapBlitzPlugin.tsx
//
// Motion game plugin — real-time canvas game where targets spawn, drift, and
// shrink. The player clicks/taps them before they vanish.
//
// Each "question" in the JSON config represents one WAVE:
//   duration        — how many seconds the wave lasts
//   spawnRate       — targets spawned per second
//   targetLifetime  — seconds before a target disappears (0 = miss)
//   targetSpeed     — pixels per second drift speed
//   targetMinRadius / targetMaxRadius — size range for targets
//
// The plugin manages its own requestAnimationFrame loop.
// When the wave ends it calls onAnswer() with the session score.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable react-refresh/only-export-components */
import React, { useRef, useEffect, useCallback, useState } from "react"
import type {
  GamePlugin,
  PluginRenderProps,
  TapBlitzQuestion,
  Question,
  AnswerResult,
} from "../../types/engine.types"
import { HowToPlayModal, HelpButton } from "../../components/ui/HowToPlayModal"

const TB_HOW_TO_STEPS = [
  { icon: "🎯", title: "Click Targets",   desc: "Coloured circles appear on the canvas and slowly drift around. Click or tap them before they disappear to score points." },
  { icon: "⏳", title: "Timer Ring",       desc: "Each target has a shrinking white ring around it showing how long you have left. When the ring vanishes, the target is gone!" },
  { icon: "🎨", title: "Target Colours",  desc: "Purple = 100 pts · Cyan = 150 pts · Green = 200 pts · Red = 300 pts · ⭐ Gold = 500 pts. Smaller targets are rarer and worth more." },
  { icon: "🔥", title: "Combo Streak",    desc: "Hit targets consecutively without missing to build a combo. At 20 hits you reach 2× multiplier — everything you click scores double!" },
  { icon: "💀", title: "Miss Limit",      desc: "Each wave has a limited number of misses allowed. Letting too many targets expire ends the wave early. Stay sharp!" },
  { icon: "⚡", title: "Score More",      desc: "Hit as many targets as possible within the wave duration. The wave ends automatically when time runs out." },
]

const TB_TIPS = [
  "Prioritise gold and red targets — they're rare and give the most points.",
  "Don't try to click every target — focus on accuracy to maintain your combo multiplier.",
  "Move your cursor to the centre of the canvas so you're always within reach of spawning targets.",
  "Smaller targets are worth more points per hit — aim for them when your combo is high.",
]

// ── Internal target object ────────────────────────────────────────────────────

interface Target {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  spawnTime: number    // performance.now()
  lifetime: number     // ms
  color: string
  ringColor: string
  points: number
  hit: boolean
  hitTime: number
  ripples: Ripple[]
}

interface Ripple {
  radius: number
  maxRadius: number
  opacity: number
  x: number
  y: number
  color: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  color: string
  life: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  { fill: "#A855F7", ring: "#D8B4FE", pts: 100 },  // purple  — normal
  { fill: "#00D4FF", ring: "#A5F3FC", pts: 150 },  // cyan    — fast
  { fill: "#22FFAA", ring: "#6EE7B7", pts: 200 },  // green   — small bonus
  { fill: "#FF2D78", ring: "#FDA4AF", pts: 300 },  // red     — tiny, hard
  { fill: "#FFD700", ring: "#FDE68A", pts: 500 },  // gold    — rare bonus
]

const CANVAS_W = 800
const CANVAS_H = 480
const HIT_ANIM_DURATION = 400  // ms

// ── Draw utilities ────────────────────────────────────────────────────────────


function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ── Main Component ────────────────────────────────────────────────────────────

const TapBlitzComponent: React.FC<PluginRenderProps<TapBlitzQuestion>> = ({
  question,
  stats: _stats,
  config: _config,
  onAnswer,
}) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef<number>(0)
  const gameRef     = useRef({
    targets:    [] as Target[],
    particles:  [] as Particle[],
    nextId:     0,
    lastSpawn:  0,
    score:      0,
    hits:       0,
    misses:     0,
    combo:      0,
    maxCombo:   0,
    startTime:  0,
    ended:      false,
    answered:   false,
  })

  const [waveScore,   setWaveScore]   = useState(0)
  const [waveHits,    setWaveHits]    = useState(0)
  const [waveMisses,  setWaveMisses]  = useState(0)
  const [waveCombo,   setWaveCombo]   = useState(0)
  const [timeLeft,    setTimeLeft]    = useState(question.duration)
  const [waveEnded,   setWaveEnded]   = useState(false)
  const [countDown,   setCountDown]   = useState(3)
  const [gameStarted, setGameStarted] = useState(false)
  const [showHelp,    setShowHelp]    = useState(false)

  // ── Countdown before wave — pauses when How-to-Play modal is open ─────────
  useEffect(() => {
    if (countDown <= 0) {
      setGameStarted(true)
      return
    }
    if (showHelp) return              // ← pause while modal is visible
    const t = setTimeout(() => setCountDown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countDown, showHelp])

  // ── Spawn a target ────────────────────────────────────────────────────────
  const spawnTarget = useCallback((now: number) => {
    const g   = gameRef.current
    const r   = question.targetMinRadius + Math.random() * (question.targetMaxRadius - question.targetMinRadius)
    const x   = r + Math.random() * (CANVAS_W - 2 * r)
    const y   = r + Math.random() * (CANVAS_H - 2 * r)
    const ang = Math.random() * Math.PI * 2
    const spd = question.targetSpeed * (0.6 + Math.random() * 0.8)

    // Gold (bonus) appears rarely
    const colorEntry = Math.random() < 0.07 ? COLORS[4] : COLORS[Math.floor(Math.random() * 4)]

    g.targets.push({
      id:        g.nextId++,
      x, y,
      vx:        Math.cos(ang) * spd,
      vy:        Math.sin(ang) * spd,
      radius:    r,
      spawnTime: now,
      lifetime:  question.targetLifetime * 1000,
      color:     colorEntry.fill,
      ringColor: colorEntry.ring,
      points:    Math.round(colorEntry.pts * (30 / (r * 2))),  // smaller = more pts
      hit:       false,
      hitTime:   0,
      ripples:   [],
    })
  }, [question])

  // ── Spawn particles on hit ────────────────────────────────────────────────
  const spawnParticles = useCallback((x: number, y: number, color: string) => {
    const g = gameRef.current
    const count = 14 + Math.floor(Math.random() * 8)
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const spd = 3 + Math.random() * 5
      g.particles.push({
        x, y,
        vx:      Math.cos(ang) * spd,
        vy:      Math.sin(ang) * spd,
        radius:  2 + Math.random() * 4,
        opacity: 1,
        color,
        life:    1,
      })
    }
  }, [])

  // ── Canvas click handler ──────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const g   = gameRef.current
    if (g.ended || !gameStarted) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect  = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top)  * scaleY

    // Check targets in reverse order (top-most first)
    let hit = false
    for (let i = g.targets.length - 1; i >= 0; i--) {
      const t = g.targets[i]
      if (t.hit) continue
      const dx = mx - t.x
      const dy = my - t.y
      if (dx * dx + dy * dy <= t.radius * t.radius) {
        t.hit      = true
        t.hitTime  = performance.now()
        t.ripples.push({ radius: t.radius, maxRadius: t.radius * 3.5, opacity: 1, x: t.x, y: t.y, color: t.ringColor })

        spawnParticles(t.x, t.y, t.color)

        g.combo++
        if (g.combo > g.maxCombo) g.maxCombo = g.combo
        const comboBonus = Math.min(g.combo * 0.1, 2.0)  // up to 2× for 20-combo
        const pts = Math.round(t.points * (1 + comboBonus))
        g.score += pts
        g.hits++

        setWaveScore(g.score)
        setWaveHits(g.hits)
        setWaveCombo(g.combo)
        hit = true
        break
      }
    }

    if (!hit) {
      // Miss click — small penalty
      g.combo = 0
      setWaveCombo(0)
    }
  }, [gameStarted, spawnParticles])

  // ── End wave ──────────────────────────────────────────────────────────────
  const endWave = useCallback(() => {
    const g = gameRef.current
    if (g.answered) return
    g.ended   = true
    g.answered = true

    cancelAnimationFrame(rafRef.current)
    setWaveEnded(true)

    const correct = g.hits > g.misses
    const result: AnswerResult = {
      questionId:    question.id,
      correct,
      pointsAwarded: g.score,
      timeTaken:     question.duration,
      feedback:      correct
        ? `Great wave! ${g.hits} hits, max combo ×${g.maxCombo}`
        : `${g.hits} hits — keep practising!`,
    }
    // Short delay to show end-screen, then report
    setTimeout(() => onAnswer(result), 2200)
  }, [question, onAnswer])

  // ── Main game loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const g   = gameRef.current
    g.startTime = performance.now()
    g.lastSpawn = g.startTime

    const spawnInterval = 1000 / question.spawnRate

    const loop = (now: number) => {
      if (g.ended) return

      const elapsed  = now - g.startTime
      const remaining = question.duration * 1000 - elapsed
      setTimeLeft(Math.max(0, Math.ceil(remaining / 1000)))

      if (remaining <= 0) { endWave(); return }

      // ── Spawn ────────────────────────────────────────────────────────────
      if (now - g.lastSpawn >= spawnInterval) {
        spawnTarget(now)
        g.lastSpawn = now
      }

      // ── Update targets ────────────────────────────────────────────────────
      for (let i = g.targets.length - 1; i >= 0; i--) {
        const t = g.targets[i]
        if (t.hit) {
          if (now - t.hitTime > HIT_ANIM_DURATION) {
            g.targets.splice(i, 1)
          }
          continue
        }
        // Move
        t.x += t.vx * (1 / 60)
        t.y += t.vy * (1 / 60)
        // Bounce walls
        if (t.x - t.radius < 0)        { t.x = t.radius;           t.vx = Math.abs(t.vx) }
        if (t.x + t.radius > CANVAS_W) { t.x = CANVAS_W - t.radius; t.vx = -Math.abs(t.vx) }
        if (t.y - t.radius < 0)        { t.y = t.radius;            t.vy = Math.abs(t.vy) }
        if (t.y + t.radius > CANVAS_H) { t.y = CANVAS_H - t.radius; t.vy = -Math.abs(t.vy) }

        // Expire
        const age = now - t.spawnTime
        if (age >= t.lifetime) {
          g.targets.splice(i, 1)
          g.misses++
          g.combo = 0
          setWaveMisses(g.misses)
          setWaveCombo(0)
          // Early fail if too many misses
          if (g.misses >= question.maxMisses) { endWave(); return }
        }
      }

      // ── Update particles ──────────────────────────────────────────────────
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i]
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.15  // gravity
        p.life    -= 0.035
        p.opacity  = Math.max(0, p.life)
        if (p.life <= 0) { g.particles.splice(i, 1) }
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      // Background
      ctx.fillStyle = "rgba(4, 2, 18, 0.92)"
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // Grid lines (subtle)
      ctx.strokeStyle = "rgba(168,85,247,0.05)"
      ctx.lineWidth   = 1
      for (let x = 0; x < CANVAS_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke() }
      for (let y = 0; y < CANVAS_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke() }

      // ── Ripples ────────────────────────────────────────────────────────────
      for (const t of g.targets) {
        for (let ri = t.ripples.length - 1; ri >= 0; ri--) {
          const rp = t.ripples[ri]
          rp.radius  += (rp.maxRadius - rp.radius) * 0.12
          rp.opacity -= 0.04
          if (rp.opacity <= 0) { t.ripples.splice(ri, 1); continue }
          ctx.beginPath()
          ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2)
          ctx.strokeStyle = hexToRgba(rp.color, rp.opacity)
          ctx.lineWidth   = 3
          ctx.stroke()
        }
      }

      // ── Particles ──────────────────────────────────────────────────────────
      for (const p of g.particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = hexToRgba(p.color, p.opacity)
        ctx.fill()
      }

      // ── Targets ────────────────────────────────────────────────────────────
      for (const t of g.targets) {
        const age         = now - t.spawnTime
        const lifeRatio   = Math.max(0, 1 - age / t.lifetime)
        const hitProgress = t.hit ? Math.min(1, (now - t.hitTime) / HIT_ANIM_DURATION) : 0
        const scale       = t.hit ? 1 + hitProgress * 0.8 : 1
        const alpha       = t.hit ? 1 - hitProgress : 0.15 + lifeRatio * 0.85

        ctx.save()
        ctx.translate(t.x, t.y)
        ctx.scale(scale, scale)

        // Outer shrinking ring (timer)
        if (!t.hit) {
          const ringR = t.radius + 6 + lifeRatio * 10
          ctx.beginPath()
          ctx.arc(0, 0, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeRatio)
          ctx.strokeStyle = hexToRgba(t.ringColor, 0.9)
          ctx.lineWidth   = 3
          ctx.stroke()
        }

        // Glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, t.radius * 2)
        glow.addColorStop(0, hexToRgba(t.color, alpha * 0.45))
        glow.addColorStop(1, hexToRgba(t.color, 0))
        ctx.beginPath()
        ctx.arc(0, 0, t.radius * 2, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Main circle
        ctx.beginPath()
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2)
        ctx.fillStyle   = hexToRgba(t.color, alpha)
        ctx.shadowColor = t.color
        ctx.shadowBlur  = t.radius
        ctx.fill()

        // Inner highlight
        if (!t.hit) {
          const hl = ctx.createRadialGradient(-t.radius * 0.3, -t.radius * 0.3, 0, 0, 0, t.radius)
          hl.addColorStop(0, `rgba(255,255,255,${0.35 * lifeRatio})`)
          hl.addColorStop(1, "rgba(255,255,255,0)")
          ctx.beginPath()
          ctx.arc(0, 0, t.radius, 0, Math.PI * 2)
          ctx.fillStyle  = hl
          ctx.shadowBlur = 0
          ctx.fill()
        }

        // Points label
        if (!t.hit && lifeRatio > 0.25) {
          ctx.fillStyle   = "rgba(255,255,255,0.95)"
          ctx.font        = `bold ${Math.max(10, t.radius * 0.7)}px Orbitron, monospace`
          ctx.textAlign   = "center"
          ctx.textBaseline = "middle"
          ctx.shadowBlur  = 0
          ctx.fillText(`${t.points}`, 0, 0)
        }

        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameStarted, question, spawnTarget, endWave])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (waveEnded) {
    const g        = gameRef.current
    const accuracy = g.hits + g.misses > 0 ? Math.round((g.hits / (g.hits + g.misses)) * 100) : 0
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "360px", gap: "16px", animation: "fadeIn 0.4s ease" }}>
        <div style={{ fontSize: "2.8rem" }}>
          {accuracy >= 70 ? "⚡" : accuracy >= 40 ? "🎯" : "💪"}
        </div>
        <h2 style={{ fontFamily: "Orbitron, monospace", color: "#A855F7", fontSize: "1.4rem", margin: 0 }}>
          Wave Complete!
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
          {[
            { label: "Score",    val: waveScore },
            { label: "Hits",     val: waveHits  },
            { label: "Accuracy", val: `${accuracy}%` },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: "12px", padding: "14px 20px" }}>
              <div style={{ fontSize: "1.6rem", fontFamily: "Orbitron, monospace", color: "#A855F7" }}>{val}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(232,224,255,0.5)", marginTop: "4px" }}>{label}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.78rem", color: "rgba(232,224,255,0.35)", fontStyle: "italic" }}>
          Advancing to next wave…
        </p>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <>
        <HowToPlayModal
          open={showHelp}
          onClose={() => setShowHelp(false)}
          title="TapBlitz"
          emoji="🎯"
          steps={TB_HOW_TO_STEPS}
          tips={TB_TIPS}
          accentColor="#A855F7"
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "360px", gap: "20px" }}>
          <h2 style={{ fontFamily: "Orbitron, monospace", color: "#00D4FF", fontSize: "1.2rem", margin: 0, textAlign: "center" }}>
            {question.instruction}
          </h2>
          <div style={{ fontSize: "6rem", fontFamily: "Orbitron, monospace", color: "#A855F7",
            textShadow: "0 0 40px rgba(168,85,247,0.8)", animation: "pulse 0.5s ease-in-out" }}>
            {countDown > 0 ? countDown : "GO!"}
          </div>
          <div style={{ textAlign: "center", fontSize: "0.86rem", color: "rgba(232,224,255,0.65)",
            background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: "10px", padding: "10px 20px", lineHeight: 1.7 }}>
            🖱️ Click targets before their timer ring shrinks · 🔥 Build combos · ⭐ Gold = 500 pts
          </div>
          <button onClick={() => setShowHelp(true)} style={{
            background: "transparent", border: "1px solid rgba(168,85,247,0.4)",
            borderRadius: "8px", color: "#A855F7", cursor: "pointer",
            fontFamily: "Orbitron, monospace", fontSize: "0.78rem", padding: "8px 18px" }}>
            📖 How to Play
          </button>
        </div>
      </>
    )
  }

  const timeRatio  = timeLeft / question.duration
  const missRatio  = waveMisses / question.maxMisses

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <HowToPlayModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        title="TapBlitz"
        emoji="🎯"
        steps={TB_HOW_TO_STEPS}
        tips={TB_TIPS}
        accentColor="#A855F7"
      />
      <HelpButton onClick={() => setShowHelp(true)} color="#A855F7" />

      {/* HUD */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px", background: "rgba(4,2,18,0.8)", borderRadius: "10px",
        border: "1px solid rgba(168,85,247,0.2)", fontFamily: "Orbitron, monospace" }}>
        <div style={{ display: "flex", gap: "24px", fontSize: "0.82rem" }}>
          <span style={{ color: "#A855F7" }}>⚡ {waveScore}</span>
          <span style={{ color: "#22FFAA" }}>🎯 {waveHits}</span>
          {waveCombo >= 3 && (
            <span style={{ color: "#FFD700", animation: "pulse 0.4s infinite" }}>
              🔥 ×{waveCombo} COMBO
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "0.82rem" }}>
          <span style={{ color: missRatio > 0.7 ? "#FF2D78" : "rgba(232,224,255,0.5)" }}>
            💔 {waveMisses}/{question.maxMisses}
          </span>
          <span style={{ color: timeRatio < 0.2 ? "#FF2D78" : "#00D4FF" }}>
            ⏱ {timeLeft}s
          </span>
        </div>
      </div>

      {/* Time bar */}
      <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: "4px",
          width: `${(timeLeft / question.duration) * 100}%`,
          background: timeRatio < 0.2 ? "#FF2D78" : "linear-gradient(90deg,#A855F7,#00D4FF)",
          transition: "width 0.25s linear, background 0.3s" }} />
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", borderRadius: "14px", overflow: "hidden",
        border: "1px solid rgba(168,85,247,0.35)", boxShadow: "0 0 40px rgba(168,85,247,0.15)" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleCanvasClick}
          style={{ display: "block", width: "100%", height: "auto", cursor: "crosshair" }}
        />
      </div>

      {/* Stats footer */}
      <div style={{ display: "flex", justifyContent: "center", gap: "20px",
        fontSize: "0.72rem", color: "rgba(232,224,255,0.35)", fontFamily: "Exo 2, sans-serif" }}>
        <span>Click targets before they vanish</span>
        <span>•</span>
        <span>🥇 Gold = 500 pts · smaller = more pts</span>
      </div>
    </div>
  )
}

// ── Plugin definition ─────────────────────────────────────────────────────────

export const TapBlitzPlugin: GamePlugin<TapBlitzQuestion> = {
  id:      "tapblitz",
  name:    "TapBlitz — Motion Aim Game",
  handles: ["tapblitz"],

  validateQuestion(q: Question): q is TapBlitzQuestion {
    const tq = q as TapBlitzQuestion
    return (
      q.type === "tapblitz" &&
      typeof tq.duration       === "number" &&
      typeof tq.spawnRate      === "number" &&
      typeof tq.targetLifetime === "number"
    )
  },

  Component: TapBlitzComponent,

  calculateScore(_q, _correct, _timeTaken, _scoring) {
    // Score is self-managed by the canvas loop; pointsAwarded is passed directly.
    return 0
  },
}
