import React, { useState, useRef, useEffect, useMemo } from "react"
import type { GameConfig, AnswerResult, Question } from "../types/engine.types"
import { pluginRegistry }     from "../plugins"
import { useGameEngine }      from "../hooks/useGameEngine"
import { LeaderboardService } from "../engine/LeaderboardService"
import { Confetti }           from "./ui/Confetti"
import { BlackbuckAI }        from "./ui/BlackbuckAI"
import { useAuth }            from "../context/AuthContext"

interface Props {
  config:       GameConfig
  onBack:       () => void
  onCorrect?:   () => void
  onWrong?:     () => void
  onVictory?:   () => void
}

// Motion game plugins manage their own end screen — the engine should
// auto-advance to the next question without requiring a manual "Next" click.
const MOTION_PLUGINS = new Set(["tapblitz", "binaryrunner"])

/**
 * Normalise a game config before passing to the engine.
 * Handles old AI-generated games that used "question" instead of "prompt",
 * and ensures level questionIds always reference real question IDs.
 */
function normalizeConfig(raw: GameConfig): GameConfig {
  if (!raw?.questions?.length) return raw
  // Re-assign stable IDs q1, q2, q3...
  const questions = raw.questions.map((q: any, i: number) => {
    const fixed = { ...q, id: `q${i + 1}` }
    if (raw.plugin === "quiz") {
      fixed.prompt = fixed.prompt ?? fixed.question ?? fixed.text ?? fixed.stem ?? `Question ${i + 1}`
      fixed.type   = "quiz"
      if (typeof fixed.correctIndex !== "number") fixed.correctIndex = 0
      delete fixed.question; delete fixed.text; delete fixed.stem
    }
    if (raw.plugin === "flashcard") {
      fixed.front = fixed.front ?? fixed.prompt ?? fixed.term ?? fixed.question ?? `Card ${i + 1}`
      fixed.back  = fixed.back  ?? fixed.answer ?? fixed.definition ?? "See your notes"
      fixed.type  = "flashcard"
      delete fixed.prompt; delete fixed.question; delete fixed.answer
    }
    return fixed
  })
  const allIds = questions.map((q: any) => q.id)
  // Rebuild levels with correct IDs
  let levels = raw.levels
  if (!levels?.length || !levels[0].questionIds?.every((id: string) => allIds.includes(id))) {
    if (raw.plugin === "flashcard") {
      levels = [{ id: "level-1", title: "All Cards", description: "Study all flashcards", questionIds: allIds, passingScore: 50 }]
    } else {
      const easyIds   = questions.filter((q: any) => q.difficulty === "easy").map((q: any) => q.id)
      const mediumIds = questions.filter((q: any) => q.difficulty === "medium").map((q: any) => q.id)
      const hardIds   = questions.filter((q: any) => q.difficulty === "hard").map((q: any) => q.id)
      levels = []
      if (easyIds.length)   levels.push({ id: "level-easy",   title: "Level 1 — Easy",   description: "Warm-up",  questionIds: easyIds,   passingScore: 50 })
      if (mediumIds.length) levels.push({ id: "level-medium", title: "Level 2 — Medium", description: "Core",     questionIds: mediumIds, passingScore: 60 })
      if (hardIds.length)   levels.push({ id: "level-hard",   title: "Level 3 — Hard",   description: "Advanced", questionIds: hardIds,   passingScore: 70 })
      if (!levels.length)   levels = [{ id: "level-1", title: "All Questions", description: "Complete the quiz", questionIds: allIds, passingScore: 60 }]
    }
  }
  const scoring = (raw as any).scoring ?? {
    basePoints:           100,
    timeBonus:            false,
    timeBonusPerSecond:   0,
    streakMultiplier:     true,
    streakThreshold:      3,
    streakMultiplierValue: 1.5,
    penalties:            false,
    penaltyPerWrong:      0,
  }
  return { ...raw, questions, levels, scoring } as GameConfig
}

