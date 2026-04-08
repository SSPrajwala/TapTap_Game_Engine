export type Difficulty = "easy" | "medium" | "hard"
export type PluginId = "quiz" | "puzzle" | "flashcard" | "memory" | "sudoku" | "wordbuilder" | string

export interface BaseQuestion {
  id: string
  type: string
  difficulty: Difficulty
  points: number
  timeLimit?: number
  hint?: string
}

export interface QuizQuestion extends BaseQuestion {
  type: "quiz"
  prompt: string
  options: string[]
  correctIndex: number
  explanation?: string
}

export interface PuzzleQuestion extends BaseQuestion {
  type: "puzzle"
  pattern: number[]
  sequenceLength: number
  instruction: string
}

export interface FlashcardQuestion extends BaseQuestion {
  type: "flashcard"
  front: string
  back: string
  category?: string
}

export interface MemoryQuestion extends BaseQuestion {
  type: "memory"
  pairs: { id: string; label: string; emoji: string }[]
  instruction: string
}

// ── Sudoku ────────────────────────────────────────────────────────────────────
// board: 81-char string, 0 = empty cell, 1-9 = given digits
// solution: 81-char string with full solution
export interface SudokuQuestion extends BaseQuestion {
  type: "sudoku"
  board: string
  solution: string
  instruction: string
}

// ── Word Builder ──────────────────────────────────────────────────────────────
// letters: shuffled letters the player uses to build words
// validWords: all accepted answers (player needs to find targetCount of them)
// targetCount: minimum words player must find to pass
export interface WordBuilderQuestion extends BaseQuestion {
  type: "wordbuilder"
  letters: string[]
  validWords: string[]
  targetCount: number
  instruction: string
  bonusWords?: string[]   // extra hard words worth bonus points
}

// ── TapBlitz (motion aim game) ────────────────────────────────────────────────
export interface TapBlitzQuestion extends BaseQuestion {
  type: "tapblitz"
  instruction: string
  duration: number          // wave seconds
  spawnRate: number         // targets per second
  targetLifetime: number    // seconds before vanish
  targetSpeed: number       // drift pixels/sec
  targetMinRadius: number
  targetMaxRadius: number
  maxMisses: number
}

// ── Binary Runner (3-lane endless runner with logic gate challenges) ──────────
export interface BinaryRunnerQuestion extends BaseQuestion {
  type: "binaryrunner"
  instruction:    string
  duration:       number    // stage seconds
  initialSpeed:   number    // units/sec (try 60)
  maxSpeed:       number    // speed cap (try 180)
  speedRampPerSec: number   // speed increase per second (try 2)
  spawnInterval:  number    // seconds between obstacles (try 2.8)
  operations:     string[]  // e.g. ["AND","OR","XOR","NAND","NOR"]
}

export type Question =
  | QuizQuestion
  | PuzzleQuestion
  | FlashcardQuestion
  | MemoryQuestion
  | SudokuQuestion
  | WordBuilderQuestion
  | TapBlitzQuestion
  | BinaryRunnerQuestion

export interface Level {
  id: string
  title: string
  description: string
  questionIds: string[]
  passingScore: number
  unlockCondition?: { previousLevelId: string; minScore: number }
}

export interface AdaptiveRule {
  condition: {
    metric: "accuracy" | "averageTime" | "streak"
    operator: "<" | ">" | "==" | "<=" | ">="
    value: number
  }
  action: {
    type: "adjustDifficulty" | "showHint" | "awardBonus" | "repeatLevel"
    payload?: Record<string, unknown>
  }
}

export interface ScoringConfig {
  basePoints: number
  timeBonus: boolean
  timeBonusPerSecond: number
  streakMultiplier: boolean
  streakThreshold: number
  streakMultiplierValue: number
  penalties?: boolean
  penaltyPerWrong?: number
}

export interface GameConfig {
  id: string
  title: string
  description: string
  plugin: PluginId
  version: string
  questions: Question[]
  levels: Level[]
  adaptiveRules: AdaptiveRule[]
  scoring: ScoringConfig
  ui?: {
    showTimer?: boolean
    showProgress?: boolean
    showStreak?: boolean
    accentColor?: string
    emoji?: string
  }
  // ── Database / ownership fields (populated from API) ─────────────────────
  visibility?:       "public" | "private"
  createdBy?:        string | null   // userId of creator, null = admin/system
  learningOutcomes?: string[]        // e.g. ["logical_reasoning","algorithms"]
  aptitudeTags?:     string[]        // e.g. ["TCS_NQT","Infosys"]
  isAiGenerated?:    boolean
}

export interface PlayerStats {
  score: number
  streak: number
  accuracy: number
  averageTime: number
  totalAnswered: number
  correctAnswered: number
  hintsUsed: number
  difficulty: Difficulty
}

export interface GameState {
  status: "idle" | "playing" | "paused" | "levelComplete" | "gameOver"
  currentLevelId: string
  currentQuestionId: string
  questionIndex: number
  levelQuestions: Question[]
  stats: PlayerStats
  startTime: number | null
  questionStartTime: number | null
  answeredIds: Set<string>
}

export interface AnswerResult {
  questionId: string
  correct: boolean
  pointsAwarded: number
  timeTaken: number
  feedback: string
}

export interface PluginRenderProps<Q extends Question = Question> {
  question: Q
  stats: PlayerStats
  config: GameConfig
  onAnswer: (result: AnswerResult) => void
  onRequestHint: () => void
  isShowingHint: boolean
  timeRemaining?: number
}

export interface GamePlugin<Q extends Question = Question> {
  id: PluginId
  name: string
  handles: Question["type"][]
  validateQuestion: (q: Question) => q is Q
  Component: React.ComponentType<PluginRenderProps<Q>>
  calculateScore?: (q: Q, correct: boolean, timeTaken: number, scoring: ScoringConfig) => number
}

export type EngineAction =
  | { type: "START_GAME" }
  | { type: "SUBMIT_ANSWER"; payload: { questionId: string; correct: boolean; timeTaken: number } }
  | { type: "REQUEST_HINT" }
  | { type: "NEXT_QUESTION" }
  | { type: "NEXT_LEVEL" }
  | { type: "RESTART" }

export type EngineEvent =
  | { type: "ANSWER_SUBMITTED";   payload: AnswerResult }
  | { type: "LEVEL_COMPLETE";     payload: { levelId: string; score: number; passed: boolean } }
  | { type: "DIFFICULTY_CHANGED"; payload: { from: Difficulty; to: Difficulty } }
  | { type: "HINT_REQUESTED";     payload: { questionId: string } }
  | { type: "GAME_OVER";          payload: { finalScore: number; accuracy: number } }

export type EngineEventListener = (event: EngineEvent) => void

export interface LeaderboardEntry {
  id: string
  playerName: string
  gameId: string
  gameTitle: string
  score: number
  accuracy: number
  totalAnswered: number
  timeTaken: number        // total seconds for the game session
  difficulty: Difficulty
  timestamp: number
}