/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react"
import type {
  GamePlugin, PluginRenderProps, SudokuQuestion, Question
} from "../../types/engine.types"

function parseBoard(s: string): number[] { return s.split("").map(Number) }

function isValid(board: number[], idx: number, val: number): boolean {
  const row = Math.floor(idx / 9)
  const col = idx % 9
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3)
  for (let i = 0; i < 9; i++) {
    if (board[row * 9 + i] === val && row * 9 + i !== idx) return false
    if (board[i * 9 + col] === val && i * 9 + col !== idx) return false
    const br = Math.floor(box / 3) * 3 + Math.floor(i / 3)
    const bc = (box % 3) * 3 + (i % 3)
    if (board[br * 9 + bc] === val && br * 9 + bc !== idx) return false
  }
  return true
}

function getConflicts(board: number[]): Set<number> {
  const conflicts = new Set<number>()
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0) continue
    const orig = board[i]
    board[i] = 0
    if (!isValid(board, i, orig)) conflicts.add(i)
    board[i] = orig
  }
  return conflicts
}

const SudokuComponent: React.FC<PluginRenderProps<SudokuQuestion>> = ({
  question, config, onAnswer, onRequestHint, isShowingHint, timeRemaining
}) => {
  // Use state (not ref) for given/solution so they can be safely read during render.
  // GameRenderer remounts this component via key={questionId}, so useState initializers
  // always reflect the correct question.
  const [given]    = useState<number[]>(() => parseBoard(question.board))
  const [solution] = useState<number[]>(() => parseBoard(question.solution))

  const [board,     setBoard]     = useState<number[]>(() => parseBoard(question.board))
  const [selected,  setSelected]  = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [correct,   setCorrect]   = useState<boolean | null>(null)
  const [conflicts, setConflicts] = useState<Set<number>>(new Set())
  const [mistakes,  setMistakes]  = useState(0)

  // No reset effect needed — GameRenderer remounts this component via key={questionId}

  const handleCellClick = (idx: number) => {
    if (submitted || given[idx] !== 0) return
    setSelected(idx)
  }

  const handleInput = (val: number) => {
    if (selected === null || submitted) return
    if (given[selected] !== 0) return
    const next = [...board]
    next[selected] = val
    if (val !== 0 && val !== solution[selected]) setMistakes(m => m + 1)
    setBoard(next)
    setConflicts(getConflicts([...next]))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selected === null || submitted) return
    const n = parseInt(e.key)
    if (!isNaN(n) && n >= 0 && n <= 9) handleInput(n)
    if (e.key === "Backspace" || e.key === "Delete") handleInput(0)
    const moves: Record<string, number> = { ArrowUp:-9, ArrowDown:9, ArrowLeft:-1, ArrowRight:1 }
    if (moves[e.key] !== undefined) {
      const nxt = selected + moves[e.key]
      if (nxt >= 0 && nxt < 81) setSelected(nxt)
    }
  }

  const handleSubmit = () => {
    if (submitted) return
    const isCorrect = board.every((v, i) => v === solution[i])
    setSubmitted(true); setCorrect(isCorrect)
    onAnswer({
      questionId: question.id, correct: isCorrect,
      pointsAwarded: 0, timeTaken: 0,
      feedback: isCorrect ? `Solved with ${mistakes} mistake${mistakes !== 1 ? "s" : ""}!` : "Some cells are incorrect",
    })
  }

  const filledCells = 81 - given.filter(v => v !== 0).length - board.filter(v => v === 0).length
  const totalEmpty  = 81 - given.filter(v => v !== 0).length
  const progress    = totalEmpty === 0 ? 100 : Math.round((filledCells / totalEmpty) * 100)

  return (
    <div className="plugin-wrap" onKeyDown={handleKeyDown} tabIndex={0} style={{ outline:"none" }}>
      <div className="q-meta">
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <span className="pts-tag">+{question.points} pts</span>
        {timeRemaining !== undefined && config.ui?.showTimer && (
          <span className={`timer-num${timeRemaining < 30 ? " urgent" : ""}`}>⏱ {timeRemaining}s</span>
        )}
        <span className="sudoku-mistakes">❌ {mistakes} mistake{mistakes !== 1 ? "s" : ""}</span>
        <span className="sudoku-progress-tag">{progress}% filled</span>
      </div>
      <p className="q-prompt">{question.instruction}</p>
      <div className="sudoku-prog-wrap">
        <div className="sudoku-prog-fill" style={{ width:`${progress}%` }}/>
      </div>
      <div className="sudoku-grid">
        {board.map((val, idx) => {
          const isGiven    = given[idx] !== 0
          const isSelected = selected === idx
          const isRelated  = selected !== null && (
            Math.floor(idx / 9) === Math.floor(selected / 9) ||
            idx % 9 === selected % 9 ||
            (Math.floor(idx / 27) === Math.floor(selected / 27) &&
             Math.floor((idx % 9) / 3) === Math.floor((selected % 9) / 3))
          )
          const isConflict = conflicts.has(idx)
          const isWrong    = submitted && !correct && val !== 0 && val !== solution[idx]
          const isSolved   = submitted && correct
          const row = Math.floor(idx / 9); const col = idx % 9
          let cls = "sudoku-cell"
          if (isGiven)    cls += " cell-given"
          if (isSelected) cls += " cell-selected"
          else if (isRelated && !isGiven) cls += " cell-related"
          if (isConflict) cls += " cell-conflict"
          if (isWrong)    cls += " cell-wrong"
          if (isSolved)   cls += " cell-solved"
          if (col % 3 === 2 && col !== 8) cls += " box-border-right"
          if (row % 3 === 2 && row !== 8) cls += " box-border-bottom"
          return <div key={idx} className={cls} onClick={() => handleCellClick(idx)}>{val !== 0 ? val : ""}</div>
        })}
      </div>
      {!submitted && (
        <div className="sudoku-numpad">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className="numpad-btn" onClick={() => handleInput(n)}>{n}</button>
          ))}
          <button className="numpad-btn numpad-clear" onClick={() => handleInput(0)}>✕</button>
        </div>
      )}
      {question.hint && !submitted && (
        <div className="hint-wrap">
          {isShowingHint ? <p className="hint-text">💡 {question.hint}</p>
            : <button className="hint-btn" onClick={onRequestHint}>Show hint</button>}
        </div>
      )}
      {!submitted && (
        <button className="submit-btn" onClick={handleSubmit}>Submit Solution</button>
      )}
      {submitted && (
        <div className={`puzzle-result ${correct ? "res-ok" : "res-fail"}`}>
          {correct ? `✓ Solved! ${mistakes} mistake${mistakes !== 1 ? "s" : ""} made.`
            : "✗ Some cells are incorrect. Press Next to continue."}
        </div>
      )}
    </div>
  )
}

export const SudokuPlugin: GamePlugin<SudokuQuestion> = {
  id: "sudoku", name: "Sudoku Grid", handles: ["sudoku"],
  validateQuestion(q: Question): q is SudokuQuestion {
    const sq = q as SudokuQuestion
    return q.type === "sudoku" &&
      typeof sq.board === "string" && sq.board.length === 81 &&
      typeof sq.solution === "string" && sq.solution.length === 81 &&
      typeof sq.instruction === "string"
  },
  Component: SudokuComponent,
  calculateScore(question, correct, timeTaken, scoring) {
    if (!correct) return 0
    let pts = question.points
    if (scoring.timeBonus && question.timeLimit)
      pts += Math.floor(Math.max(0, question.timeLimit - timeTaken) * scoring.timeBonusPerSecond)
    return pts
  }
}