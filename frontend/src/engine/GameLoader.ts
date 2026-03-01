export interface LevelConfig {
  levelId: number
  difficulty: string
  timeLimit: number
}

export interface GameConfig {
  gameName: string
  levels: LevelConfig[]
}

export class GameLoader {
  static load(config: GameConfig): GameConfig {
    // Basic validation
    if (!config.gameName) {
      throw new Error("Invalid Game Config: Missing gameName")
    }

    if (!config.levels || config.levels.length === 0) {
      throw new Error("Invalid Game Config: No levels defined")
    }

    console.log(`Game Loaded: ${config.gameName}`)
    console.log(`Total Levels: ${config.levels.length}`)

    return config
  }
}