// ─────────────────────────────────────────────────────────────────────────────
// EngineCore.ts
//
// OLD:
//   static run(config, metrics): EngineResult
//   → One-shot static call. No state. Called from handleAnswer() in App.tsx.
//   → Returned { game, level, decision, score } — mixed concerns.
//   → AdaptiveEngine.decide() returned a raw string with no typed rules.
//   → ScoreEngine.calculate() received hardcoded responseTime: 30, attempts: 1.
//
// NEW:
//   instance.reduce(state, action): GameState   ← pure reducer for useReducer
//   instance.initialState(): GameState          ← builds first state from config
//   instance.currentQuestion(state): Question   ← convenience accessor
//   instance.on(listener): () => void           ← replaces AnalyticsEngine calls
//
// App.tsx goes from ~80 lines of game logic to zero.
// Every branch that was if (result.decision === "NEXT") is now a reducer case.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GameConfig,
  GameState,
  Question,
  EngineAction,
  EngineEvent,
  EngineEventListener,
} from "../types/engine.types"
import { ScoreEngine, createInitialStats } from "./ScoreEngine"
import { AdaptiveEngine }                  from "./AdaptiveEngine"
import { LevelManager }                    from "./LevelManager"

export class EngineCore {
  readonly config:  GameConfig

  private score:    ScoreEngine
  private adaptive: AdaptiveEngine
  private levels:   LevelManager
  private listeners: EngineEventListener[] = []

  constructor(config: GameConfig) {
    this.config   = config
    this.score    = new ScoreEngine(config.scoring)
    this.adaptive = new AdaptiveEngine(config.adaptiveRules)
    this.levels   = new LevelManager(config)
  }

  // ── Initial state ──────────────────────────────────────────────────────────
  // Called once (useReducer's initializer). Replaces the scattered
  // useState() calls in old App.tsx.

  initialState(): GameState {
    const first     = this.levels.first()
    const questions = this.adaptive.selectQuestions(
      this.config.questions,
      first.questionIds,
      "easy"
    )
    return {
      status:            "idle",
      currentLevelId:    first.id,
      currentQuestionId: questions[0]?.id ?? "",
      questionIndex:     0,
      levelQuestions:    questions,
      stats:             createInitialStats("easy"),
      startTime:         null,
      questionStartTime: null,
      answeredIds:       new Set(),
    }
  }

  // ── Pure reducer ───────────────────────────────────────────────────────────
  // React calls this via useReducer(engine.reduce, ...).
  // No side-effects inside — emit() is called but it only notifies listeners,
  // it doesn't modify state or trigger re-renders directly.

  reduce = (state: GameState, action: EngineAction): GameState => {
    switch (action.type) {

      // ── START_GAME ─────────────────────────────────────────────────────────
      case "START_GAME":
        return {
          ...state,
          status:            "playing",
          startTime:         Date.now(),
          questionStartTime: Date.now(),
        }

      // ── SUBMIT_ANSWER ──────────────────────────────────────────────────────
      // Replaces: player.recordAnswer(), player.updateScore(),
      //           EngineCore.run(), setDecision(), setScore()
      //           all scattered across handleAnswer() in App.tsx

      case "SUBMIT_ANSWER": {
        const { questionId, correct, timeTaken } = action.payload
        const question = state.levelQuestions.find(q => q.id === questionId)
        if (!question || state.answeredIds.has(questionId)) return state

        const points      = this.score.calculate(question, correct, timeTaken, state.stats.streak)
        const updatedStats = this.score.updateStats(state.stats, correct, timeTaken, points)

        // Apply adaptive rules to the post-answer stats
        const adaptiveActions = this.adaptive.evaluate(updatedStats)
        let finalStats = { ...updatedStats }

        for (const a of adaptiveActions) {
          if (a.type === "adjustDifficulty") {
            finalStats = { ...finalStats, difficulty: a.difficulty }
            this.emit({ type: "DIFFICULTY_CHANGED", payload: { from: state.stats.difficulty, to: a.difficulty } })
          }
          if (a.type === "awardBonus") {
            finalStats = { ...finalStats, score: finalStats.score + a.points }
          }
        }

        const answeredIds = new Set(state.answeredIds).add(questionId)

        const feedback = this.score.buildFeedback(correct, points, finalStats.streak, question.hint)

        this.emit({
          type: "ANSWER_SUBMITTED",
          payload: { questionId, correct, pointsAwarded: points, timeTaken, feedback },
        })

        return { ...state, stats: finalStats, answeredIds }
      }

      // ── REQUEST_HINT ───────────────────────────────────────────────────────
      case "REQUEST_HINT": {
        const q = state.levelQuestions.find(q => q.id === state.currentQuestionId)
        this.emit({ type: "HINT_REQUESTED", payload: { questionId: state.currentQuestionId } })
        return { ...state, stats: { ...state.stats, hintsUsed: state.stats.hintsUsed + 1 } }
      }

      // ── NEXT_QUESTION ──────────────────────────────────────────────────────
      // Replaces: the nextQuestion / setLevelIndex / QuestionEngine.reset() block
      // that was manually computed in App.tsx after every answer.

      case "NEXT_QUESTION": {
        const nextIdx = state.questionIndex + 1

        // Level complete
        if (nextIdx >= state.levelQuestions.length) {
          const maxPts    = this.score.maxPoints(state.levelQuestions)
          const scorePct  = this.score.levelScore(state.stats.score, maxPts)
          const passed    = this.levels.complete(state.currentLevelId, scorePct)
          this.emit({ type: "LEVEL_COMPLETE", payload: { levelId: state.currentLevelId, score: scorePct, passed } })
          return { ...state, status: "levelComplete" }
        }

        const nextQ = state.levelQuestions[nextIdx]
        return {
          ...state,
          questionIndex:     nextIdx,
          currentQuestionId: nextQ.id,
          questionStartTime: Date.now(),
        }
      }

      // ── NEXT_LEVEL ─────────────────────────────────────────────────────────
      // Replaces: player.moveToNextLevel(), manual index math, QuestionEngine.reset()

      case "NEXT_LEVEL": {
        const nextLevel = this.levels.next(state.currentLevelId)

        if (!nextLevel) {
          this.emit({ type: "GAME_OVER", payload: { finalScore: state.stats.score, accuracy: state.stats.accuracy } })
          return { ...state, status: "gameOver" }
        }

        const nextDiff  = this.adaptive.nextDifficulty(state.stats.difficulty, state.stats.accuracy, this.config)
        const questions = this.adaptive.selectQuestions(this.config.questions, nextLevel.questionIds, nextDiff)

        return {
          ...state,
          status:            "playing",
          currentLevelId:    nextLevel.id,
          currentQuestionId: questions[0]?.id ?? "",
          questionIndex:     0,
          levelQuestions:    questions,
          answeredIds:       new Set(),
          questionStartTime: Date.now(),
          stats:             { ...state.stats, difficulty: nextDiff },
        }
      }

      // ── RESTART ────────────────────────────────────────────────────────────
      case "RESTART":
        this.levels.reset()
        return this.initialState()

      default:
        return state
    }
  }

  // ── Convenience ───────────────────────────────────────────────────────────

  currentQuestion(state: GameState): Question | undefined {
    return state.levelQuestions.find(q => q.id === state.currentQuestionId)
  }

  // ── Event bus (replaces AnalyticsEngine calls in App.tsx) ─────────────────

  on(listener: EngineEventListener): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  private emit(event: EngineEvent): void {
    this.listeners.forEach(l => l(event))
  }
}