export const GameRenderer: React.FC<Props> = ({ config: rawConfig, onBack, onCorrect, onWrong, onVictory }) => {
  // Normalise config once — fixes old AI games with wrong field names / IDs
  const config = useMemo(() => normalizeConfig(rawConfig), [rawConfig])
  const {
    state, engine, currentQuestion, lastResult,
    isShowingHint, timeRemaining,
    handleAnswer, handleHint, send,
  } = useGameEngine(config)

  const isMotionGame = MOTION_PLUGINS.has(config.plugin)

  const { user, token } = useAuth()

  // ── Deer mascot + victory reactions ──────────────────────────────────────────
  useEffect(() => engine.on(event => {
    if (event.type === "ANSWER_SUBMITTED") {
      if (event.payload.correct) onCorrect?.()
      else                       onWrong?.()
    }
    if (event.type === "GAME_OVER" || event.type === "LEVEL_COMPLETE") {
      onVictory?.()
    }
  }), [engine, onCorrect, onWrong, onVictory])

  // Pre-fill name from logged-in user (username field in new schema)
  const [playerName, setPlayerName] = useState((user as { username?: string } | null)?.username ?? "")
  const [scoreSaved, setScoreSaved] = useState(false)
  const [apiStatus,  setApiStatus]  = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)

  // ── Blackbuck AI explain panel ─────────────────────────────────────────────
  const [aiOpen,       setAiOpen]       = useState(false)
  const [explainCtx,   setExplainCtx]   = useState<{
    concept: string; question?: string; correctAnswer?: string; studentAnswer?: string
  } | undefined>(undefined)

  // ── Adaptive Engine panel ──────────────────────────────────────────────────
  const [showAdaptive, setShowAdaptive] = useState(false)

  const gameStartRef = useRef<number>(0)
  const [timeTaken,  setTimeTaken]  = useState(0)

  useEffect(() => {
    if (state.status === "playing" && gameStartRef.current === 0) {
      gameStartRef.current = Date.now()
    }
  }, [state.status])

  useEffect(() => {
    if (state.status === "gameOver" && gameStartRef.current > 0) {
      setTimeTaken(Math.round((Date.now() - gameStartRef.current) / 1000))
    }
  }, [state.status])

  // ── Motion game auto-advance ───────────────────────────────────────────────
  // After a motion game wave ends (answered → true), automatically fire
  // NEXT_QUESTION after 2.4s so the plugin's own result screen has time to show.
  // This means players never need to manually click "Next →" between waves.
  const answeredRef = useRef(false)
  useEffect(() => {
    if (!isMotionGame) return
    const answered = currentQuestion ? state.answeredIds.has(currentQuestion.id) : false
    if (answered && !answeredRef.current) {
      answeredRef.current = true
      const t = setTimeout(() => {
        answeredRef.current = false
        send({ type: "NEXT_QUESTION" })
      }, 2400)
      return () => clearTimeout(t)
    }
    if (!answered) answeredRef.current = false
  })

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
  const totalQ  = state.levelQuestions.length
  const doneQ   = state.questionIndex
  const answered = currentQuestion ? state.answeredIds.has(currentQuestion.id) : false

  const handleSaveScore = async () => {
    if (!playerName.trim() || saving) return
    setSaving(true)
    const entry = LeaderboardService.save({
      playerName:    playerName.trim(),
      gameId:        config.id,
      gameTitle:     config.title,
      score:         state.stats.score,
      accuracy:      state.stats.accuracy,
      totalAnswered: state.stats.totalAnswered,
      timeTaken,
      difficulty:    state.stats.difficulty,
    })
    const result = await LeaderboardService.submitToAPI(entry, token, config.learningOutcomes)
    setApiStatus(result.message)
    setScoreSaved(true)
    setSaving(false)
  }

  const handleRestart = () => {
    gameStartRef.current = 0
    setScoreSaved(false)
    setPlayerName("")
    setApiStatus(null)
    setTimeTaken(0)
    send({ type: "RESTART" })
  }

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
              <div>
                <div className="level-row-title">{lvl.title}</div>
                <div className="level-row-sub">{lvl.description}</div>
              </div>
              <span className="level-row-count">{lvl.questionIds.length}q</span>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => send({ type: "START_GAME" })}>
          Start Game →
        </button>
      </div>
    )
  }

  if (state.status === "levelComplete") {
    const nextLevel = config.levels[config.levels.findIndex(l => l.id === state.currentLevelId) + 1]
    return (
      <div className="screen screen-complete">
        <Confetti active count={40} />
        <div className="complete-ring">✓</div>
        <h2>Level Complete!</h2>
        <p className="complete-level-name">{currentLevel?.title}</p>
        <div className="stats-row">
          <div className="stat-block"><span className="stat-val">{state.stats.score}</span><span className="stat-lbl">Score</span></div>
          <div className="stat-block"><span className="stat-val">{Math.round(state.stats.accuracy * 100)}%</span><span className="stat-lbl">Accuracy</span></div>
          <div className="stat-block"><span className="stat-val">{state.stats.streak}</span><span className="stat-lbl">Streak</span></div>
        </div>
        <div className="complete-actions">
          <button className="btn-primary" onClick={() => send({ type: "NEXT_LEVEL" })}>
            {nextLevel ? `Next: ${nextLevel.title} →` : "Finish →"}
          </button>
          <button className="btn-ghost" onClick={handleRestart}>Restart</button>
        </div>
      </div>
    )
  }

  if (state.status === "gameOver") {
    const rank = LeaderboardService.getRank(state.stats.score, timeTaken)
    return (
      <div className="screen screen-gameover">
        <Confetti active count={60} />
        <div className="gameover-trophy">🏆</div>
        <h2>Game Complete!</h2>
        <div className="final-score-display">
          <span className="final-score-num">{state.stats.score.toLocaleString()}</span>
          <span className="final-score-lbl">final score · rank #{rank}</span>
        </div>
        <div className="stats-row">
          <div className="stat-block"><span className="stat-val">{Math.round(state.stats.accuracy * 100)}%</span><span className="stat-lbl">Accuracy</span></div>
          <div className="stat-block"><span className="stat-val">{state.stats.totalAnswered}</span><span className="stat-lbl">Answered</span></div>
          <div className="stat-block"><span className="stat-val">{timeTaken}s</span><span className="stat-lbl">Time</span></div>
        </div>
        {!scoreSaved ? (
          <div className="save-score-form">
            <p className="save-score-label">Save your score to the leaderboard</p>
            <div className="save-score-row">
              <input
                className="admin-input save-name-input"
                placeholder="Your name"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveScore()}
              />
              <button className="btn-primary btn-sm" onClick={handleSaveScore} disabled={!playerName.trim() || saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="save-score-success">
            ✓ Score saved!
            {apiStatus && <div className="api-status">{apiStatus}</div>}
          </div>
        )}
        <div className="complete-actions">
          <button className="btn-primary" onClick={handleRestart}>Play Again</button>
          <button className="btn-ghost" onClick={onBack}>← Library</button>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return <div className="engine-error">No question found.</div>

  if (!plugin.validateQuestion(currentQuestion)) {
    return (
      <div className="engine-error">
        Question failed validation for plugin <code>{plugin.id}</code>.
        Expected: <code>{plugin.handles.join(" | ")}</code>, got: <code>{(currentQuestion as Question).type}</code>
      </div>
    )
  }

  const PluginComponent = plugin.Component as React.ComponentType<{
    question:      Question
    stats:         typeof state.stats
    config:        GameConfig
    onAnswer:      (r: AnswerResult) => void
    onRequestHint: () => void
    isShowingHint: boolean
    timeRemaining?: number
  }>

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
          {config.ui?.showStreak && state.stats.streak > 1 && (
            <span className="pill pill-streak">🔥 {state.stats.streak}</span>
          )}
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
        {/* key=currentQuestionId remounts the plugin on every new question,
            which resets all local state without needing useEffect resets in plugins */}
        <PluginComponent
          key={state.currentQuestionId}
          question={currentQuestion}
          stats={state.stats}
          config={config}
          onAnswer={handleAnswer}
          onRequestHint={handleHint}
          isShowingHint={isShowingHint}
          timeRemaining={timeRemaining}
        />
      </div>
      {/* Motion games auto-advance — no manual Next button needed.
          Regular games show the continue bar with the feedback toast. */}
      {answered && !isMotionGame && (
        <div className="gr-continue">
          {lastResult && (
            <span className={`result-toast ${lastResult.correct ? "toast-ok" : "toast-fail"}`}>
              {lastResult.feedback}
            </span>
          )}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* "Why?" AI explanation button — only shown after a wrong answer when logged in */}
            {token && lastResult && !lastResult.correct && (
              <button
                className="btn-ghost btn-sm"
                title="Ask Blackbuck AI to explain this"
                onClick={() => {
                  const q = currentQuestion as Question & { prompt?: string; answer?: string }
                  setExplainCtx({
                    concept:       config.title,
                    question:      q.prompt ?? "",
                    correctAnswer: q.answer ?? "",
                    studentAnswer: lastResult.feedback,
                  })
                  setAiOpen(true)
                }}
                style={{
                  background: "rgba(0,212,255,0.12)",
                  border: "1px solid rgba(0,212,255,0.3)",
                  color: "#00D4FF",
                  fontFamily: "Orbitron, monospace",
                  fontSize: "0.68rem",
                }}
              >
                🤖 Why?
              </button>
            )}
            <button className="btn-primary btn-sm" onClick={() => send({ type: "NEXT_QUESTION" })}>
              {doneQ + 1 < totalQ ? "Next →" : "Finish Level →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Adaptive Engine Live Panel ── */}
      <AdaptivePanel
        show={showAdaptive}
        onToggle={() => setShowAdaptive(v => !v)}
        difficulty={state.stats.difficulty}
        accuracy={state.stats.accuracy}
        streak={state.stats.streak}
        score={state.stats.score}
        totalAnswered={state.stats.totalAnswered}
        correctAnswered={state.stats.correctAnswered}
        questionIndex={doneQ}
        totalQuestions={totalQ}
      />

      {/* Blackbuck AI explanation panel */}
      <BlackbuckAI
        isOpen={aiOpen}
        onClose={() => { setAiOpen(false); setExplainCtx(undefined) }}
        explainContext={explainCtx}
      />
    </div>
  )
}

// ── Adaptive Engine Live Panel component ──────────────────────────────────────

interface AdaptivePanelProps {
  show:            boolean
  onToggle:        () => void
  difficulty:      string
  accuracy:        number
  streak:          number
  score:           number
  totalAnswered:   number
  correctAnswered: number
  questionIndex:   number
  totalQuestions:  number
}

const difficultyColor: Record<string, string> = {
  easy:   "#4ADE80",
  medium: "#FBBF24",
  hard:   "#F87171",
}

const AdaptivePanel: React.FC<AdaptivePanelProps> = ({
  show, onToggle, difficulty, accuracy, streak,
  score, totalAnswered, correctAnswered, questionIndex, totalQuestions,
}) => {
  const accPct    = Math.round(accuracy * 100)
  const diffColor = difficultyColor[difficulty] ?? "#00D4FF"

  // Determine what the adaptive engine will do next
  let nextAction = "Monitoring..."
  if (totalAnswered >= 3) {
    if (accPct >= 80 && difficulty === "easy")        nextAction = "⬆ Increasing to Medium"
    else if (accPct >= 80 && difficulty === "medium") nextAction = "⬆ Increasing to Hard"
    else if (accPct < 40 && difficulty === "hard")    nextAction = "⬇ Decreasing to Medium"
    else if (accPct < 40 && difficulty === "medium")  nextAction = "⬇ Decreasing to Easy"
    else if (accPct >= 80) nextAction = "✓ At peak difficulty"
    else                   nextAction = "✓ Maintaining level"
  }
  if (streak >= 3) nextAction += ` · 🔥 Streak bonus active`

  return (
    <div style={{
      marginTop: 12,
      border:    "1px solid rgba(0,212,255,0.2)",
      borderRadius: 12,
      background: "rgba(6,6,20,0.92)",
      overflow: "hidden",
    }}>
      {/* Toggle tab — always visible, opens panel DOWNWARD */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", background: "rgba(0,212,255,0.06)",
          border: "none", borderBottom: show ? "1px solid rgba(0,212,255,0.12)" : "none",
          padding: "9px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          color: "#00D4FF", fontFamily: "Orbitron, monospace",
          fontSize: "0.63rem", letterSpacing: 2, fontWeight: 700,
        }}
      >
        <span>⚙ ADAPTIVE ENGINE  ·  LIVE</span>
        <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>
          {show ? "▲ HIDE" : "▼ SHOW"}
        </span>
      </button>

      {/* Panel content — animates open/close with max-height */}
      <div style={{
        maxHeight: show ? 300 : 0,
        overflow: "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ padding: "14px 16px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {/* Difficulty */}
          <div style={statBox}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.58rem", letterSpacing: 2 }}>DIFFICULTY</div>
            <div style={{ color: diffColor, fontFamily: "Orbitron", fontWeight: 900, fontSize: "0.95rem", textTransform: "uppercase", marginTop: 4 }}>
              {difficulty}
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: difficulty === "easy" ? "33%" : difficulty === "medium" ? "66%" : "100%", background: diffColor, borderRadius: 99 }} />
            </div>
          </div>

          {/* Accuracy */}
          <div style={statBox}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.58rem", letterSpacing: 2 }}>ACCURACY</div>
            <div style={{ color: accPct >= 70 ? "#4ADE80" : accPct >= 40 ? "#FBBF24" : "#F87171", fontFamily: "Orbitron", fontWeight: 900, fontSize: "0.95rem", marginTop: 4 }}>
              {totalAnswered === 0 ? "—" : `${accPct}%`}
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.63rem", marginTop: 4 }}>
              {correctAnswered}/{totalAnswered} correct
            </div>
          </div>

          {/* Score */}
          <div style={statBox}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.58rem", letterSpacing: 2 }}>SCORE</div>
            <div style={{ color: "#00D4FF", fontFamily: "Orbitron", fontWeight: 900, fontSize: "0.95rem", marginTop: 4 }}>
              {score.toLocaleString()}
            </div>
            {streak > 1 && (
              <div style={{ color: "#FBBF24", fontSize: "0.63rem", marginTop: 4 }}>🔥 {streak} streak</div>
            )}
          </div>

          {/* Progress */}
          <div style={statBox}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.58rem", letterSpacing: 2 }}>PROGRESS</div>
            <div style={{ color: "#A855F7", fontFamily: "Orbitron", fontWeight: 900, fontSize: "0.95rem", marginTop: 4 }}>
              {questionIndex + 1}/{totalQuestions}
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${((questionIndex) / totalQuestions) * 100}%`, background: "#A855F7", borderRadius: 99 }} />
            </div>
          </div>

          {/* Next action */}
          <div style={{ ...statBox, flex: 2, minWidth: 180 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.58rem", letterSpacing: 2 }}>ENGINE DECISION</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.78rem", marginTop: 6, lineHeight: 1.4 }}>
              {nextAction}
            </div>
            {totalAnswered < 3 && (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.63rem", marginTop: 4 }}>
                Answer {3 - totalAnswered} more to trigger adaptive logic
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const statBox: React.CSSProperties = {
  flex:         1,
  minWidth:     90,
  background:   "rgba(255,255,255,0.03)",
  border:       "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  padding:      "10px 12px",
}