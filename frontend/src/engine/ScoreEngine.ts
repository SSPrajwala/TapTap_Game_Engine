// ─────────────────────────────────────────────────────────────────────────────
// ScoreEngine.ts
//
// OLD: ScoreEngine.calculate(metrics) → returned a number, hardcoded logic,
//      received `responseTime: 30, attempts: 1` constants from App.tsx.
//
// NEW: Pure class, zero hardcoding. Every threshold comes from ScoringConfig
//      (which comes from your JSON). App.tsx never touches scoring logic.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Question,
  PlayerStats,
  ScoringConfig,
  Difficulty,
} from "../types/engine.types"

export class ScoreEngine {
  private readonly cfg: ScoringConfig

  constructor(cfg: ScoringConfig) {
    this.cfg = cfg
  }

  // ── Per-answer score ───────────────────────────────────────────────────────
  // Called by EngineCore.reduce() — never called from App.tsx or components.
  //
  // Accepts an optional plugin override so QuizPlugin can penalise hint usage
  // without touching core scoring logic.

  calculate(
    question:         Question,
    correct:          boolean,
    timeTaken:        number,
    currentStreak:    number,
    pluginOverride?:  (q: Question, correct: boolean, t: number, cfg: ScoringConfig) => number
  ): number {
    if (!correct) return 0

    if (pluginOverride) {
      return pluginOverride(question, correct, timeTaken, this.cfg)
    }

    let pts = question.points

    // Time bonus: reward fast answers proportionally
    if (this.cfg.timeBonus && question.timeLimit) {
      const timeLeft = Math.max(0, question.timeLimit - timeTaken)
      pts += Math.floor(timeLeft * this.cfg.timeBonusPerSecond)
    }

    // Streak multiplier activates after N consecutive correct answers
    if (this.cfg.streakMultiplier && currentStreak >= this.cfg.streakThreshold) {
      pts = Math.floor(pts * this.cfg.streakMultiplierValue)
    }

    return pts
  }

  // ── Rolling stats update ───────────────────────────────────────────────────
  // Your old PlayerState.recordAnswer() + updateScore() were two separate
  // mutable methods called from App.tsx. Now it's one pure function that
  // returns a new stats object — no mutation, works cleanly with useReducer.

  updateStats(
    prev:          PlayerStats,
    correct:       boolean,
    timeTaken:     number,
    pointsAwarded: number
  ): PlayerStats {
    const totalAnswered   = prev.totalAnswered + 1
    const correctAnswered = prev.correctAnswered + (correct ? 1 : 0)
    const streak          = correct ? prev.streak + 1 : 0
    const accuracy        = correctAnswered / totalAnswered
    const averageTime     =
      (prev.averageTime * prev.totalAnswered + timeTaken) / totalAnswered

    return {
      ...prev,
      score: prev.score + pointsAwarded,
      streak,
      accuracy,
      averageTime,
      totalAnswered,
      correctAnswered,
    }
  }

  // ── Feedback string ────────────────────────────────────────────────────────

  buildFeedback(correct: boolean, points: number, streak: number, hint?: string): string {
    if (!correct) return hint ? `Incorrect — hint: ${hint}` : "Incorrect — keep going!"
    if (streak >= this.cfg.streakThreshold && this.cfg.streakMultiplier) {
      return `🔥 ${streak}-streak! +${points} pts`
    }
    return `Correct! +${points} pts`
  }

  // ── Level score (0–100) ───────────────────────────────────────────────────

  levelScore(earnedPoints: number, maxPossible: number): number {
    if (maxPossible === 0) return 100
    return Math.min(100, Math.round((earnedPoints / maxPossible) * 100))
  }

  maxPoints(questions: Question[]): number {
    return questions.reduce((sum, q) => {
      let pts = q.points
      if (this.cfg.timeBonus && q.timeLimit) {
        pts += q.timeLimit * this.cfg.timeBonusPerSecond
      }
      if (this.cfg.streakMultiplier) {
        pts = Math.floor(pts * this.cfg.streakMultiplierValue)
      }
      return sum + pts
    }, 0)
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function createInitialStats(difficulty: Difficulty = "easy"): PlayerStats {
  return {
    score:          0,
    streak:         0,
    accuracy:       0,
    averageTime:    0,
    totalAnswered:  0,
    correctAnswered:0,
    hintsUsed:      0,
    difficulty,
  }
}