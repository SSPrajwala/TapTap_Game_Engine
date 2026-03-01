import type { AdaptiveDecision } from "./AdaptiveEngine"
import type { LevelConfig } from "./GameLoader"

export class LevelManager {
  private currentIndex: number
  private levels: LevelConfig[]

  constructor(levels: LevelConfig[]) {
    this.levels = levels
    this.currentIndex = 0
  }

  getCurrentLevel(): LevelConfig {
    return this.levels[this.currentIndex]
  }

  applyDecision(decision: AdaptiveDecision) {
    if (decision === "SKIP") {
      this.currentIndex = Math.min(this.currentIndex + 2, this.levels.length - 1)
    } else if (decision === "NEXT") {
      this.currentIndex = Math.min(this.currentIndex + 1, this.levels.length - 1)
    }
    // REPEAT = no change

    console.log(`Now at Level: ${this.levels[this.currentIndex].levelId}`)
  }
}