# ⚡ TapTap Adaptive Game Engine

> **A reusable, plugin-based, JSON-driven game engine framework for gamified learning — built for the TapTap × Blackbucks Hackathon 2026**

🎮 **Live Demo:** [taptapadaptivegameenginedeployed7.vercel.app](https://taptapadaptivegameenginedeployed7.vercel.app/)
📁 **Repository:** [github.com/SSPrajwala/taptap_adaptive_game_engine_deployed](https://github.com/SSPrajwala/taptap_adaptive_game_engine_deployed)

---

## 🌟 What is TapTap Game Engine?

TapTap is not just one game — it is the **infrastructure that hosts unlimited games**. Every aspect of gameplay — questions, levels, rules, scoring, difficulty — is controlled entirely by JSON configuration files. Changing one line in a JSON file changes the game behaviour. No code changes required.

The engine supports **8 game types** including real-time canvas motion games, a full WebSocket multiplayer live session system, AI-generated content, procedural sound effects, skill/XP progression tracking, and a live admin panel — all driven by a pure Redux-style reducer.

---

## 🏗️ Architecture Overview

```
taptap_adaptive_game_engine/
├── backend/                            ← Node.js + Express + Socket.io
│   ├── server.js                       ← Entry point, CORS, REST + WS mount
│   ├── roomManager.js                  ← In-memory Kahoot-style room state
│   ├── socketHandlers.js               ← All Socket.io handlers (rooms + live game)
│   └── taptap_db.json                  ← Persisted game configs (admin panel edits)
│
└── frontend/src/
    ├── types/engine.types.ts           ← Single source of truth for all TypeScript types
    ├── engine/
    │   ├── EngineCore.ts               ← Pure reducer: reduce(state, action) → GameState
    │   ├── ScoreEngine.ts              ← Points, time bonus, streak multiplier
    │   ├── AdaptiveEngine.ts           ← JSON-driven adaptive difficulty logic
    │   ├── LevelManager.ts             ← Level progression + unlock conditions
    │   └── LeaderboardService.ts       ← Local + backend leaderboard, skill submission
    ├── plugins/
    │   ├── index.ts                    ← ONLY file that registers plugins
    │   ├── quiz/QuizPlugin.tsx         ← Multiple choice with timer + streak
    │   ├── puzzle/PuzzlePlugin.tsx     ← Number sequence pattern detection
    │   ├── flashcard/FlashcardPlugin.tsx  ← Flip-card self-assessment
    │   ├── memory/MemoryPlugin.tsx     ← Card pair matching game
    │   ├── sudoku/SudokuPlugin.tsx     ← Full 9×9 Sudoku with conflict detection
    │   ├── wordbuilder/WordBuilderPlugin.tsx  ← Letter-tile word building
    │   ├── tapblitz/TapBlitzPlugin.tsx ← Motion canvas: tap moving targets
    │   └── binaryrunner/BinaryRunnerPlugin.tsx  ← Motion canvas: steer lane
    ├── services/
    │   ├── AIService.ts                ← Groq-powered AI game generation
    │   └── SoundEngine.ts              ← Web Audio API procedural sound effects
    ├── utils/
    │   └── GameSkillMapper.ts          ← Maps game types to skill area tags
    ├── games/                          ← 8 pre-built JSON game configs
    ├── components/
    │   ├── GameRenderer.tsx            ← Dynamic renderer — zero plugin coupling
    │   └── ui/
    │       ├── HowToPlayModal.tsx      ← Reusable how-to overlay + help button
    │       ├── Confetti.tsx, DeerMascot.tsx, SplashScreen.tsx, TopRibbon.tsx
    ├── hooks/
    │   ├── useGameEngine.ts            ← Wires useReducer + timer + hints
    │   └── useMultiplayerRoom.ts       ← Full multiplayer state machine
    ├── context/
    │   └── AuthContext.tsx             ← JWT login / register / token persistence
    └── pages/
        ├── LiveRoomPage.tsx            ← Live session: independent per-player flow
        ├── MultiplayerPage.tsx         ← Kahoot-style lobby + countdown
        ├── LeaderboardPage.tsx         ← Global + per-game leaderboard
        └── AdminPanel.tsx              ← Live game config editor
```

---

## 🚀 Clone & Run Locally

### Prerequisites
- Node.js v18+ and npm v9+
- A free [Groq API key](https://console.groq.com/) (for AI-generated games — optional)

### Step 1 — Clone the repository
```bash
git clone https://github.com/SSPrajwala/taptap_adaptive_game_engine_deployed.git
cd taptap_adaptive_game_engine_deployed
```

### Step 2 — Configure environment variables

**Frontend** — create `frontend/.env`:
```env
# Required: Your Groq API key (for AI game generation)
VITE_GROQ_API_KEY=gsk_your_key_here

# Optional: Override backend URL (default: http://localhost:3001/api)
VITE_API_URL=http://localhost:3001/api
```

> ⚠️ **Security:** Never commit `.env` to git. The repo `.gitignore` already excludes it.
> The Groq key is called only from the browser; use Groq's allowed-origin settings or a server-side proxy in production for stronger protection.

**Backend** — create `backend/.env` (optional):
```env
PORT=3001
ADMIN_ACCESS_CODE=your_secret_admin_code
JWT_SECRET=your_jwt_secret_here
```

### Step 3 — Install and run

**Frontend only** (static games work without a backend):
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

**Full stack** (multiplayer + leaderboard persistence):
```bash
# Terminal 1 — backend
cd backend
npm install
node server.js          # http://localhost:3001

# Terminal 2 — frontend
cd frontend
npm install
npm run dev             # http://localhost:5173
```

### Step 4 — TypeScript type-check (optional)
```bash
cd frontend
npx tsc -b --noEmit     # should produce zero errors
```

---

## 🎮 Game Plugins (8 Types)

| Plugin | Type | Key Features |
|--------|------|-------------|
| `quiz` | Multiple Choice | Timer bar, hints, explanations, streak bonus, correct/wrong sounds |
| `puzzle` | Pattern Sequence | Arithmetic, geometric, quadratic sequence detection |
| `flashcard` | Flip Card | Card flip sound, self-graded with category tags |
| `memory` | Grid Match | Card flip/match sounds, shuffle, animated reveals |
| `sudoku` | Grid | Full 9×9 with conflict detection and numpad |
| `wordbuilder` | Letter Tiles | Timer bar, bonus words, missed-word reveal, all sounds |
| `tapblitz` | Motion Canvas | Moving targets, combo multiplier, particle effects |
| `binaryrunner` | Motion Canvas | 3D perspective runner, logic gate challenges, color-reveal at impact |

### Motion Games
TapBlitz and Binary Runner are **canvas-rendered real-time games** featuring:
- 3-2-1 countdown that **pauses** when the How-to-Play modal is open
- Auto-advance to next wave/stage (no manual Next button needed)
- A floating "?" help button during gameplay
- Neon visual design with glow effects and particle bursts
- **Binary Runner:** block colours are hidden until the exact moment of impact — no early hints

### WordBuilder Details
- Prominent countdown timer bar (green → yellow → red) with pulsing ⚠️ warning at ≤10s
- Auto-submits when timer hits 0
- Shows missed valid words after round ends (up to 12)
- Progress dots showing how many words found toward target count
- Finish Round button when target reached

---

## 🔊 Sound Engine

The engine includes a **zero-dependency procedural audio system** built entirely on the Web Audio API. No external sound files or libraries are used — every sound is synthesised in real time.

**Sound events:**
- `click` — button presses and navigation
- `letterClick` — letter tile taps in WordBuilder
- `wordFound` — valid word added (major chord arpeggio)
- `bonusWord` — bonus word found (ascending sparkle)
- `correct` — correct quiz/flashcard answer (rising 3-tone)
- `wrong` — incorrect answer (descending sawtooth)
- `shake` — invalid input shake animation
- `streak` — streak milestone at 3, 5, 10 consecutive correct answers
- `timerWarn` — square wave beep at 10s remaining
- `levelComplete` — level/wave completed (4-tone ascent)
- `gameWin` — full game complete (fanfare + chord)
- `cardFlip` — memory/flashcard flip
- `pairMatch` — memory card pair matched
- `runnerHit` — Binary Runner correct lane
- `runnerMiss` — Binary Runner wrong lane

Volume is controllable: `SoundEngine.setVolume(0.5)` (0.0–1.0). AudioContext is auto-resumed on first user interaction (browser policy).

---

## 🧠 JSON-Driven Gameplay

**Everything** is controlled by JSON. Change the JSON → change the game behaviour. No code touch required.

```json
{
  "id": "my-game",
  "plugin": "quiz",
  "title": "My Awesome Quiz",
  "description": "Test your knowledge!",
  "learningOutcomes": ["logical_reasoning", "algorithms"],
  "aptitudeTags": ["analytical", "technical"],
  "questions": [{
    "id": "q1",
    "type": "quiz",
    "difficulty": "easy",
    "points": 100,
    "timeLimit": 30,
    "prompt": "What is 2 + 2?",
    "options": ["3", "4", "5", "6"],
    "correctIndex": 1,
    "hint": "Think basic addition",
    "explanation": "2 + 2 = 4, always."
  }],
  "levels": [{
    "id": "level-1",
    "title": "Level 1",
    "description": "Warm-up",
    "questionIds": ["q1"],
    "passingScore": 60
  }],
  "adaptiveRules": [{
    "condition": { "metric": "accuracy", "operator": ">=", "value": 0.8 },
    "action": { "type": "adjustDifficulty", "payload": { "difficulty": "hard" } }
  }],
  "scoring": {
    "basePoints": 100,
    "timeBonus": true,
    "timeBonusPerSecond": 3,
    "streakMultiplier": true,
    "streakThreshold": 3,
    "streakMultiplierValue": 1.5
  },
  "ui": { "showTimer": true, "showProgress": true, "showStreak": true, "emoji": "🧮" }
}
```

---

## 🤖 AI-Generated Games

Players can generate entirely new games on demand using Groq AI (llama-3.3-70b-versatile). The AI:
- Generates complete JSON game configs for all 8 plugin types
- Creates engaging, high-energy questions with plausible distractors
- Automatically sets `learningOutcomes` and `aptitudeTags`
- Validates letter coverage in WordBuilder (every word uses only given letters)
- Injects timing, hints, and explanations automatically

The AI is called directly from the browser using `VITE_GROQ_API_KEY`. For production, proxy the API key through your backend for security.

---

## 🏆 Skill / XP Progression System

Every game has a `learningOutcomes` array that links it to skill areas. When a player finishes a game and saves their score, the backend upserts their skill XP:

**Skill areas include:** `logical_reasoning`, `algorithms`, `pattern_recognition`, `verbal_reasoning`, `numerical_ability`, `vocabulary`, `spatial_reasoning`, `data_interpretation`, `coding`, `analytical_thinking`, and more.

The `GameSkillMapper` utility provides a fallback skill derivation from game type + config when `learningOutcomes` is not set in the JSON.

---

## 🌐 Real-Time Multiplayer

### Kahoot-Style Room System (`MultiplayerPage`)
1. Host creates a room → gets a 6-character code (e.g. `XKT9Q2`)
2. Guests enter the code and name → join the lobby
3. Host picks any game → clicks Start → 3-2-1 countdown
4. All players answer simultaneously, live leaderboard updates after each answer
5. Final scoreboard shows rank, score, and accuracy for all players

**Reconnect resilience:** every browser tab gets a persistent player ID stored in `sessionStorage`. If a player refreshes, the server restores them to their room automatically (12-second grace period).

### Independent Live Game System (`LiveRoomPage`)
A second, more advanced multiplayer mode where each player advances through questions at their **own pace**:
- Each player gets their own per-question countdown timer (30s per question)
- Answering a question immediately shows the next one — no waiting for others
- After finishing all questions, a "Waiting for others..." overlay is displayed
- Results are revealed when all players finish OR a server-side timeout fires
- Live leaderboard updates in real time as players answer

### Socket.io Event Contract

**Room system (Kahoot-style):**
| Direction | Event | Description |
|-----------|-------|-------------|
| Client → Server | `room:create` | Create a new room |
| Client → Server | `room:join` | Join by code |
| Client → Server | `room:selectGame` | Host picks a game |
| Client → Server | `room:start` | Host starts countdown |
| Client → Server | `game:answer` | Submit answer |
| Server → Client | `room:updated` | Any room state change |
| Server → Client | `game:start` | Game begins |
| Server → Client | `game:scoreUpdate` | Leaderboard after answer |
| Server → Client | `game:end` | Final leaderboard |

**Live game system (independent flow):**
| Direction | Event | Description |
|-----------|-------|-------------|
| Client → Server | `lobby:game:answer` | Answer with `{ sessionId, correct, points, questionIndex }` |
| Server → Client | `lobby:game:start` | Game begins with `questionTimeLimit` |
| Server → Client | `lobby:game:score` | Live leaderboard update |
| Server → Client | `lobby:game:player_done` | A player finished all questions |
| Server → Client | `lobby:game:end` | Final results for all players |

---

## 🧠 Adaptive Difficulty Engine

The adaptive engine reads rules from JSON and modifies difficulty in real time:

```json
"adaptiveRules": [
  { "condition": { "metric": "accuracy", "operator": ">=", "value": 0.8 },
    "action": { "type": "adjustDifficulty", "payload": { "difficulty": "hard" } } },
  { "condition": { "metric": "accuracy", "operator": "<",  "value": 0.4 },
    "action": { "type": "adjustDifficulty", "payload": { "difficulty": "easy" } } }
]
```

The **Adaptive Engine Live Panel** (collapsible at the bottom of any game) shows: current difficulty, accuracy, score, streak, progress, and the engine's next decision — all in real time.

---

## 🔌 Adding a New Game Type (4 Steps)

**Step 1 — Add type to `engine.types.ts`:**
```ts
export interface MyQuestion extends BaseQuestion {
  type: "mygame"
  myField: string
}
export type Question = QuizQuestion | ... | MyQuestion
```

**Step 2 — Create plugin:**
```tsx
// src/plugins/mygame/MyGamePlugin.tsx
export const MyGamePlugin: GamePlugin<MyQuestion> = {
  id: "mygame",
  handles: ["mygame"],
  validateQuestion(q): q is MyQuestion { return q.type === "mygame" },
  Component: MyGameComponent,
}
```

**Step 3 — Register in `src/plugins/index.ts`:**
```ts
pluginRegistry.register(MyGamePlugin)
```

**Step 4 — Create a JSON config with `"plugin": "mygame"`**

✅ Zero other files change. The engine picks it up automatically.

---

## 🔐 Security Notes

- **API keys:** Store `VITE_GROQ_API_KEY` in `.env` (excluded from git via `.gitignore`). In production, proxy Groq calls through your backend to hide the key from browser devtools.
- **JWT Auth:** The backend issues JWT tokens for registered users. Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>` headers.
- **Admin access code:** The Admin Panel requires a secret code stored server-side in `backend/.env` as `ADMIN_ACCESS_CODE`. Never hardcode it.
- **CORS:** The backend allows only your Vercel frontend URL in production. Update `server.js` `ALLOWED_ORIGINS` when you deploy.
- **Input sanitisation:** All user-typed inputs (player names, chat) are trimmed and length-limited before being broadcast over Socket.io.

---

## 🆓 Free Deployment Guide

The frontend and backend deploy to different platforms — both have generous free tiers.

### Frontend → Vercel (Free)

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   - `VITE_GROQ_API_KEY` = your Groq API key
   - `VITE_API_URL` = your Render backend URL (set after step below)
5. Click **Deploy** — Vercel auto-deploys on every `git push`

### Backend → Render (Free)

1. Go to [render.com](https://render.com) → **New Web Service** → connect GitHub repo
2. Set **Root Directory** to `backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables:
   - `ADMIN_ACCESS_CODE` = your secret admin code
   - `JWT_SECRET` = a random 32-character string
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app`
6. Click **Deploy** — Render gives you a URL like `https://taptap-backend.onrender.com`
7. Copy that URL + `/api` → paste into Vercel's `VITE_API_URL` variable

> **Note on Render free tier:** Free services spin down after 15 minutes of inactivity and take ~30 seconds to wake up on the next request. This is fine for demos. For always-on production, upgrade to the $7/month Starter plan.

### Alternative: Backend → Railway (Free trial)

1. Go to [railway.app](https://railway.app) → **New Project** → Deploy from GitHub
2. Select the `backend` folder, set `PORT=3001`
3. Railway provides a persistent URL with free trial credits

---

## ⚙️ Admin Panel

The Admin Panel (`/admin`) allows changing game content without touching code:

- **Questions tab:** Add, edit, delete questions with live preview. Set correct answer with one click.
- **Levels tab:** Assign/remove questions from levels. Drag to reorder.
- **Settings tab:** Change title, description, scoring config, timing, and UI flags.

Changes are saved to `taptap_db.json` on the backend and immediately reflected for all players — no restart needed.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9 (strict mode) |
| Build | Vite 6 |
| State | useReducer pure reducer pattern |
| Realtime | Socket.io (WebSocket + polling fallback) |
| Canvas | HTML5 Canvas 2D API (motion games) |
| Audio | Web Audio API — zero dependencies, procedural |
| AI | Groq API — llama-3.3-70b-versatile |
| Backend | Node.js + Express 4 |
| Database | JSON file (taptap_db.json) + in-memory Maps |
| Auth | JWT (jsonwebtoken) |
| Styling | CSS Variables, custom neon dark design system |
| Fonts | Orbitron (display), Exo 2 (body) |
| Deployment | Vercel (frontend) + Render/Railway (backend) |

---

## 📊 Judging Criteria — How We Satisfy Each

| Criterion | Weight | How Satisfied |
|-----------|--------|--------------|
| Functionality & Stability | 30% | 8 fully playable plugins, independent multiplayer, adaptive difficulty, TypeScript strict, zero compile errors |
| Architecture & Reusability | 25% | Plugin registry pattern, pure reducer, JSON config, zero coupling, skill mapper, sound engine abstraction |
| UI/UX Design | 20% | Neon dark theme, canvas motion games, procedural sounds, animated mascot, glassmorphism, particle effects |
| Code Quality | 15% | TypeScript strict mode, separated concerns, single-responsibility modules, persistent player identity |
| Innovation & Creativity | 10% | Live independent multiplayer flow, AI game generation, procedural audio, adaptive engine with live panel, skill XP system |

---

## 👤 Developer

**S. S. Prajwala**
B.Tech CSE — KITS Warangal
TapTap × Blackbucks Hackathon 2026 — League 1: Engine League

---

## 📄 License

Built for the TapTap Hackathon. Original work only. All rights reserved.
