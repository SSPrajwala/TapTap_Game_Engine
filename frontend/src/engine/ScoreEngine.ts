import type { Question, PlayerStats, ScoringConfig, Difficulty } from "../types/engine.types"

const DEFAULT_SCORING: ScoringConfig = {
  basePoints: 100, timeBonus: false, timeBonusPerSecond: 0,
  streakMultiplier: true, streakThreshold: 3, streakMultiplierValue: 1.5,
  penalties: false, penaltyPerWrong: 0,
}

export class ScoreEngine {
  private readonly cfg: ScoringConfig
  constructor(cfg?: ScoringConfig) { this.cfg = cfg ?? DEFAULT_SCORING }

  calculate(q: Question, correct: boolean, timeTaken: number, streak: number, override?: (q: Question, correct: boolean, t: number, cfg: ScoringConfig) => number): number {
    if (!correct) return 0
    if (override) return override(q, correct, timeTaken, this.cfg)
    let pts = q.points
    if (this.cfg.timeBonus && q.timeLimit) pts += Math.floor(Math.max(0, q.timeLimit - timeTaken) * this.cfg.timeBonusPerSecond)
    if (this.cfg.streakMultiplier && streak >= this.cfg.streakThreshold) pts = Math.floor(pts * this.cfg.streakMultiplierValue)
    return pts
  }

  updateStats(prev: PlayerStats, correct: boolean, timeTaken: number, points: number): PlayerStats {
    const totalAnswered = prev.totalAnswered + 1
    const correctAnswered = prev.correctAnswered + (correct ? 1 : 0)
    return {
      ...prev,
      score: prev.score + points,
      streak: correct ? prev.streak + 1 : 0,
      accuracy: correctAnswered / totalAnswered,
      averageTime: (prev.averageTime * prev.totalAnswered + timeTaken) / totalAnswered,
      totalAnswered,
      correctAnswered,
    }
  }

  buildFeedback(correct: boolean, points: number, streak: number, hint?: string): string {
    if (!correct) return hint ? `Incorrect — hint: ${hint}` : "Incorrect — keep going!"
    if (streak >= this.cfg.streakThreshold && this.cfg.streakMultiplier) return `🔥 ${streak}-streak! +${points} pts`
    return `Correct! +${points} pts`
  }

  levelScore(earned: number, max: number): number {
    if (max === 0) return 100
    return Math.min(100, Math.round((earned / max) * 100))
  }

  maxPoints(questions: Question[]): number {
    return questions.reduce((sum, q) => {
      let pts = q.points
      if (this.cfg.timeBonus && q.timeLimit) pts += q.timeLimit * this.cfg.timeBonusPerSecond
      if (this.cfg.streakMultiplier) pts = Math.floor(pts * this.cfg.streakMultiplierValue)
      return sum + pts
    }, 0)
  }
}

export function createInitialStats(difficulty: Difficulty = "easy"): PlayerStats {
  return { score: 0, streak: 0, accuracy: 0, averageTime: 0, totalAnswered: 0, correctAnswered: 0, hintsUsed: 0, difficulty }
}