/* eslint-disable react-refresh/only-export-components */
import React, { useState, useRef } from "react"
import type {
  GamePlugin,
  PluginRenderProps,
  PuzzleQuestion,
  Question,
  AnswerResult,
} from "../../types/engine.types"

const PuzzleComponent: React.FC<PluginRenderProps<PuzzleQuestion>> = ({
  question,
  config,
  onAnswer,
  onRequestHint,
  isShowingHint,
  timeRemaining,
}) => {
  const [inputs,    setInputs]    = useState<string[]>(() => Array(question.sequenceLength).fill(""))
  const [submitted, setSubmitted] = useState(false)
  const [correct,   setCorrect]   = useState<boolean | null>(null)
  const submittedRef = useRef(false)

  const timeLimit  = question.timeLimit ?? 30
  const timeLeft   = timeRemaining ?? timeLimit
  const timerPct   = Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100))
  const timerColor = timeLeft <= 5 ? "#FF6090" : timeLeft <= 10 ? "#FFD700" : "#22FFAA"

  // No reset effect needed — GameRenderer remounts this component via key={questionId}

  // Derive expected answers from the arithmetic pattern
  const expected = (): number[] => {
  const p = question.pattern
  // Try arithmetic first (constant difference)
  const diffs = p.slice(1).map((v, i) => v - p[i])
  const isArithmetic = diffs.every(d => d === diffs[0])
  if (isArithmetic) {
    return Array.from({ length: question.sequenceLength },
      (_, i) => p[p.length - 1] + diffs[0] * (i + 1))
  }
  // Try geometric (constant ratio)
  const ratios = p.slice(1).map((v, i) => v / p[i])
  const isGeometric = ratios.every(r => Math.abs(r - ratios[0]) < 0.001)
  if (isGeometric) {
    return Array.from({ length: question.sequenceLength },
      (_, i) => Math.round(p[p.length - 1] * Math.pow(ratios[0], i + 1)))
  }
  // Try quadratic (constant second difference — catches 1,4,9,16,25...)
  const d2 = diffs.slice(1).map((v, i) => v - diffs[i])
  const isQuadratic = d2.every(d => d === d2[0])
  if (isQuadratic) {
    const results: number[] = []
    let last = p[p.length - 1]
    let lastDiff = diffs[diffs.length - 1]
    for (let i = 0; i < question.sequenceLength; i++) {
      lastDiff += d2[0]
      last += lastDiff
      results.push(last)
    }
    return results
  }
  // Fallback to arithmetic
  return Array.from({ length: question.sequenceLength },
    (_, i) => p[p.length - 1] + diffs[0] * (i + 1))
}

  const handleSubmit = () => {
    if (submittedRef.current) return
    submittedRef.current = true
    const exp = expected()
    const ok  = inputs.every((v, i) => parseInt(v, 10) === exp[i])
    setCorrect(ok)
    setSubmitted(true)

    const result: AnswerResult = {
      questionId:    question.id,
      correct:       ok,
      pointsAwarded: 0,
      timeTaken:     0,
      feedback:      ok ? "Correct sequence!" : `Expected: ${exp.join(", ")}`,
    }
    onAnswer(result)
  }

  const exp = submitted ? expected() : []

  return (
    <div className="puzzle-plugin">
      <div className="q-meta">
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <span className="pts-label">+{question.points} pts</span>
        {config.ui?.showTimer && !submitted && (
          <span style={{
            fontFamily: "Orbitron,monospace", fontSize: "0.72rem", fontWeight: 700,
            color: timerColor, marginLeft: "auto",
          }}>
            ⏱ {timeLeft}s
          </span>
        )}
      </div>

      {/* Timer bar */}
      {config.ui?.showTimer && !submitted && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{
            height: "5px", borderRadius: "99px",
            background: "rgba(255,255,255,0.08)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: "99px",
              width: `${timerPct}%`,
              background: `linear-gradient(90deg, ${timerColor}, ${timerColor}88)`,
              transition: "width 1s linear, background 0.5s",
            }} />
          </div>
        </div>
      )}

      <h2 className="q-prompt">{question.instruction}</h2>

      <div className="pattern-row">
        {question.pattern.map((n, i) => (
          <div key={i} className="pattern-cell">{n}</div>
        ))}
        <div className="pattern-sep">→</div>
        {inputs.map((val, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={6}
            className={`pattern-input${submitted ? (parseInt(val, 10) === exp[i] ? " correct" : " wrong") : ""}`}
            value={val}
            placeholder="?"
            disabled={submitted}
            onChange={e => {
              if (submitted) return
              const next = [...inputs]
              next[i]    = e.target.value.replace(/[^0-9-]/g, "")
              setInputs(next)
            }}
          />
        ))}
      </div>

      {question.hint && (
        <div className="hint-row">
          {isShowingHint
            ? <p className="hint-text">💡 {question.hint}</p>
            : <button className="hint-btn" onClick={onRequestHint}>Show hint</button>
          }
        </div>
      )}

      {!submitted && (
        <button
          className="submit-btn"
          disabled={inputs.some(v => v === "")}
          onClick={handleSubmit}
        >
          Submit answer
        </button>
      )}

      {submitted && (
        <div className={`puzzle-result ${correct ? "result-correct" : "result-wrong"}`}>
          {correct ? "✓ Perfect pattern!" : `✗ Correct answer was: ${exp.join(", ")}`}
        </div>
      )}
    </div>
  )
}

export const PuzzlePlugin: GamePlugin<PuzzleQuestion> = {
  id:      "puzzle",
  name:    "Number Pattern Puzzle",
  handles: ["puzzle"],

  validateQuestion(q: Question): q is PuzzleQuestion {
    const pq = q as PuzzleQuestion
    return (
      q.type === "puzzle" &&
      Array.isArray(pq.pattern) &&
      typeof pq.sequenceLength === "number" &&
      typeof pq.instruction    === "string"
    )
  },

  Component: PuzzleComponent,
}