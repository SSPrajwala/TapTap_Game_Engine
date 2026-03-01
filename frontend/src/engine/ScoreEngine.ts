import type { PerformanceMetrics } from "./AdaptiveEngine"

export class ScoreEngine {
  static calculate(metrics: PerformanceMetrics): number {
    const baseScore = metrics.accuracy * 10
    const speedBonus = Math.max(0, 100 - metrics.responseTime)
    const attemptPenalty = (metrics.attempts - 1) * 20

    const finalScore = baseScore + speedBonus - attemptPenalty

    console.log(`Final Score: ${finalScore}`)

    return finalScore
  }
}