// ─────────────────────────────────────────────────────────────────────────────
// useGameEngine.ts
//
// Extracts all engine wiring from GameRenderer:
//   - useReducer wired to EngineCore.reduce
//   - Timer countdown with auto-submit on expiry
//   - Hint state
//   - Last answer result for toast feedback
//   - Engine event subscription
//
// GameRenderer becomes a pure layout component. No game logic inside it.
// ─────────────────────────────────────────────────────────────────────────────

import { useReducer, useEffect, useState, useCallback, useRef } from "react"
import type { GameConfig, AnswerResult, EngineAction } from "../types/engine.types"
import { EngineCore } from "../engine/EngineCore"

export function useGameEngine(config: GameConfig) {
  // Stable engine — never recreated on re-render
  const engineRef = useRef<EngineCore | null>(null)
  if (!engineRef.current) {
    engineRef.current = new EngineCore(config)
  }
  const engine = engineRef.current

  const [state, dispatch] = useReducer(engine.reduce, undefined, () => engine.initialState())

  const [lastResult,    setLastResult]    = useState<AnswerResult | null>(null)
  const [isShowingHint, setIsShowingHint] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | undefined>(undefined)

  // ── Engine events → UI side-effects ────────────────────────────────────────
  useEffect(() => {
    return engine.on(event => {
      if (event.type === "ANSWER_SUBMITTED") {
        setLastResult(event.payload)
      }
      // Hook analytics here without touching core:
      // if (event.type === "LEVEL_COMPLETE") analytics.track(...)
    })
  }, [engine])

  // ── Timer ──────────────────────────────────────────────────────────────────
  // Your old timer was in App.tsx and reset only on levelIndex change.
  // This one resets on currentQuestionId so each question gets its own timer.

  const currentQuestion = engine.currentQuestion(state)

  useEffect(() => {
    if (!currentQuestion?.timeLimit || state.status !== "playing") {
      setTimeRemaining(undefined)
      return
    }
    setTimeRemaining(currentQuestion.timeLimit)

    const tick = setInterval(() => {
      setTimeRemaining(t => {
        if (t === undefined || t <= 1) {
          clearInterval(tick)
          // Time's up — auto-submit as incorrect if not already answered
          if (!state.answeredIds.has(currentQuestion.id)) {
            dispatch({
              type: "SUBMIT_ANSWER",
              payload: {
                questionId: currentQuestion.id,
                correct:    false,
                timeTaken:  currentQuestion.timeLimit!,
              },
            })
          }
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(tick)
  }, [state.currentQuestionId, state.status])

  // ── Reset hint + toast on new question ────────────────────────────────────
  useEffect(() => {
    setIsShowingHint(false)
    setLastResult(null)
  }, [state.currentQuestionId])

  // ── Stable callbacks ───────────────────────────────────────────────────────

  const handleAnswer = useCallback((result: AnswerResult) => {
    // Compute actual elapsed time from engine's questionStartTime
    const timeTaken = state.questionStartTime
      ? (Date.now() - state.questionStartTime) / 1000
      : result.timeTaken

    dispatch({
      type: "SUBMIT_ANSWER",
      payload: { questionId: result.questionId, correct: result.correct, timeTaken },
    })
  }, [state.questionStartTime])

  const handleHint = useCallback(() => {
    setIsShowingHint(true)
    dispatch({ type: "REQUEST_HINT" })
  }, [])

  const send = useCallback((action: EngineAction) => dispatch(action), [])

  return {
    state,
    engine,
    currentQuestion,
    lastResult,
    isShowingHint,
    timeRemaining,
    handleAnswer,
    handleHint,
    send,
  }
}