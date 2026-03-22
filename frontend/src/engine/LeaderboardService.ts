import type { LeaderboardEntry } from "../types/engine.types"

const KEY = "taptap_leaderboard"
const MAX_ENTRIES = 100

export class LeaderboardService {
  static getAll(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  static save(entry: Omit<LeaderboardEntry, "id" | "timestamp">): LeaderboardEntry {
    const full: LeaderboardEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    const all = this.getAll()
    all.push(full)
    // Keep top 100 by score
    all.sort((a, b) => b.score - a.score)
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX_ENTRIES)))
    return full
  }

  static getForGame(gameId: string): LeaderboardEntry[] {
    return this.getAll()
      .filter(e => e.gameId === gameId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }

  static getGlobal(): LeaderboardEntry[] {
    return this.getAll()
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
  }

  static clear(): void {
    localStorage.removeItem(KEY)
  }

  static getRank(score: number): number {
    const all = this.getAll()
    return all.filter(e => e.score > score).length + 1
  }
}