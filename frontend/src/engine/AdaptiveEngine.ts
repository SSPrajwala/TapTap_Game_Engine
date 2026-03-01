export interface PerformanceMetrics {
  accuracy: number
  responseTime: number
  attempts: number
}

export type AdaptiveDecision = "SKIP" | "REPEAT" | "NEXT"

export class AdaptiveEngine {
  static decide(metrics: PerformanceMetrics): AdaptiveDecision {
    const { accuracy } = metrics

    if (accuracy > 80) {
      console.log("Adaptive Decision: SKIP to higher difficulty")
      return "SKIP"
    }

    if (accuracy < 50) {
      console.log("Adaptive Decision: REPEAT level")
      return "REPEAT"
    }

    console.log("Adaptive Decision: Proceed to NEXT level")
    return "NEXT"
  }
}