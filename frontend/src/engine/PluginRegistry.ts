import type { GamePlugin, PluginId, Question } from "../types/engine.types"

class PluginRegistry {
  private store = new Map<PluginId, GamePlugin>()
  register<Q extends Question>(plugin: GamePlugin<Q>): void {
    if (this.store.has(plugin.id)) throw new Error(`Plugin "${plugin.id}" already registered`)
    this.store.set(plugin.id, plugin as unknown as GamePlugin)
  }
  get(id: PluginId): GamePlugin | undefined { return this.store.get(id) }
  has(id: PluginId): boolean { return this.store.has(id) }
  list(): PluginId[] { return Array.from(this.store.keys()) }
}

export const pluginRegistry = new PluginRegistry()