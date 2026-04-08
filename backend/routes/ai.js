/**
 * AI Routes — Groq-powered generation + analysis
 * Uses Groq free tier: llama-3.3-70b-versatile (14,400 req/day, no credit card)
 *
 * POST /api/ai/generate/quiz         → full quiz game JSON
 * POST /api/ai/generate/flashcard    → flashcard game JSON
 * POST /api/ai/generate/lesson       → structured lesson plan
 * POST /api/ai/generate/report       → skill-gap analysis report
 * POST /api/ai/generate/explanation  → explain a specific concept
 * POST /api/ai/generate/analysis     → analyse a completed session
 * POST /api/ai/mascot/chat           → Blackbuck AI companion chat
 * GET  /api/ai/history               → user's past generations
 * GET  /api/ai/history/:id           → a single stored generation
 */

require("dotenv").config()
const express      = require("express")
const Groq         = require("groq-sdk")
const prisma       = require("../prisma/client")
const { requireAuth } = require("../middleware/auth")

const router = express.Router()

// Lazy-init Groq client
let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" })
  return _groq
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Call Groq with a system prompt + user prompt.
 * Returns the raw text response.
 */
async function callGemini(systemPrompt, userPrompt) {
  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt   },
    ],
    temperature: 0.7,
    max_tokens:  4096,
  })
  return response.choices[0].message.content
}

/**
 * Call Groq and parse JSON from the response.
 * LLMs sometimes wrap JSON in ```json ... ``` fences — strip them.
 */
