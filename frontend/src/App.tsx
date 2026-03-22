// ─────────────────────────────────────────────────────────────────────────────
// App.tsx
//
// OLD App.tsx had:
//   - useState for levelIndex, currentQuestion, feedback, decision, score, timeLeft
//   - useEffect for timer (reset only on levelIndex — buggy per-question)
//   - handleAnswer: 40+ lines of game logic
//   - Direct imports of QuestionEngine, PlayerState, EngineCore, AnalyticsEngine
//   - if (result.decision === "NEXT") string comparison
//   - Manual QuestionEngine.reset() and index management
//
// NEW App.tsx has:
//   - Zero game logic
//   - Zero engine imports (only types + GameRenderer)
//   - Just: pick a game → render GameRenderer with that config
//
// To add a new game: import its JSON, add to GAMES. Done.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react"
import { GameRenderer }   from "./components/GameRenderer"
import type { GameConfig } from "./types/engine.types"

import logicGame    from "./games/logic-game.json"
// import puzzleGame from "./games/pattern-puzzle.json"   ← add future games here
import patternPuzzle from "./games/pattern-puzzle.json"



// Side-effect import: registers all plugins into pluginRegistry
import "./plugins"
import "./styles.css"

const GAMES = [
  logicGame as unknown as GameConfig,
  // puzzleGame as unknown as GameConfig,
   patternPuzzle as unknown as GameConfig,
]

export default function App() {
  const [active, setActive] = useState<GameConfig | null>(null)

  if (active) {
    return (
      <div className="app-shell">
        <button className="back-btn" onClick={() => setActive(null)}>
          ← Library
        </button>
        <GameRenderer config={active} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">⚡</div>
        <h1>TapTap Adaptive Engine</h1>
        <p>JSON-driven · Plugin-based · Adaptive difficulty</p>
      </header>

      <div className="game-library">
        {GAMES.map(game => (
          <div key={game.id} className="game-card" onClick={() => setActive(game)}>
            <div className="card-plugin-id">{game.plugin}</div>
            <h2 className="card-title">{game.title}</h2>
            <p  className="card-desc">{game.description}</p>
            <div className="card-meta">
              <span>{game.levels.length} levels</span>
              <span>{game.questions.length} questions</span>
            </div>
            <button className="btn-primary btn-sm">Play →</button>
          </div>
        ))}
      </div>
    </div>
  )
}