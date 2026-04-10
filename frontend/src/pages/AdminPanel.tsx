import React, { useState, useEffect } from "react"
import type {
  GameConfig, Question,
  QuizQuestion, FlashcardQuestion, MemoryQuestion, WordBuilderQuestion,
  PuzzleQuestion, TapBlitzQuestion, BinaryRunnerQuestion,
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

// Plugin metadata for the Create Game flow
const PLUGIN_META: Record<string, { emoji: string; label: string; desc: string; color: string }> = {
  quiz:        { emoji: "❓", label: "Quiz",          desc: "Multiple-choice questions with hints & explanations",  color: "#A855F7" },
  puzzle:      { emoji: "🔢", label: "Pattern Puzzle", desc: "Number-sequence / pattern-recognition questions",      color: "#00D4FF" },
  flashcard:   { emoji: "🃏", label: "Flashcard",      desc: "Flip-card front/back learning decks",                 color: "#FF2D78" },
  memory:      { emoji: "🧩", label: "Memory Match",   desc: "Emoji pair-matching concentration game",              color: "#22FFAA" },
  wordbuilder: { emoji: "📝", label: "Word Builder",   desc: "Build words from shuffled letter tiles",              color: "#EC4899" },
  tapblitz:    { emoji: "⚡", label: "TapBlitz",       desc: "Motion aim game — configure wave speed & spawn rate", color: "#FFD700" },
  binaryrunner:{ emoji: "🚀", label: "Binary Runner",  desc: "3-lane runner — configure logic gate operations",     color: "#00D4FF" },
  sudoku:      { emoji: "🔢", label: "Sudoku",         desc: "9×9 constraint-satisfaction grid puzzle",            color: "#FFD700" },
}

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

function blankPuzzle(): Partial<PuzzleQuestion> {
  return { id: `p-${crypto.randomUUID()}`, type: "puzzle", difficulty: "easy", points: 100,
           pattern: [2, 4, 6, 8], sequenceLength: 2,
           instruction: "What are the next 2 numbers?", hint: "Add 2 each time." }
}

function blankTapBlitz(): Partial<TapBlitzQuestion> {
  return { id: `tb-${crypto.randomUUID()}`, type: "tapblitz", difficulty: "easy", points: 500,
           instruction: "Click the targets!", duration: 30, spawnRate: 1.2,
           targetLifetime: 3.5, targetSpeed: 55, targetMinRadius: 28, targetMaxRadius: 44, maxMisses: 12 }
}

function blankBinaryRunner(): Partial<BinaryRunnerQuestion> {
  return { id: `br-${crypto.randomUUID()}`, type: "binaryrunner", difficulty: "easy", points: 600,
           instruction: "Stage 1 — Steer into the correct answer lane!",
           duration: 40, initialSpeed: 55, maxSpeed: 110, speedRampPerSec: 1.2,
           spawnInterval: 3.2, operations: ["AND", "OR"] }
}

// ── New blank game template builder ──────────────────────────────────────────

function buildBlankGame(plugin: string, title: string, description: string, emoji: string): GameConfig {
  const id = `admin-${plugin}-${Date.now()}`
  const base = {
    id, title, description, plugin, version: "1.0.0",
    questions: [], levels: [{ id: "level-1", title: "Level 1", description: "All questions", questionIds: [], passingScore: 60 }],
    adaptiveRules: [
      { condition: { metric: "accuracy" as const, operator: "<" as const, value: 0.4 }, action: { type: "adjustDifficulty" as const, payload: { difficulty: "easy" } } },
      { condition: { metric: "accuracy" as const, operator: ">" as const, value: 0.8 }, action: { type: "adjustDifficulty" as const, payload: { difficulty: "hard" } } },
    ],
    scoring: { basePoints: 100, timeBonus: false, timeBonusPerSecond: 0, streakMultiplier: true, streakThreshold: 3, streakMultiplierValue: 1.5 },
    ui: { emoji: emoji || (PLUGIN_META[plugin]?.emoji ?? "🎮"), showProgress: true, showStreak: true, showTimer: plugin === "tapblitz" || plugin === "binaryrunner" },
  }
  return base as GameConfig
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

function validatePuzzle(q: Partial<PuzzleQuestion>): string {
  if (!q.instruction?.trim())       return "Instruction is required."
  if (!q.pattern?.length)           return "Pattern (number sequence) is required."
  if (!q.sequenceLength || q.sequenceLength < 1) return "Sequence length must be at least 1."
  if (!q.hint?.trim())              return "Hint is required — explain the pattern rule."
  if (!q.points || q.points < 1)   return "Points must be at least 1."
  return ""
}

function validateTapBlitz(q: Partial<TapBlitzQuestion>): string {
  if (!q.instruction?.trim())             return "Wave instruction is required."
  if (!q.duration || q.duration < 5)      return "Duration must be at least 5 seconds."
  if (!q.spawnRate || q.spawnRate <= 0)   return "Spawn rate must be > 0."
  if (!q.targetLifetime || q.targetLifetime <= 0) return "Target lifetime must be > 0."
  if (!q.targetSpeed || q.targetSpeed <= 0) return "Target speed must be > 0."
  return ""
}

function validateBinaryRunner(q: Partial<BinaryRunnerQuestion>): string {
  if (!q.instruction?.trim())           return "Stage instruction is required."
  if (!q.duration || q.duration < 5)    return "Duration must be at least 5 seconds."
  if (!q.operations?.length)            return "At least one operation (AND, OR, etc.) is required."
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
  const [puzzleForm, setPuzzleForm]       = useState<Partial<PuzzleQuestion>>(blankPuzzle)
  const [tbForm, setTbForm]               = useState<Partial<TapBlitzQuestion>>(blankTapBlitz)
  const [brForm, setBrForm]               = useState<Partial<BinaryRunnerQuestion>>(blankBinaryRunner)
  const [wbLettersRaw, setWbLettersRaw]   = useState("")
  const [wbWordsRaw,   setWbWordsRaw]     = useState("")
  const [wbBonusRaw,   setWbBonusRaw]     = useState("")
  const [puzzlePatternRaw, setPuzzlePatternRaw] = useState("2,4,6,8")

  // ── Create game modal state ───────────────────────────────────────────────
  const [showCreateGame, setShowCreateGame]   = useState(false)
  const [createPlugin,   setCreatePlugin]     = useState("quiz")
  const [createTitle,    setCreateTitle]      = useState("")
  const [createDesc,     setCreateDesc]       = useState("")
  const [createEmoji,    setCreateEmoji]      = useState("")
  const [createLO,       setCreateLO]         = useState("") // learning outcomes
  const [createLoading,  setCreateLoading]    = useState(false)
  const [createError,    setCreateError]      = useState("")

  // ── Delete game state ─────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading,     setDeleteLoading]     = useState(false)

  // Keep letters/words raw strings in sync with form
  useEffect(() => {
    setWbLettersRaw(wbForm.letters?.join(",") ?? "")
    setWbWordsRaw(wbForm.validWords?.join(", ") ?? "")
    setWbBonusRaw(wbForm.bonusWords?.join(", ") ?? "")
  }, [wbForm.letters, wbForm.validWords, wbForm.bonusWords])

  useEffect(() => {
    setPuzzlePatternRaw(puzzleForm.pattern?.join(",") ?? "")
  }, [puzzleForm.pattern])

  const resetForm = () => {
    setQuizForm(blankQuiz()); setFlashForm(blankFlashcard())
    setMemForm(blankMemory()); setWbForm(blankWordBuilder())
    setPuzzleForm(blankPuzzle()); setTbForm(blankTapBlitz()); setBrForm(blankBinaryRunner())
    setWbLettersRaw(""); setWbWordsRaw(""); setWbBonusRaw("")
    setPuzzlePatternRaw("2,4,6,8")
    setEditingQId(null); setQError("")
  }

  // ── Create new game ───────────────────────────────────────────────────────
  const handleCreateGame = async () => {
    if (!createTitle.trim()) { setCreateError("Title is required."); return }
    setCreateLoading(true)
    setCreateError("")
    try {
      const newGame = buildBlankGame(createPlugin, createTitle.trim(), createDesc.trim(), createEmoji.trim())
      const learningOutcomes = createLO.split(",").map(s => s.trim()).filter(Boolean)
      const res = await fetch(`${ADMIN_API}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
        body: JSON.stringify({ ...newGame, config: newGame, isAiGenerated: false, visibility: "public", learningOutcomes, aptitudeTags: [] }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      const newGames = [...localGames, newGame]
      setLocalGames(newGames)
      onSave(newGames)
      setSelectedGameId(newGame.id)
      setShowCreateGame(false)
      setCreateTitle(""); setCreateDesc(""); setCreateEmoji(""); setCreateLO(""); setCreatePlugin("quiz")
      setSaveMsg(`✅ "${newGame.title}" created! Now add questions in the Questions tab.`)
      setSaveStatus("saved")
      setTimeout(() => { setSaveStatus("idle"); setSaveMsg("") }, 4000)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed.")
    } finally {
      setCreateLoading(false)
    }
  }

  // ── Delete current game ───────────────────────────────────────────────────
  const handleDeleteGame = async () => {
    if (!game) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${ADMIN_API}/games/${encodeURIComponent(game.id)}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${adminToken}` },
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      const remaining = localGames.filter(g => g.id !== game.id)
      setLocalGames(remaining)
      onSave(remaining)
      setSelectedGameId(remaining[0]?.id ?? "")
      setShowDeleteConfirm(false)
      setSaveMsg(`🗑 "${game.title}" deleted.`)
      setSaveStatus("saved")
      setTimeout(() => { setSaveStatus("idle"); setSaveMsg("") }, 3000)
    } catch (err) {
      setSaveMsg(`⚠️ Delete failed: ${err instanceof Error ? err.message : "unknown error"}`)
      setSaveStatus("error")
      setTimeout(() => { setSaveStatus("idle"); setSaveMsg("") }, 4000)
      setShowDeleteConfirm(false)
    } finally {
      setDeleteLoading(false)
    }
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
      case "puzzle": {
        const patternNums = puzzlePatternRaw.split(",").map(s => +s.trim()).filter(n => !isNaN(n))
        const puzzleFull = { ...puzzleForm, pattern: patternNums }
        err = validatePuzzle(puzzleFull)
        if (err) { setQError(err); return }
        q = {
          id: puzzleForm.id ?? `p-${crypto.randomUUID()}`, type: "puzzle",
          difficulty: puzzleForm.difficulty ?? "easy", points: puzzleForm.points ?? 100,
          pattern: patternNums, sequenceLength: puzzleForm.sequenceLength ?? 2,
          instruction: puzzleForm.instruction!, hint: puzzleForm.hint ?? "",
        } satisfies PuzzleQuestion
        break
      }
      case "tapblitz": {
        err = validateTapBlitz(tbForm)
        if (err) { setQError(err); return }
        q = {
          id: tbForm.id ?? `tb-${crypto.randomUUID()}`, type: "tapblitz",
          difficulty: tbForm.difficulty ?? "easy", points: tbForm.points ?? 500,
          instruction: tbForm.instruction!, duration: tbForm.duration ?? 30,
          spawnRate: tbForm.spawnRate ?? 1.2, targetLifetime: tbForm.targetLifetime ?? 3.5,
          targetSpeed: tbForm.targetSpeed ?? 55,
          targetMinRadius: tbForm.targetMinRadius ?? 28, targetMaxRadius: tbForm.targetMaxRadius ?? 44,
          maxMisses: tbForm.maxMisses ?? 12,
        } satisfies TapBlitzQuestion
        break
      }
      case "binaryrunner": {
        err = validateBinaryRunner(brForm)
        if (err) { setQError(err); return }
        q = {
          id: brForm.id ?? `br-${crypto.randomUUID()}`, type: "binaryrunner",
          difficulty: brForm.difficulty ?? "easy", points: brForm.points ?? 600,
          instruction: brForm.instruction!, duration: brForm.duration ?? 40,
          initialSpeed: brForm.initialSpeed ?? 55, maxSpeed: brForm.maxSpeed ?? 110,
          speedRampPerSec: brForm.speedRampPerSec ?? 1.2,
          spawnInterval: brForm.spawnInterval ?? 3.2,
          operations: brForm.operations ?? ["AND", "OR"],
        } satisfies BinaryRunnerQuestion
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
      case "puzzle": {
        const pq = q as PuzzleQuestion
        setPuzzleForm({ ...pq })
        setPuzzlePatternRaw(pq.pattern.join(","))
        break
      }
      case "tapblitz":     setTbForm({ ...q as TapBlitzQuestion }); break
      case "binaryrunner": setBrForm({ ...q as BinaryRunnerQuestion }); break
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

  const unsupported = !["quiz", "flashcard", "memory", "wordbuilder", "puzzle", "tapblitz", "binaryrunner"].includes(game.plugin)

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

      {/* Game selector + create/delete controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "2px" }}>
        <div className="admin-game-tabs" style={{ flex: 1, marginBottom: 0 }}>
          {localGames.map(g => (
            <button key={g.id}
              className={`admin-game-tab${g.id === selectedGameId ? " active" : ""}`}
              onClick={() => { setSelectedGameId(g.id); resetForm() }}>
              {g.ui?.emoji ?? "🎮"} {g.title}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowCreateGame(true); setCreateError("") }}
          style={{ flexShrink: 0, padding: "7px 14px", background: "linear-gradient(135deg,#22FFAA,#00D4FF)", color: "#0A0A0F",
            border: "none", borderRadius: "8px", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
          + New Game
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{ flexShrink: 0, padding: "7px 14px", background: "rgba(255,45,120,0.1)", color: "#FF6090",
            border: "1px solid rgba(255,45,120,0.25)", borderRadius: "8px", fontFamily: "Exo 2, sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
          🗑 Delete Game
        </button>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "4px" }}>
                  <div>
                    <Label required>Difficulty</Label>
                    <select className="admin-select"
                      value={
                        game.plugin === "quiz"        ? quizForm.difficulty
                        : game.plugin === "flashcard" ? flashForm.difficulty
                        : game.plugin === "memory"    ? memForm.difficulty
                        : game.plugin === "puzzle"    ? puzzleForm.difficulty
                        : game.plugin === "tapblitz"  ? tbForm.difficulty
                        : game.plugin === "binaryrunner" ? brForm.difficulty
                        : wbForm.difficulty
                      }
                      onChange={e => {
                        const d = e.target.value as "easy" | "medium" | "hard"
                        if      (game.plugin === "quiz")         setQuizForm(f  => ({ ...f, difficulty: d }))
                        else if (game.plugin === "flashcard")    setFlashForm(f => ({ ...f, difficulty: d }))
                        else if (game.plugin === "memory")       setMemForm(f   => ({ ...f, difficulty: d }))
                        else if (game.plugin === "puzzle")       setPuzzleForm(f => ({ ...f, difficulty: d }))
                        else if (game.plugin === "tapblitz")     setTbForm(f    => ({ ...f, difficulty: d }))
                        else if (game.plugin === "binaryrunner") setBrForm(f    => ({ ...f, difficulty: d }))
                        else                                     setWbForm(f    => ({ ...f, difficulty: d }))
                      }}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <Label required>Points</Label>
                    <input className="admin-input" type="number" min={1}
                      value={
                        game.plugin === "quiz"        ? quizForm.points
                        : game.plugin === "flashcard" ? flashForm.points
                        : game.plugin === "memory"    ? memForm.points
                        : game.plugin === "puzzle"    ? puzzleForm.points
                        : game.plugin === "tapblitz"  ? tbForm.points
                        : game.plugin === "binaryrunner" ? brForm.points
                        : wbForm.points
                      }
                      onChange={e => {
                        const v = +e.target.value
                        if      (game.plugin === "quiz")         setQuizForm(f  => ({ ...f, points: v }))
                        else if (game.plugin === "flashcard")    setFlashForm(f => ({ ...f, points: v }))
                        else if (game.plugin === "memory")       setMemForm(f   => ({ ...f, points: v }))
                        else if (game.plugin === "puzzle")       setPuzzleForm(f => ({ ...f, points: v }))
                        else if (game.plugin === "tapblitz")     setTbForm(f    => ({ ...f, points: v }))
                        else if (game.plugin === "binaryrunner") setBrForm(f    => ({ ...f, points: v }))
                        else                                     setWbForm(f    => ({ ...f, points: v }))
                      }} />
                  </div>
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

                {/* ── PUZZLE fields ── */}
                {game.plugin === "puzzle" && (
                  <>
                    <Label required>Instruction</Label>
                    <input className="admin-input" placeholder="e.g. What are the next 2 numbers in the sequence?"
                      value={puzzleForm.instruction ?? ""} onChange={e => setPuzzleForm(f => ({ ...f, instruction: e.target.value }))} />

                    <Label required>Number Sequence (comma-separated, e.g. 2,4,6,8)</Label>
                    <input className="admin-input" placeholder="2,4,6,8"
                      value={puzzlePatternRaw}
                      onChange={e => {
                        setPuzzlePatternRaw(e.target.value)
                        const nums = e.target.value.split(",").filter(s => s.trim() !== "").map(s => +s.trim()).filter(n => !isNaN(n))
                        setPuzzleForm(f => ({ ...f, pattern: nums }))
                      }} />

                    <Label required>Answer Count (how many numbers does the player need to find?)</Label>
                    <input className="admin-input" type="number" min={1} max={5}
                      value={puzzleForm.sequenceLength ?? 2}
                      onChange={e => setPuzzleForm(f => ({ ...f, sequenceLength: +e.target.value }))} />

                    <Label required>Hint (explain the pattern rule)</Label>
                    <input className="admin-input" placeholder="e.g. Add 2 each time."
                      value={puzzleForm.hint ?? ""} onChange={e => setPuzzleForm(f => ({ ...f, hint: e.target.value }))} />

                    <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)", marginTop: "8px", fontSize: "0.75rem", fontFamily: "Exo 2, sans-serif", color: "rgba(0,212,255,0.7)" }}>
                      💡 <strong>Pattern tip:</strong> Enter the known part of the sequence — the player must figure out the next <strong>{puzzleForm.sequenceLength ?? 2}</strong> numbers.
                      For example, pattern <code>2,4,6,8</code> with answer count <strong>2</strong> means the player must type <strong>10, 12</strong>.
                    </div>
                  </>
                )}

                {/* ── TAPBLITZ fields ── */}
                {game.plugin === "tapblitz" && (
                  <>
                    <Label required>Wave Instruction</Label>
                    <input className="admin-input" placeholder="e.g. Wave 1 — Tap the targets before they disappear!"
                      value={tbForm.instruction ?? ""} onChange={e => setTbForm(f => ({ ...f, instruction: e.target.value }))} />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <Label required>Duration (seconds)</Label>
                        <input className="admin-input" type="number" min={5} max={120}
                          value={tbForm.duration ?? 30} onChange={e => setTbForm(f => ({ ...f, duration: +e.target.value }))} />
                      </div>
                      <div>
                        <Label required>Max Misses</Label>
                        <input className="admin-input" type="number" min={1} max={50}
                          value={tbForm.maxMisses ?? 12} onChange={e => setTbForm(f => ({ ...f, maxMisses: +e.target.value }))} />
                      </div>
                      <div>
                        <Label required>Spawn Rate (targets/sec)</Label>
                        <input className="admin-input" type="number" min={0.1} max={10} step={0.1}
                          value={tbForm.spawnRate ?? 1.2} onChange={e => setTbForm(f => ({ ...f, spawnRate: +e.target.value }))} />
                      </div>
                      <div>
                        <Label required>Target Lifetime (sec)</Label>
                        <input className="admin-input" type="number" min={0.5} max={10} step={0.5}
                          value={tbForm.targetLifetime ?? 3.5} onChange={e => setTbForm(f => ({ ...f, targetLifetime: +e.target.value }))} />
                      </div>
                      <div>
                        <Label required>Target Speed (px/sec)</Label>
                        <input className="admin-input" type="number" min={0} max={300}
                          value={tbForm.targetSpeed ?? 55} onChange={e => setTbForm(f => ({ ...f, targetSpeed: +e.target.value }))} />
                      </div>
                      <div>
                        <Label>Min Radius (px)</Label>
                        <input className="admin-input" type="number" min={10} max={80}
                          value={tbForm.targetMinRadius ?? 28} onChange={e => setTbForm(f => ({ ...f, targetMinRadius: +e.target.value }))} />
                      </div>
                      <div>
                        <Label>Max Radius (px)</Label>
                        <input className="admin-input" type="number" min={10} max={80}
                          value={tbForm.targetMaxRadius ?? 44} onChange={e => setTbForm(f => ({ ...f, targetMaxRadius: +e.target.value }))} />
                      </div>
                    </div>

                    <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", marginTop: "8px", fontSize: "0.75rem", fontFamily: "Exo 2, sans-serif", color: "rgba(255,215,0,0.7)" }}>
                      ⚡ Each entry is a <strong>wave</strong>. Add multiple waves to create escalating difficulty — e.g. Wave 1 (slow), Wave 2 (faster), Wave 3 (boss wave).
                    </div>
                  </>
                )}

                {/* ── BINARYRUNNER fields ── */}
                {game.plugin === "binaryrunner" && (
                  <>
                    <Label required>Stage Instruction</Label>
                    <input className="admin-input" placeholder="e.g. Stage 1 — Steer into the correct answer lane!"
                      value={brForm.instruction ?? ""} onChange={e => setBrForm(f => ({ ...f, instruction: e.target.value }))} />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <Label required>Duration (seconds)</Label>
                        <input className="admin-input" type="number" min={5} max={180}
                          value={brForm.duration ?? 40} onChange={e => setBrForm(f => ({ ...f, duration: +e.target.value }))} />
                      </div>
                      <div>
                        <Label required>Initial Speed (px/sec)</Label>
                        <input className="admin-input" type="number" min={20} max={300}
                          value={brForm.initialSpeed ?? 55} onChange={e => setBrForm(f => ({ ...f, initialSpeed: +e.target.value }))} />
                      </div>
                      <div>
                        <Label required>Max Speed (px/sec)</Label>
                        <input className="admin-input" type="number" min={20} max={600}
                          value={brForm.maxSpeed ?? 110} onChange={e => setBrForm(f => ({ ...f, maxSpeed: +e.target.value }))} />
                      </div>
                      <div>
                        <Label>Speed Ramp (px/s²)</Label>
                        <input className="admin-input" type="number" min={0} max={10} step={0.1}
                          value={brForm.speedRampPerSec ?? 1.2} onChange={e => setBrForm(f => ({ ...f, speedRampPerSec: +e.target.value }))} />
                      </div>
                      <div>
                        <Label required>Spawn Interval (sec)</Label>
                        <input className="admin-input" type="number" min={0.5} max={10} step={0.5}
                          value={brForm.spawnInterval ?? 3.2} onChange={e => setBrForm(f => ({ ...f, spawnInterval: +e.target.value }))} />
                      </div>
                    </div>

                    <Label required>Logic Operations (check all that appear in this stage)</Label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px", marginBottom: "8px" }}>
                      {(["AND","OR","XOR","NOT","NAND","NOR"] as const).map(op => (
                        <label key={op} style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer",
                          padding: "5px 10px", borderRadius: "6px", fontFamily: "Exo 2, sans-serif", fontSize: "0.8rem",
                          background: brForm.operations?.includes(op) ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
                          border: brForm.operations?.includes(op) ? "1px solid rgba(0,212,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
                          color: brForm.operations?.includes(op) ? "#00D4FF" : "rgba(232,224,255,0.5)" }}>
                          <input type="checkbox" style={{ accentColor: "#00D4FF" }}
                            checked={brForm.operations?.includes(op) ?? false}
                            onChange={e => {
                              const ops = brForm.operations ?? []
                              setBrForm(f => ({ ...f, operations: e.target.checked ? [...ops, op] : ops.filter(o => o !== op) }))
                            }} />
                          {op}
                        </label>
                      ))}
                    </div>

                    <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)", marginTop: "4px", fontSize: "0.75rem", fontFamily: "Exo 2, sans-serif", color: "rgba(0,212,255,0.7)" }}>
                      🚀 Each entry is a <strong>stage</strong>. Add multiple stages for progressive logic gate challenges — start with AND/OR, advance to XOR/NAND.
                    </div>
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
                {game.questions.map((q, qi) => (
                  <div key={q.id} className="admin-q-row">
                    <div className="admin-q-info">
                      <span className={`badge badge-${q.difficulty}`}>{q.difficulty}</span>
                      <span className="admin-q-prompt">
                        {q.type === "quiz"
                          ? (q as QuizQuestion).prompt
                        : q.type === "flashcard"
                          ? `${(q as FlashcardQuestion).front} → ${(q as FlashcardQuestion).back}`
                        : q.type === "memory"
                          ? `${(q as MemoryQuestion).pairs.length} pairs — ${(q as MemoryQuestion).instruction.slice(0, 30)}`
                        : q.type === "wordbuilder"
                          ? `Letters: ${(q as WordBuilderQuestion).letters.join("")} (${(q as WordBuilderQuestion).validWords.length} words)`
                        : q.type === "puzzle"
                          ? `Pattern: ${(q as PuzzleQuestion).pattern.join(",")}… (find ${(q as PuzzleQuestion).sequenceLength})`
                        : q.type === "tapblitz"
                          ? `Wave ${qi + 1}: ${(q as TapBlitzQuestion).duration}s · ${(q as TapBlitzQuestion).spawnRate}/s spawn`
                        : q.type === "binaryrunner"
                          ? `Stage ${qi + 1}: ${(q as BinaryRunnerQuestion).duration}s · ${(q as BinaryRunnerQuestion).operations.join(",")} ops`
                        : q.id}
                      </span>
                    </div>
                    <div className="admin-q-actions">
                      {["quiz","flashcard","memory","wordbuilder","puzzle","tapblitz","binaryrunner"].includes(q.type) && (
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

      {/* ── CREATE GAME MODAL ──────────────────────────────────────────────── */}
      {showCreateGame && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(10,10,15,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }} onClick={e => { if (e.target === e.currentTarget) setShowCreateGame(false) }}>
          <div style={{
            background: "#12121A", border: "1px solid rgba(168,85,247,0.25)", borderRadius: "16px",
            padding: "28px", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto",
          }}>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", color: "#E8E0FF", fontSize: "1.1rem", marginBottom: "4px" }}>
              ✨ Create New Game
            </h2>
            <p style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.78rem", color: "rgba(232,224,255,0.4)", marginBottom: "20px" }}>
              Choose a plugin type, fill in the basics — then add questions/waves/stages in the Questions tab.
            </p>

            {/* Plugin grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" }}>
              {Object.entries(PLUGIN_META).map(([key, meta]) => (
                <button key={key} onClick={() => setCreatePlugin(key)}
                  style={{
                    padding: "12px 8px", borderRadius: "10px", cursor: "pointer", textAlign: "center",
                    fontFamily: "Exo 2, sans-serif", transition: "all 0.2s",
                    background: createPlugin === key ? `${meta.color}18` : "rgba(255,255,255,0.03)",
                    border: createPlugin === key ? `2px solid ${meta.color}` : "1px solid rgba(255,255,255,0.08)",
                    color: createPlugin === key ? meta.color : "rgba(232,224,255,0.6)",
                  }}>
                  <div style={{ fontSize: "1.6rem", marginBottom: "4px" }}>{meta.emoji}</div>
                  <div style={{ fontWeight: 700, fontSize: "0.75rem" }}>{meta.label}</div>
                  <div style={{ fontSize: "0.65rem", marginTop: "3px", opacity: 0.7, lineHeight: 1.3 }}>{meta.desc}</div>
                </button>
              ))}
            </div>

            {/* Title / description / emoji */}
            <Label required>Game Title</Label>
            <input className="admin-input" placeholder={`e.g. ${PLUGIN_META[createPlugin]?.label} Challenge`}
              value={createTitle} onChange={e => setCreateTitle(e.target.value)} />

            <Label>Description (shown on game card)</Label>
            <textarea className="admin-textarea" rows={2} placeholder="What does this game teach? Who is it for?"
              value={createDesc} onChange={e => setCreateDesc(e.target.value)} />

            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "10px" }}>
              <div>
                <Label>Emoji</Label>
                <input className="admin-input" placeholder={PLUGIN_META[createPlugin]?.emoji ?? "🎮"}
                  value={createEmoji} onChange={e => setCreateEmoji(e.target.value)}
                  style={{ textAlign: "center", fontSize: "1.2rem" }} />
              </div>
              <div>
                <Label>Learning Outcomes (comma-separated)</Label>
                <input className="admin-input" placeholder="e.g. Problem Solving, Algorithms, Attention to Detail"
                  value={createLO} onChange={e => setCreateLO(e.target.value)} />
              </div>
            </div>

            {createError && (
              <div className="admin-error" style={{ margin: "12px 0 0" }}>⚠️ {createError}</div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowCreateGame(false)} disabled={createLoading}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateGame} disabled={createLoading}>
                {createLoading ? "Creating…" : `✨ Create ${PLUGIN_META[createPlugin]?.label ?? "Game"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE GAME CONFIRM DIALOG ─────────────────────────────────────── */}
      {showDeleteConfirm && game && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(10,10,15,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }} onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}>
          <div style={{
            background: "#12121A", border: "1px solid rgba(255,45,120,0.3)", borderRadius: "16px",
            padding: "28px", maxWidth: "420px", width: "100%",
          }}>
            <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "12px" }}>🗑</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", color: "#FF6090", fontSize: "1rem", textAlign: "center", marginBottom: "8px" }}>
              Delete Game?
            </h2>
            <p style={{ fontFamily: "Exo 2, sans-serif", fontSize: "0.82rem", color: "rgba(232,224,255,0.6)", textAlign: "center", marginBottom: "20px" }}>
              You are about to permanently delete <strong style={{ color: "#E8E0FF" }}>{game.ui?.emoji ?? "🎮"} {game.title}</strong>.
              This will remove it from the game engine and cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button className="btn-ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                Keep Game
              </button>
              <button
                onClick={handleDeleteGame} disabled={deleteLoading}
                style={{ padding: "9px 22px", background: "rgba(255,45,120,0.15)", color: "#FF6090",
                  border: "1px solid rgba(255,45,120,0.4)", borderRadius: "8px", fontFamily: "Exo 2, sans-serif",
                  fontWeight: 700, fontSize: "0.82rem", cursor: deleteLoading ? "not-allowed" : "pointer" }}>
                {deleteLoading ? "Deleting…" : "🗑 Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
