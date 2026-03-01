import { GameLoader } from "./GameLoader"
import { AdaptiveEngine } from "./AdaptiveEngine"
import { ScoreEngine } from "./ScoreEngine"
import { LevelManager } from "./LevelManager"
import type { GameConfig } from "./GameLoader"
import type { PerformanceMetrics } from "./AdaptiveEngine"

export class EngineCore {
  static run(config: GameConfig, metrics: PerformanceMetrics) {
    console.log("----- ENGINE START -----")

    const game = GameLoader.load(config)

    const levelManager = new LevelManager(game.levels)

    console.log(`Starting Level: ${levelManager.getCurrentLevel().levelId}`)

    const decision = AdaptiveEngine.decide(metrics)

    ScoreEngine.calculate(metrics)

    levelManager.applyDecision(decision)

    console.log("----- ENGINE END -----")
  }
}