async function callGeminiJSON(systemPrompt, userPrompt) {
  const raw  = await callGemini(systemPrompt, userPrompt)
  const text = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im,     "")
    .replace(/```\s*$/im,     "")
    .trim()
  return JSON.parse(text)
}

/**
 * Validate and auto-fix a Gemini-generated quiz GameConfig so it will
 * load correctly in the TapTap engine regardless of minor AI deviations.
 */
function fixQuizConfig(config) {
  if (!config || typeof config !== "object") throw new Error("AI returned invalid JSON structure")

  config.version = config.version ?? "1.0.0"
  config.plugin  = "quiz"
  config.ui      = config.ui ?? { emoji: "🧠", showProgress: true, showStreak: true }
  config.scoring = config.scoring ?? {
    basePoints: 100, timeBonus: false, timeBonusPerSecond: 0,
    streakMultiplier: true, streakThreshold: 3, streakMultiplierValue: 1.5,
    penalties: false, penaltyPerWrong: 0,
  }
  config.adaptiveRules = config.adaptiveRules ?? [
    { condition: { metric: "accuracy", operator: "<", value: 0.4 }, action: { type: "adjustDifficulty", payload: { difficulty: "easy" } } },
    { condition: { metric: "accuracy", operator: ">", value: 0.8 }, action: { type: "adjustDifficulty", payload: { difficulty: "hard" } } },
  ]

  if (!Array.isArray(config.questions) || config.questions.length === 0)
    throw new Error("AI generated no questions")

  // ALWAYS normalize question IDs to q1, q2, q3... — prevents any ID mismatch
  config.questions = config.questions.map((q, i) => {
    const fixed = { ...q }
    fixed.id         = `q${i + 1}`          // force simple IDs — no mismatch possible
    fixed.type       = "quiz"
    fixed.difficulty = ["easy","medium","hard"].includes(fixed.difficulty) ? fixed.difficulty : "medium"
    fixed.points     = fixed.points ?? (fixed.difficulty === "hard" ? 200 : fixed.difficulty === "easy" ? 100 : 150)
    fixed.timeLimit  = fixed.timeLimit ?? 30

    // Remap: LLMs use "question"/"text"/"stem" — engine needs "prompt"
    fixed.prompt = fixed.prompt ?? fixed.question ?? fixed.text ?? fixed.stem ?? `Question ${i + 1}`
    delete fixed.question; delete fixed.text; delete fixed.stem

    // Ensure exactly 4 options
    if (!Array.isArray(fixed.options) || fixed.options.length < 2)
      fixed.options = ["True", "False", "Cannot determine", "Not applicable"]
    while (fixed.options.length < 4) fixed.options.push(`Option ${fixed.options.length + 1}`)
    fixed.options = fixed.options.slice(0, 4).map(String)

    // Fix correctIndex — AI might send "answer" string or wrong type
    if (typeof fixed.correctIndex !== "number") {
      const answerStr = (fixed.answer ?? fixed.correctAnswer ?? "").toString().toLowerCase().trim()
      const idx = fixed.options.findIndex(o => o.toString().toLowerCase().trim() === answerStr)
      fixed.correctIndex = idx >= 0 ? idx : 0
    }
    fixed.correctIndex = Math.min(Math.max(0, Math.floor(Number(fixed.correctIndex))), 3)
    delete fixed.answer; delete fixed.correctAnswer

    fixed.explanation = fixed.explanation ?? "Review your notes on this topic."
    return fixed
  })

  // ALWAYS rebuild levels from scratch using normalized IDs — guaranteed to match
  const allIds    = config.questions.map(q => q.id)
  const easyIds   = config.questions.filter(q => q.difficulty === "easy").map(q => q.id)
  const mediumIds = config.questions.filter(q => q.difficulty === "medium").map(q => q.id)
  const hardIds   = config.questions.filter(q => q.difficulty === "hard").map(q => q.id)

  if (easyIds.length > 0 || mediumIds.length > 0 || hardIds.length > 0) {
    config.levels = []
    if (easyIds.length   > 0) config.levels.push({ id: "level-easy",   title: "Level 1 — Easy",   description: "Warm-up questions",    questionIds: easyIds,   passingScore: 50 })
    if (mediumIds.length > 0) config.levels.push({ id: "level-medium", title: "Level 2 — Medium", description: "Core questions",        questionIds: mediumIds, passingScore: 60 })
    if (hardIds.length   > 0) config.levels.push({ id: "level-hard",   title: "Level 3 — Hard",   description: "Advanced questions",    questionIds: hardIds,   passingScore: 70 })
  } else {
    config.levels = [{ id: "level-1", title: "All Questions", description: "Complete the quiz", questionIds: allIds, passingScore: 60 }]
  }

  return config
}

/**
 * Validate and auto-fix a Gemini-generated flashcard GameConfig.
 */
function fixFlashcardConfig(config) {
  if (!config || typeof config !== "object") throw new Error("AI returned invalid JSON structure")

  config.version = config.version ?? "1.0.0"
  config.plugin  = "flashcard"
  config.ui      = config.ui ?? { emoji: "🃏", showProgress: true, showStreak: false }
  config.scoring = config.scoring ?? {
    basePoints: 100, timeBonus: false, timeBonusPerSecond: 0,
    streakMultiplier: false, streakThreshold: 3, streakMultiplierValue: 1,
    penalties: false, penaltyPerWrong: 0,
  }
  config.adaptiveRules = []

  if (!Array.isArray(config.questions) || config.questions.length === 0)
    throw new Error("AI generated no flashcard questions")

  // ALWAYS normalize IDs to q1, q2, ... — guarantees level IDs match
  config.questions = config.questions.map((q, i) => {
    const fixed = { ...q }
    fixed.id         = `q${i + 1}`           // force simple IDs
    fixed.type       = "flashcard"
    fixed.difficulty = ["easy","medium","hard"].includes(fixed.difficulty) ? fixed.difficulty : "medium"
    fixed.points     = fixed.points ?? 100

    // Remap to front/back — LLMs use prompt/answer/term/definition/question
    fixed.front = fixed.front ?? fixed.prompt ?? fixed.term ?? fixed.question ?? `Card ${i + 1}`
    fixed.back  = fixed.back  ?? fixed.answer ?? fixed.definition ?? fixed.explanation ?? "See your notes"

    // Clean up non-standard fields
    delete fixed.prompt; delete fixed.options; delete fixed.answer
    delete fixed.correctIndex; delete fixed.term; delete fixed.definition
    delete fixed.question; delete fixed.text; delete fixed.explanation

    fixed.category = fixed.category ?? fixed.tags?.[0] ?? "General"
    return fixed
  })

  // ALWAYS rebuild levels with normalized IDs
  const allIds = config.questions.map(q => q.id)
  config.levels = [{ id: "level-1", title: "All Cards", description: "Study all flashcards", questionIds: allIds, passingScore: 50 }]

  return config
}

// ── System Prompts ────────────────────────────────────────────────────────────

const GAME_SCHEMA = `
You are TapTap AI, an expert educational game designer. You must return ONLY valid JSON with NO explanation, NO markdown, NO extra text — just the raw JSON object.

CRITICAL: The TapTap engine uses this EXACT format. Any deviation will break the game loader.

QUIZ GAME FORMAT:
{
  "id": "ai-{topic-kebab}-{timestamp}",
  "title": "Quiz title here",
  "plugin": "quiz",
  "version": "1.0.0",
  "description": "Short description of what this quiz covers",
  "questions": [
    {
      "id": "q1",
      "type": "quiz",
      "difficulty": "easy",
      "points": 100,
      "timeLimit": 30,
      "prompt": "The full question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "Explanation of why Option C is correct"
    }
  ],
  "levels": [
    {
      "id": "level-easy",
      "title": "Level 1 — Easy",
      "description": "Beginner questions",
      "questionIds": ["q1", "q2", "q3"],
      "passingScore": 50
    },
    {
      "id": "level-medium",
      "title": "Level 2 — Medium",
      "description": "Intermediate questions",
      "questionIds": ["q4", "q5", "q6"],
      "passingScore": 60
    },
    {
      "id": "level-hard",
      "title": "Level 3 — Hard",
      "description": "Advanced questions",
      "questionIds": ["q7", "q8", "q9"],
      "passingScore": 70
    }
  ],
  "adaptiveRules": [
    { "condition": { "metric": "accuracy", "operator": "<", "value": 0.4 }, "action": { "type": "adjustDifficulty", "payload": { "difficulty": "easy" } } },
    { "condition": { "metric": "accuracy", "operator": ">", "value": 0.8 }, "action": { "type": "adjustDifficulty", "payload": { "difficulty": "hard" } } }
  ],
  "ui": { "emoji": "🧠", "showProgress": true, "showStreak": true }
}

CRITICAL RULES:
1. "type" for every question MUST be exactly "quiz" — never "mcq", "multiple_choice", or anything else
2. "correctIndex" MUST be a NUMBER (0, 1, 2, or 3) — the index of the correct option in the "options" array
3. NEVER use "answer" field — use "correctIndex" only
4. "options" MUST have exactly 4 strings
5. "levels" array is REQUIRED — each level references question IDs via "questionIds"
6. ALL question IDs referenced in "questionIds" must exist in the "questions" array
7. "points" should be 100 for easy, 150 for medium, 200 for hard
`

const FLASHCARD_SCHEMA = `
You are TapTap AI, an expert educational game designer. You must return ONLY valid JSON with NO explanation, NO markdown, NO extra text — just the raw JSON object.

CRITICAL: The TapTap engine uses this EXACT format for flashcard games.

FLASHCARD GAME FORMAT:
{
  "id": "ai-flash-{topic-kebab}-{timestamp}",
  "title": "Flashcard title here",
  "plugin": "flashcard",
  "version": "1.0.0",
  "description": "Short description",
  "questions": [
    {
      "id": "q1",
      "type": "flashcard",
      "difficulty": "medium",
      "points": 100,
      "front": "Term or question shown on front of card",
      "back": "Definition or answer shown on back of card",
      "category": "Category name (e.g. Algorithms, Vocabulary, etc.)"
    }
  ],
  "levels": [
    {
      "id": "level-1",
      "title": "All Cards",
      "description": "Study all flashcards",
      "questionIds": ["q1", "q2", "q3"],
      "passingScore": 50
    }
  ],
  "adaptiveRules": [],
  "ui": { "emoji": "🃏", "showProgress": true, "showStreak": false }
}

CRITICAL RULES:
1. "type" for every question MUST be exactly "flashcard" — never "true_false" or anything else
2. "front" and "back" are REQUIRED — do NOT use "prompt", "options", or "answer"
3. "levels" array is REQUIRED — every question id must appear in at least one level's "questionIds"
4. "category" should reflect the subject area
`

// ── POST /api/ai/generate/quiz ────────────────────────────────────────────────
router.post("/generate/quiz", requireAuth, async (req, res) => {
  const { topic, difficulty, questionCount, targetCompany, tags } = req.body ?? {}
  if (!topic) return res.status(400).json({ error: "topic is required." })

  const count   = Math.min(Number(questionCount ?? 10), 20)
  const diff    = difficulty ?? "medium"
  const company = targetCompany ? ` tailored for ${targetCompany} aptitude tests` : ""
  const tagStr  = tags?.length ? ` Focus areas: ${tags.join(", ")}.` : ""

  const slug = topic.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  const userPrompt = `Create a quiz game about "${topic}"${company}.
- Exactly ${count} questions total
- Difficulty split: ~40% easy, ~40% medium, ~20% hard
- ALL questions MUST use type "quiz" with 4 options and a numeric correctIndex (0, 1, 2, or 3)
- Each question needs a thorough explanation of WHY the answer is correct
- Split questions evenly across 3 levels (easy/medium/hard)
- Use id: "ai-${slug}-${Date.now()}"${tagStr}
- Return ONLY the raw JSON game config — no markdown, no explanation`

  try {
    const rawConfig  = await callGeminiJSON(GAME_SCHEMA, userPrompt)
    const config     = fixQuizConfig(rawConfig)        // ← validate + auto-fix format
    const tokensUsed = Math.round(JSON.stringify(config).length / 4)

    const gen = await prisma.aiGeneration.create({
      data: {
        userId:     req.user.id,
        type:       "quiz",
        prompt:     userPrompt,
        result:     config,
        tokensUsed,
      },
    })

    res.json({ success: true, generationId: gen.id, config })
  } catch (err) {
    console.error("AI quiz generation error:", err)
    res.status(500).json({ error: "AI generation failed. Please try again.", detail: err.message })
  }
})

// ── POST /api/ai/generate/flashcard ──────────────────────────────────────────
router.post("/generate/flashcard", requireAuth, async (req, res) => {
  const { topic, cardCount, difficulty } = req.body ?? {}
  if (!topic) return res.status(400).json({ error: "topic is required." })

  const count = Math.min(Number(cardCount ?? 12), 24)

  const userPrompt = `Create a flashcard game for studying "${topic}".
- Exactly ${count} cards (each is a "true_false" type for the flip mechanic)
- Difficulty: ${difficulty ?? "medium"}
- Prompts should be on one side: definition, concept, or term
- Answer "True" means the statement is correct / the definition is accurate
- Answer "False" means the opposite / incorrect statement
- Each card must have a thorough explanation
- Generate unique kebab-case id
Return ONLY the JSON game config.`

  try {
    const rawConfig  = await callGeminiJSON(FLASHCARD_SCHEMA, userPrompt)
    const config     = fixFlashcardConfig(rawConfig)   // ← validate + auto-fix format
    const tokensUsed = Math.round(JSON.stringify(config).length / 4)

    const gen = await prisma.aiGeneration.create({
      data: {
        userId:     req.user.id,
        type:       "flashcard",
        prompt:     userPrompt,
        result:     config,
        tokensUsed,
      },
    })

    res.json({ success: true, generationId: gen.id, config })
  } catch (err) {
    console.error("AI flashcard generation error:", err)
    res.status(500).json({ error: "AI generation failed. Please try again.", detail: err.message })
  }
})

// ── POST /api/ai/generate/explanation ────────────────────────────────────────
// Explain a concept (shown in-game after wrong answer via Blackbuck AI)
router.post("/generate/explanation", requireAuth, async (req, res) => {
  const { concept, question, correctAnswer, studentAnswer, context } = req.body ?? {}
  if (!concept && !question)
    return res.status(400).json({ error: "concept or question is required." })

  const systemPrompt = `You are Blackbuck, a friendly and encouraging AI tutor for engineering students in India.
You explain concepts clearly, using relatable Indian examples (UPSC, competitive exams, college life).
Keep explanations concise (3-5 sentences), warm, and end with an encouraging line.
Return plain text (no JSON, no markdown formatting).`

  const questionContext = question ? `\nQuestion that was asked: "${question}"` : ""
  const answerContext   = correctAnswer ? `\nCorrect answer: ${correctAnswer}` : ""
  const wrongContext    = studentAnswer ? `\nStudent answered: ${studentAnswer}` : ""
  const extraCtx        = context ? `\nAdditional context: ${context}` : ""

  const userPrompt = `Explain the concept: "${concept ?? question}"${questionContext}${answerContext}${wrongContext}${extraCtx}
Help the student understand why the correct answer is right.`

  try {
    const explanation = await callGemini(systemPrompt, userPrompt)
    const tokensUsed  = Math.round((systemPrompt.length + userPrompt.length + explanation.length) / 4)

    const gen = await prisma.aiGeneration.create({
      data: {
        userId:     req.user.id,
        type:       "explanation",
        prompt:     userPrompt,
        result:     { explanation },
        tokensUsed,
      },
    })

    res.json({ success: true, generationId: gen.id, explanation })
  } catch (err) {
    console.error("AI explanation error:", err)
    res.status(500).json({ error: "Failed to generate explanation.", detail: err.message })
  }
})

// ── POST /api/ai/generate/report ──────────────────────────────────────────────
// Generate a personalised skill-gap report based on the user's skill progress
router.post("/generate/report", requireAuth, async (req, res) => {
  try {
    // Fetch user's skill progress
    const skills  = await prisma.userSkillProgress.findMany({ where: { userId: req.user.id } })
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.id } })
    const user    = await prisma.user.findUnique({ where: { id: req.user.id } })

    const systemPrompt = `You are Blackbuck, an expert career counsellor for engineering students in India.
You analyse a student's game performance data and provide a structured, actionable skill-gap report.
Return ONLY valid JSON — no markdown, no extra text.`

    const skillSummary = skills.map(s =>
      `${s.skillArea}: Level ${s.level}/5, XP ${s.xp}, Accuracy ${s.accuracy}%, ${s.gamesPlayed} games`
    ).join("\n")

    const targetCompany = profile?.targetCompany ?? "top tech companies"
    const userPrompt    = `Generate a skill gap report for:
Student: ${user?.username ?? "Student"}
Target Company: ${targetCompany}
Campus Year: ${profile?.campusYear ?? "not specified"}
Branch: ${profile?.branch ?? "not specified"}

Skill Performance:
${skillSummary || "No games played yet"}

Return this exact JSON structure:
{
  "summary": "2-3 sentence overview of strengths and gaps",
  "strengths": ["skill area 1", "skill area 2"],
  "improvements": ["skill area 1", "skill area 2"],
  "recommendations": [
    { "skill": "skill_area", "action": "specific action to take", "games": ["game suggestions"] }
  ],
  "readiness": { "score": 0-100, "level": "Beginner|Developing|Ready|Strong", "message": "..." },
  "weeklyPlan": [
    { "day": "Monday", "focus": "...", "duration": "20 min" }
  ]
}`

    const report     = await callGeminiJSON(systemPrompt, userPrompt)
    const tokensUsed = Math.round(JSON.stringify(report).length / 4)

    const gen = await prisma.aiGeneration.create({
      data: {
        userId:     req.user.id,
        type:       "report",
        prompt:     userPrompt,
        result:     report,
        tokensUsed,
      },
    })

    res.json({ success: true, generationId: gen.id, report })
  } catch (err) {
    console.error("AI report generation error:", err)
    res.status(500).json({ error: "Failed to generate report.", detail: err.message })
  }
})

// ── POST /api/ai/generate/analysis ────────────────────────────────────────────
// Post-game session analysis (called right after finishing a game)
router.post("/generate/analysis", requireAuth, async (req, res) => {
  const { gameTitle, score, accuracy, timeTaken, difficulty, wrongAnswers, correctAnswers } = req.body ?? {}
  if (!gameTitle) return res.status(400).json({ error: "gameTitle is required." })

  const systemPrompt = `You are Blackbuck, a supportive AI tutor. Analyse a student's game performance and give brief, actionable feedback.
Return ONLY valid JSON — no markdown, no extra text.`

  const wrongList  = wrongAnswers?.slice(0, 5).map((w, i) => `${i + 1}. Q: ${w.question} — Wrong: ${w.answer} (Correct: ${w.correct})`).join("\n") ?? "none"
  const userPrompt = `Student just completed: "${gameTitle}"
Score: ${score}, Accuracy: ${accuracy}%, Time: ${timeTaken}s, Difficulty: ${difficulty}

Wrong answers (up to 5):
${wrongList}

Return this exact JSON:
{
  "grade": "A+|A|B|C|D",
  "feedback": "1-2 warm sentences about their performance",
  "mistakePatterns": ["pattern 1 if any", "pattern 2 if any"],
  "focusTip": "One specific tip to improve next time",
  "encouragement": "A motivating closing line"
}`

  try {
    const analysis   = await callGeminiJSON(systemPrompt, userPrompt)
    const tokensUsed = Math.round(JSON.stringify(analysis).length / 4)

    const gen = await prisma.aiGeneration.create({
      data: {
        userId:     req.user.id,
        type:       "analysis",
        prompt:     userPrompt,
        result:     analysis,
        tokensUsed,
      },
    })

    res.json({ success: true, generationId: gen.id, analysis })
  } catch (err) {
    console.error("AI analysis error:", err)
    res.status(500).json({ error: "Failed to generate analysis.", detail: err.message })
  }
})

// ── POST /api/ai/generate/lesson ──────────────────────────────────────────────
// Generate a structured lesson plan
router.post("/generate/lesson", requireAuth, async (req, res) => {
  const { topic, targetCompany, duration, level } = req.body ?? {}
  if (!topic) return res.status(400).json({ error: "topic is required." })

  const systemPrompt = `You are Blackbuck, a smart study planner for Indian engineering students.
Create structured lesson plans optimised for aptitude and placement preparation.
Return ONLY valid JSON — no markdown, no extra text.`

  const company    = targetCompany ? ` for ${targetCompany} placement` : ""
  const userPrompt = `Create a lesson plan for: "${topic}"${company}
Level: ${level ?? "beginner to intermediate"}
Study session: ${duration ?? "45 minutes"}

Return this exact JSON:
{
  "title": "lesson title",
  "overview": "1-2 sentence description",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "sections": [
    {
      "title": "section title",
      "duration": "X minutes",
      "content": "what to study / key concepts",
      "practiceType": "quiz|flashcard|practice problems",
      "tips": "exam tip for this section"
    }
  ],
  "keyFormulas": ["formula or rule 1 if applicable"],
  "commonMistakes": ["mistake to avoid 1", "mistake to avoid 2"],
  "practiceRecommendation": "which TapTap game type to play for this topic"
}`

  try {
    const lesson     = await callGeminiJSON(systemPrompt, userPrompt)
    const tokensUsed = Math.round(JSON.stringify(lesson).length / 4)

    const gen = await prisma.aiGeneration.create({
      data: {
        userId:     req.user.id,
        type:       "lesson",
        prompt:     userPrompt,
        result:     lesson,
        tokensUsed,
      },
    })

    res.json({ success: true, generationId: gen.id, lesson })
  } catch (err) {
    console.error("AI lesson generation error:", err)
    res.status(500).json({ error: "Failed to generate lesson.", detail: err.message })
  }
})

// ── POST /api/ai/mascot/chat ──────────────────────────────────────────────────
// Blackbuck AI companion — conversational chat endpoint
router.post("/mascot/chat", requireAuth, async (req, res) => {
  const { message, history, context } = req.body ?? {}
  if (!message) return res.status(400).json({ error: "message is required." })

  const systemPrompt = `You are Blackbuck, a friendly, witty, and knowledgeable AI study companion for engineering students in India.
You help with aptitude preparation, placement readiness, and concept clarification.
Personality: encouraging, slightly humorous, uses relatable Indian student references.
Keep responses concise (2-4 sentences) unless the student asks for detailed explanation.
Never say you are Google or Gemini — you are Blackbuck, the TapTap mascot.
${context ? `Current context: ${context}` : ""}`

  // Build conversation history string
  const historyText = (history ?? [])
    .slice(-6) // last 3 exchanges
    .map(m => `${m.role === "user" ? "Student" : "Blackbuck"}: ${m.text}`)
    .join("\n")

  const fullPrompt = historyText
    ? `Previous conversation:\n${historyText}\n\nStudent: ${message}`
    : `Student: ${message}`

  try {
    const reply      = await callGemini(systemPrompt, fullPrompt)
    const tokensUsed = Math.round((systemPrompt.length + fullPrompt.length + reply.length) / 4)

    // Store mascot chats as "explanation" type
    await prisma.aiGeneration.create({
      data: {
        userId:     req.user.id,
        type:       "explanation",
        prompt:     message,
        result:     { reply },
        tokensUsed,
      },
    })

    res.json({ success: true, reply })
  } catch (err) {
    console.error("AI mascot chat error:", err)
    res.status(500).json({ error: "Blackbuck is thinking too hard. Try again!", detail: err.message })
  }
})

// ── GET /api/ai/history ───────────────────────────────────────────────────────
router.get("/history", requireAuth, async (req, res) => {
  try {
    const type = req.query.type // optional filter: quiz|flashcard|report|...
    const gens = await prisma.aiGeneration.findMany({
      where: {
        userId: req.user.id,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    50,
      select: {
        id:         true,
        type:       true,
        prompt:     true,
        tokensUsed: true,
        gameId:     true,
        createdAt:  true,
        // Don't return full result in the list — it can be huge
      },
    })

    res.json(gens)
  } catch (err) {
    console.error("GET /api/ai/history error:", err)
    res.status(500).json({ error: "Failed to load generation history." })
  }
})

// ── GET /api/ai/history/:id ───────────────────────────────────────────────────
router.get("/history/:id", requireAuth, async (req, res) => {
  try {
    const gen = await prisma.aiGeneration.findUnique({ where: { id: req.params.id } })
    if (!gen) return res.status(404).json({ error: "Generation not found." })
    if (gen.userId !== req.user.id) return res.status(403).json({ error: "Access denied." })
    res.json(gen)
  } catch (err) {
    console.error("GET /api/ai/history/:id error:", err)
    res.status(500).json({ error: "Failed to load generation." })
  }
})

module.exports = router
