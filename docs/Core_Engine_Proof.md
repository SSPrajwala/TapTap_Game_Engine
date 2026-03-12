
# Core Engine Proof – Milestone 2

## Overview

The **TaPTaP Adaptive Learning Game Engine** is a modular, configuration-driven system designed to generate multiple learning games from a single reusable engine.

The core engine demonstrates how a learning game can be defined using **JSON configuration**, executed through the **engine core**, and extended through a **plugin architecture**.

This milestone proves that the engine can:

* Load game configurations dynamically
* Manage game levels
* Adapt gameplay difficulty
* Calculate player scores
* Support multiple game types using plugins

---

# Engine Architecture

The engine follows a **modular architecture** where each module is responsible for a specific system function.

```
JSON Game Config
        ↓
    GameLoader
        ↓
    EngineCore
        ↓
   PluginManager
        ↓
   GamePlugin
        ↓
AdaptiveEngine → ScoreEngine
        ↓
    LevelManager
```

### EngineCore

The **EngineCore** acts as the central orchestrator of the system.

Responsibilities:

* Initializes game configuration
* Coordinates engine modules
* Executes gameplay flow
* Integrates plugins

---

### GameLoader

Loads and validates the JSON game configuration.

Responsibilities:

* Validate game structure
* Ensure levels are defined
* Provide game data to the engine

Example configuration:

```json
{
  "gameName": "Logical Reasoning Challenge",
  "plugin": "quiz",
  "levels": [
    { "levelId": 1, "difficulty": "easy", "timeLimit": 60 }
  ]
}
```

---

### LevelManager

Controls level progression within the game.

Responsibilities:

* Track current level
* Apply adaptive decisions
* Move player between levels

---

### AdaptiveEngine

Implements adaptive learning logic.

It evaluates player performance using:

* accuracy
* response time
* attempts

Based on these metrics, it decides:

```
NEXT
REPEAT
DOWNGRADE
```

This allows the engine to dynamically adjust difficulty.

---

### ScoreEngine

Calculates the player's score based on performance metrics.

Example inputs:

```
accuracy
responseTime
attempts
```

Outputs a numerical score used to evaluate gameplay performance.

---

### Plugin Architecture

The engine supports **multiple game types** using a plugin system.

Each game plugin implements the `GamePlugin` interface.

Example plugin:

```
QuizPlugin
```

Plugins can define unique gameplay behavior while still using the same engine core.

This architecture allows the engine to support future game types such as:

* quiz games
* memory challenges
* vocabulary games
* math puzzles

---

# Project Structure

```
frontend/src
│
├── engine
│   ├── EngineCore.ts
│   ├── GameLoader.ts
│   ├── LevelManager.ts
│   ├── AdaptiveEngine.ts
│   ├── ScoreEngine.ts
│   ├── PluginManager.ts
│   │
│   └── plugins
│       ├── GamePlugin.ts
│       └── QuizPlugin.ts
│
├── games
│   └── logic-game.json
│
├── App.tsx
└── main.tsx
```

---

# Execution Proof

The engine is integrated with a React UI to demonstrate execution.

Example output:

```
TapTap Adaptive Game Engine

Game: Logical Reasoning Challenge
Level: 1
Decision: NEXT
Score: 910
```

This confirms that:

* JSON configuration loads successfully
* Engine modules execute in sequence
* Plugin system operates correctly
* Adaptive and scoring systems function as expected

---

# Key Features Demonstrated

✔ JSON-driven game configuration
✔ Modular engine architecture
✔ Plugin-based game types
✔ Adaptive learning logic
✔ Dynamic scoring system

---

# Next Milestone

The next phase focuses on **Prototype Build**, where the engine will be extended with:

* QuestionEngine (content loading)
* PlayerState tracking
* AnalyticsEngine
* Dynamic game rendering

These additions will allow the engine to generate **fully playable learning games** from configuration.


