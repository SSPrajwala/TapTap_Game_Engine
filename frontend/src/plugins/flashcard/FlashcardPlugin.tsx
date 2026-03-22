import React, { useState, useEffect } from "react"
import type { GamePlugin, PluginRenderProps, FlashcardQuestion, Question } from "../../types/engine.types"
const FlashcardComponent: React.FC<PluginRenderProps<FlashcardQuestion>> = ({ question, onAnswer }) => {
  const [flipped, setFlipped] = useState(false)
  const [answered, setAnswered] = useState(false)

  useEffect(() => { setFlipped(false); setAnswered(false) }, [question.id])

  const handleAnswer = (correct: boolean) => {
    if (answered) return
    setAnswered(true)
    onAnswer({ questionId: question.id, correct, pointsAwarded: 0, timeTaken: 0, feedback: correct ? "Got it!" : "Keep practicing" })
  }

  return (
    <div className="plugin-wrap">
      <div className="q-meta">
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <span className="pts-tag">+{question.points} pts</span>
        {question.category && <span className="category-tag">{question.category}</span>}
      </div>
      <p className="flashcard-instruction">{flipped ? "Do you know this?" : "Tap the card to reveal the answer"}</p>
      <div className={`flashcard${flipped ? " flipped" : ""}`} onClick={() => !answered && setFlipped(true)}>
        <div className="flashcard-front">
          <div className="flashcard-label">QUESTION</div>
          <div className="flashcard-text">{question.front}</div>
          <div className="flashcard-tap">tap to flip →</div>
        </div>
        <div className="flashcard-back">
          <div className="flashcard-label">ANSWER</div>
          <div className="flashcard-text">{question.back}</div>
        </div>
      </div>
      {flipped && !answered && (
        <div className="flashcard-actions">
          <button className="fc-btn fc-wrong" onClick={() => handleAnswer(false)}>✗ Didn't know</button>
          <button className="fc-btn fc-correct" onClick={() => handleAnswer(true)}>✓ Got it!</button>
        </div>
      )}
      {answered && <div className="flashcard-done">Answer recorded — press Next</div>}
    </div>
  )
}

export const FlashcardPlugin: GamePlugin<FlashcardQuestion> = {
  id: "flashcard", name: "Flashcards", handles: ["flashcard"],
  validateQuestion(q: Question): q is FlashcardQuestion {
    const fq = q as FlashcardQuestion
    return q.type === "flashcard" && typeof fq.front === "string" && typeof fq.back === "string"
  },
  Component: FlashcardComponent,
}