/**
 * AIService — typed wrapper for all /api/ai endpoints
 *
 * When VITE_GROQ_API_KEY is set, game generation calls are made DIRECTLY
 * from the browser to api.groq.com (bypassing the backend, which may be
 * on a network that cannot reach Groq).
 *
 * All other calls (history, mascot chat, reports, etc.) still go via the
 * backend as usual.
 */

const API       = import.meta.env.VITE_API_URL     ?? "http://localhost:3001/api"
const GROQ_KEY  = import.meta.env.VITE_GROQ_API_KEY ?? ""
const GROQ_URL  = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Groq helpers (browser → api.groq.com)
// ─────────────────────────────────────────────────────────────────────────────

/** Call Groq directly from the browser and return raw text. */
async function callGroqDirect(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body:    JSON.stringify({
      model:       GROQ_MODEL,
      messages:    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature,
      max_tokens:  4096,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((err.error as { message?: string })?.message ?? `Groq error ${res.status}`)
  }
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

/** Robustly extract first complete JSON object from an LLM response. */
function extractJSON(raw: string): Record<string, unknown> {
  const text = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  const start = text.indexOf("{")
  if (start === -1) throw new Error("No JSON object found in AI response")

  let depth = 0
  let end   = -1
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) throw new Error("Unbalanced braces in AI response")

  const cleaned = text.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1")
  return JSON.parse(cleaned) as Record<string, unknown>
}

/** Call Groq, parse JSON, retry up to 3× with lower temperature. */
async function callGroqJSON(systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const temperature = attempt === 0 ? 0.7 : attempt === 1 ? 0.3 : 0.1
      const up = attempt === 0 ? userPrompt : `${userPrompt}\n\nIMPORTANT: Return ONLY the raw JSON object. No explanation, no markdown, no code fences.`
      const text = await callGroqDirect(systemPrompt, up, temperature)
      return extractJSON(text)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw new Error(`AI returned invalid JSON after 3 attempts: ${lastError?.message}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Config fixers (port of backend fixers)
// ─────────────────────────────────────────────────────────────────────────────

type AnyConfig = Record<string, unknown>

function fixQuizConfig(cfg: AnyConfig): AnyConfig {
  if (!cfg || typeof cfg !== "object") throw new Error("AI returned invalid JSON structure")
  cfg["version"] = cfg["version"] ?? "1.0.0"
  cfg["plugin"]  = "quiz"
  cfg["learningOutcomes"] = cfg["learningOutcomes"] ?? ["logical_reasoning","general_knowledge","attention_to_detail"]
  cfg["aptitudeTags"]     = cfg["aptitudeTags"]     ?? cfg["learningOutcomes"]
  cfg["ui"]      = cfg["ui"] ?? { emoji: "🧠", showProgress: true, showStreak: true }
  cfg["scoring"] = cfg["scoring"] ?? { basePoints: 100, timeBonus: false, timeBonusPerSecond: 0, streakMultiplier: true, streakThreshold: 3, streakMultiplierValue: 1.5, penalties: false, penaltyPerWrong: 0 }
  cfg["adaptiveRules"] = cfg["adaptiveRules"] ?? [
    { condition: { metric: "accuracy", operator: "<", value: 0.4 }, action: { type: "adjustDifficulty", payload: { difficulty: "easy" } } },
    { condition: { metric: "accuracy", operator: ">", value: 0.8 }, action: { type: "adjustDifficulty", payload: { difficulty: "hard" } } },
  ]
  if (!Array.isArray(cfg["questions"]) || (cfg["questions"] as unknown[]).length === 0) throw new Error("AI generated no questions")

  cfg["questions"] = (cfg["questions"] as AnyConfig[]).map((q, i) => {
    const f = { ...q }
    f["id"]         = `q${i + 1}`
    f["type"]       = "quiz"
    f["difficulty"] = ["easy","medium","hard"].includes(String(f["difficulty"])) ? f["difficulty"] : "medium"
    f["points"]     = f["points"] ?? (f["difficulty"] === "hard" ? 200 : f["difficulty"] === "easy" ? 100 : 150)
    f["timeLimit"]  = f["timeLimit"] ?? 30
    f["prompt"]     = f["prompt"] ?? f["question"] ?? f["text"] ?? f["stem"] ?? `Question ${i + 1}`
    delete f["question"]; delete f["text"]; delete f["stem"]

    if (!Array.isArray(f["options"]) || (f["options"] as unknown[]).length < 2)
      f["options"] = ["True", "False", "Cannot determine", "Not applicable"]
    while ((f["options"] as unknown[]).length < 4) (f["options"] as string[]).push(`Option ${(f["options"] as unknown[]).length + 1}`)
    f["options"] = (f["options"] as unknown[]).slice(0, 4).map(String)

    if (typeof f["correctIndex"] !== "number") {
      const parsed = parseInt(String(f["correctIndex"] ?? ""), 10)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 3) {
        f["correctIndex"] = parsed
      } else {
        const ansStr = String(f["answer"] ?? f["correctAnswer"] ?? f["correctIndex"] ?? "").toLowerCase().trim()
        const idx = (f["options"] as string[]).findIndex(o => o.toLowerCase().trim() === ansStr)
        f["correctIndex"] = idx >= 0 ? idx : 0
      }
    }
    f["correctIndex"] = Math.min(Math.max(0, Math.floor(Number(f["correctIndex"]))), 3)
    delete f["answer"]; delete f["correctAnswer"]
    f["explanation"] = f["explanation"] ?? "Review your notes on this topic."
    return f
  })

  const qs = cfg["questions"] as AnyConfig[]
  const easyIds   = qs.filter(q => q["difficulty"] === "easy").map(q => String(q["id"]))
  const mediumIds = qs.filter(q => q["difficulty"] === "medium").map(q => String(q["id"]))
  const hardIds   = qs.filter(q => q["difficulty"] === "hard").map(q => String(q["id"]))
  const allIds    = qs.map(q => String(q["id"]))
  if (easyIds.length || mediumIds.length || hardIds.length) {
    cfg["levels"] = [
      ...(easyIds.length   ? [{ id: "level-easy",   title: "Level 1 — Easy",   description: "Warm-up questions",  questionIds: easyIds,   passingScore: 50 }] : []),
      ...(mediumIds.length ? [{ id: "level-medium", title: "Level 2 — Medium", description: "Core questions",     questionIds: mediumIds, passingScore: 60 }] : []),
      ...(hardIds.length   ? [{ id: "level-hard",   title: "Level 3 — Hard",   description: "Advanced questions", questionIds: hardIds,   passingScore: 70 }] : []),
    ]
  } else {
    cfg["levels"] = [{ id: "level-1", title: "All Questions", description: "Complete the quiz", questionIds: allIds, passingScore: 60 }]
  }
  return cfg
}

function fixFlashcardConfig(cfg: AnyConfig): AnyConfig {
  if (!cfg || typeof cfg !== "object") throw new Error("AI returned invalid JSON structure")
  cfg["version"] = cfg["version"] ?? "1.0.0"
  cfg["plugin"]  = "flashcard"
  cfg["learningOutcomes"] = cfg["learningOutcomes"] ?? ["memory","general_knowledge"]
  cfg["aptitudeTags"]     = cfg["aptitudeTags"]     ?? cfg["learningOutcomes"]
  cfg["ui"]      = cfg["ui"] ?? { emoji: "🃏", showProgress: true, showStreak: false }
  cfg["scoring"] = cfg["scoring"] ?? { basePoints: 100, timeBonus: false, timeBonusPerSecond: 0, streakMultiplier: false, streakThreshold: 3, streakMultiplierValue: 1, penalties: false, penaltyPerWrong: 0 }
  cfg["adaptiveRules"] = []
  if (!Array.isArray(cfg["questions"]) || (cfg["questions"] as unknown[]).length === 0) throw new Error("AI generated no flashcard questions")

  cfg["questions"] = (cfg["questions"] as AnyConfig[]).map((q, i) => {
    const f = { ...q }
    f["id"]         = `q${i + 1}`
    f["type"]       = "flashcard"
    f["difficulty"] = ["easy","medium","hard"].includes(String(f["difficulty"])) ? f["difficulty"] : "medium"
    f["points"]     = f["points"] ?? 100
    f["front"]      = f["front"] ?? f["prompt"] ?? f["term"] ?? f["question"] ?? `Card ${i + 1}`
    f["back"]       = f["back"] ?? f["answer"] ?? f["definition"] ?? f["explanation"] ?? "See your notes"
    delete f["prompt"]; delete f["options"]; delete f["answer"]
    delete f["correctIndex"]; delete f["term"]; delete f["definition"]
    delete f["question"]; delete f["text"]; delete f["explanation"]
    f["category"]   = f["category"] ?? (Array.isArray(f["tags"]) ? (f["tags"] as string[])[0] : "General")
    return f
  })
  const allIds = (cfg["questions"] as AnyConfig[]).map(q => String(q["id"]))
  cfg["levels"] = [{ id: "level-1", title: "All Cards", description: "Study all flashcards", questionIds: allIds, passingScore: 50 }]
  return cfg
}

function fixPuzzleConfig(cfg: AnyConfig): AnyConfig {
  if (!cfg || typeof cfg !== "object") throw new Error("Invalid JSON structure")
  cfg["plugin"]  = "puzzle"
  cfg["version"] = cfg["version"] ?? "1.0.0"
  cfg["learningOutcomes"] = cfg["learningOutcomes"] ?? ["logical_reasoning","pattern_recognition","problem_solving"]
  cfg["aptitudeTags"]     = cfg["aptitudeTags"]     ?? cfg["learningOutcomes"]
  cfg["ui"]      = cfg["ui"] ?? { emoji: "🔢", showProgress: true, showStreak: true, showTimer: false }
  cfg["scoring"] = cfg["scoring"] ?? { basePoints: 100, timeBonus: false, timeBonusPerSecond: 0, streakMultiplier: true, streakThreshold: 2, streakMultiplierValue: 1.25 }
  if (!Array.isArray(cfg["questions"]) || (cfg["questions"] as unknown[]).length === 0) throw new Error("No questions generated")
  cfg["questions"] = (cfg["questions"] as AnyConfig[]).map((q, i) => {
    const f = { ...q }
    f["id"]             = `p${i + 1}`
    f["type"]           = "puzzle"
    f["difficulty"]     = ["easy","medium","hard"].includes(String(f["difficulty"])) ? f["difficulty"] : "medium"
    f["points"]         = f["points"] ?? (f["difficulty"] === "hard" ? 400 : f["difficulty"] === "easy" ? 100 : 200)
    f["pattern"]        = Array.isArray(f["pattern"]) ? (f["pattern"] as unknown[]).map(Number).filter(n => !isNaN(n)) : [1,2,3,4]
    f["sequenceLength"] = Math.max(1, Number(f["sequenceLength"] ?? 2))
    f["instruction"]    = f["instruction"] ?? `What are the next ${f["sequenceLength"]} numbers?`
    f["hint"]           = f["hint"] ?? "Look at the difference between consecutive numbers."
    return f
  })
  const qs = cfg["questions"] as AnyConfig[]
  const easyIds   = qs.filter(q => q["difficulty"] === "easy").map(q => String(q["id"]))
  const mediumIds = qs.filter(q => q["difficulty"] === "medium").map(q => String(q["id"]))
  const hardIds   = qs.filter(q => q["difficulty"] === "hard").map(q => String(q["id"]))
  const allIds    = qs.map(q => String(q["id"]))
  cfg["levels"] = [
    ...(easyIds.length   ? [{ id: "level-easy",   title: "Easy Patterns",  description: "Warm-up sequences",      questionIds: easyIds,   passingScore: 50 }] : []),
    ...(mediumIds.length ? [{ id: "level-medium", title: "Medium Patterns", description: "Core pattern recognition", questionIds: mediumIds, passingScore: 60 }] : []),
    ...(hardIds.length   ? [{ id: "level-hard",   title: "Hard Patterns",   description: "Advanced sequences",     questionIds: hardIds,   passingScore: 70 }] : []),
  ]
  if (!(cfg["levels"] as unknown[]).length) cfg["levels"] = [{ id: "level-1", title: "All Patterns", description: "Complete the puzzle", questionIds: allIds, passingScore: 60 }]
  cfg["adaptiveRules"] = cfg["adaptiveRules"] ?? [
    { condition: { metric: "accuracy", operator: ">=", value: 0.9 }, action: { type: "adjustDifficulty", payload: { difficulty: "hard" } } },
    { condition: { metric: "accuracy", operator: "<",  value: 0.5 }, action: { type: "showHint" } },
  ]
  return cfg
}

function fixMemoryConfig(cfg: AnyConfig): AnyConfig {
  if (!cfg || typeof cfg !== "object") throw new Error("Invalid JSON structure")
  cfg["plugin"]  = "memory"
  cfg["version"] = cfg["version"] ?? "1.0.0"
  cfg["learningOutcomes"] = cfg["learningOutcomes"] ?? ["memory","focus","attention_to_detail"]
  cfg["aptitudeTags"]     = cfg["aptitudeTags"]     ?? cfg["learningOutcomes"]
  cfg["ui"]      = cfg["ui"] ?? { emoji: "🧩", showProgress: true, showStreak: false }
  cfg["scoring"] = cfg["scoring"] ?? { basePoints: 200, timeBonus: false, timeBonusPerSecond: 0, streakMultiplier: false, streakThreshold: 3, streakMultiplierValue: 1 }
  if (!Array.isArray(cfg["questions"]) || (cfg["questions"] as unknown[]).length === 0) throw new Error("No questions generated")
  cfg["questions"] = (cfg["questions"] as AnyConfig[]).map((q, i) => {
    const f = { ...q }
    f["id"]          = `m${i + 1}`
    f["type"]        = "memory"
    f["difficulty"]  = ["easy","medium","hard"].includes(String(f["difficulty"])) ? f["difficulty"] : "medium"
    f["points"]      = f["points"] ?? (f["difficulty"] === "hard" ? 400 : f["difficulty"] === "easy" ? 200 : 300)
    f["instruction"] = f["instruction"] ?? "Match each word to its emoji!"
    if (!Array.isArray(f["pairs"]) || (f["pairs"] as unknown[]).length < 2)
      f["pairs"] = [{ id: "p1", label: "Item 1", emoji: "⭐" }, { id: "p2", label: "Item 2", emoji: "🔹" }]
    f["pairs"] = (f["pairs"] as AnyConfig[]).map((p, pi) => ({
      id:    String(p["id"] ?? `p${pi + 1}`),
      label: String(p["label"] ?? p["word"] ?? p["concept"] ?? `Item ${pi + 1}`).trim(),
      emoji: String(p["emoji"] ?? p["icon"] ?? "❓").trim(),
    }))
    return f
  })
  const allIds = (cfg["questions"] as AnyConfig[]).map(q => String(q["id"]))
  cfg["levels"] = [{ id: "level-1", title: "All Rounds", description: "Match all the pairs", questionIds: allIds, passingScore: 60 }]
  cfg["adaptiveRules"] = []
  return cfg
}

function fixWordBuilderConfig(cfg: AnyConfig): AnyConfig {
  if (!cfg || typeof cfg !== "object") throw new Error("Invalid JSON structure")
  cfg["plugin"]  = "wordbuilder"
  cfg["version"] = cfg["version"] ?? "1.0.0"
  cfg["learningOutcomes"] = cfg["learningOutcomes"] ?? ["vocabulary","verbal_ability"]
  cfg["aptitudeTags"]     = cfg["aptitudeTags"]     ?? cfg["learningOutcomes"]
  cfg["ui"]      = cfg["ui"] ?? { emoji: "📝", showProgress: true, showStreak: false }
  cfg["scoring"] = cfg["scoring"] ?? { basePoints: 300, timeBonus: false, timeBonusPerSecond: 0, streakMultiplier: false, streakThreshold: 3, streakMultiplierValue: 1 }
  if (!Array.isArray(cfg["questions"]) || (cfg["questions"] as unknown[]).length === 0) throw new Error("No questions generated")
  cfg["questions"] = (cfg["questions"] as AnyConfig[]).map((q, i) => {
    const f = { ...q }
    f["id"]          = `wb${i + 1}`
    f["type"]        = "wordbuilder"
    f["difficulty"]  = ["easy","medium","hard"].includes(String(f["difficulty"])) ? f["difficulty"] : "medium"
    f["points"]      = f["points"] ?? 300
    f["instruction"] = f["instruction"] ?? "Build as many words as you can from these letters!"
    f["letters"]     = Array.isArray(f["letters"]) ? (f["letters"] as unknown[]).map(l => String(l).toUpperCase().trim()).filter(Boolean) : ["A","P","L","E","S"]
    f["validWords"]  = Array.isArray(f["validWords"]) ? (f["validWords"] as unknown[]).map(w => String(w).toLowerCase().trim()).filter(Boolean) : []
    f["bonusWords"]  = Array.isArray(f["bonusWords"]) ? (f["bonusWords"] as unknown[]).map(w => String(w).toLowerCase().trim()).filter(Boolean) : []
    f["targetCount"] = Math.max(1, Number(f["targetCount"] ?? 3))
    return f
  })
  const allIds = (cfg["questions"] as AnyConfig[]).map(q => String(q["id"]))
  cfg["levels"] = [{ id: "level-1", title: "All Challenges", description: "Build as many words as you can", questionIds: allIds, passingScore: 60 }]
  cfg["adaptiveRules"] = []
  return cfg
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────────────────────

const QUIZ_SCHEMA = `You are TapTap AI — a WORLD-CLASS educational game designer known for creating electrifying, high-energy quiz games that students can't put down. Return ONLY valid JSON — no markdown, no explanation.

Your questions must be:
★ PUNCHY and specific — no vague or boring phrasing. Every question should feel like a challenge worth beating.
★ VARIED in format — "which of these is NOT...", "in which year...", "what happens when...", scenario-based, calculation-based — mix it up!
★ PROGRESSIVELY INTENSE — easy warms up, medium demands real thought, hard is genuinely hard (tricky distractors, edge cases, deeper concepts).
★ REAL DISTRACTOR OPTIONS — wrong answers must be plausible, not obviously wrong. Make the player think.
★ SATISFACTION-DRIVEN — correct explanations should feel rewarding ("Exactly! Because..."). Wrong ones should make the player go "oh WOW I didn't know that".

QUIZ FORMAT:
{
  "id": "ai-quiz-topic-timestamp",
  "title": "🔥 Explosive Title With Energy",
  "plugin": "quiz",
  "version": "1.0.0",
  "description": "One punchy sentence that makes you want to play right now",
  "questions": [
    { "id": "q1", "type": "quiz", "difficulty": "easy", "points": 100, "timeLimit": 25,
      "prompt": "Specific, energetic question text?",
      "options": ["Plausible A","Plausible B","Correct Answer","Plausible D"],
      "correctIndex": 2,
      "explanation": "Satisfying 'Aha!' explanation that teaches something" }
  ],
  "levels": [
    { "id": "level-easy",   "title": "⚡ Ignition",     "description": "Warm up your brain",   "questionIds": ["q1","q2"], "passingScore": 50 },
    { "id": "level-medium", "title": "🔥 Inferno",      "description": "Real knowledge tested", "questionIds": ["q3","q4"], "passingScore": 60 },
    { "id": "level-hard",   "title": "💀 Skull Crusher", "description": "Only the elite pass",  "questionIds": ["q5","q6"], "passingScore": 70 }
  ],
  "adaptiveRules": [],
  "ui": { "emoji": "🧠", "showProgress": true, "showStreak": true }
}

CRITICAL:
1. type = "quiz" (never "mcq" or "multiple_choice")
2. correctIndex = NUMBER 0-3 (not text)
3. options = exactly 4 strings — ALL must look plausible
4. points: easy=100, medium=150, hard=200
5. timeLimit: easy=25, medium=20, hard=15 (time pressure = excitement!)
6. Generate at LEAST 6 questions spread across difficulties
7. Title and description must be energetic — avoid "Let's learn about X" blandness`

const FLASHCARD_SCHEMA = `You are TapTap AI — master of rapid-fire knowledge retention. Return ONLY valid JSON — no markdown, no explanation.

Your flashcards must be:
★ SNAPPY on the front — a crisp term, formula, date, or concept — no paragraphs
★ ILLUMINATING on the back — the definition + one surprising fact or real-world connection that makes it stick
★ THEMED around a specific angle — not just random facts but a cohesive journey through the topic
★ VARIED — some are definitions, some are "what does X produce?", some are famous examples, some are "why does X matter?"

FLASHCARD FORMAT:
{
  "id": "ai-flash-topic",
  "title": "⚡ Speed Drill: Topic Name",
  "plugin": "flashcard",
  "version": "1.0.0",
  "description": "Master [topic] at lightning speed — flip, learn, dominate",
  "questions": [
    { "id": "q1", "type": "flashcard", "difficulty": "medium", "points": 100,
      "front": "Crisp term, concept, or question",
      "back": "Punchy definition + one real-world connection or surprising fact",
      "category": "Subcategory name" }
  ],
  "levels": [{ "id": "level-1", "title": "⚡ Full Speed Ahead", "description": "All cards, no mercy", "questionIds": ["q1"], "passingScore": 50 }],
  "adaptiveRules": [],
  "ui": { "emoji": "⚡", "showProgress": true, "showStreak": true }
}

CRITICAL: type="flashcard", use front/back (not prompt/answer), generate 8-12 cards minimum, backs must be informative and memorable`

const PUZZLE_SCHEMA = `You are TapTap AI — architect of mind-bending mathematical patterns that make brains explode (in a good way). Return ONLY valid JSON — no markdown.

Your patterns must be:
★ CLEVER — not just "+2 each time". Use Fibonacci, prime gaps, alternating operations, squares, factorials, positional tricks.
★ SURPRISING — easy patterns should still have a small "aha!", medium should require 10 seconds of thought, hard should feel nearly impossible then suddenly obvious.
★ DIVERSE — mix arithmetic sequences, geometric progressions, nested patterns, combined operations, negative numbers, fractions (as integers × 10 trick).
★ INSTRUCTIVE — the hint should reveal the pattern without spoiling the answer.

PUZZLE FORMAT (number sequence patterns):
{
  "id": "ai-puzzle-topic",
  "title": "🔮 Pattern Breaker: Topic",
  "plugin": "puzzle",
  "version": "1.0.0",
  "description": "Crack the code — patterns hidden in plain sight",
  "questions": [
    { "id": "p1", "type": "puzzle", "difficulty": "easy", "points": 100,
      "pattern": [1,4,9,16,25], "sequenceLength": 2,
      "instruction": "Crack the pattern — what are the next 2 numbers?",
      "hint": "Each number is a perfect square (1²=1, 2²=4, 3²=9...)" }
  ],
  "levels": [
    { "id": "level-easy",   "title": "🟢 Warm-Up",     "questionIds": ["p1","p2"], "passingScore": 50, "description": "Light brain stretch" },
    { "id": "level-medium", "title": "🟡 Mind Bender",  "questionIds": ["p3","p4"], "passingScore": 60, "description": "Think harder" },
    { "id": "level-hard",   "title": "🔴 Brain Crusher", "questionIds": ["p5","p6"], "passingScore": 70, "description": "Genius territory" }
  ],
  "adaptiveRules": [],
  "scoring": { "basePoints": 100, "timeBonus": true, "timeBonusPerSecond": 5, "streakMultiplier": true, "streakThreshold": 2, "streakMultiplierValue": 1.5 },
  "ui": { "emoji": "🔮", "showProgress": true, "showStreak": true }
}

CRITICAL: type="puzzle", pattern=number array (integers only), sequenceLength=how many to find, points: easy=100 medium=200 hard=400, generate 6-9 questions`

const MEMORY_SCHEMA = `You are TapTap AI — creator of unforgettable memory games with rich visual associations. Return ONLY valid JSON — no markdown.

Your memory pairs must be:
★ THEMATICALLY RICH — each round should feel like a themed adventure (e.g., "Space Missions", "World Capitals", "Algorithm Types")
★ MEANINGFULLY CONNECTED — label+emoji pairings that make intuitive sense and reinforce learning
★ PROGRESSIVELY CHALLENGING — easy = 4 pairs (obvious), medium = 6 pairs (thoughtful), hard = 8 pairs (expert knowledge required)
★ VISUALLY DISTINCT — use emojis that are visually different from each other (don't use similar-looking emojis in same round)
★ KNOWLEDGE-BUILDING — when you match a pair, you should learn something. Labels should be real concepts from the topic.

MEMORY GAME FORMAT (emoji pair matching):
{
  "id": "ai-memory-topic",
  "title": "🧩 Memory Blitz: Topic",
  "plugin": "memory",
  "version": "1.0.0",
  "description": "Lightning-fast recall — match concepts before time runs out",
  "questions": [
    { "id": "m1", "type": "memory", "difficulty": "easy", "points": 200,
      "instruction": "🔥 Match each concept to its symbol — GO!",
      "pairs": [
        { "id": "p1", "label": "Photosynthesis", "emoji": "🌿" },
        { "id": "p2", "label": "DNA",            "emoji": "🧬" },
        { "id": "p3", "label": "Gravity",        "emoji": "🍎" },
        { "id": "p4", "label": "Electricity",    "emoji": "⚡" }
      ] },
    { "id": "m2", "type": "memory", "difficulty": "medium", "points": 300,
      "instruction": "🧠 6 pairs — think fast!",
      "pairs": [
        { "id": "p1", "label": "Concept 1", "emoji": "🔬" },
        { "id": "p2", "label": "Concept 2", "emoji": "🌊" },
        { "id": "p3", "label": "Concept 3", "emoji": "🔥" },
        { "id": "p4", "label": "Concept 4", "emoji": "🌪️" },
        { "id": "p5", "label": "Concept 5", "emoji": "❄️" },
        { "id": "p6", "label": "Concept 6", "emoji": "⚗️" }
      ] }
  ],
  "levels": [{ "id": "level-1", "title": "🧩 Memory Arena", "description": "Match pairs, earn glory", "questionIds": ["m1","m2"], "passingScore": 60 }],
  "adaptiveRules": [],
  "scoring": { "basePoints": 200, "timeBonus": true, "timeBonusPerSecond": 3, "streakMultiplier": true, "streakThreshold": 3, "streakMultiplierValue": 1.25 },
  "ui": { "emoji": "🧩", "showProgress": true, "showStreak": true }
}

CRITICAL: type="memory", pairs need id+label+emoji, 3 rounds minimum (easy/medium/hard), emojis must be visually distinct within each round`

const WB_SCHEMA = `You are TapTap AI — wordsmith extraordinaire who crafts word-building challenges that feel like a vocabulary rocket launch. Return ONLY valid JSON — no markdown.

Your word challenges must be:
★ GENEROUS with letters — give 7-9 letters that enable many words, including short (3-letter) and long (6-8 letter) ones
★ TOPIC-RELEVANT — validWords should include terms from the subject area where possible
★ BONUS-WORTHY — bonusWords should be impressive, longer words that feel like real achievements
★ FAIR — every validWord MUST be constructable from the given letters (check each word carefully!)
★ PROGRESSIVELY HARDER — easy = common short words, medium = technical vocab + longer combos, hard = obscure or domain-specific words

WORDBUILDER FORMAT:
{
  "id": "ai-wb-topic",
  "title": "📝 Word Forge: Topic",
  "plugin": "wordbuilder",
  "version": "1.0.0",
  "description": "Forge words at lightning speed — how many can you build?",
  "questions": [
    { "id": "wb1", "type": "wordbuilder", "difficulty": "easy", "points": 300,
      "instruction": "⚡ Build as many words as you can — GO!",
      "letters": ["A","P","L","E","S","T","R"],
      "validWords": ["apt","tap","rap","lap","pal","alps","pals","taps","raps","laps","trap","traps","petal","tapas","plaster"],
      "bonusWords": ["plaster","tapas"],
      "targetCount": 4 }
  ],
  "levels": [{ "id": "level-1", "title": "⚡ Word Forge Arena", "description": "Build words, earn points, dominate", "questionIds": ["wb1"], "passingScore": 60 }],
  "adaptiveRules": [],
  "scoring": { "basePoints": 300, "timeBonus": true, "timeBonusPerSecond": 10, "streakMultiplier": true, "streakThreshold": 3, "streakMultiplierValue": 1.5 },
  "ui": { "emoji": "📝", "showProgress": true, "showStreak": true }
}

CRITICAL: type="wordbuilder", letters=UPPERCASE singles, validWords=lowercase, EVERY validWord must use ONLY the given letters — double-check each one! Generate 2-3 rounds.`

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateQuizInput {
  topic:          string
  difficulty?:    "easy" | "medium" | "hard"
  questionCount?: number
  targetCompany?: string
  tags?:          string[]
}
export interface GenerateFlashcardInput  { topic: string; cardCount?: number; difficulty?: "easy" | "medium" | "hard" }
export interface GeneratePuzzleInput     { topic?: string; questionCount?: number; difficulty?: "easy" | "medium" | "hard" | "mixed" }
export interface GenerateMemoryInput     { topic: string; pairCount?: number }
export interface GenerateWordBuilderInput { topic: string; wordCount?: number; difficulty?: "easy" | "medium" | "hard" | "mixed" }
export interface ExplanationInput        { concept?: string; question?: string; correctAnswer?: string; studentAnswer?: string; context?: string }
export interface AnalysisInput           { gameTitle: string; score: number; accuracy: number; timeTaken: number; difficulty?: string; wrongAnswers?: { question: string; answer: string; correct: string }[]; correctAnswers?: string[] }
export interface LessonInput             { topic: string; targetCompany?: string; duration?: string; level?: string }
export interface MascotMessage           { role: "user" | "assistant"; text: string }
export interface SkillReport             { summary: string; strengths: string[]; improvements: string[]; recommendations: { skill: string; action: string; games: string[] }[]; readiness: { score: number; level: string; message: string }; weeklyPlan: { day: string; focus: string; duration: string }[] }
export interface SessionAnalysis         { grade: string; feedback: string; mistakePatterns: string[]; focusTip: string; encouragement: string }

// ─────────────────────────────────────────────────────────────────────────────
// Internal: direct browser generation
// ─────────────────────────────────────────────────────────────────────────────

function slug(s: string) { return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }

async function generateDirect(
  schema: string,
  userPrompt: string,
  fixer: (c: AnyConfig) => AnyConfig,
): Promise<{ generationId: string; config: Record<string, unknown> }> {
  const rawConfig = await callGroqJSON(schema, userPrompt)
  const config    = fixer(rawConfig)
  return { generationId: `local-${Date.now()}`, config }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const AIService = {

  async generateQuiz(token: string, input: GenerateQuizInput) {
    if (GROQ_KEY) {
      const count   = Math.min(Number(input.questionCount ?? 10), 20)
      const company = input.targetCompany ? ` — specifically crafted for ${input.targetCompany} placement/aptitude tests with realistic question styles` : ""
      const tagStr  = input.tags?.length ? ` Emphasise: ${input.tags.join(", ")}.` : ""
      const diff    = input.difficulty ?? "mixed"
      const diffStr = diff === "mixed" ? "~35% easy, ~40% medium, ~25% hard" : `all ${diff}`
      const userPrompt = `Create a THRILLING, high-energy quiz game about "${input.topic}"${company}.

Requirements:
- Exactly ${count} questions. Difficulty: ${diffStr}. ${tagStr}
- Make questions SPECIFIC and SURPRISING — no generic textbook phrasing
- Wrong options must be genuinely plausible (not obviously wrong)
- Explanations must be memorable and teach something new
- Title should be exciting (e.g. "⚡ ${input.topic} Blitz", "🔥 ${input.topic} Showdown")
- type="quiz", 4 options, numeric correctIndex (0-3)
- id: "ai-${slug(input.topic)}-${Date.now()}"

Return ONLY raw JSON.`
      return generateDirect(QUIZ_SCHEMA, userPrompt, fixQuizConfig)
    }
    const res  = await fetch(`${API}/ai/generate/quiz`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "AI quiz generation failed."))
    return data as { generationId: string; config: Record<string, unknown> }
  },

  async generateFlashcard(token: string, input: GenerateFlashcardInput) {
    if (GROQ_KEY) {
      const count = Math.min(Number(input.cardCount ?? 12), 24)
      const userPrompt = `Create a RAPID-FIRE flashcard game that drills "${input.topic}" into memory like a laser.

Requirements:
- Exactly ${count} cards. Difficulty: ${input.difficulty ?? "medium"}.
- front = ultra-crisp term or question (max 10 words)
- back = punchy definition + one surprising real-world connection
- Group by subcategory so the player senses a theme
- Title: exciting (e.g. "⚡ ${input.topic} Speed Drill")
- id: "ai-flash-${slug(input.topic)}-${Date.now()}"

Return ONLY raw JSON.`
      return generateDirect(FLASHCARD_SCHEMA, userPrompt, fixFlashcardConfig)
    }
    const res  = await fetch(`${API}/ai/generate/flashcard`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "AI flashcard generation failed."))
    return data as { generationId: string; config: Record<string, unknown> }
  },

  async generatePuzzle(token: string, input: GeneratePuzzleInput) {
    if (GROQ_KEY) {
      const count = Math.min(Number(input.questionCount ?? 8), 16)
      const diff  = input.difficulty ?? "mixed"
      const topicStr = input.topic ? ` about "${input.topic}"` : ""
      const userPrompt = `Create MIND-BENDING pattern puzzles${topicStr} that make players feel like geniuses when they crack them.

Requirements:
- Exactly ${count} questions. Difficulty: ${diff === "mixed" ? "~35% easy, ~40% medium, ~25% hard" : `all ${diff}`}.
- Use DIVERSE pattern types: arithmetic (+/-), geometric (×/÷), squared, cubed, Fibonacci, alternating ops, combined rules
- Easy: recognisable instantly. Medium: needs 10s of thought. Hard: tricky — needs real insight.
- Hints must reveal the rule WITHOUT giving away the answer
- Title: exciting (e.g. "🔮 Pattern Crusher")
- id: "ai-puzzle-${slug(input.topic ?? "pattern")}-${Date.now()}"

Return ONLY raw JSON.`
      return generateDirect(PUZZLE_SCHEMA, userPrompt, fixPuzzleConfig)
    }
    const res  = await fetch(`${API}/ai/generate/puzzle`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "AI puzzle generation failed."))
    return data as { generationId: string; config: Record<string, unknown> }
  },

  async generateMemory(token: string, input: GenerateMemoryInput) {
    if (GROQ_KEY) {
      const count = Math.min(Number(input.pairCount ?? 6), 12)
      const userPrompt = `Create an EXPLOSIVE memory game about "${input.topic}" with rich, meaningful concept-emoji pairs.

Requirements:
- ${count} rounds. Each round themed (e.g. "Core Concepts", "Famous Examples", "Real-World Applications")
- Easy round: 4 pairs (very clear concepts). Medium: 6 pairs. Hard: 8 pairs (expert-level concepts).
- Labels = real concepts from "${input.topic}" — NOT generic words
- Emojis = visually distinct within each round, genuinely representing the concept
- instruction must be energetic ("🔥 Match the concept to its symbol — GO!")
- Title: thrilling (e.g. "🧩 ${input.topic} Memory Blitz")
- id: "ai-memory-${slug(input.topic)}-${Date.now()}"

Return ONLY raw JSON.`
      return generateDirect(MEMORY_SCHEMA, userPrompt, fixMemoryConfig)
    }
    const res  = await fetch(`${API}/ai/generate/memory`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "AI memory game generation failed."))
    return data as { generationId: string; config: Record<string, unknown> }
  },

  async generateWordBuilder(token: string, input: GenerateWordBuilderInput) {
    if (GROQ_KEY) {
      const count = Math.min(Number(input.wordCount ?? 4), 8)
      const userPrompt = `Create an ADDICTIVE word-building game themed around "${input.topic}" — where letters feel like power-ups.

Requirements:
- ${count} rounds. Each round: 7-9 UPPERCASE single letters (generous pool).
- Include letters that form MANY words (e.g. include common vowels A,E,I and consonants S,T,R,N).
- validWords: at LEAST 8-15 words per round including 3-letter easy words and 6+ letter harder words.
- bonusWords: 2-3 impressive long words or domain-specific words.
- CRITICAL: verify every validWord uses ONLY the provided letters — NO exceptions.
- Difficulty: ${input.difficulty ?? "mixed"}.
- Title: energetic (e.g. "⚡ ${input.topic} Word Forge")
- id: "ai-wb-${slug(input.topic)}-${Date.now()}"

Return ONLY raw JSON.`
      return generateDirect(WB_SCHEMA, userPrompt, fixWordBuilderConfig)
    }
    const res  = await fetch(`${API}/ai/generate/wordbuilder`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "AI word builder generation failed."))
    return data as { generationId: string; config: Record<string, unknown> }
  },

  async getExplanation(token: string, input: ExplanationInput): Promise<string> {
    if (GROQ_KEY) {
      const sys = `You are Blackbuck, a friendly AI tutor for engineering students. Explain concepts clearly in 3-5 sentences, using relatable examples. End with an encouraging line. Plain text only.`
      const up  = `Explain: "${input.concept ?? input.question}"${input.question ? `\nQuestion: "${input.question}"` : ""}${input.correctAnswer ? `\nCorrect answer: ${input.correctAnswer}` : ""}${input.studentAnswer ? `\nStudent answered: ${input.studentAnswer}` : ""}`
      return callGroqDirect(sys, up, 0.7)
    }
    const res  = await fetch(`${API}/ai/generate/explanation`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "Failed to get explanation."))
    return String(data["explanation"])
  },

  async generateReport(token: string): Promise<SkillReport> {
    const res  = await fetch(`${API}/ai/generate/report`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({}) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "Failed to generate report."))
    return data["report"] as SkillReport
  },

  async analyseSession(token: string, input: AnalysisInput): Promise<SessionAnalysis> {
    if (GROQ_KEY) {
      const sys = `You are TapTap AI. Analyse a student's game session and return ONLY a JSON object with these exact keys: grade (A/B/C/D), feedback (2-3 sentences), mistakePatterns (string array), focusTip (1 sentence), encouragement (1 sentence).`
      const up  = `Game: "${input.gameTitle}". Score: ${input.score}. Accuracy: ${input.accuracy}%. Time: ${input.timeTaken}s.${input.wrongAnswers?.length ? ` Wrong answers: ${input.wrongAnswers.map(w => `"${w.question}" (answered "${w.answer}", correct "${w.correct}")`).join("; ")}` : ""}`
      const raw = await callGroqJSON(sys, up)
      return raw as unknown as SessionAnalysis
    }
    const res  = await fetch(`${API}/ai/generate/analysis`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "Failed to analyse session."))
    return data["analysis"] as SessionAnalysis
  },

  async generateLesson(token: string, input: LessonInput) {
    const res  = await fetch(`${API}/ai/generate/lesson`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(input) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "Failed to generate lesson."))
    return data["lesson"]
  },

  async chat(token: string, message: string, history: MascotMessage[] = [], context?: string): Promise<string> {
    if (GROQ_KEY) {
      const sys  = `You are Blackbuck, a friendly and encouraging AI learning companion for engineering and aptitude exam students. Keep answers concise (2-4 sentences), warm, and practical.${context ? `\n\nContext: ${context}` : ""}`
      const msgs = [
        { role: "system" as const, content: sys },
        ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.text })),
        { role: "user" as const, content: message },
      ]
      const res = await fetch(GROQ_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
        body:    JSON.stringify({ model: GROQ_MODEL, messages: msgs, temperature: 0.8, max_tokens: 512 }),
      })
      if (!res.ok) throw new Error(`Groq error ${res.status}`)
      const data = await res.json() as { choices: { message: { content: string } }[] }
      return data.choices[0].message.content
    }
    const res  = await fetch(`${API}/ai/mascot/chat`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ message, history, context }) })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error(String(data["error"] ?? "Blackbuck is unavailable right now."))
    return String(data["reply"])
  },

  async getHistory(token: string, type?: string) {
    const url = type ? `${API}/ai/history?type=${type}` : `${API}/ai/history`
    const res  = await fetch(url, { headers: authHeaders(token) })
    const data = await res.json() as unknown
    if (!res.ok) throw new Error(String((data as Record<string, unknown>)["error"] ?? "Failed to load history."))
    return data as { id: string; type: string; prompt: string; createdAt: string }[]
  },

  async getGeneration(token: string, id: string) {
    const res  = await fetch(`${API}/ai/history/${id}`, { headers: authHeaders(token) })
    const data = await res.json() as unknown
    if (!res.ok) throw new Error(String((data as Record<string, unknown>)["error"] ?? "Generation not found."))
    return data
  },
}
