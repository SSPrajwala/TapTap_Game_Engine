/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef, useCallback } from "react"
import type {
  GamePlugin, PluginRenderProps, WordBuilderQuestion, Question
} from "../../types/engine.types"

const WordBuilderComponent: React.FC<PluginRenderProps<WordBuilderQuestion>> = ({
  question, config, onAnswer, onRequestHint, isShowingHint, timeRemaining
}) => {
  const [input,      setInput]      = useState("")
  const [found,      setFound]      = useState<string[]>([])
  const [shake,      setShake]      = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [flashWord,  setFlashWord]  = useState<string | null>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const submittedRef = useRef(false)

  // Letters shuffled once at mount — GameRenderer remounts via key={questionId}
  const [displayLetters] = useState(() => [...question.letters].sort(() => Math.random() - 0.5))

  const normalise = (w: string) => w.trim().toLowerCase()

  // useCallback gives handleFinish a stable reference so it can safely be a dep below.
  // Empty deps are safe: this component always remounts fresh per question
  // (GameRenderer uses key={questionId}), so captured vars are never stale.
  const handleFinish = useCallback((currentFound: string[]) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    const isCorrect  = currentFound.length >= question.targetCount
    const bonusCount = (question.bonusWords ?? []).filter(w => currentFound.includes(normalise(w))).length
    onAnswer({
      questionId: question.id, correct: isCorrect,
      pointsAwarded: 0, timeTaken: 0,
      feedback: isCorrect
        ? `Found ${currentFound.length} words${bonusCount > 0 ? ` (${bonusCount} bonus!)` : ""}!`
        : `Found ${currentFound.length}/${question.targetCount} required`,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // empty: component is always fresh (key-remounted)

  useEffect(() => {
    if (!submittedRef.current && found.length >= question.targetCount) {
      handleFinish(found)
    }
  }, [found, question.targetCount, handleFinish])

  const handleSubmitWord = () => {
    const word = normalise(input)
    if (!word) return
    setInput("")
    inputRef.current?.focus()
    if (found.includes(word)) { triggerShake(); return }
    const allValid = [
      ...question.validWords.map(normalise),
      ...(question.bonusWords ?? []).map(normalise)
    ]
    if (!allValid.includes(word)) { triggerShake(); return }
    const avail = [...question.letters.map(l => l.toLowerCase())]
    let ok = true
    for (const ch of word) {
      const i = avail.indexOf(ch)
      if (i === -1) { ok = false; break }
      avail.splice(i, 1)
    }
    if (!ok) { triggerShake(); return }
    const next = [...found, word]
    setFound(next)
    setFlashWord(word)
    setTimeout(() => setFlashWord(null), 700)
  }

  const handleLetterClick = (letter: string) => {
    if (submitted) return
    setInput(i => i + letter.toLowerCase())
    inputRef.current?.focus()
  }

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 400) }

  const allWords = [...question.validWords, ...(question.bonusWords ?? [])]
  const remaining = question.targetCount - found.length

  return (
    <div className="plugin-wrap">
      <div className="q-meta">
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <span className="pts-tag">+{question.points} pts</span>
        {timeRemaining !== undefined && config.ui?.showTimer && (
          <span className={`timer-num${timeRemaining < 15 ? " urgent" : ""}`}>⏱ {timeRemaining}s</span>
        )}
      </div>
      <p className="q-prompt">{question.instruction}</p>
      <div className="wb-target-row">
        <span className="wb-target-label">
          {found.length >= question.targetCount
            ? `✓ Target reached! (${found.length} words)`
            : `Find ${remaining} more word${remaining !== 1 ? "s" : ""} to pass`}
        </span>
        <div className="wb-target-dots">
          {Array.from({ length: question.targetCount }, (_, i) => (
            <div key={i} className={`wb-dot${i < found.length ? " filled" : ""}`}/>
          ))}
        </div>
      </div>
      <div className="wb-letters">
        {displayLetters.map((letter, i) => (
          <button key={i} className="wb-letter-tile" onClick={() => handleLetterClick(letter)} disabled={submitted}>
            {letter.toUpperCase()}
          </button>
        ))}
      </div>
      {!submitted && (
        <div className={`wb-input-row${shake ? " shake" : ""}`}>
          <input ref={inputRef} className="wb-input"
            value={input.toUpperCase()}
            onChange={e => setInput(e.target.value.toLowerCase().replace(/[^a-z]/g,""))}
            onKeyDown={e => { if (e.key === "Enter") handleSubmitWord(); if (e.key === "Escape") setInput("") }}
            placeholder="Type or click letters..." maxLength={12} autoFocus disabled={submitted}/>
          <button className="wb-submit-word" onClick={handleSubmitWord} disabled={!input.trim()}>Add ↵</button>
          <button className="wb-clear" onClick={() => setInput("")}>✕</button>
        </div>
      )}
      {flashWord && <div className="wb-flash">+{flashWord.toUpperCase()}</div>}
      {found.length > 0 && (
        <div className="wb-found-section">
          <div className="wb-found-label">Found words ({found.length})</div>
          <div className="wb-found-words">
            {found.map((w, i) => {
              const isBonus = (question.bonusWords ?? []).map(b => b.toLowerCase()).includes(w)
              return (
                <span key={i} className={`wb-word-chip${isBonus ? " bonus" : ""}`}>
                  {w.toUpperCase()}{isBonus ? " ⭐" : ""}
                </span>
              )
            })}
          </div>
        </div>
      )}
      {question.hint && !submitted && (
        <div className="hint-wrap">
          {isShowingHint ? <p className="hint-text">💡 {question.hint}</p>
            : <button className="hint-btn" onClick={onRequestHint}>Show hint</button>}
        </div>
      )}
      {!submitted && found.length >= question.targetCount && (
        <button className="submit-btn" onClick={() => handleFinish(found)}>Finish Round →</button>
      )}
      {submitted && (
        <div className={`puzzle-result ${found.length >= question.targetCount ? "res-ok" : "res-fail"}`}>
          {found.length >= question.targetCount
            ? `✓ Passed! Found ${found.length} / ${allWords.length} possible words.`
            : `✗ Only found ${found.length} / ${question.targetCount} required words.`}
        </div>
      )}
    </div>
  )
}

export const WordBuilderPlugin: GamePlugin<WordBuilderQuestion> = {
  id: "wordbuilder", name: "Word Builder", handles: ["wordbuilder"],
  validateQuestion(q: Question): q is WordBuilderQuestion {
    const wq = q as WordBuilderQuestion
    return q.type === "wordbuilder" && Array.isArray(wq.letters) &&
      Array.isArray(wq.validWords) && typeof wq.targetCount === "number" &&
      typeof wq.instruction === "string"
  },
  Component: WordBuilderComponent,
  calculateScore(question, correct, timeTaken, scoring) {
    if (!correct) return 0
    let pts = question.points
    if (scoring.timeBonus && question.timeLimit)
      pts += Math.floor(Math.max(0, question.timeLimit - timeTaken) * scoring.timeBonusPerSecond)
    return pts
  }
}