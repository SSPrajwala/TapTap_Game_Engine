import type { AdaptiveRule, Difficulty, PlayerStats, Question } from "../types/engine.types"

export type AdaptiveAction =
  | { type: "adjustDifficulty"; difficulty: Difficulty }
  | { type: "showHint" }
  | { type: "awardBonus"; points: number }
  | { type: "repeatLevel" }

export class AdaptiveEngine {
  private readonly rules: AdaptiveRule[]
  constructor(rules: AdaptiveRule[]) { this.rules = rules }

  evaluate(stats: PlayerStats): AdaptiveAction[] {
    return this.rules.filter(r => this.conditionMet(r, stats)).map(r => this.toAction(r, stats))
  }

  selectQuestions(all: Question[], ids: string[], difficulty: Difficulty): Question[] {
    const pool = all.filter(q => ids.includes(q.id) && q.difficulty === difficulty)
    const source = pool.length > 0 ? pool : all.filter(q => ids.includes(q.id))
    return this.shuffle(source)
  }

  nextDifficulty(current: Difficulty, accuracy: number): Difficulty {
    for (const rule of this.rules) {
      if (rule.action.type === "adjustDifficulty" && rule.condition.metric === "accuracy" && this.compare(accuracy, rule.condition.operator, rule.condition.value)) {
        const t = rule.action.payload?.["difficulty"] as Difficulty | undefined
        if (t) return t
      }
    }
    if (accuracy >= 0.8 && current === "easy") return "medium"
    if (accuracy >= 0.8 && current === "medium") return "hard"
    if (accuracy < 0.4 && current === "hard") return "medium"
    if (accuracy < 0.4 && current === "medium") return "easy"
    return current
  }

  private conditionMet(rule: AdaptiveRule, stats: PlayerStats): boolean {
    const v = rule.condition.metric === "accuracy" ? stats.accuracy : rule.condition.metric === "averageTime" ? stats.averageTime : stats.streak
    return this.compare(v, rule.condition.operator, rule.condition.value)
  }

  private compare(a: number, op: AdaptiveRule["condition"]["operator"], b: number): boolean {
    return op === "<" ? a < b : op === ">" ? a > b : op === "==" ? a === b : op === "<=" ? a <= b : a >= b
  }

  private toAction(rule: AdaptiveRule, stats: PlayerStats): AdaptiveAction {
    switch (rule.action.type) {
      case "adjustDifficulty": return { type: "adjustDifficulty", difficulty: (rule.action.payload?.["difficulty"] as Difficulty) ?? stats.difficulty }
      case "showHint": return { type: "showHint" }
      case "awardBonus": return { type: "awardBonus", points: (rule.action.payload?.["points"] as number) ?? 0 }
      default: return { type: "repeatLevel" }
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[out[i], out[j]] = [out[j], out[i]] }
    return out
  }
}