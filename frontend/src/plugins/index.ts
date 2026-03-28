// ─────────────────────────────────────────────────────────────────────────────
// plugins/index.ts
// The ONLY file that imports and registers plugins.
// To add a new game type: create plugin file → add one line here → done.
// ─────────────────────────────────────────────────────────────────────────────

import { pluginRegistry }    from "../engine/PluginRegistry"
import { QuizPlugin }        from "./quiz/QuizPlugin"
import { PuzzlePlugin }      from "./puzzle/PuzzlePlugin"
import { FlashcardPlugin }   from "./flashcard/FlashcardPlugin"
import { MemoryPlugin }      from "./memory/MemoryPlugin"
import { SudokuPlugin }      from "./sudoku/SudokuPlugin"
import { WordBuilderPlugin } from "./wordbuilder/WordBuilderPlugin"
import { TapBlitzPlugin }    from "./tapblitz/TapBlitzPlugin"

pluginRegistry.register(QuizPlugin)
pluginRegistry.register(PuzzlePlugin)
pluginRegistry.register(FlashcardPlugin)
pluginRegistry.register(MemoryPlugin)
pluginRegistry.register(SudokuPlugin)
pluginRegistry.register(WordBuilderPlugin)
pluginRegistry.register(TapBlitzPlugin)

export { pluginRegistry }