/* eslint-disable react-refresh/only-export-components */
import React, { useState, useRef } from "react"
import type { GamePlugin, PluginRenderProps, MemoryQuestion, Question } from "../../types/engine.types"
import { SoundEngine } from "../../services/SoundEngine"

interface CardState { id: string; pairId: string; label: string; emoji: string; flipped: boolean; matched: boolean }

// Builds and shuffles a deck from pairs. Called once via useState lazy initializer
// (component is remounted per question via key={questionId} in GameRenderer).
function buildDeck(pairs: MemoryQuestion["pairs"]): CardState[] {
  const deck: CardState[] = []
  pairs.forEach(pair => {
    deck.push({ id: `${pair.id}-a`, pairId: pair.id, label: pair.label, emoji: pair.emoji, flipped: false, matched: false })
    deck.push({ id: `${pair.id}-b`, pairId: pair.id, label: pair.label, emoji: pair.emoji, flipped: false, matched: false })
  })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

const MemoryComponent: React.FC<PluginRenderProps<MemoryQuestion>> = ({ question, onAnswer }) => {
  // useState lazy initializer: runs once on mount. GameRenderer uses key={questionId}
  // to remount this component fresh for every new question — no reset effect needed.
  const [cards, setCards] = useState<CardState[]>(() => buildDeck(question.pairs))
  const [selected, setSelected] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const [done, setDone] = useState(false)
  const lockRef = useRef(false)

  const handleFlip = (cardId: string) => {
    if (lockRef.current || done) return
    const card = cards.find(c => c.id === cardId)
    if (!card || card.flipped || card.matched) return
    if (selected.includes(cardId)) return

    const newSelected = [...selected, cardId]
    SoundEngine.cardFlip()
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, flipped: true } : c))

    if (newSelected.length === 2) {
      lockRef.current = true
      setMoves(m => m + 1)
      setSelected([])
      const [a, b] = newSelected.map(id => cards.find(c => c.id === id)!)
      if (a.pairId === b.pairId) {
        SoundEngine.pairMatch()
        setCards(prev => prev.map(c => newSelected.includes(c.id) ? { ...c, matched: true } : c))
        lockRef.current = false
        const allMatched = cards.filter(c => !newSelected.includes(c.id)).every(c => c.matched)
        if (allMatched) {
          SoundEngine.levelComplete()
          setDone(true)
          onAnswer({ questionId: question.id, correct: true, pointsAwarded: 0, timeTaken: 0, feedback: `Matched all in ${moves + 1} moves!` })
        }
      } else {
        SoundEngine.wrong()
        setTimeout(() => {
          setCards(prev => prev.map(c => newSelected.includes(c.id) ? { ...c, flipped: false } : c))
          lockRef.current = false
        }, 900)
      }
    } else {
      setSelected(newSelected)
    }
  }

  const matched = cards.filter(c => c.matched).length / 2
  const total = question.pairs.length

  return (
    <div className="plugin-wrap">
      <div className="q-meta">
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <span className="pts-tag">+{question.points} pts</span>
        <span className="memory-progress">{matched}/{total} matched · {moves} moves</span>
      </div>
      <h2 className="q-prompt">{question.instruction}</h2>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, total * 2)}, 1fr)` }}>
        {cards.map(card => (
          <div key={card.id}
            className={`memory-card${card.flipped || card.matched ? " flipped" : ""}${card.matched ? " matched" : ""}`}
            onClick={() => handleFlip(card.id)}>
            <div className="mc-front">?</div>
            <div className="mc-back">
              {card.id.endsWith("-a") ? <span className="mc-label">{card.label}</span> : <span className="mc-emoji">{card.emoji}</span>}
            </div>
          </div>
        ))}
      </div>
      {done && <div className="puzzle-result res-ok">🎉 All pairs matched in {moves} moves!</div>}
    </div>
  )
}

export const MemoryPlugin: GamePlugin<MemoryQuestion> = {
  id: "memory", name: "Memory Match", handles: ["memory"],
  validateQuestion(q: Question): q is MemoryQuestion {
    const mq = q as MemoryQuestion
    return q.type === "memory" && Array.isArray(mq.pairs) && typeof mq.instruction === "string"
  },
  Component: MemoryComponent,
}