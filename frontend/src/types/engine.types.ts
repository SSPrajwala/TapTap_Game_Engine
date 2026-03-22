// ─────────────────────────────────────────────────────────────────────────────
// engine.types.ts
//
// Single source of truth for ALL types in the engine.
// Your old code had types split across GameLoader.ts and EngineTypes.ts,
// causing the two competing type systems you saw. Everything lives here now.
// ─────────────────────────────────────────────────────────────────────────────

// ── Primitives ────────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard"
export type PluginId   = "quiz" | "puzzle" | string   // open for extension

// ── Questions ─────────────────────────────────────────────────────────────────
// Each question type is a discriminated union member.
// The `type` field is the discriminant — plugins use it to validate ownership.

export interface BaseQuestion {
  id:          string
  type:        string
  difficulty:  Difficulty
  points:      number
  timeLimit?:  number   // seconds; undefined = no timer
  hint?:       string
}

export interface QuizQuestion extends BaseQuestion {
  type:          "quiz"
  prompt:        string
  options:       string[]
  correctIndex:  number
  explanation?:  string
}

export interface PuzzleQuestion extends BaseQuestion {
  type:            "puzzle"
  pattern:         number[]
  sequenceLength:  number
  instruction:     string
}

// Add new question types here as the union grows:
export type Question = QuizQuestion | PuzzleQuestion

// ── Level ─────────────────────────────────────────────────────────────────────

export interface Level {
  id:               string
  title:            string
  description:      string
  questionIds:      string[]     // references Question.id
  passingScore:     number       // 0–100 %
  unlockCondition?: {
    previousLevelId: string
    minScore:        number
  }
}

// ── Adaptive Rules ────────────────────────────────────────────────────────────
// Your old AdaptiveEngine.decide() returned a raw string ("NEXT", "REPEAT").
// Now every rule and every action is fully typed — JSON drives the logic.

export interface AdaptiveRule {
  condition: {
    metric:   "accuracy" | "averageTime" | "streak"
    operator: "<" | ">" | "==" | "<=" | ">="
    value:    number
  }
  action: {
    type:     "adjustDifficulty" | "showHint" | "awardBonus" | "repeatLevel"
    payload?: Record<string, unknown>
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// Your old ScoreEngine.calculate() received a metrics blob and returned a number.
// Now every scoring parameter comes from JSON — zero hardcoding.

export interface ScoringConfig {
  basePoints:            number
  timeBonus:             boolean
  timeBonusPerSecond:    number
  streakMultiplier:      boolean
  streakThreshold:       number
  streakMultiplierValue: number
}

// ── Game Config (the JSON shape) ──────────────────────────────────────────────
// This is what your logic-game.json (and any future JSON) must satisfy.
// Your old GameConfig was missing adaptiveRules and scoring entirely.

export interface GameConfig {
  id:             string
  title:          string
  description:    string
  plugin:         PluginId        // drives which plugin renders the game
  version:        string
  questions:      Question[]
  levels:         Level[]
  adaptiveRules:  AdaptiveRule[]
  scoring:        ScoringConfig
  ui?: {
    showTimer?:    boolean
    showProgress?: boolean
    showStreak?:   boolean
    accentColor?:  string
  }
}

// ── Runtime State ─────────────────────────────────────────────────────────────
// Your old code scattered this across PlayerState, App.tsx useState, and
// QuestionEngine static vars. It all lives here now as a single plain object
// that useReducer owns.

export interface PlayerStats {
  score:           number
  streak:          number
  accuracy:        number    // 0–1
  averageTime:     number    // seconds
  totalAnswered:   number
  correctAnswered: number
  hintsUsed:       number
  difficulty:      Difficulty
}

export interface GameState {
  status:            "idle" | "playing" | "paused" | "levelComplete" | "gameOver"
  currentLevelId:    string
  currentQuestionId: string
  questionIndex:     number
  levelQuestions:    Question[]
  stats:             PlayerStats
  startTime:         number | null
  questionStartTime: number | null
  answeredIds:       Set<string>
}

// ── Answer Result ─────────────────────────────────────────────────────────────

export interface AnswerResult {
  questionId:    string
  correct:       boolean
  pointsAwarded: number
  timeTaken:     number    // seconds (engine measures this, not the plugin)
  feedback:      string
}

// ── Plugin Interface ──────────────────────────────────────────────────────────
// Your old GamePlugin interface only had name + start(level).
// This is the real contract: a typed Component plus a validateQuestion guard.

export interface PluginRenderProps<Q extends Question = Question> {
  question:       Q
  stats:          PlayerStats
  config:         GameConfig
  onAnswer:       (result: AnswerResult) => void
  onRequestHint:  () => void
  isShowingHint:  boolean
  timeRemaining?: number
}

export interface GamePlugin<Q extends Question = Question> {
  id:               PluginId
  name:             string
  handles:          Question["type"][]
  /** Type guard — plugin rejects questions that aren't its shape */
  validateQuestion: (q: Question) => q is Q
  /** The React component that renders this game type's UI */
  Component:        React.ComponentType<PluginRenderProps<Q>>
  /** Optional override of default score calculation */
  calculateScore?:  (
    question:  Q,
    correct:   boolean,
    timeTaken: number,
    scoring:   ScoringConfig
  ) => number
}

// ── Engine Actions (useReducer dispatch) ──────────────────────────────────────
// Your old EngineCore.run() was a static one-shot call from handleAnswer().
// Now the engine is a pure reducer driven by these typed actions.

export type EngineAction =
  | { type: "START_GAME" }
  | { type: "SUBMIT_ANSWER"; payload: { questionId: string; correct: boolean; timeTaken: number } }
  | { type: "REQUEST_HINT" }
  | { type: "NEXT_QUESTION" }
  | { type: "NEXT_LEVEL" }
  | { type: "RESTART" }

// ── Engine Events (observable side-effects) ───────────────────────────────────
// Replaces your AnalyticsEngine.logEvent() calls scattered in App.tsx.
// Subscribe once in GameRenderer; the engine emits; analytics stays clean.

export type EngineEvent =
  | { type: "ANSWER_SUBMITTED";  payload: AnswerResult }
  | { type: "LEVEL_COMPLETE";    payload: { levelId: string; score: number; passed: boolean } }
  | { type: "DIFFICULTY_CHANGED";payload: { from: Difficulty; to: Difficulty } }
  | { type: "HINT_REQUESTED";    payload: { questionId: string } }
  | { type: "GAME_OVER";         payload: { finalScore: number; accuracy: number } }

export type EngineEventListener = (event: EngineEvent) => void