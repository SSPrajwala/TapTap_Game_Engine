import type { GameConfig, Level, Question } from "../types/engine.types"

export class LevelManager {
  private readonly config: GameConfig
  private completedScores = new Map<string, number>()
  constructor(config: GameConfig) { this.config = config }
  get levels(): Level[] { return this.config.levels }
  first(): Level { const f = this.config.levels[0]; if (!f) throw new Error("No levels"); return f }
  get(id: string): Level | undefined { return this.config.levels.find(l => l.id === id) }
  questionsFor(levelId: string): Question[] { const l = this.get(levelId); if (!l) return []; return this.config.questions.filter(q => l.questionIds.includes(q.id)) }
  complete(levelId: string, score: number): boolean { this.completedScores.set(levelId, score); return score >= (this.get(levelId)?.passingScore ?? 0) }
  next(currentId: string): Level | null { const i = this.config.levels.findIndex(l => l.id === currentId); if (i < 0 || i >= this.config.levels.length - 1) return null; const n = this.config.levels[i + 1]; return this.isUnlocked(n) ? n : null }
  isUnlocked(level: Level): boolean { if (!level.unlockCondition) return true; const s = this.completedScores.get(level.unlockCondition.previousLevelId); return s !== undefined && s >= level.unlockCondition.minScore }
  reset(): void { this.completedScores.clear() }
}