import React, { useState } from "react"
import type { GameConfig, AnswerResult, Question } from "../types/engine.types"
import { pluginRegistry } from "../plugins"
import { useGameEngine } from "../hooks/useGameEngine"
import { LeaderboardService } from "../engine/LeaderboardService"

interface Props { config: GameConfig; onBack: () => void }

export const GameRenderer: React.FC<Props> = ({ config, onBack }) => {
  const { state, currentQuestion, lastResult, isShowingHint, timeRemaining, handleAnswer, handleHint, send } = useGameEngine(config)
  const [playerName, setPlayerName] = useState("")
  //const [nameSubmitted, setNameSubmitted] = useState(false) // eslint-disable-line
  const [scoreSaved, setScoreSaved] = useState(false)

  const plugin = pluginRegistry.get(config.plugin)
  if (!plugin) return <div className="engine-error"><code>Unknown plugin: "{config.plugin}"</code><p>Registered: {pluginRegistry.list().join(", ")}</p></div>

  const currentLevel = config.levels.find(l => l.id === state.currentLevelId)
  const totalQ = state.levelQuestions.length
  const doneQ = state.questionIndex

  const handleSaveScore = () => {
    if (!playerName.trim()) return
    LeaderboardService.save({
      playerName: playerName.trim(),
      gameId: config.id,
      gameTitle: config.title,
      score: state.stats.score,
      accuracy: state.stats.accuracy,
      totalAnswered: state.stats.totalAnswered,
      difficulty: state.stats.difficulty,
    })
    setScoreSaved(true)
  }

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (state.status === "idle") {
    return (
      <div className="screen screen-idle">
        <button className="back-btn" onClick={onBack}>← Library</button>
        <div className="idle-badge">{config.plugin}</div>
        <h1 className="idle-title">{config.ui?.emoji ?? "🎮"} {config.title}</h1>
        <p className="idle-desc">{config.description}</p>
        <div className="level-list">
          {config.levels.map((lvl, i) => (
            <div key={lvl.id} className="level-row">
              <span className="level-num">0{i + 1}</span>
              <div><div className="level-row-title">{lvl.title}</div><div className="level-row-sub">{lvl.description}</div></div>
              <span className="level-row-count">{lvl.questionIds.length}q</span>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => send({ type: "START_GAME" })}>Start Game →</button>
      </div>
    )
  }

  // ── Level complete ─────────────────────────────────────────────────────────
  if (state.status === "levelComplete") {
    const nextLevel = config.levels[config.levels.findIndex(l => l.id === state.currentLevelId) + 1]
    return (
      <div className="screen screen-complete">
        <div className="complete-ring">✓</div>
        <h2>Level Complete!</h2>
        <p className="complete-level-name">{currentLevel?.title}</p>
        <div className="stats-row">
          <div className="stat-block"><span className="stat-val">{state.stats.score}</span><span className="stat-lbl">Score</span></div>
          <div className="stat-block"><span className="stat-val">{Math.round(state.stats.accuracy * 100)}%</span><span className="stat-lbl">Accuracy</span></div>
          <div className="stat-block"><span className="stat-val">{state.stats.streak}</span><span className="stat-lbl">Streak</span></div>
        </div>
        <div className="complete-actions">
          <button className="btn-primary" onClick={() => send({ type: "NEXT_LEVEL" })}>{nextLevel ? `Next: ${nextLevel.title} →` : "Finish →"}</button>
          <button className="btn-ghost" onClick={() => send({ type: "RESTART" })}>Restart</button>
        </div>
      </div>
    )
  }

  // ── Game over ──────────────────────────────────────────────────────────────
  if (state.status === "gameOver") {
    const rank = LeaderboardService.getRank(state.stats.score)
    return (
      <div className="screen screen-gameover">
        <div className="gameover-trophy">🏆</div>
        <h2>Game Complete!</h2>
        <div className="final-score-display">
          <span className="final-score-num">{state.stats.score.toLocaleString()}</span>
          <span className="final-score-lbl">final score · rank #{rank}</span>
        </div>
        <div className="stats-row">
          <div className="stat-block"><span className="stat-val">{Math.round(state.stats.accuracy * 100)}%</span><span className="stat-lbl">Accuracy</span></div>
          <div className="stat-block"><span className="stat-val">{state.stats.totalAnswered}</span><span className="stat-lbl">Answered</span></div>
          <div className="stat-block"><span className="stat-val">{state.stats.hintsUsed}</span><span className="stat-lbl">Hints</span></div>
        </div>

        {/* Save to leaderboard */}
        {!scoreSaved ? (
          <div className="save-score-form">
            <p className="save-score-label">Save your score to the leaderboard</p>
            <div className="save-score-row">
              <input className="admin-input save-name-input" placeholder="Your name" value={playerName} onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveScore()} />
              <button className="btn-primary btn-sm" onClick={handleSaveScore} disabled={!playerName.trim()}>Save</button>
            </div>
          </div>
        ) : (
          <div className="save-score-success">✓ Score saved to leaderboard!</div>
        )}

        <div className="complete-actions">
          <button className="btn-primary" onClick={() => { send({ type: "RESTART" }); setScoreSaved(false); setPlayerName("") }}>Play Again</button>
          <button className="btn-ghost" onClick={onBack}>← Library</button>
        </div>
      </div>
    )
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  if (!currentQuestion) return <div className="engine-error">No question found.</div>
  if (!plugin.validateQuestion(currentQuestion)) return (
   <div className="engine-error">Question failed validation for plugin <code>{plugin.id}</code>.</div>
  )

  const PluginComponent = plugin.Component as React.ComponentType<{
    question: Question; stats: typeof state.stats; config: GameConfig
    onAnswer: (r: AnswerResult) => void; onRequestHint: () => void; isShowingHint: boolean; timeRemaining?: number
  }>

  const answered = state.answeredIds.has(currentQuestion.id)

  return (
    <div className="game-renderer">
      <div className="gr-header">
        <div className="gr-header-left">
          <button className="gr-back-btn" onClick={onBack}>←</button>
          <div>
            <div className="gr-game-name">{config.title}</div>
            <div className="gr-level-name">{currentLevel?.title}</div>
          </div>
        </div>
        <div className="gr-header-right">
          {config.ui?.showStreak && state.stats.streak > 1 && <span className="pill pill-streak">🔥 {state.stats.streak}</span>}
          <span className="pill pill-score">{state.stats.score.toLocaleString()} pts</span>
        </div>
      </div>

      {config.ui?.showProgress !== false && (
        <div className="gr-progress-wrap">
          <div className="gr-progress-fill" style={{ width: `${(doneQ / totalQ) * 100}%` }} />
          <span className="gr-progress-label">{doneQ + 1} / {totalQ}</span>
        </div>
      )}

      <div className="gr-plugin-area">
        <PluginComponent question={currentQuestion} stats={state.stats} config={config} onAnswer={handleAnswer} onRequestHint={handleHint} isShowingHint={isShowingHint} timeRemaining={timeRemaining} />
      </div>

      {answered && (
        <div className="gr-continue">
          {lastResult && <span className={`result-toast ${lastResult.correct ? "toast-ok" : "toast-fail"}`}>{lastResult.feedback}</span>}
          <button className="btn-primary btn-sm" onClick={() => send({ type: "NEXT_QUESTION" })}>
            {doneQ + 1 < totalQ ? "Next →" : "Finish Level →"}
          </button>
        </div>
      )}
    </div>
  )
}