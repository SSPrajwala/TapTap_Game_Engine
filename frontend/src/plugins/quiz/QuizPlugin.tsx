// ─────────────────────────────────────────────────────────────────────────────
// QuizPlugin.tsx
//
// OLD QuizPlugin:
//   export const QuizPlugin: GamePlugin = { name: "quiz", start(level) { console.log(...) } }
//   → No Component. No validateQuestion. Rendered nothing. JSON plugin field did nothing.
//
// NEW QuizPlugin:
//   → Typed GamePlugin<QuizQuestion> with a real React component.
//   → validateQuestion is a type guard — rejects wrong question shapes at runtime.
//   → Component owns only UI state (selected index, revealed flag).
//     All game state (score, streak, progression) stays in the engine reducer.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable react-refresh/only-export-components */
import React, { useState, useRef } from "react"
import type {
  GamePlugin,
  PluginRenderProps,
  QuizQuestion,
  Question,
  AnswerResult,
} from "../../types/engine.types"

// ── Component ─────────────────────────────────────────────────────────────────

const QuizComponent: React.FC<PluginRenderProps<QuizQuestion>> = ({
  question,
  stats,
  config,
  onAnswer,
  onRequestHint,
  isShowingHint,
  timeRemaining,
}) => {
  const [selected,  setSelected]  = useState<number | null>(null)
  const [revealed,  setRevealed]  = useState(false)
  const submittedRef = useRef(false)

  const handleSelect = (index: number) => {
    if (revealed || submittedRef.current) return
    submittedRef.current = true
    setSelected(index)
    setRevealed(true)

    const correct = index === question.correctIndex
    // timeTaken is measured by the engine via questionStartTime;
    // we pass 0 here and the reducer computes actual elapsed time.
    const result: AnswerResult = {
      questionId:    question.id,
      correct,
      pointsAwarded: 0,   // engine recalculates — this is just a signal
      timeTaken:     0,   // engine measures from questionStartTime
      feedback:      correct ? "Correct!" : "Incorrect",
    }
    onAnswer(result)
  }

  const showTimer = config.ui?.showTimer !== false && question.timeLimit

  return (
    <div className="quiz-plugin">

      {/* Timer bar */}
      {showTimer && timeRemaining !== undefined && (
        <div className="timer-bar-wrap">
          <div
            className="timer-bar"
            style={{
              width:      `${Math.max(0, (timeRemaining / (question.timeLimit ?? 30)) * 100)}%`,
              background: timeRemaining < 6 ? "var(--danger)" : "var(--accent)",
            }}
          />
        </div>
      )}

      {/* Meta row */}
      <div className="q-meta">
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <span className="pts-label">+{question.points} pts</span>
        {config.scoring && stats.streak >= config.scoring.streakThreshold && config.scoring.streakMultiplier && (
          <span className="streak-label">🔥 ×{config.scoring.streakMultiplierValue}</span>
        )}
        {showTimer && timeRemaining !== undefined && (
          <span className={`timer-num ${timeRemaining < 6 ? "timer-urgent" : ""}`}>
            ⏱ {timeRemaining}s
          </span>
        )}
      </div>

      {/* Prompt */}
      <h2 className="q-prompt">{question.prompt}</h2>

      {/* Hint */}
      {question.hint && (
        <div className="hint-row">
          {isShowingHint
            ? <p className="hint-text">💡 {question.hint}</p>
            : <button className="hint-btn" onClick={onRequestHint}>Show hint</button>
          }
        </div>
      )}

      {/* Options — 2×2 grid for 4 options, single column otherwise */}
      <div className={`options-grid${question.options.length === 4 ? " options-grid-2col" : ""}`}>
        {question.options.map((opt, i) => {
          let cls = "opt-btn"
          if (revealed) {
            if (i === question.correctIndex) cls += " correct"
            else if (i === selected)         cls += " wrong"
          } else if (i === selected) {
            cls += " selected"
          }
          return (
            <button key={i} className={cls} onClick={() => handleSelect(i)} disabled={revealed}>
              <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
              <span className="opt-text">{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Explanation after reveal */}
      {revealed && question.explanation && (
        <div className="explanation">
          <strong>Why:</strong> {question.explanation}
        </div>
      )}
    </div>
  )
}

// ── Plugin definition ─────────────────────────────────────────────────────────

export const QuizPlugin: GamePlugin<QuizQuestion> = {
  id:      "quiz",
  name:    "Multiple Choice Quiz",
  handles: ["quiz"],

  validateQuestion(q: Question): q is QuizQuestion {
    const qq = q as QuizQuestion
    return (
      q.type === "quiz" &&
      typeof qq.prompt        === "string" &&
      Array.isArray(qq.options) &&
      typeof qq.correctIndex  === "number"
    )
  },

  Component: QuizComponent,
}