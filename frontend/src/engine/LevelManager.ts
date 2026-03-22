// ─────────────────────────────────────────────────────────────────────────────
// LevelManager.ts
//
// OLD: LevelManager(game.levels) → getCurrentLevel() + applyDecision(decision)
//      with no unlock logic, no pass/fail, no JSON-driven conditions.
//
// NEW: Fully driven by Level.unlockCondition in JSON. Tracks completion scores.
//      Pure methods — no mutation of game state (that lives in the reducer).
// ─────────────────────────────────────────────────────────────────────────────

import type { GameConfig, Level, Question } from "../types/engine.types"

export class LevelManager {
  private readonly config: GameConfig
  private completedScores = new Map<string, number>()   // levelId → score %

  constructor(config: GameConfig) {
    this.config = config
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get levels(): Level[] { return this.config.levels }

  first(): Level {
    const first = this.config.levels[0]
    if (!first) throw new Error("GameConfig has no levels")
    return first
  }

  get(id: string): Level | undefined {
    return this.config.levels.find(l => l.id === id)
  }

  questionsFor(levelId: string): Question[] {
    const level = this.get(levelId)
    if (!level) return []
    return this.config.questions.filter(q => level.questionIds.includes(q.id))
  }

  // ── Progression ────────────────────────────────────────────────────────────

  complete(levelId: string, scorePercent: number): boolean {
    this.completedScores.set(levelId, scorePercent)
    const level = this.get(levelId)
    return scorePercent >= (level?.passingScore ?? 0)
  }

  next(currentLevelId: string): Level | null {
    const idx = this.config.levels.findIndex(l => l.id === currentLevelId)
    if (idx < 0 || idx >= this.config.levels.length - 1) return null
    const candidate = this.config.levels[idx + 1]
    return this.isUnlocked(candidate) ? candidate : null
  }

  isUnlocked(level: Level): boolean {
    if (!level.unlockCondition) return true
    const { previousLevelId, minScore } = level.unlockCondition
    const prev = this.completedScores.get(previousLevelId)
    return prev !== undefined && prev >= minScore
  }

  isCompleted(levelId: string): boolean {
    return this.completedScores.has(levelId)
  }

  scoreFor(levelId: string): number {
    return this.completedScores.get(levelId) ?? 0
  }

  reset(): void {
    this.completedScores.clear()
  }
}