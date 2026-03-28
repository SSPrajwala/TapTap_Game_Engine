import React, { useState, useMemo, useEffect } from "react"
import logoSrc                        from "./assets/logo.png"
import { AuthProvider, useAuth }      from "./context/AuthContext"
import { GameRenderer }               from "./components/GameRenderer"
import { LeaderboardPage }            from "./pages/LeaderboardPage"
import { AdminPanel }                 from "./pages/AdminPanel"
import { SplashScreen }               from "./components/ui/SplashScreen"
import { DeerMascot }                 from "./components/ui/DeerMascot"
import { useDeerMascot }              from "./hooks/useDeerMascot"
import { HexBackground }              from "./components/ui/HexBackground"
import { TopRibbon }                  from "./components/ui/TopRibbon"
import { Footer }                     from "./components/ui/Footer"
import { AboutOverlay }               from "./components/overlays/AboutOverlay"
import { DocsOverlay }                from "./components/overlays/DocsOverlay"
import { SignInOverlay }              from "./components/overlays/SignInOverlay"
import { ProfileOverlay }             from "./components/overlays/ProfileOverlay"
import { AdminAuthOverlay }           from "./components/overlays/AdminAuthOverlay"
import type { GameConfig }            from "./types/engine.types"

import logicGameRaw      from "./games/logic-game.json"
import patternPuzzleRaw  from "./games/pattern-puzzle.json"
import worldCapitalsRaw  from "./games/world-capitals.json"
import emojiMemoryRaw    from "./games/emoji-memory.json"
import sudokuRaw         from "./games/sudoku.json"
import wordbuilderRaw    from "./games/wordbuilder.json"

import "./plugins"
import "./styles.css"

type Page    = "library" | "game" | "leaderboard" | "admin"
type Overlay = "about" | "docs" | "signin" | "profile" | "adminAuth" | null

// Static fallback games (used until backend responds)
const STATIC_GAMES: GameConfig[] = [
  logicGameRaw      as unknown as GameConfig,
  patternPuzzleRaw  as unknown as GameConfig,
  worldCapitalsRaw  as unknown as GameConfig,
  emojiMemoryRaw    as unknown as GameConfig,
  sudokuRaw         as unknown as GameConfig,
  wordbuilderRaw    as unknown as GameConfig,
]

const PLUGIN_COLORS: Record<string, string> = {
  quiz:        "linear-gradient(135deg,#A855F7,#3B82F6)",
  puzzle:      "linear-gradient(135deg,#00D4FF,#22FFAA)",
  flashcard:   "linear-gradient(135deg,#A855F7,#FF2D78)",
  memory:      "linear-gradient(135deg,#22FFAA,#00D4FF)",
  sudoku:      "linear-gradient(135deg,#FFD700,#FF8C00)",
  wordbuilder: "linear-gradient(135deg,#FF2D78,#A855F7)",
}

const PLUGIN_TEXT: Record<string, string> = {
  quiz:        "#A855F7",
  puzzle:      "#00D4FF",
  flashcard:   "#FF2D78",
  memory:      "#22FFAA",
  sudoku:      "#FFD700",
  wordbuilder: "#FF2D78",
}

// Logo image used in header — actual logo.png asset
const AppLogoImg = () => (
  <img
    src={logoSrc}
    alt="TapTap Game Engine"
    style={{
      width:     "64px",
      height:    "64px",
      objectFit: "contain",
      animation: "logoPulse 3s ease-in-out infinite",
      filter:    "drop-shadow(0 0 12px rgba(168,85,247,0.8))",
    }}
  />
)

// ── Inner app ─────────────────────────────────────────────────────────────────

