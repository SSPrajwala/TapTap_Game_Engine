// ─────────────────────────────────────────────────────────────────────────────
// GameRenderer.tsx
//
// OLD App.tsx had ~80 lines of game logic mixed into the component:
//   handleAnswer, timer, level transitions, score tracking, question cycling.
//   It also directly imported QuestionEngine and PlayerState from the engine.
//
// NEW GameRenderer:
//   - All game logic → useGameEngine hook
//   - All plugin resolution → pluginRegistry.get(config.plugin)
//   - This file has zero knowledge of quiz vs puzzle — it just renders whatever
//     plugin is registered for the config's plugin id.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react"
import type { GameConfig, AnswerResult, Question } from "../types/engine.types"
import { pluginRegistry } from "../plugins"
import { useGameEngine }  from "../hooks/useGameEngine"

interface Props { config: GameConfig }

export const GameRenderer: React.FC<Props> = ({ config }) => {
  const {
    state,
    currentQuestion,
    lastResult,
    isShowingHint,
    timeRemaining,
    handleAnswer,
    handleHint,
    send,
  } = useGameEngine(config)

  // ── Plugin resolution ──────────────────────────────────────────────────────
  const plugin = pluginRegistry.get(config.plugin)

  if (!plugin) {
    return (
      <div className="engine-error">
        <code>Unknown plugin: "{config.plugin}"</code>
        <p>Registered: {pluginRegistry.list().join(", ")}</p>
      </div>
    )
  }

  const currentLevel = config.levels.find(l => l.id === state.currentLevelId)
  const totalQ       = state.levelQuestions.length
  const doneQ        = state.questionIndex

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (state.status === "idle") {
    return (
      <div className="screen screen-idle">
        <div className="idle-badge">{config.plugin}</div>
        <h1 className="idle-title">{config.title}</h1>
        <p  className="idle-desc">{config.description}</p>

        <div className="level-list">
          {config.levels.map((lvl, i) => (
            <div key={lvl.id} className="level-row">
              <span className="level-num">0{i + 1}</span>
              <div>
                <div className="level-row-title">{lvl.title}</div>
                <div className="level-row-sub">{lvl.description}</div>
              </div>
              <span className="level-row-count">{lvl.questionIds.length}q</span>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={() => send({ type: "START_GAME" })}>
          Start Game
        </button>
      </div>
    )
  }

  // ── Level complete ─────────────────────────────────────────────────────────
  if (state.status === "levelComplete") {
    const nextLevel = (() => {
      const idx = config.levels.findIndex(l => l.id === state.currentLevelId)
      return config.levels[idx + 1]
    })()

    return (
      <div className="screen screen-complete">
        <div className="complete-ring">
          <svg viewBox="0 0 64 64" width="64" height="64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--success-dim)" strokeWidth="4"/>
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--success)" strokeWidth="4"
              strokeDasharray="176" strokeDashoffset="44" strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}/>
            <text x="32" y="37" textAnchor="middle" fontSize="18" fill="var(--success)">✓</text>
          </svg>
        </div>

        <h2>Level Complete</h2>
        <p className="complete-level-name">{currentLevel?.title}</p>

        <div className="stats-row">
          <div className="stat-block">
            <span className="stat-val">{state.stats.score}</span>
            <span className="stat-lbl">Score</span>
          </div>
          <div className="stat-block">
            <span className="stat-val">{Math.round(state.stats.accuracy * 100)}%</span>
            <span className="stat-lbl">Accuracy</span>
          </div>
          <div className="stat-block">
            <span className="stat-val">{state.stats.streak}</span>
            <span className="stat-lbl">Streak</span>
          </div>
        </div>

        <div className="complete-actions">
          <button className="btn-primary" onClick={() => send({ type: "NEXT_LEVEL" })}>
            {nextLevel ? `Next: ${nextLevel.title} →` : "Finish →"}
          </button>
          <button className="btn-ghost" onClick={() => send({ type: "RESTART" })}>
            Restart
          </button>
        </div>
      </div>
    )
  }

  // ── Game over ──────────────────────────────────────────────────────────────
  if (state.status === "gameOver") {
    return (
      <div className="screen screen-gameover">
        <div className="gameover-emoji">🏆</div>
        <h2>Game Complete</h2>

        <div className="final-score-display">
          <span className="final-score-num">{state.stats.score}</span>
          <span className="final-score-lbl">final score</span>
        </div>

        <div className="stats-row">
          <div className="stat-block">
            <span className="stat-val">{Math.round(state.stats.accuracy * 100)}%</span>
            <span className="stat-lbl">Accuracy</span>
          </div>
          <div className="stat-block">
            <span className="stat-val">{state.stats.totalAnswered}</span>
            <span className="stat-lbl">Answered</span>
          </div>
          <div className="stat-block">
            <span className="stat-val">{state.stats.hintsUsed}</span>
            <span className="stat-lbl">Hints</span>
          </div>
        </div>

        <button className="btn-primary" onClick={() => send({ type: "RESTART" })}>
          Play Again
        </button>
      </div>
    )
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  if (!currentQuestion) return <div className="engine-error">No question found.</div>

  if (!plugin.validateQuestion(currentQuestion)) {
    return (
      <div className="engine-error">
        Question <code>{currentQuestion.id}</code> (type: <code>{currentQuestion.type}</code>)
        failed validation for plugin <code>{plugin.id}</code>.
        Expected: <code>{plugin.handles.join(" | ")}</code>
      </div>
    )
  }

  // Cast is safe: validateQuestion is a type guard
  const PluginComponent = plugin.Component as React.ComponentType<{
    question:       Question
    stats:          typeof state.stats
    config:         GameConfig
    onAnswer:       (r: AnswerResult) => void
    onRequestHint:  () => void
    isShowingHint:  boolean
    timeRemaining?: number
  }>

  const answered = state.answeredIds.has(currentQuestion.id)

  return (
    <div className="game-renderer">

      {/* ── Header ── */}
      <div className="gr-header">
        <div className="gr-header-left">
          <span className="gr-game-name">{config.title}</span>
          <span className="gr-level-name">{currentLevel?.title}</span>
        </div>
        <div className="gr-header-right">
          {config.ui?.showStreak && state.stats.streak > 1 && (
            <span className="pill pill-streak">🔥 {state.stats.streak}</span>
          )}
          <span className="pill pill-score">{state.stats.score} pts</span>
        </div>
      </div>

      {/* ── Progress ── */}
      {config.ui?.showProgress !== false && (
        <div className="gr-progress-wrap">
          <div
            className="gr-progress-fill"
            style={{ width: `${(doneQ / totalQ) * 100}%` }}
          />
          <span className="gr-progress-label">{doneQ + 1} / {totalQ}</span>
        </div>
      )}

      {/* ── Plugin renders the question ── */}
      <div className="gr-plugin-area">
        <PluginComponent
          question={currentQuestion}
          stats={state.stats}
          config={config}
          onAnswer={handleAnswer}
          onRequestHint={handleHint}
          isShowingHint={isShowingHint}
          timeRemaining={timeRemaining}
        />
      </div>

      {/* ── Continue row (appears after answering) ── */}
      {answered && (
        <div className="gr-continue">
          {lastResult && (
            <span className={`result-toast ${lastResult.correct ? "toast-ok" : "toast-fail"}`}>
              {lastResult.feedback}
            </span>
          )}
          <button
            className="btn-primary btn-sm"
            onClick={() => send({ type: "NEXT_QUESTION" })}
          >
            {doneQ + 1 < totalQ ? "Next →" : "Finish Level →"}
          </button>
        </div>
      )}
    </div>
  )
}