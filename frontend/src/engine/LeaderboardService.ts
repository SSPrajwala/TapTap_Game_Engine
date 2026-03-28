import type { LeaderboardEntry } from "../types/engine.types"

const KEY     = "taptap_leaderboard_v2"
const MAX     = 100
const API_URL = "http://localhost:3001/api/leaderboard"

export class LeaderboardService {

  // ── Local storage ──────────────────────────────────────────────────────────

  static getAll(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  static save(entry: Omit<LeaderboardEntry, "id" | "timestamp">): LeaderboardEntry {
    const full: LeaderboardEntry = {
      ...entry,
      id:        crypto.randomUUID(),
      timestamp: Date.now(),
    }
    const all = this.getAll()
    all.push(full)
    all.sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken)
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)))
    return full
  }

  static getForGame(gameId: string): LeaderboardEntry[] {
    return this.getAll()
      .filter(e => e.gameId === gameId)
      .sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken)
      .slice(0, 10)
  }

  static getGlobal(): LeaderboardEntry[] {
    return this.getAll()
      .sort((a, b) => b.score - a.score || a.timeTaken - b.timeTaken)
      .slice(0, 20)
  }

  static getRank(score: number, timeTaken: number): number {
    const all = this.getAll()
    return all.filter(e =>
      e.score > score || (e.score === score && e.timeTaken < timeTaken)
    ).length + 1
  }

  static clear(): void {
    localStorage.removeItem(KEY)
  }

  // ── Admin clear — wipes backend DB scores + local cache ───────────────────
  static async clearAll(
    adminName: string,
    accessCode: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_URL}/clear`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ adminName, accessCode }),
        signal:  AbortSignal.timeout(6000),
      })
      const data: { error?: string; message?: string } = await res.json()
      if (!res.ok) return { success: false, message: data.error ?? "Server error." }
      localStorage.removeItem(KEY)   // also wipe local cache
      return { success: true, message: data.message ?? "All scores cleared." }
    } catch {
      return { success: false, message: "Could not reach backend. Try again." }
    }
  }

  // ── Real backend submit ────────────────────────────────────────────────────
  // Posts score to the TapTap backend (localhost:3001).
  // Falls back gracefully if the backend is not running.

  static async submitToAPI(
    entry: LeaderboardEntry,
    authToken?: string | null,
  ): Promise<{ success: boolean; message: string; rank?: number }> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`

      const res = await fetch(`${API_URL}/submit`, {
        method:  "POST",
        headers,
        body:    JSON.stringify({
          playerName: entry.playerName,
          gameId:     entry.gameId,
          gameTitle:  entry.gameTitle,
          score:      entry.score,
          accuracy:   entry.accuracy,
          timeTaken:  entry.timeTaken,
          difficulty: entry.difficulty,
          timestamp:  entry.timestamp,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return {
        success: true,
        message: `Score submitted! Your rank: #${data.rank ?? "?"}`,
        rank:    data.rank,
      }
    } catch {
      return { success: false, message: "Backend unavailable — score saved locally." }
    }
  }

  // ── Fetch global leaderboard from backend ──────────────────────────────────
  // Returns backend data, falls back to localStorage on failure.

  static async fetchGlobal(): Promise<LeaderboardEntry[]> {
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error("not ok")
      const data: Array<{
        id: string; playerName: string; gameId: string; gameTitle: string
        score: number; accuracy: number; totalAnswered: number
        timeTaken: number; difficulty: string; timestamp: number
      }> = await res.json()
      return data.map(d => ({
        id:            d.id,
        playerName:    d.playerName,
        gameId:        d.gameId,
        gameTitle:     d.gameTitle,
        score:         d.score,
        accuracy:      d.accuracy,
        totalAnswered: d.totalAnswered ?? 0,
        timeTaken:     d.timeTaken,
        difficulty:    d.difficulty as "easy" | "medium" | "hard",
        timestamp:     d.timestamp,
      }))
    } catch {
      return this.getGlobal()
    }
  }

  // ── Fetch per-game leaderboard from backend ────────────────────────────────

  static async fetchForGame(gameId: string): Promise<LeaderboardEntry[]> {
    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(gameId)}`, {
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) throw new Error("not ok")
      const data: Array<{
        id: string; playerName: string; gameId: string; gameTitle: string
        score: number; accuracy: number; totalAnswered: number
        timeTaken: number; difficulty: string; timestamp: number
      }> = await res.json()
      return data.map(d => ({
        id:            d.id,
        playerName:    d.playerName,
        gameId:        d.gameId,
        gameTitle:     d.gameTitle,
        score:         d.score,
        accuracy:      d.accuracy,
        totalAnswered: d.totalAnswered ?? 0,
        timeTaken:     d.timeTaken,
        difficulty:    d.difficulty as "easy" | "medium" | "hard",
        timestamp:     d.timestamp,
      }))
    } catch {
      return this.getForGame(gameId)
    }
  }
}
