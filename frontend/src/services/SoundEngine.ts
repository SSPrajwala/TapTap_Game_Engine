/**
 * SoundEngine — lightweight Web Audio API sound effects.
 * No external libraries. Uses procedural synthesis for zero-load sounds.
 * All sounds are fire-and-forget; call any method at any time.
 */

let _ctx: AudioContext | null = null

// Never throws — returns null if AudioContext unavailable (blocked, SSR, etc.)
function ctx(): AudioContext | null {
  try {
    if (!_ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      _ctx = new AC()
    }
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {})
    return _ctx
  } catch {
    return null
  }
}

// Volume multiplier — 0 to 1 (can be controlled via settings later)
let _volume = 0.6

export const SoundEngine = {
  setVolume(v: number) { _volume = Math.max(0, Math.min(1, v)) },
  getVolume() { return _volume },

  /** Short click — used on button presses */
  click() {
    tone(ctx(), 660, 0.04, "sine", 0.08 * _volume, 0)
  },

  /** Letter tile click in WordBuilder */
  letterClick() {
    tone(ctx(), 740, 0.06, "sine", 0.07 * _volume, 0)
  },

  /** Word successfully found in WordBuilder */
  wordFound() {
    const c = ctx()
    tone(c, 523, 0.15, "sine", 0.15 * _volume, 0)
    tone(c, 659, 0.15, "sine", 0.12 * _volume, 0.08)
    tone(c, 784, 0.2,  "sine", 0.10 * _volume, 0.16)
  },

  /** Bonus word found — extra sparkle */
  bonusWord() {
    const c = ctx()
    tone(c, 659,  0.1,  "sine", 0.12 * _volume, 0)
    tone(c, 784,  0.1,  "sine", 0.12 * _volume, 0.06)
    tone(c, 1047, 0.15, "sine", 0.14 * _volume, 0.12)
    tone(c, 1319, 0.2,  "sine", 0.10 * _volume, 0.20)
  },

  /** Correct answer on quiz/flashcard/puzzle */
  correct() {
    const c = ctx()
    tone(c, 523, 0.12, "sine", 0.18 * _volume, 0)
    tone(c, 659, 0.12, "sine", 0.14 * _volume, 0.07)
    tone(c, 784, 0.18, "sine", 0.12 * _volume, 0.14)
  },

  /** Wrong answer */
  wrong() {
    const c = ctx()
    tone(c, 330, 0.08, "sawtooth", 0.1 * _volume, 0)
    tone(c, 220, 0.18, "sawtooth", 0.1 * _volume, 0.06)
  },

  /** Shake — invalid input */
  shake() {
    tone(ctx(), 180, 0.12, "square", 0.06 * _volume, 0)
  },

  /** Streak milestone */
  streak() {
    const c = ctx()
    tone(c, 659,  0.1,  "sine", 0.12 * _volume, 0)
    tone(c, 880,  0.12, "sine", 0.12 * _volume, 0.08)
    tone(c, 1047, 0.15, "sine", 0.12 * _volume, 0.18)
  },

  /** Timer warning beep (plays when < 10s left) */
  timerWarn() {
    tone(ctx(), 440, 0.07, "square", 0.06 * _volume, 0)
  },

  /** Level / round complete */
  levelComplete() {
    const c = ctx()
    tone(c, 523,  0.1,  "sine", 0.14 * _volume, 0)
    tone(c, 659,  0.1,  "sine", 0.12 * _volume, 0.1)
    tone(c, 784,  0.1,  "sine", 0.12 * _volume, 0.2)
    tone(c, 1047, 0.25, "sine", 0.14 * _volume, 0.3)
  },

  /** Full game win / trophy */
  gameWin() {
    const c = ctx()
    // Ascending fanfare
    const notes = [523, 659, 784, 1047, 1319]
    notes.forEach((freq, i) => {
      tone(c, freq, 0.18, "sine", 0.12 * _volume, i * 0.12)
    })
    // Final chord
    tone(c, 523,  0.5, "sine", 0.1 * _volume, 0.72)
    tone(c, 659,  0.5, "sine", 0.1 * _volume, 0.72)
    tone(c, 784,  0.5, "sine", 0.1 * _volume, 0.72)
    tone(c, 1047, 0.5, "sine", 0.1 * _volume, 0.72)
  },

  /** Card flip in Memory game */
  cardFlip() {
    tone(ctx(), 880, 0.08, "sine", 0.08 * _volume, 0)
  },

  /** Memory pair match */
  pairMatch() {
    const c = ctx()
    tone(c, 659, 0.12, "sine", 0.12 * _volume, 0)
    tone(c, 880, 0.15, "sine", 0.10 * _volume, 0.08)
  },

  /** Binary Runner correct lane */
  runnerHit() {
    const c = ctx()
    tone(c, 880, 0.06, "sine", 0.12 * _volume, 0)
    tone(c, 1047,0.1,  "sine", 0.10 * _volume, 0.05)
  },

  /** Binary Runner wrong lane */
  runnerMiss() {
    tone(ctx(), 150, 0.15, "sawtooth", 0.1 * _volume, 0)
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tone(
  c:       AudioContext | null,
  freq:    number,
  dur:     number,
  type:    OscillatorType,
  gain:    number,
  delay:   number,
) {
  if (!c) return   // audio unavailable — silent no-op
  try {
    const osc = c.createOscillator()
    const amp = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    amp.gain.setValueAtTime(0, c.currentTime + delay)
    amp.gain.linearRampToValueAtTime(gain, c.currentTime + delay + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + delay + dur)
    osc.connect(amp)
    amp.connect(c.destination)
    osc.start(c.currentTime + delay)
    osc.stop(c.currentTime + delay + dur + 0.05)
  } catch {
    // Silently ignore audio errors (e.g. context closed)
  }
}