function AppInner() {
  const { user, isLoggedIn } = useAuth()

  const [showSplash,  setShowSplash]  = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page,        setPage]        = useState<Page>("library")
  const [activeGame,  setActiveGame]  = useState<GameConfig | null>(null)
  const [overlay,     setOverlay]     = useState<Overlay>(null)

  // ── Admin auth state (session-only — cleared on tab close) ──────────────────
  const [adminToken,  setAdminToken]  = useState<string | null>(null)
  const [adminName,   setAdminName]   = useState<string>("")
  const isAdmin = adminToken !== null

  // ── Games — start with static, merge backend-saved overrides after mount ───
  const [games, setGames] = useState<GameConfig[]>(STATIC_GAMES)

  useEffect(() => {
    fetch("http://localhost:3001/api/games", { signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then((backendGames: GameConfig[]) => {
        if (!backendGames.length) return
        // Merge: backend versions override static, keeping any static games not in backend
        setGames(prev => prev.map(g => backendGames.find(b => b.id === g.id) ?? g))
      })
      .catch(() => { /* backend not running — static games are fine */ })
  }, [])

  const { deerState, triggerCorrect, triggerWrong, triggerVictory } = useDeerMascot()

  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games
    const q = searchQuery.toLowerCase()
    return games.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.plugin.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
    )
  }, [games, searchQuery])

  const openOverlay  = (o: Overlay) => setOverlay(o)
  const closeOverlay = () => setOverlay(null)

  // When admin nav button is clicked:
  const handleAdminClick = () => {
    if (isAdmin) {
      setPage("admin")  // already authenticated this session
    } else {
      openOverlay("adminAuth")
    }
  }

  const handleAdminSuccess = (token: string, name: string) => {
    setAdminToken(token)
    setAdminName(name)
    setPage("admin")
  }

  const ribbonProps = {
    onSearchGame:  setSearchQuery,
    onShowDocs:    () => openOverlay("docs"),
    onShowAbout:   () => openOverlay("about"),
    onShowSignIn:  () => openOverlay("signin"),
    onShowProfile: () => openOverlay(isLoggedIn ? "profile" : "signin"),
    user,
  }

  // Shared overlays
  const overlays = (
    <>
      <AboutOverlay      open={overlay === "about"}     onClose={closeOverlay} />
      <DocsOverlay       open={overlay === "docs"}       onClose={closeOverlay} />
      <SignInOverlay     open={overlay === "signin"}     onClose={closeOverlay} />
      <ProfileOverlay    open={overlay === "profile"}    onClose={closeOverlay} />
      <AdminAuthOverlay
        open={overlay === "adminAuth"}
        onClose={closeOverlay}
        onSuccess={handleAdminSuccess}
      />
    </>
  )

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  // ── Game page ──────────────────────────────────────────────────────────────
  if (page === "game" && activeGame) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <GameRenderer
            config={activeGame}
            onBack={() => setPage("library")}
            onCorrect={triggerCorrect}
            onWrong={triggerWrong}
            onVictory={triggerVictory}
          />
        </div>
        <DeerMascot state={deerState} showLabel />
        {overlays}
      </div>
    )
  }

  // ── Leaderboard page ───────────────────────────────────────────────────────
  if (page === "leaderboard") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <LeaderboardPage onBack={() => setPage("library")} />
        </div>
        {/* Leaderboard: neutral idle glow, not "victory" — no scores yet doesn't mean someone won */}
        <DeerMascot state="idle" size={80} />
        {overlays}
      </div>
    )
  }

  // ── Admin page (only reachable after admin auth) ───────────────────────────
  if (page === "admin" && isAdmin) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <AdminPanel
            games={games}
            onBack={() => setPage("library")}
            onSave={setGames}
            adminToken={adminToken!}
            adminName={adminName}
          />
        </div>
        <DeerMascot state="idle" size={80} />
        {overlays}
      </div>
    )
  }

  // ── Library (home) ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <HexBackground />
      <TopRibbon {...ribbonProps} />

      <div className="app-shell" style={{ flex: 1, paddingTop: "24px" }}>
        <header className="app-header animate-in" style={{ marginBottom: "28px" }}>
          <div className="app-logo-mark">
            <AppLogoImg />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
              <h1 style={{ fontFamily: "Orbitron, monospace", margin: 0 }}>
                Tap Tap{" "}
                <span style={{
                  background: "linear-gradient(135deg, #A855F7 0%, #00D4FF 60%, #22FFAA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  GAME ENGINE
                </span>
              </h1>
              <p style={{ margin: 0, fontStyle: "italic", letterSpacing: "0.18em", color: "rgba(232,224,255,0.55)", fontSize: "0.75rem" }}>
                "One engine · many games"
              </p>
            </div>
          </div>
          <p style={{ marginTop: "10px" }}>Adaptive · Plugin-based · JSON-driven · 6 Game Types</p>
        </header>

        <nav className="app-nav animate-in stagger-1">
          <button className="nav-btn nav-btn-active">🎮 Games</button>
          <button className="nav-btn" onClick={() => setPage("leaderboard")}>🏆 Leaderboard</button>
          <button
            className="nav-btn"
            onClick={handleAdminClick}
            title={isAdmin ? `Admin: ${adminName}` : "Admin (requires access code)"}
          >
            {isAdmin ? `🔓 Admin (${adminName.split(" ")[0]})` : "⚙️ Admin"}
          </button>
        </nav>

        {searchQuery && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px",
            padding: "8px 16px", background: "rgba(168,85,247,0.08)",
            border: "1px solid rgba(168,85,247,0.2)", borderRadius: "8px",
            fontSize: "0.82rem", color: "rgba(232,224,255,0.6)", fontFamily: "Exo 2, sans-serif",
          }}>
            <span>🔍 Results for "<strong style={{ color: "#A855F7" }}>{searchQuery}</strong>" — {filteredGames.length} found</span>
            <button onClick={() => setSearchQuery("")}
              style={{ background: "transparent", color: "rgba(232,224,255,0.4)", fontSize: "0.8rem", marginLeft: "auto", cursor: "pointer", border: "none" }}>
              Clear ✕
            </button>
          </div>
        )}

        <div className="game-library">
          {filteredGames.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px", color: "rgba(232,224,255,0.3)", fontFamily: "Orbitron, monospace", fontSize: "0.88rem" }}>
              No games found for "{searchQuery}"
            </div>
          ) : filteredGames.map((game, i) => (
            <div
              key={game.id}
              className={`game-card animate-in stagger-${Math.min(i + 2, 6)}`}
              style={{
                "--card-accent": PLUGIN_COLORS[game.plugin] ?? "var(--grad-brand)",
                background: "rgba(10, 8, 30, 0.6)",
                backdropFilter: "blur(20px) saturate(160%)",
              } as React.CSSProperties}
              onClick={() => { setActiveGame(game); setPage("game") }}
            >
              <div className="game-card-inner-glow" />
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "40%",
                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
                borderRadius: "inherit", pointerEvents: "none",
              }} />
              <div className="card-top">
                <span className="card-emoji">{game.ui?.emoji ?? "🎮"}</span>
                <span className="card-plugin-tag" style={{ color: PLUGIN_TEXT[game.plugin] ?? "#A855F7" }}>{game.plugin}</span>
              </div>
              <h2 className="card-title">{game.title}</h2>
              <p  className="card-desc">{game.description}</p>
              <div className="card-footer">
                <div className="card-meta">
                  <span>📚 {game.levels.length} levels</span>
                  <span>❓ {game.questions.length} questions</span>
                </div>
                <button className="btn-play"
                  onClick={e => { e.stopPropagation(); setActiveGame(game); setPage("game") }}>
                  Play →
                </button>
              </div>
            </div>
          ))}
        </div>

        <Footer gameCount={games.length} questionCount={games.reduce((s, g) => s + g.questions.length, 0)} />
      </div>

      <DeerMascot state={deerState} showLabel size={85} />
      {overlays}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
