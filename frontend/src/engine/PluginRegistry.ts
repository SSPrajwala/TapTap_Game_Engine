// ─────────────────────────────────────────────────────────────────────────────
// PluginRegistry.ts
//
// Your old QuizPlugin had: name, start(level) → console.log only.
// GameRenderer never called it. The plugin field in JSON did nothing.
//
// Now config.plugin is the lookup key. pluginRegistry.get("quiz") returns the
// full GamePlugin with its typed React Component. GameRenderer never imports
// plugin files directly — all coupling goes through this registry.
// ─────────────────────────────────────────────────────────────────────────────

import type { GamePlugin, PluginId, Question } from "../types/engine.types"

class PluginRegistry {
  private store = new Map<PluginId, GamePlugin>()

  register<Q extends Question>(plugin: GamePlugin<Q>): void {
    if (this.store.has(plugin.id)) {
      throw new Error(
        `PluginRegistry: "${plugin.id}" already registered. IDs must be unique.`
      )
    }
    this.store.set(plugin.id, plugin as unknown as GamePlugin)
  }

  get(id: PluginId): GamePlugin | undefined {
    return this.store.get(id)
  }

  has(id: PluginId): boolean {
    return this.store.has(id)
  }

  list(): PluginId[] {
    return Array.from(this.store.keys())
  }
}

// Singleton — import { pluginRegistry } from anywhere
export const pluginRegistry = new PluginRegistry()