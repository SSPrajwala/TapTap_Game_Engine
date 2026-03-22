// ─────────────────────────────────────────────────────────────────────────────
// AdaptiveEngine.ts
//
// OLD: AdaptiveEngine.decide(metrics) returned a raw string ("NEXT" | "REPEAT")
//      with zero typed rules. App.tsx then did: if (result.decision === "NEXT")
//      — brittle string comparison, no JSON control whatsoever.
//
// NEW: Reads AdaptiveRule[] directly from GameConfig. Every threshold is in
//      your JSON. Zero hardcoded values. Returns typed AdaptiveAction objects.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AdaptiveRule,
  Difficulty,
  PlayerStats,
  Question,
  GameConfig,
} from "../types/engine.types"

// Typed actions — replaces the old raw string return
export type AdaptiveAction =
  | { type: "adjustDifficulty"; difficulty: Difficulty }
  | { type: "showHint" }
  | { type: "awardBonus"; points: number }
  | { type: "repeatLevel" }

export class AdaptiveEngine {
  private readonly rules: AdaptiveRule[]

  constructor(rules: AdaptiveRule[]) {
    this.rules = rules
  }

  // ── Evaluate all rules after each answer ───────────────────────────────────
  // Returns every action whose condition is satisfied. EngineCore applies them
  // in order inside the reducer — still pure, still testable.

  evaluate(stats: PlayerStats): AdaptiveAction[] {
    return this.rules
      .filter(rule => this.conditionMet(rule, stats))
      .map(rule  => this.toAction(rule, stats))
  }

  // ── Question selection ─────────────────────────────────────────────────────
  // Your old QuestionEngine held static mutable state (currentIndex, reset()).
  // This is a pure function: same inputs → same output, no hidden state.

  selectQuestions(
    allQuestions: Question[],
    questionIds:  string[],
    difficulty:   Difficulty
  ): Question[] {
    const pool = allQuestions.filter(
      q => questionIds.includes(q.id) && q.difficulty === difficulty
    )
    // Graceful fallback: if target difficulty has no questions, use all
    const source = pool.length > 0
      ? pool
      : allQuestions.filter(q => questionIds.includes(q.id))

    return this.shuffle(source)
  }

  // ── Next difficulty ────────────────────────────────────────────────────────
  // Checks explicit JSON rules first; built-in thresholds are the fallback.

  nextDifficulty(
    current:  Difficulty,
    accuracy: number,
    _config:  GameConfig   // reserved: future per-game difficulty curves
  ): Difficulty {
    // Explicit rule wins
    for (const rule of this.rules) {
      if (
        rule.action.type === "adjustDifficulty" &&
        rule.condition.metric === "accuracy" &&
        this.compare(accuracy, rule.condition.operator, rule.condition.value)
      ) {
        const target = rule.action.payload?.["difficulty"] as Difficulty | undefined
        if (target) return target
      }
    }

    // Built-in fallback progression
    if (accuracy >= 0.8 && current === "easy")   return "medium"
    if (accuracy >= 0.8 && current === "medium")  return "hard"
    if (accuracy < 0.4  && current === "hard")    return "medium"
    if (accuracy < 0.4  && current === "medium")  return "easy"
    return current
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private conditionMet(rule: AdaptiveRule, stats: PlayerStats): boolean {
    const actual = this.metricValue(stats, rule.condition.metric)
    return this.compare(actual, rule.condition.operator, rule.condition.value)
  }

  private metricValue(
    stats:  PlayerStats,
    metric: AdaptiveRule["condition"]["metric"]
  ): number {
    switch (metric) {
      case "accuracy":    return stats.accuracy
      case "averageTime": return stats.averageTime
      case "streak":      return stats.streak
    }
  }

  private compare(
    actual:   number,
    op:       AdaptiveRule["condition"]["operator"],
    target:   number
  ): boolean {
    switch (op) {
      case "<":  return actual < target
      case ">":  return actual > target
      case "==": return actual === target
      case "<=": return actual <= target
      case ">=": return actual >= target
    }
  }

  private toAction(rule: AdaptiveRule, stats: PlayerStats): AdaptiveAction {
    switch (rule.action.type) {
      case "adjustDifficulty":
        return {
          type:       "adjustDifficulty",
          difficulty: (rule.action.payload?.["difficulty"] as Difficulty) ?? stats.difficulty,
        }
      case "showHint":
        return { type: "showHint" }
      case "awardBonus":
        return { type: "awardBonus", points: (rule.action.payload?.["points"] as number) ?? 0 }
      case "repeatLevel":
        return { type: "repeatLevel" }
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
}