import React, { useState, useEffect } from "react"
import type {
  GameConfig, Question,
  QuizQuestion, FlashcardQuestion, MemoryQuestion, WordBuilderQuestion,
} from "../types/engine.types"

const ADMIN_API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001/api") + "/admin"

interface Props {
  games:      GameConfig[]
  onBack:     () => void
  onSave:     (games: GameConfig[]) => void
  adminToken: string
  adminName:  string
}

type AdminTab  = "questions" | "levels" | "settings"
type SaveStatus = "idle" | "saving" | "saved" | "error"

// ── Shared input components ───────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="admin-label">
    {children}{required && <span style={{ color: "#FF2D78", marginLeft: "3px" }}>*</span>}
  </label>
)

// ── Blank question factories ──────────────────────────────────────────────────

function blankQuiz(): Partial<QuizQuestion> {
  return { id: `q-${crypto.randomUUID()}`, type: "quiz", difficulty: "easy", points: 100, timeLimit: 30,
           prompt: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", hint: "" }
}

function blankFlashcard(): Partial<FlashcardQuestion> {
  return { id: `fc-${crypto.randomUUID()}`, type: "flashcard", difficulty: "easy", points: 50, timeLimit: 30,
           front: "", back: "", category: "", hint: "" }
}

function blankMemory(): Partial<MemoryQuestion> {
  return { id: `mem-${crypto.randomUUID()}`, type: "memory", difficulty: "easy", points: 200,
           instruction: "Match each word to its emoji!",
           pairs: [
             { id: "p1", label: "", emoji: "" },
             { id: "p2", label: "", emoji: "" },
             { id: "p3", label: "", emoji: "" },
             { id: "p4", label: "", emoji: "" },
           ] }
}

function blankWordBuilder(): Partial<WordBuilderQuestion> {
  return { id: `wb-${crypto.randomUUID()}`, type: "wordbuilder", difficulty: "easy", points: 300,
           letters: [], validWords: [], targetCount: 3,
           instruction: "Build as many words as you can from these letters!", bonusWords: [] }
}

// ── Validation helpers ────────────────────────────────────────────────────────

function validateQuiz(q: Partial<QuizQuestion>): string {
  if (!q.prompt?.trim())          return "Question prompt is required."
  if (!q.timeLimit || q.timeLimit < 5) return "Time limit must be at least 5 seconds."
  if (!q.points    || q.points   < 1) return "Points must be at least 1."
  const opts = q.options ?? []
  if (opts.some(o => !o.trim()))  return "All 4 answer options must be filled in."
  if (!q.hint?.trim())            return "Hint is required."
  if (!q.explanation?.trim())     return "Explanation is required."
  return ""
}

function validateFlashcard(q: Partial<FlashcardQuestion>): string {
  if (!q.front?.trim())           return "Front (question side) is required."
  if (!q.back?.trim())            return "Back (answer side) is required."
  if (!q.hint?.trim())            return "Hint is required."
  if (!q.timeLimit || q.timeLimit < 5) return "Time limit must be at least 5 seconds."
  if (!q.points    || q.points   < 1) return "Points must be at least 1."
  return ""
}

function validateMemory(q: Partial<MemoryQuestion>): string {
  if (!q.instruction?.trim())     return "Instruction text is required."
  const pairs = q.pairs ?? []
  if (pairs.length < 2)           return "At least 2 pairs are required."
  if (pairs.some(p => !p.label.trim() || !p.emoji.trim()))
    return "Every pair must have both a label and an emoji."
  if (!q.points || q.points < 1)  return "Points must be at least 1."
  return ""
}

function validateWordBuilder(q: Partial<WordBuilderQuestion>): string {
  if (!q.instruction?.trim())     return "Instruction is required."
  if (!q.letters?.length)         return "Letters are required (enter as comma-separated e.g. A,B,C)."
  if (!q.validWords?.length)      return "Valid words list is required."
  if (!q.targetCount || q.targetCount < 1) return "Target word count must be at least 1."
  if (!q.points || q.points < 1)  return "Points must be at least 1."
  return ""
}

// ── Main component ────────────────────────────────────────────────────────────

export const AdminPanel: React.FC<Props> = ({ games, onBack, onSave, adminToken, adminName }) => {
  const [localGames,     setLocalGames]     = useState<GameConfig[]>(games)
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id ?? "")
  const [tab,            setTab]            = useState<AdminTab>("questions")
  const [saveStatus,     setSaveStatus]     = useState<SaveStatus>("idle")
  const [saveMsg,        setSaveMsg]        = useState("")
  const [editingQId,     setEditingQId]     = useState<string | null>(null)
  const [qError,         setQError]         = useState("")

  const game = localGames.find(g => g.id === selectedGameId)

  // ── Per-type question form state ──────────────────────────────────────────
  const [quizForm, setQuizForm]           = useState<Partial<QuizQuestion>>(blankQuiz)
  const [flashForm, setFlashForm]         = useState<Partial<FlashcardQuestion>>(blankFlashcard)
  const [memForm, setMemForm]             = useState<Partial<MemoryQuestion>>(blankMemory)
  const [wbForm, setWbForm]               = useState<Partial<WordBuilderQuestion>>(blankWordBuilder)
  const [wbLettersRaw, setWbLettersRaw]   = useState("")
  const [wbWordsRaw,   setWbWordsRaw]     = useState("")
  const [wbBonusRaw,   setWbBonusRaw]     = useState("")

  // Keep letters/words raw strings in sync with form
  useEffect(() => {
    setWbLettersRaw(wbForm.letters?.join(",") ?? "")
    setWbWordsRaw(wbForm.validWords?.join(", ") ?? "")
    setWbBonusRaw(wbForm.bonusWords?.join(", ") ?? "")
  }, [wbForm.letters, wbForm.validWords, wbForm.bonusWords])

  const resetForm = () => {
    setQuizForm(blankQuiz()); setFlashForm(blankFlashcard())
    setMemForm(blankMemory()); setWbForm(blankWordBuilder())
    setWbLettersRaw(""); setWbWordsRaw(""); setWbBonusRaw("")
    setEditingQId(null); setQError("")
  }

  const updateGame = (updated: GameConfig) =>
    setLocalGames(prev => prev.map(g => g.id === updated.id ? updated : g))

  // ── Save to backend (writes to JSON file) ─────────────────────────────────
  const saveGameToBackend = async (targetGame: GameConfig, silent = false) => {
    if (!silent) { setSaveStatus("saving"); setSaveMsg("Writing to game JSON file…") }
    try {
      const res = await fetch(`${ADMIN_API}/games/${encodeURIComponent(targetGame.id)}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
        body:    JSON.stringify(targetGame),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      onSave(localGames)
      setSaveStatus("saved")
      setSaveMsg(silent
        ? `✓ Auto-saved — ${data.questionCount} questions in JSON file.`
        : `✓ Saved by ${data.savedBy} — ${data.questionCount} questions written to JSON file.`)
    } catch (err) {
      setSaveStatus("error")
      setSaveMsg(`⚠️ ${err instanceof Error ? err.message : "Save failed"}. Changes kept in memory.`)
      onSave(localGames)
    }
    setTimeout(() => { setSaveStatus("idle"); setSaveMsg("") }, 3500)
  }

  const handleSaveAll = () => void saveGameToBackend(game!, false)

  // ── Question save (all types) ─────────────────────────────────────────────
  const handleSaveQ = () => {
    if (!game) return
    let q: Question
    let err = ""

    switch (game.plugin) {
      case "quiz": {
        err = validateQuiz(quizForm)
        if (err) { setQError(err); return }
        q = {
          id: quizForm.id ?? `q-${crypto.randomUUID()}`, type: "quiz",
          difficulty: quizForm.difficulty ?? "easy", points: quizForm.points ?? 100,
          timeLimit: quizForm.timeLimit ?? 30, prompt: quizForm.prompt!,
          options: quizForm.options!, correctIndex: quizForm.correctIndex ?? 0,
          explanation: quizForm.explanation!, hint: quizForm.hint!,
        } satisfies QuizQuestion
        break
      }
      case "flashcard": {
        err = validateFlashcard(flashForm)
        if (err) { setQError(err); return }
        q = {
          id: flashForm.id ?? `fc-${crypto.randomUUID()}`, type: "flashcard",
          difficulty: flashForm.difficulty ?? "easy", points: flashForm.points ?? 50,
          timeLimit: flashForm.timeLimit ?? 30,
          front: flashForm.front!, back: flashForm.back!,
          category: flashForm.category ?? "", hint: flashForm.hint!,
        } satisfies FlashcardQuestion
        break
      }
      case "memory": {
        err = validateMemory(memForm)
        if (err) { setQError(err); return }
        q = {
          id: memForm.id ?? `mem-${crypto.randomUUID()}`, type: "memory",
          difficulty: memForm.difficulty ?? "easy", points: memForm.points ?? 200,
          instruction: memForm.instruction!, pairs: memForm.pairs!,
        } satisfies MemoryQuestion
        break
      }
      case "wordbuilder": {
        const letters   = wbLettersRaw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
        const validWords = wbWordsRaw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        const bonusWords = wbBonusRaw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        const wbFull = { ...wbForm, letters, validWords, bonusWords }
        err = validateWordBuilder(wbFull)
        if (err) { setQError(err); return }
        q = {
          id: wbForm.id ?? `wb-${crypto.randomUUID()}`, type: "wordbuilder",
          difficulty: wbForm.difficulty ?? "easy", points: wbForm.points ?? 300,
          instruction: wbForm.instruction!, letters, validWords, bonusWords,
          targetCount: wbForm.targetCount ?? 3,
        } satisfies WordBuilderQuestion
        break
      }
      default:
        setQError(`Question editing not supported for plugin type "${game.plugin}".`)
        return
    }

    setQError("")
    let updatedQs: Question[]
    let updatedLevels = game.levels
    if (editingQId) {
      updatedQs = game.questions.map(existing => existing.id === editingQId ? q : existing)
    } else {
      updatedQs = [...game.questions, q]
      const firstLevel = game.levels[0]
      if (firstLevel && !firstLevel.questionIds.includes(q.id)) {
        updatedLevels = game.levels.map((l, i) =>
          i === 0 ? { ...l, questionIds: [...l.questionIds, q.id] } : l
        )
      }
    }
    const updatedGame = { ...game, questions: updatedQs, levels: updatedLevels }
    updateGame(updatedGame)
    void saveGameToBackend(updatedGame, true)   // ← auto-save immediately to JSON
    resetForm()
  }

  const handleEditQ = (q: Question) => {
    setEditingQId(q.id); setTab("questions"); setQError("")
    switch (q.type) {
      case "quiz":        setQuizForm({ ...q as QuizQuestion }); break
      case "flashcard":   setFlashForm({ ...q as FlashcardQuestion }); break
      case "memory":      setMemForm({ ...q as MemoryQuestion }); break
      case "wordbuilder": {
        const wq = q as WordBuilderQuestion
        setWbForm({ ...wq })
        setWbLettersRaw(wq.letters.join(","))
        setWbWordsRaw(wq.validWords.join(", "))
        setWbBonusRaw(wq.bonusWords?.join(", ") ?? "")
        break
      }
    }
  }

  const handleDeleteQ = (id: string) => {
    if (!game) return
    const updated: GameConfig = {
      ...game,
      questions: game.questions.filter(q => q.id !== id),
      levels:    game.levels.map(l => ({ ...l, questionIds: l.questionIds.filter(qid => qid !== id) })),
    }
    updateGame(updated)
    void saveGameToBackend(updated, true)   // ← persist deletion to JSON immediately
  }

  // ── Save button style ─────────────────────────────────────────────────────
  const saveBtnStyle: React.CSSProperties = {
    padding:    "8px 20px",
    background: saveStatus === "saved"  ? "rgba(34,255,170,0.15)"
              : saveStatus === "error"  ? "rgba(255,45,120,0.15)"
              : saveStatus === "saving" ? "rgba(168,85,247,0.15)"
              : "linear-gradient(135deg,#A855F7,#3B82F6)",
    border:     saveStatus === "saved"  ? "1px solid rgba(34,255,170,0.4)"
              : saveStatus === "error"  ? "1px solid rgba(255,45,120,0.4)"
              : saveStatus === "saving" ? "1px solid rgba(168,85,247,0.3)" : "none",
    color:      saveStatus === "saved"  ? "#22FFAA"
              : saveStatus === "error"  ? "#FF6090"
              : saveStatus === "saving" ? "rgba(232,224,255,0.6)" : "#fff",
    borderRadius: "8px", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.82rem",
    cursor: saveStatus === "saving" ? "not-allowed" : "pointer", transition: "all 0.3s",
  }

  if (!game) return (
    <div className="page-wrap">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <p>No games found.</p>
    </div>
  )

  const unsupported = !["quiz", "flashcard", "memory", "wordbuilder"].includes(game.plugin)

  return (
    <div className="page-wrap">
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <div style={{ fontSize: "0.72rem", color: "rgba(168,85,247,0.6)", fontFamily: "Exo 2, sans-serif", marginTop: "2px" }}>
            🔓 {adminName}
          </div>
        </div>
        <button style={saveBtnStyle} onClick={handleSaveAll} disabled={saveStatus === "saving"}>
          {saveStatus === "saving" ? "Saving…" : "💾 Save to JSON"}
        </button>
      </div>

      {/* Save status banner */}
      {saveMsg && (
        <div style={{
          padding: "10px 16px", borderRadius: "8px",
          fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem", marginBottom: "10px",
          background: saveStatus === "saved" ? "rgba(34,255,170,0.08)" : "rgba(255,45,120,0.08)",
          border:     saveStatus === "saved" ? "1px solid rgba(34,255,170,0.2)" : "1px solid rgba(255,45,120,0.2)",
          color:      saveStatus === "saved" ? "#22FFAA" : "#FF6090",
        }}>
          {saveMsg}
        </div>
      )}

      {/* Info banner */}
      {saveStatus === "idle" && (
        <div style={{
          padding: "8px 14px", borderRadius: "8px",
          fontFamily: "Exo 2, sans-serif", fontSize: "0.75rem", marginBottom: "10px",
          background: "rgba(34,255,170,0.04)", border: "1px solid rgba(34,255,170,0.12)", color: "rgba(34,255,170,0.55)",
        }}>
          ✓ Adding, editing, or deleting questions <strong>auto-saves</strong> to the game JSON file instantly.
          Use <strong>"💾 Save to JSON"</strong> for Settings / Level changes.
        </div>
      )}

      {/* Game selector */}
      <div className="admin-game-tabs">
        {localGames.map(g => (
          <button key={g.id}
            className={`admin-game-tab${g.id === selectedGameId ? " active" : ""}`}
            onClick={() => { setSelectedGameId(g.id); resetForm() }}>
            {g.ui?.emoji ?? "🎮"} {g.title}
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

      {/* ── QUESTIONS TAB ─────────────────────────────────────────────────── */}
      {tab === "questions" && (
        <div className="admin-content">
          {unsupported ? (
            <div style={{ padding: "24px", textAlign: "center", color: "rgba(232,224,255,0.4)", fontFamily: "Exo 2, sans-serif", fontSize: "0.85rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔧</div>
              Question editing for <strong style={{ color: "#A855F7" }}>{game.plugin}</strong> type is view-only (complex structured data — edit the JSON file directly for Puzzle/Sudoku).
            </div>
          ) : (
            <div className="admin-split">
              {/* ── Left: Form ── */}
              <div className="admin-form-panel">
                <h3 className="admin-section-title">{editingQId ? "Edit Question" : `Add New ${game.plugin} Question`}</h3>

                {/* ── Common fields ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "4px" }}>
                  <div>
                    <Label required>Difficulty</Label>
                    <select className="admin-select"
                      value={game.plugin === "quiz" ? quizForm.difficulty : game.plugin === "flashcard" ? flashForm.difficulty : game.plugin === "memory" ? memForm.difficulty : wbForm.difficulty}
                      onChange={e => {
                        const d = e.target.value as "easy" | "medium" | "hard"
                        if (game.plugin === "quiz")        setQuizForm(f  => ({ ...f, difficulty: d }))
                        else if (game.plugin === "flashcard") setFlashForm(f => ({ ...f, difficulty: d }))
                        else if (game.plugin === "memory")    setMemForm(f  => ({ ...f, difficulty: d }))
                        else                              setWbForm(f    => ({ ...f, difficulty: d }))
                      }}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <Label required>Points</Label>
                    <input className="admin-input" type="number" min={1}
                      value={game.plugin === "quiz" ? quizForm.points : game.plugin === "flashcard" ? flashForm.points : game.plugin === "memory" ? memForm.points : wbForm.points}
                      onChange={e => {
                        const v = +e.target.value
                        if (game.plugin === "quiz")           setQuizForm(f  => ({ ...f, points: v }))
                        else if (game.plugin === "flashcard") setFlashForm(f => ({ ...f, points: v }))
                        else if (game.plugin === "memory")    setMemForm(f   => ({ ...f, points: v }))
                        else                                  setWbForm(f    => ({ ...f, points: v }))
                      }} />
                  </div>
                  {game.plugin !== "memory" && (
                    <div>
                      <Label required>Time (sec)</Label>
                      <input className="admin-input" type="number" min={5}
                        style={{ minWidth: "90px", width: "100%" }}
                        value={game.plugin === "quiz" ? quizForm.timeLimit : game.plugin === "flashcard" ? flashForm.timeLimit : wbForm.timeLimit}
                        onChange={e => {
                          const v = +e.target.value
                          if (game.plugin === "quiz")           setQuizForm(f  => ({ ...f, timeLimit: v }))
                          else if (game.plugin === "flashcard") setFlashForm(f => ({ ...f, timeLimit: v }))
                          else                                  setWbForm(f    => ({ ...f, timeLimit: v }))
                        }} />
                    </div>
                  )}
                </div>

                {/* ── QUIZ fields ── */}
                {game.plugin === "quiz" && (
                  <>
                    <Label required>Question Prompt</Label>
                    <textarea className="admin-textarea" rows={3} placeholder="Enter the question..."
                      value={quizForm.prompt} onChange={e => setQuizForm(f => ({ ...f, prompt: e.target.value }))} />

                    <Label required>Answer Options (A / B / C / D)</Label>
                    {(quizForm.options ?? ["", "", "", ""]).map((opt, i) => (
                      <div key={i} className="admin-option-row" style={{ alignItems: "center", gap: "8px" }}>
                        <span className={`opt-indicator${quizForm.correctIndex === i ? " correct-ind" : ""}`}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <input
                          className="admin-input admin-option-input"
                          placeholder={`Option ${String.fromCharCode(65 + i)} — type full answer here`}
                          value={opt}
                          style={{ minWidth: 0, flex: 1 }}
                          onChange={e => {
                            const o = [...(quizForm.options ?? [])]
                            o[i] = e.target.value
                            setQuizForm(f => ({ ...f, options: o }))
                          }} />
                        <button
                          className={`mark-correct-btn${quizForm.correctIndex === i ? " is-correct" : ""}`}
                          style={{ flexShrink: 0 }}
                          onClick={() => setQuizForm(f => ({ ...f, correctIndex: i }))}>
                          {quizForm.correctIndex === i ? "✓ Correct" : "Mark ✓"}
                        </button>
                      </div>
                    ))}

                    <Label required>Hint</Label>
                    <input className="admin-input" placeholder="Give a clue to help the player..."
                      value={quizForm.hint ?? ""} onChange={e => setQuizForm(f => ({ ...f, hint: e.target.value }))} />

                    <Label required>Explanation</Label>
                    <input className="admin-input" placeholder="Why is this the correct answer?"
                      value={quizForm.explanation ?? ""} onChange={e => setQuizForm(f => ({ ...f, explanation: e.target.value }))} />
                  </>
                )}

                {/* ── FLASHCARD fields ── */}
                {game.plugin === "flashcard" && (
                  <>
                    <Label required>Front (Question side — e.g. country name)</Label>
                    <input className="admin-input" placeholder="e.g. France"
                      value={flashForm.front ?? ""} onChange={e => setFlashForm(f => ({ ...f, front: e.target.value }))} />

                    <Label required>Back (Answer side — e.g. capital city)</Label>
                    <input className="admin-input" placeholder="e.g. Paris"
                      value={flashForm.back ?? ""} onChange={e => setFlashForm(f => ({ ...f, back: e.target.value }))} />

                    <Label>Category (optional)</Label>
                    <input className="admin-input" placeholder="e.g. Europe, Asia..."
                      value={flashForm.category ?? ""} onChange={e => setFlashForm(f => ({ ...f, category: e.target.value }))} />

                    <Label required>Hint</Label>
                    <input className="admin-input" placeholder="e.g. Not the biggest city!"
                      value={flashForm.hint ?? ""} onChange={e => setFlashForm(f => ({ ...f, hint: e.target.value }))} />
                  </>
                )}

                {/* ── MEMORY fields ── */}
                {game.plugin === "memory" && (
                  <>
                    <Label required>Instruction</Label>
                    <input className="admin-input" placeholder="e.g. Match each word to its emoji!"
                      value={memForm.instruction ?? ""} onChange={e => setMemForm(f => ({ ...f, instruction: e.target.value }))} />

                    <Label required>Pairs (label + emoji each)</Label>
                    {(memForm.pairs ?? []).map((pair, i) => (
                      <div key={pair.id} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "center" }}>
                        <span style={{ color: "rgba(168,85,247,0.6)", fontFamily: "Exo 2,sans-serif", fontSize: "0.75rem", width: "20px" }}>#{i+1}</span>
                        <input className="admin-input" placeholder="Label (e.g. Sun)"
                          value={pair.label} style={{ flex: 2 }}
                          onChange={e => {
                            const p = [...(memForm.pairs ?? [])]
                            p[i] = { ...p[i], label: e.target.value }
                            setMemForm(f => ({ ...f, pairs: p }))
                          }} />
                        <input className="admin-input" placeholder="Emoji (e.g. ☀️)"
                          value={pair.emoji} style={{ flex: 1, textAlign: "center", fontSize: "1.1rem" }}
                          onChange={e => {
                            const p = [...(memForm.pairs ?? [])]
                            p[i] = { ...p[i], emoji: e.target.value }
                            setMemForm(f => ({ ...f, pairs: p }))
                          }} />
                        {(memForm.pairs ?? []).length > 2 && (
                          <button onClick={() => setMemForm(f => ({ ...f, pairs: f.pairs?.filter((_, j) => j !== i) }))}
                            style={{ background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.2)", borderRadius: "6px", color: "#FF6090", cursor: "pointer", padding: "6px 8px", fontSize: "0.75rem" }}>
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setMemForm(f => ({ ...f, pairs: [...(f.pairs ?? []), { id: `p${Date.now()}`, label: "", emoji: "" }] }))}
                      style={{ background: "rgba(168,85,247,0.08)", border: "1px dashed rgba(168,85,247,0.3)", borderRadius: "8px", color: "rgba(168,85,247,0.7)", cursor: "pointer", padding: "7px 14px", fontFamily: "Exo 2,sans-serif", fontSize: "0.78rem", width: "100%", marginBottom: "8px" }}>
                      + Add Pair
                    </button>
                  </>
                )}

                {/* ── WORDBUILDER fields ── */}
                {game.plugin === "wordbuilder" && (
                  <>
                    <Label required>Instruction</Label>
                    <input className="admin-input" placeholder="e.g. Build as many words as you can!"
                      value={wbForm.instruction ?? ""} onChange={e => setWbForm(f => ({ ...f, instruction: e.target.value }))} />

                    <Label required>Letters (comma-separated, e.g. A,P,L,E,S)</Label>
                    <input className="admin-input" placeholder="A,P,L,E,S,T,R"
                      value={wbLettersRaw}
                      onChange={e => {
                        setWbLettersRaw(e.target.value)
                        setWbForm(f => ({ ...f, letters: e.target.value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) }))
                      }} />

                    <Label required>Valid Words (comma-separated, e.g. ATE,EAT,TAP)</Label>
                    <textarea className="admin-textarea" rows={3} placeholder="eat, ate, tap, ape, pest, ..."
                      value={wbWordsRaw}
                      onChange={e => {
                        setWbWordsRaw(e.target.value)
                        setWbForm(f => ({ ...f, validWords: e.target.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) }))
                      }} />

                    <Label required>Target Word Count (minimum words to find)</Label>
                    <input className="admin-input" type="number" min={1}
                      value={wbForm.targetCount ?? 3}
                      onChange={e => setWbForm(f => ({ ...f, targetCount: +e.target.value }))} />

                    <Label>Bonus Words (optional, harder words)</Label>
                    <input className="admin-input" placeholder="splat, reap, ..."
                      value={wbBonusRaw}
                      onChange={e => {
                        setWbBonusRaw(e.target.value)
                        setWbForm(f => ({ ...f, bonusWords: e.target.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) }))
                      }} />
                  </>
                )}

                {qError && <div className="admin-error" style={{ marginTop: "10px" }}>⚠️ {qError}</div>}

                <div className="admin-form-actions">
                  {editingQId && (
                    <button className="btn-ghost" onClick={resetForm}>Cancel</button>
                  )}
                  <button className="btn-primary" onClick={handleSaveQ}>
                    {editingQId ? "Update Question" : "Add Question"}
                  </button>
                </div>
              </div>

              {/* ── Right: Question list ── */}
              <div className="admin-list-panel">
                <h3 className="admin-section-title">{game.questions.length} Questions</h3>
                {game.questions.length === 0 && (
                  <div className="empty-state-sm">No questions yet — add one on the left!</div>
                )}
                {game.questions.map(q => (
                  <div key={q.id} className="admin-q-row">
                    <div className="admin-q-info">
                      <span className={`badge badge-${q.difficulty}`}>{q.difficulty}</span>
                      <span className="admin-q-prompt">
                        {q.type === "quiz"        ? (q as QuizQuestion).prompt
                        : q.type === "flashcard"  ? `${(q as FlashcardQuestion).front} → ${(q as FlashcardQuestion).back}`
                        : q.type === "memory"     ? `${(q as MemoryQuestion).pairs.length} pairs — ${(q as MemoryQuestion).instruction.slice(0, 30)}`
                        : q.type === "wordbuilder"? `Letters: ${(q as WordBuilderQuestion).letters.join("")} (${(q as WordBuilderQuestion).validWords.length} words)`
                        : q.id}
                      </span>
                    </div>
                    <div className="admin-q-actions">
                      {["quiz","flashcard","memory","wordbuilder"].includes(q.type) && (
                        <button className="admin-icon-btn" onClick={() => handleEditQ(q)}>✏️</button>
                      )}
                      <button className="admin-icon-btn danger" onClick={() => handleDeleteQ(q.id)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEVELS TAB ────────────────────────────────────────────────────── */}
      {tab === "levels" && (
        <div className="admin-content">
          {game.levels.map((level, li) => (
            <div key={level.id} className="admin-level-card">
              <div className="admin-level-header">
                <h3>{level.title}</h3>
                <span className="admin-level-meta">
                  {level.questionIds.length} questions · pass at {level.passingScore}%
                </span>
              </div>
              <div className="admin-level-qs">
                {level.questionIds.map(qid => {
                  const q = game.questions.find(q => q.id === qid)
                  return (
                    <div key={qid} className="admin-level-q-chip">
                      <span className={`badge badge-${q?.difficulty ?? "easy"}`}>{q?.difficulty ?? "?"}</span>
                      <span>
                        {q?.type === "quiz"       ? (q as QuizQuestion).prompt.slice(0, 40) + "…"
                        : q?.type === "flashcard" ? `${(q as FlashcardQuestion).front}`
                        : q?.type === "memory"    ? `${(q as MemoryQuestion).pairs.length} pairs`
                        : qid}
                      </span>
                      <button className="chip-remove" onClick={() => {
                        updateGame({ ...game, levels: game.levels.map((l, i) =>
                          i === li ? { ...l, questionIds: l.questionIds.filter(id => id !== qid) } : l
                        )})
                      }}>×</button>
                    </div>
                  )
                })}
              </div>
              <select className="admin-select admin-add-q-select" onChange={e => {
                if (!e.target.value) return
                updateGame({ ...game, levels: game.levels.map((l, i) =>
                  i === li && !l.questionIds.includes(e.target.value)
                    ? { ...l, questionIds: [...l.questionIds, e.target.value] } : l
                )})
                e.target.value = ""
              }}>
                <option value="">+ Add question to this level</option>
                {game.questions.filter(q => !level.questionIds.includes(q.id)).map(q => (
                  <option key={q.id} value={q.id}>
                    {q.type === "quiz"        ? (q as QuizQuestion).prompt.slice(0, 50)
                    : q.type === "flashcard"  ? `${(q as FlashcardQuestion).front} → ${(q as FlashcardQuestion).back}`
                    : q.id}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ── SETTINGS TAB ──────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="admin-content">
          <div className="admin-form-panel">
            <h3 className="admin-section-title">Game Settings</h3>

            <Label required>Game Title</Label>
            <input className="admin-input" value={game.title}
              onChange={e => updateGame({ ...game, title: e.target.value })} />

            <Label required>Description</Label>
            <textarea className="admin-textarea" rows={2} value={game.description}
              onChange={e => updateGame({ ...game, description: e.target.value })} />

            <h3 className="admin-section-title" style={{ marginTop: "20px" }}>Scoring</h3>

            <Label required>Base Points per Question</Label>
            <input className="admin-input" type="number" value={game.scoring.basePoints}
              onChange={e => updateGame({ ...game, scoring: { ...game.scoring, basePoints: +e.target.value } })} />

            <Label required>Streak Threshold</Label>
            <input className="admin-input" type="number" value={game.scoring.streakThreshold}
              onChange={e => updateGame({ ...game, scoring: { ...game.scoring, streakThreshold: +e.target.value } })} />

            <Label required>Streak Multiplier</Label>
            <input className="admin-input" type="number" step="0.1" value={game.scoring.streakMultiplierValue}
              onChange={e => updateGame({ ...game, scoring: { ...game.scoring, streakMultiplierValue: +e.target.value } })} />

            <h3 className="admin-section-title" style={{ marginTop: "20px" }}>UI Options</h3>
            {[
              { key: "showTimer",    label: "Show Timer" },
              { key: "showProgress", label: "Show Progress Bar" },
              { key: "showStreak",   label: "Show Streak Counter" },
            ].map(({ key, label }) => (
              <label key={key} className="admin-toggle-row">
                <span>{label}</span>
                <input type="checkbox"
                  checked={!!game.ui?.[key as keyof typeof game.ui]}
                  onChange={e => updateGame({ ...game, ui: { ...game.ui, [key]: e.target.checked } })} />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
