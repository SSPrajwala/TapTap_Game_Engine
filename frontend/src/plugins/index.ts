// ─────────────────────────────────────────────────────────────────────────────
// plugins/index.ts  — the ONLY file that imports and registers plugins.
//
// GameRenderer and App.tsx never import plugins directly.
// Adding a new game type = add one line here + create the plugin file.
// ─────────────────────────────────────────────────────────────────────────────

import { pluginRegistry } from "../engine/PluginRegistry"
import { QuizPlugin }     from "./quiz/QuizPlugin"
import { PuzzlePlugin }   from "./puzzle/PuzzlePlugin"

pluginRegistry.register(QuizPlugin)
pluginRegistry.register(PuzzlePlugin)

export { pluginRegistry }