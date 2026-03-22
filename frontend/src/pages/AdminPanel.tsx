import React, { useState } from "react"
import type { GameConfig, Question, QuizQuestion } from "../types/engine.types"
interface Props {
  games: GameConfig[]
  onBack: () => void
  onSave: (games: GameConfig[]) => void
}

type AdminTab = "questions" | "levels" | "settings"

export const AdminPanel: React.FC<Props> = ({ games, onBack, onSave }) => {
  const [localGames, setLocalGames] = useState<GameConfig[]>(games)
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id ?? "")
  const [tab, setTab] = useState<AdminTab>("questions")
  const [saved, setSaved] = useState(false)

  const game = localGames.find(g => g.id === selectedGameId)

  // ── Question form state ────────────────────────────────────────────────────
  const blankQ = (): Partial<QuizQuestion> => ({
    id: `q-${Date.now()}`, type: "quiz", difficulty: "easy", points: 100,
    timeLimit: 30, prompt: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", hint: ""
  })

  const [qForm, setQForm] = useState<Partial<QuizQuestion>>(blankQ())
  const [editingQId, setEditingQId] = useState<string | null>(null)
  const [qError, setQError] = useState("")

  const updateGame = (updated: GameConfig) => {
    setLocalGames(prev => prev.map(g => g.id === updated.id ? updated : g))
  }

  const handleSaveQ = () => {
    if (!game) return
    if (!qForm.prompt?.trim()) { setQError("Question prompt is required"); return }
    if (game.plugin === "quiz") {
      const opts = qForm.options ?? []
      if (opts.some(o => !o.trim())) { setQError("All 4 options are required"); return }
    }
    setQError("")

    const q: QuizQuestion = {
      id: qForm.id ?? `q-${Date.now()}`,
      type: "quiz",
      difficulty: qForm.difficulty ?? "easy",
      points: qForm.points ?? 100,
      timeLimit: qForm.timeLimit ?? 30,
      prompt: qForm.prompt ?? "",
      options: qForm.options ?? ["", "", "", ""],
      correctIndex: qForm.correctIndex ?? 0,
      explanation: qForm.explanation ?? "",
      hint: qForm.hint ?? "",
    }

    let updatedQs: Question[]
    if (editingQId) {
      updatedQs = game.questions.map(existing => existing.id === editingQId ? q : existing)
    } else {
      updatedQs = [...game.questions, q]
      // Auto-add to first level's questionIds
      const firstLevel = game.levels[0]
      if (firstLevel && !firstLevel.questionIds.includes(q.id)) {
        const updatedLevels = game.levels.map((l, i) => i === 0 ? { ...l, questionIds: [...l.questionIds, q.id] } : l)
        updateGame({ ...game, questions: updatedQs, levels: updatedLevels })
        setQForm(blankQ()); setEditingQId(null); return
      }
    }

    updateGame({ ...game, questions: updatedQs })
    setQForm(blankQ()); setEditingQId(null)
  }

  const handleEditQ = (q: Question) => {
    if (q.type !== "quiz") return
    const qq = q as QuizQuestion
    setQForm({ ...qq }); setEditingQId(qq.id); setTab("questions")
  }

  const handleDeleteQ = (id: string) => {
    if (!game) return
    updateGame({
      ...game,
      questions: game.questions.filter(q => q.id !== id),
      levels: game.levels.map(l => ({ ...l, questionIds: l.questionIds.filter(qid => qid !== id) }))
    })
  }

  const handleSaveAll = () => {
    onSave(localGames)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!game) return <div className="page-wrap"><button className="back-btn" onClick={onBack}>← Back</button><p>No games found.</p></div>

  return (
    <div className="page-wrap">
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 className="page-title">Admin Panel</h1>
        <button className={`btn-save${saved ? " saved" : ""}`} onClick={handleSaveAll}>
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Game selector */}
      <div className="admin-game-tabs">
        {localGames.map(g => (
          <button key={g.id} className={`admin-game-tab${g.id === selectedGameId ? " active" : ""}`} onClick={() => setSelectedGameId(g.id)}>
            {g.title}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="admin-tabs">
        {(["questions", "levels", "settings"] as AdminTab[]).map(t => (
          <button key={t} className={`admin-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "questions" ? "❓ Questions" : t === "levels" ? "🏆 Levels" : "⚙️ Settings"}
          </button>
        ))}
      </div>

      {/* ── Questions tab ── */}
      {tab === "questions" && (
        <div className="admin-content">
          <div className="admin-split">
            {/* Form */}
            <div className="admin-form-panel">
              <h3 className="admin-section-title">{editingQId ? "Edit Question" : "Add New Question"}</h3>

              <label className="admin-label">Difficulty</label>
              <select className="admin-select" value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: e.target.value as any }))}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <label className="admin-label">Points</label>
              <input className="admin-input" type="number" value={qForm.points} onChange={e => setQForm(f => ({ ...f, points: +e.target.value }))} />

              <label className="admin-label">Time Limit (seconds)</label>
              <input className="admin-input" type="number" value={qForm.timeLimit} onChange={e => setQForm(f => ({ ...f, timeLimit: +e.target.value }))} />

              <label className="admin-label">Question Prompt *</label>
              <textarea className="admin-textarea" rows={3} placeholder="Enter the question..." value={qForm.prompt} onChange={e => setQForm(f => ({ ...f, prompt: e.target.value }))} />

              <label className="admin-label">Options (A, B, C, D) *</label>
              {(qForm.options ?? ["", "", "", ""]).map((opt, i) => (
                <div key={i} className="admin-option-row">
                  <span className={`opt-indicator${qForm.correctIndex === i ? " correct-ind" : ""}`}>{String.fromCharCode(65 + i)}</span>
                  <input className="admin-input admin-option-input" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                    onChange={e => { const o = [...(qForm.options ?? [])]; o[i] = e.target.value; setQForm(f => ({ ...f, options: o })) }} />
                  <button className={`mark-correct-btn${qForm.correctIndex === i ? " is-correct" : ""}`} onClick={() => setQForm(f => ({ ...f, correctIndex: i }))}>
                    {qForm.correctIndex === i ? "✓ Correct" : "Mark correct"}
                  </button>
                </div>
              ))}

              <label className="admin-label">Hint (optional)</label>
              <input className="admin-input" placeholder="Give a small clue..." value={qForm.hint ?? ""} onChange={e => setQForm(f => ({ ...f, hint: e.target.value }))} />

              <label className="admin-label">Explanation (shown after answer)</label>
              <input className="admin-input" placeholder="Why is this the answer?" value={qForm.explanation ?? ""} onChange={e => setQForm(f => ({ ...f, explanation: e.target.value }))} />

              {qError && <div className="admin-error">{qError}</div>}

              <div className="admin-form-actions">
                {editingQId && <button className="btn-ghost" onClick={() => { setQForm(blankQ()); setEditingQId(null) }}>Cancel</button>}
                <button className="btn-primary" onClick={handleSaveQ}>{editingQId ? "Update Question" : "Add Question"}</button>
              </div>
            </div>

            {/* Question list */}
            <div className="admin-list-panel">
              <h3 className="admin-section-title">{game.questions.length} Questions</h3>
              {game.questions.length === 0 && <div className="empty-state-sm">No questions yet — add one!</div>}
              {game.questions.map(q => (
                <div key={q.id} className="admin-q-row">
                  <div className="admin-q-info">
                    <span className={`badge badge-${q.difficulty}`}>{q.difficulty}</span>
                    <span className="admin-q-prompt">{q.type === "quiz" ? (q as QuizQuestion).prompt : q.id}</span>
                  </div>
                  <div className="admin-q-actions">
                    {q.type === "quiz" && <button className="admin-icon-btn" onClick={() => handleEditQ(q)}>✏️</button>}
                    <button className="admin-icon-btn danger" onClick={() => handleDeleteQ(q.id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Levels tab ── */}
      {tab === "levels" && (
        <div className="admin-content">
          {game.levels.map((level, li) => (
            <div key={level.id} className="admin-level-card">
              <div className="admin-level-header">
                <h3>{level.title}</h3>
                <span className="admin-level-meta">{level.questionIds.length} questions · pass at {level.passingScore}%</span>
              </div>
              <div className="admin-level-qs">
                {level.questionIds.map(qid => {
                  const q = game.questions.find(q => q.id === qid)
                  return (
                    <div key={qid} className="admin-level-q-chip">
                      <span className={`badge badge-${q?.difficulty ?? "easy"}`}>{q?.difficulty ?? "?"}</span>
                      <span>{q?.type === "quiz" ? (q as QuizQuestion).prompt.slice(0, 40) + "..." : qid}</span>
                      <button className="chip-remove" onClick={() => {
                        const updatedLevels = game.levels.map((l, i) => i === li ? { ...l, questionIds: l.questionIds.filter(id => id !== qid) } : l)
                        updateGame({ ...game, levels: updatedLevels })
                      }}>×</button>
                    </div>
                  )
                })}
              </div>
              {/* Add question to level */}
              <select className="admin-select admin-add-q-select" onChange={e => {
                if (!e.target.value) return
                const updatedLevels = game.levels.map((l, i) => i === li && !l.questionIds.includes(e.target.value) ? { ...l, questionIds: [...l.questionIds, e.target.value] } : l)
                updateGame({ ...game, levels: updatedLevels })
                e.target.value = ""
              }}>
                <option value="">+ Add question to this level</option>
                {game.questions.filter(q => !level.questionIds.includes(q.id)).map(q => (
                  <option key={q.id} value={q.id}>{q.type === "quiz" ? (q as QuizQuestion).prompt.slice(0, 50) : q.id}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ── Settings tab ── */}
      {tab === "settings" && (
        <div className="admin-content">
          <div className="admin-form-panel">
            <h3 className="admin-section-title">Game Settings</h3>

            <label className="admin-label">Game Title</label>
            <input className="admin-input" value={game.title} onChange={e => updateGame({ ...game, title: e.target.value })} />

            <label className="admin-label">Description</label>
            <textarea className="admin-textarea" rows={2} value={game.description} onChange={e => updateGame({ ...game, description: e.target.value })} />

            <h3 className="admin-section-title" style={{ marginTop: "20px" }}>Scoring</h3>

            <label className="admin-label">Base Points per Question</label>
            <input className="admin-input" type="number" value={game.scoring.basePoints} onChange={e => updateGame({ ...game, scoring: { ...game.scoring, basePoints: +e.target.value } })} />

            <label className="admin-label">Streak Threshold (answers before multiplier)</label>
            <input className="admin-input" type="number" value={game.scoring.streakThreshold} onChange={e => updateGame({ ...game, scoring: { ...game.scoring, streakThreshold: +e.target.value } })} />

            <label className="admin-label">Streak Multiplier Value</label>
            <input className="admin-input" type="number" step="0.1" value={game.scoring.streakMultiplierValue} onChange={e => updateGame({ ...game, scoring: { ...game.scoring, streakMultiplierValue: +e.target.value } })} />

            <h3 className="admin-section-title" style={{ marginTop: "20px" }}>UI Options</h3>

            {[
              { key: "showTimer", label: "Show Timer" },
              { key: "showProgress", label: "Show Progress Bar" },
              { key: "showStreak", label: "Show Streak Counter" },
            ].map(({ key, label }) => (
              <label key={key} className="admin-toggle-row">
                <span>{label}</span>
                <input type="checkbox" checked={!!game.ui?.[key as keyof typeof game.ui]} onChange={e => updateGame({ ...game, ui: { ...game.ui, [key]: e.target.checked } })} />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}