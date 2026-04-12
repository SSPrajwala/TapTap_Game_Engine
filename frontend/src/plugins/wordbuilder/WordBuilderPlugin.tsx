/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef, useCallback } from "react"
import type {
  GamePlugin, PluginRenderProps, WordBuilderQuestion, Question
} from "../../types/engine.types"
import { SoundEngine } from "../../services/SoundEngine"

const WordBuilderComponent: React.FC<PluginRenderProps<WordBuilderQuestion>> = ({
  question, config, onAnswer, onRequestHint, isShowingHint, timeRemaining
}) => {
  const [input,     setInput]     = useState("")
  const [found,     setFound]     = useState<string[]>([])
  const [shake,     setShake]     = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [flashWord, setFlashWord] = useState<string | null>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const submittedRef = useRef(false)
  const warnedRef    = useRef(false)   // prevent repeat timer-warn sounds

  // Letters shuffled once at mount — GameRenderer remounts via key={questionId}
  const [displayLetters] = useState(() => [...question.letters].sort(() => Math.random() - 0.5))

  const normalise = (w: string) => w.trim().toLowerCase()

  const timeLimit = question.timeLimit ?? 90
  const timeLeft  = timeRemaining ?? timeLimit
  const timerPct  = Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100))
  const timerColor = timeLeft <= 10 ? "#FF6090" : timeLeft <= 20 ? "#FFD700" : "#22FFAA"

  // Warn sound at 10s left
  useEffect(() => {
    if (timeLeft === 10 && !submitted && !warnedRef.current) {
      warnedRef.current = true
      SoundEngine.timerWarn()
    }
  }, [timeLeft, submitted])

  // When engine timer hits 0 — finish the round
  useEffect(() => {
    if (timeLeft === 0 && !submittedRef.current) {
      handleFinish(found)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const handleFinish = useCallback((currentFound: string[]) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    const isCorrect  = currentFound.length >= question.targetCount
    const bonusCount = (question.bonusWords ?? []).filter(w => currentFound.includes(normalise(w))).length
    if (isCorrect) SoundEngine.levelComplete()
    else SoundEngine.wrong()
    onAnswer({
      questionId:   question.id,
      correct:      isCorrect,
      pointsAwarded: 0,
      timeTaken:    0,
      feedback: isCorrect
        ? `Found ${currentFound.length} words${bonusCount > 0 ? ` (${bonusCount} bonus!)` : ""}!`
        : `Found ${currentFound.length}/${question.targetCount} required`,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-finish when target count is reached
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
      ...(question.bonusWords ?? []).map(normalise),
    ]
    if (!allValid.includes(word)) { triggerShake(); return }
    const isBonus = (question.bonusWords ?? []).map(normalise).includes(word)
    const next = [...found, word]
    setFound(next)
    setFlashWord(word)
    if (isBonus) SoundEngine.bonusWord()
    else         SoundEngine.wordFound()
    setTimeout(() => setFlashWord(null), 700)
  }

  const handleLetterClick = (letter: string) => {
    if (submitted) return
    SoundEngine.letterClick()
    setInput(i => i + letter.toLowerCase())
    inputRef.current?.focus()
  }

  const triggerShake = () => {
    SoundEngine.shake()
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const allWords = [...question.validWords, ...(question.bonusWords ?? [])]
  const remaining = question.targetCount - found.length

  return (
    <div className="plugin-wrap">
      {/* Meta row */}
      <div className="q-meta">
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <span className="pts-tag">+{question.points} pts</span>
        {config.ui?.showTimer && !submitted && (
          <span style={{
            fontFamily: "Orbitron,monospace", fontSize: "0.72rem", fontWeight: 700,
            color: timerColor, marginLeft: "auto",
          }}>
            ⏱ {timeLeft}s
          </span>
        )}
      </div>

      {/* Prominent countdown timer bar */}
      {config.ui?.showTimer && !submitted && (
        <div style={{ marginBottom: "10px" }}>
          <div style={{
            height: "6px", borderRadius: "99px",
            background: "rgba(255,255,255,0.08)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: "99px",
              width: `${timerPct}%`,
              background: `linear-gradient(90deg, ${timerColor}, ${timerColor}88)`,
              transition: "width 1s linear, background 0.5s",
            }} />
          </div>
          {timeLeft <= 10 && (
            <div style={{
              textAlign: "center", marginTop: "4px",
              fontFamily: "Orbitron,monospace", fontSize: "0.65rem",
              color: "#FF6090", animation: "pulse 0.8s infinite",
            }}>
              ⚠️ Time running out!
            </div>
          )}
        </div>
      )}

      <p className="q-prompt">{question.instruction}</p>

      {/* Target progress dots */}
      <div className="wb-target-row">
        <span className="wb-target-label">
          {found.length >= question.targetCount
            ? `✓ Target reached! (${found.length} words found)`
            : `Find ${remaining} more word${remaining !== 1 ? "s" : ""} to pass`}
        </span>
        <div className="wb-target-dots">
          {Array.from({ length: question.targetCount }, (_, i) => (
            <div key={i} className={`wb-dot${i < found.length ? " filled" : ""}`} />
          ))}
        </div>
      </div>

      {/* Letter tiles */}
      <div className="wb-letters">
        {displayLetters.map((letter, i) => (
          <button
            key={i}
            className="wb-letter-tile"
            onClick={() => handleLetterClick(letter)}
            disabled={submitted}
          >
            {letter.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Input row */}
      {!submitted && (
        <div className={`wb-input-row${shake ? " shake" : ""}`}>
          <input
            ref={inputRef}
            className="wb-input"
            value={input.toUpperCase()}
            onChange={e => setInput(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
            onKeyDown={e => {
              if (e.key === "Enter") handleSubmitWord()
              if (e.key === "Escape") setInput("")
            }}
            placeholder="Type or click letters…"
            maxLength={12}
            autoFocus
            disabled={submitted}
          />
          <button
            className="wb-submit-word"
            onClick={handleSubmitWord}
            disabled={!input.trim()}
          >
            Add ↵
          </button>
          <button className="wb-clear" onClick={() => setInput("")}>✕</button>
        </div>
      )}

      {/* Flash animation on word found */}
      {flashWord && <div className="wb-flash">+{flashWord.toUpperCase()}</div>}

      {/* Found words list */}
      {found.length > 0 && (
        <div className="wb-found-section">
          <div className="wb-found-label">Found words ({found.length} / {allWords.length} possible)</div>
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

      {/* Hint */}
      {question.hint && !submitted && (
        <div className="hint-wrap">
          {isShowingHint
            ? <p className="hint-text">💡 {question.hint}</p>
            : <button className="hint-btn" onClick={onRequestHint}>Show hint</button>}
        </div>
      )}

      {/* Manual finish button (shown when target reached but auto-submit hasn't fired yet) */}
      {!submitted && found.length >= question.targetCount && (
        <button className="submit-btn" onClick={() => handleFinish(found)}>
          Finish Round →
        </button>
      )}

      {/* Result card with prominent NEXT button */}
      {submitted && (
        <div style={{ marginTop: "16px" }}>
          <div className={`puzzle-result ${found.length >= question.targetCount ? "res-ok" : "res-fail"}`}>
            {found.length >= question.targetCount
              ? `✓ Passed! Found ${found.length} / ${allWords.length} possible words.`
              : `✗ Only found ${found.length} / ${question.targetCount} required words.`}
          </div>
          {/* Missed words reveal */}
          {question.validWords.filter(w => !found.includes(normalise(w))).length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div className="wb-found-label" style={{ marginBottom: "6px" }}>
                Words you missed:
              </div>
              <div className="wb-found-words">
                {question.validWords
                  .filter(w => !found.includes(normalise(w)))
                  .slice(0, 12)
                  .map((w, i) => (
                    <span key={i} style={{
                      padding: "3px 10px", borderRadius: "6px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontFamily: "Orbitron,monospace", fontSize: "0.72rem",
                      color: "rgba(232,224,255,0.4)",
                    }}>
                      {w.toUpperCase()}
                    </span>
                  ))}
              </div>
            </div>
          )}
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
      pts += Math.floor(Math.max(0, question.timeLimit - timeTaken) * (scoring.timeBonusPerSecond ?? 0))
    return pts
  },
}
