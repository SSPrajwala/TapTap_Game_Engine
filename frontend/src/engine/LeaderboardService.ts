import type { LeaderboardEntry } from "../types/engine.types"

const KEY      = "taptap_leaderboard_v2"
const MAX      = 100
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"
const API_URL  = `${API_BASE}/leaderboard`

// ── New aggregated types returned by the redesigned backend ──────────────────

/** One row in the per-game breakdown inside the Global ⓘ popover */
export interface GameBreakdown {
  gameTitle:   string
  plays:       number
  bestScore:   number
  totalScore:  number
  avgAccuracy: number   // 0-100
  bestTime:    number   // seconds
}

/** One individual play attempt inside the Per-game ⓘ popover */
export interface AttemptDetail {
  score:      number
  accuracy:   number   // 0-100
  timeTaken:  number   // seconds
  difficulty: string
  timestamp:  number   // ms since epoch
}

/** One row in the global leaderboard (one entry per player across all games) */
export interface GlobalPlayerEntry {
  playerName:    string
  college:       string
  totalScore:    number
  avgAccuracy:   number   // 0-100
  gamesPlayed:   number   // unique game count
  totalSessions: number
  timestamp:     number   // last played ms
  breakdown:     GameBreakdown[]
}

/** One row in the per-game leaderboard (one entry per player for a specific game) */
export interface GamePlayerEntry {
  playerName:  string
  college:     string
  bestScore:   number
  totalScore:  number
  avgAccuracy: number   // 0-100
  attempts:    number
  timestamp:   number   // last played ms
  allAttempts: AttemptDetail[]
}

/** A game item returned by GET /api/leaderboard/games */
export interface GameListItem {
  gameId:    string
  gameTitle: string
}

// ─────────────────────────────────────────────────────────────────────────────

export class LeaderboardService {

  // ── Local storage (legacy / offline fallback) ─────────────────────────────

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
  static async submitToAPI(
    entry: LeaderboardEntry,
    authToken?: string | null,
    learningOutcomes?: string[],
  ): Promise<{ success: boolean; message: string; rank?: number }> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`

      const res = await fetch(`${API_URL}/submit`, {
        method:  "POST",
        headers,
        body:    JSON.stringify({
          playerName:      entry.playerName,
          gameId:          entry.gameId,
          gameTitle:       entry.gameTitle,
          score:           entry.score,
          accuracy:        entry.accuracy,
          totalAnswered:   entry.totalAnswered,
          correctCount:    entry.totalAnswered ? Math.round(entry.accuracy * entry.totalAnswered) : 0,
          timeTaken:       entry.timeTaken,
          difficulty:      entry.difficulty,
          timestamp:       entry.timestamp,
          learningOutcomes: learningOutcomes ?? [],
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

  // ── Fetch list of games that have sessions ─────────────────────────────────
  static async fetchGameList(): Promise<GameListItem[]> {
    try {
      const res = await fetch(`${API_URL}/games`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error("not ok")
      return await res.json() as GameListItem[]
    } catch {
      // Build game list from local storage as fallback
      const all  = this.getAll()
      const seen = new Map<string, string>()
      for (const e of all) seen.set(e.gameId, e.gameTitle ?? e.gameId)
      return Array.from(seen.entries()).map(([gameId, gameTitle]) => ({ gameId, gameTitle }))
    }
  }

  // ── Fetch global aggregated leaderboard from backend ──────────────────────
  // Returns one GlobalPlayerEntry per player (sorted by totalScore).
  static async fetchGlobal(): Promise<GlobalPlayerEntry[]> {
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error("not ok")
      return await res.json() as GlobalPlayerEntry[]
    } catch {
      // Fallback: aggregate local storage
      return this._aggregateLocalGlobal()
    }
  }

  // ── Fetch per-game aggregated leaderboard from backend ────────────────────
  // Returns one GamePlayerEntry per player for that game (sorted by bestScore).
  static async fetchForGame(gameId: string): Promise<GamePlayerEntry[]> {
    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(gameId)}`, {
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) throw new Error("not ok")
      return await res.json() as GamePlayerEntry[]
    } catch {
      return this._aggregateLocalForGame(gameId)
    }
  }

  // ── Local-storage aggregation fallbacks ───────────────────────────────────

  private static _aggregateLocalGlobal(): GlobalPlayerEntry[] {
    const all = this.getAll()
    const map = new Map<string, LeaderboardEntry[]>()
    for (const s of all) {
      const key = (s.playerName ?? "Anonymous").trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    const rows: GlobalPlayerEntry[] = []
    for (const [playerName, list] of map) {
      const totalScore   = list.reduce((sum, x) => sum + x.score, 0)
      const avgAccuracy  = list.reduce((sum, x) => sum + x.accuracy * 100, 0) / list.length
      const uniqueGames  = new Set(list.map(x => x.gameId)).size
      const lastPlayed   = Math.max(...list.map(x => x.timestamp))
      const gameMap = new Map<string, LeaderboardEntry[]>()
      for (const s of list) {
        if (!gameMap.has(s.gameId)) gameMap.set(s.gameId, [])
        gameMap.get(s.gameId)!.push(s)
      }
      const breakdown: GameBreakdown[] = []
      for (const [, gs] of gameMap) {
        breakdown.push({
          gameTitle:   gs[0].gameTitle ?? gs[0].gameId,
          plays:       gs.length,
          bestScore:   Math.max(...gs.map(x => x.score)),
          totalScore:  gs.reduce((sum, x) => sum + x.score, 0),
          avgAccuracy: Math.round(gs.reduce((sum, x) => sum + x.accuracy * 100, 0) / gs.length * 100) / 100,
          bestTime:    Math.min(...gs.map(x => x.timeTaken)),
        })
      }
      rows.push({
        playerName,
        college:       "",
        totalScore,
        avgAccuracy:   Math.round(avgAccuracy * 100) / 100,
        gamesPlayed:   uniqueGames,
        totalSessions: list.length,
        timestamp:     lastPlayed,
        breakdown,
      })
    }
    rows.sort((a, b) => b.totalScore - a.totalScore || b.avgAccuracy - a.avgAccuracy)
    return rows.slice(0, 50)
  }

  private static _aggregateLocalForGame(gameId: string): GamePlayerEntry[] {
    const all  = this.getAll().filter(e => e.gameId === gameId)
    const map  = new Map<string, LeaderboardEntry[]>()
    for (const s of all) {
      const key = (s.playerName ?? "Anonymous").trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    const rows: GamePlayerEntry[] = []
    for (const [playerName, list] of map) {
      const bestScore  = Math.max(...list.map(x => x.score))
      const totalScore = list.reduce((sum, x) => sum + x.score, 0)
      const avgAcc     = list.reduce((sum, x) => sum + x.accuracy * 100, 0) / list.length
      rows.push({
        playerName,
        college:     "",
        bestScore,
        totalScore,
        avgAccuracy: Math.round(avgAcc * 100) / 100,
        attempts:    list.length,
        timestamp:   Math.max(...list.map(x => x.timestamp)),
        allAttempts: list
          .map(x => ({
            score:      x.score,
            accuracy:   Math.round(x.accuracy * 10000) / 100,
            timeTaken:  x.timeTaken,
            difficulty: x.difficulty ?? "medium",
            timestamp:  x.timestamp,
          }))
          .sort((a, b) => b.score - a.score),
      })
    }
    rows.sort((a, b) => b.bestScore - a.bestScore || b.avgAccuracy - a.avgAccuracy)
    return rows.slice(0, 50)
  }
}
