import React, { useState, useMemo, useEffect, useCallback } from "react"
import { QRChallengeCard } from "./components/ui/QRChallengeCard"
import logoSrc                        from "./assets/logo.png"
import { AuthProvider, useAuth }      from "./context/AuthContext"
import { GameRenderer }               from "./components/GameRenderer"
import { LeaderboardPage }            from "./pages/LeaderboardPage"
import { AdminPanel }                 from "./pages/AdminPanel"
import { SplashScreen }               from "./components/ui/SplashScreen"
import { DeerMascot }                 from "./components/ui/DeerMascot"
import { BlackbuckAI }                from "./components/ui/BlackbuckAI"
import { useDeerMascot }              from "./hooks/useDeerMascot"
import { HexBackground }              from "./components/ui/HexBackground"
import { TopRibbon }                  from "./components/ui/TopRibbon"
import { Footer }                     from "./components/ui/Footer"
import { AboutOverlay }               from "./components/overlays/AboutOverlay"
import { DocsOverlay }                from "./components/overlays/DocsOverlay"
import { SignInOverlay }              from "./components/overlays/SignInOverlay"
import { ProfileOverlay }             from "./components/overlays/ProfileOverlay"
import { AdminAuthOverlay }           from "./components/overlays/AdminAuthOverlay"
import { MultiplayerPage }            from "./pages/MultiplayerPage"
import { SkillsDashboard }            from "./pages/SkillsDashboard"
import { EngineShowcase }             from "./pages/EngineShowcase"
import { CEOPanel }                   from "./pages/CEOPanel"
import { LiveRoomPage }               from "./pages/LiveRoomPage"
import { useBoardMode }               from "./hooks/useBoardMode"
import type { GameConfig }            from "./types/engine.types"
import { getGameSkills, skillLabel, skillColor } from "./utils/GameSkillMapper"

import logicGameRaw      from "./games/logic-game.json"
import patternPuzzleRaw  from "./games/pattern-puzzle.json"
import worldCapitalsRaw  from "./games/world-capitals.json"
import emojiMemoryRaw    from "./games/emoji-memory.json"
import sudokuRaw         from "./games/sudoku.json"
import wordbuilderRaw    from "./games/wordbuilder.json"
import tapblitzRaw       from "./games/tapblitz.json"
import binaryrunnerRaw   from "./games/binaryrunner.json"

import "./plugins"
import "./styles.css"

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"

type Page    = "library" | "game" | "leaderboard" | "admin" | "multiplayer" | "skills" | "engine" | "ceo" | "liveroom"
type Overlay = "about" | "docs" | "signin" | "profile" | "adminAuth" | null

// Static fallback games (used until backend responds)
const STATIC_GAMES: GameConfig[] = [
  logicGameRaw      as unknown as GameConfig,
  patternPuzzleRaw  as unknown as GameConfig,
  worldCapitalsRaw  as unknown as GameConfig,
  emojiMemoryRaw    as unknown as GameConfig,
  sudokuRaw         as unknown as GameConfig,
  wordbuilderRaw    as unknown as GameConfig,
  tapblitzRaw       as unknown as GameConfig,
  binaryrunnerRaw   as unknown as GameConfig,
]

const PLUGIN_COLORS: Record<string, string> = {
  quiz:        "linear-gradient(135deg,#A855F7,#3B82F6)",
  puzzle:      "linear-gradient(135deg,#00D4FF,#22FFAA)",
  flashcard:   "linear-gradient(135deg,#A855F7,#FF2D78)",
  memory:      "linear-gradient(135deg,#22FFAA,#00D4FF)",
  sudoku:      "linear-gradient(135deg,#FFD700,#FF8C00)",
  wordbuilder: "linear-gradient(135deg,#FF2D78,#A855F7)",
  tapblitz:    "linear-gradient(135deg,#FFD700,#FF2D78)",
  binaryrunner:"linear-gradient(135deg,#00D4FF,#A855F7)",
}

const PLUGIN_TEXT: Record<string, string> = {
  quiz:        "#A855F7",
  puzzle:      "#00D4FF",
  flashcard:   "#FF2D78",
  memory:      "#22FFAA",
  sudoku:      "#FFD700",
  wordbuilder: "#FF2D78",
  tapblitz:    "#FFD700",
  binaryrunner:"#00D4FF",
}

const AppLogoImg = () => (
  <img
    src={logoSrc}
    alt="TapTap Game Engine"
    style={{
      width: "64px", height: "64px", objectFit: "contain",
      animation: "logoPulse 3s ease-in-out infinite",
      filter: "drop-shadow(0 0 12px rgba(168,85,247,0.8))",
    }}
  />
)

// ── Inner app ─────────────────────────────────────────────────────────────────

function AppInner() {
  const { user, token, isLoggedIn } = useAuth()

  const [showSplash,   setShowSplash]   = useState(true)
  const [searchQuery,  setSearchQuery]  = useState("")
  const [page,         setPage]         = useState<Page>("library")
  const [activeGame,   setActiveGame]   = useState<GameConfig | null>(null)
  const [overlay,      setOverlay]      = useState<Overlay>(null)
  const [aiOpen,       setAiOpen]       = useState(false)

  // Live Room → Multiplayer redirect: stores room code to auto-join
  const [pendingLiveCode, setPendingLiveCode] = useState<string | null>(null)

  // Admin auth
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [adminName,  setAdminName]  = useState<string>("")
  const isAdmin = adminToken !== null

  // ── CEO Easter-egg trigger — click logo 5 times within 2 seconds ──────────
  const logoClickTimesRef = React.useRef<number[]>([])
  const handleLogoClick = () => {
    const now = Date.now()
    logoClickTimesRef.current = [...logoClickTimesRef.current, now].filter(t => now - t < 2000)
    if (logoClickTimesRef.current.length >= 5) {
      logoClickTimesRef.current = []
      setPage("ceo")
    }
  }

  // ── Games — public always + user's private when logged in ──────────────────
  const [publicGames, setPublicGames] = useState<GameConfig[]>(STATIC_GAMES)
  const [myGames,     setMyGames]     = useState<GameConfig[]>([])

  const loadGames = useCallback(async () => {
    try {
      const headers: HeadersInit = token ? { "Authorization": `Bearer ${token}` } : {}
      const res  = await fetch(`${API}/games`, { headers, signal: AbortSignal.timeout(5000) })
      if (!res.ok) return
      const all: GameConfig[] = await res.json()

      const pub  = all.filter(g => g.visibility !== "private" || !g.createdBy)
      const mine = all.filter(g => g.visibility === "private" && g.createdBy === user?.id)

      if (pub.length)  setPublicGames(pub)
      if (mine.length) setMyGames(mine)
    } catch {
      /* backend not running — static games are fine */
    }
  }, [token, user?.id])

  useEffect(() => { loadGames() }, [loadGames])

  const { deerState, triggerKey, triggerCorrect, triggerWrong, triggerVictory } = useDeerMascot()
  const { boardMode, toggleBoardMode, enterBoardMode } = useBoardMode()

  const allGames = useMemo(() => [...publicGames, ...myGames], [publicGames, myGames])

  const filteredPublic = useMemo(() => {
    if (!searchQuery.trim()) return publicGames
    const q = searchQuery.toLowerCase()
    return publicGames.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.plugin.toLowerCase().includes(q) ||
      (g.description ?? "").toLowerCase().includes(q)
    )
  }, [publicGames, searchQuery])

  const filteredMy = useMemo(() => {
    if (!searchQuery.trim()) return myGames
    const q = searchQuery.toLowerCase()
    return myGames.filter(g =>
      g.title.toLowerCase().includes(q) ||
      (g.description ?? "").toLowerCase().includes(q)
    )
  }, [myGames, searchQuery])

  const openOverlay  = (o: Overlay) => setOverlay(o)
  const closeOverlay = () => setOverlay(null)

  const handleAdminClick = () => {
    if (isAdmin) setPage("admin")
    else         openOverlay("adminAuth")
  }

  const handleAdminSuccess = (t: string, n: string) => {
    setAdminToken(t); setAdminName(n); setPage("admin")
  }

  // Called when AI generates a game and user clicks "Save to My Games"
  const handleGameGenerated = useCallback(async (config: Record<string, unknown>) => {
    if (!token) { openOverlay("signin"); return }
    try {
      const res = await fetch(`${API}/games`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body:    JSON.stringify({
          id:              config.id,
          title:           config.title,
          description:     config.description ?? "",
          plugin:          config.plugin,
          version:         config.version ?? "1.0.0",
          config,
          isAiGenerated:   true,
          learningOutcomes: [],
          aptitudeTags:    [],
        }),
      })
      if (res.ok) {
        await loadGames()
        alert(`✅ "${config.title}" saved to My Games!`)
        setAiOpen(false)
      } else {
        const d = await res.json()
        alert(`Save failed: ${d.error}`)
      }
    } catch {
      alert("Save failed. Please try again.")
    }
  }, [token, loadGames])

  // Admin: publish AI-generated game to the global library (visible to all users)
  const handlePublishGame = useCallback(async (config: Record<string, unknown>) => {
    if (!adminToken) { alert("Admin access required to publish games."); return }
    try {
      const uniqueId = `${config.id ?? "ai-game"}-${Date.now()}`
      const res = await fetch(`${API}/admin/games`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
        body:    JSON.stringify({
          id:               uniqueId,
          title:            config.title,
          description:      config.description ?? "",
          plugin:           config.plugin,
          version:          config.version ?? "1.0.0",
          config:           { ...config, id: uniqueId },
          isAiGenerated:    true,
          visibility:       "public",
          learningOutcomes: (config.learningOutcomes as string[]) ?? [],
          aptitudeTags:     (config.aptitudeTags as string[]) ?? [],
        }),
      })
      if (res.ok) {
        await loadGames()
        alert(`🌐 "${config.title}" published to All Games!`)
        setAiOpen(false)
      } else {
        const d = await res.json()
        alert(`Publish failed: ${d.error}`)
      }
    } catch {
      alert("Publish failed. Please try again.")
    }
  }, [adminToken, loadGames])

  const ribbonProps = {
    onSearchGame:  setSearchQuery,
    onShowDocs:    () => openOverlay("docs"),
    onShowAbout:   () => openOverlay("about"),
    onShowSignIn:  () => openOverlay("signin"),
    onShowProfile: () => openOverlay(isLoggedIn ? "profile" : "signin"),
    user,
  }

  const overlays = (
    <>
      <AboutOverlay     open={overlay === "about"}     onClose={closeOverlay} />
      <DocsOverlay      open={overlay === "docs"}       onClose={closeOverlay} />
      <SignInOverlay    open={overlay === "signin"}     onClose={closeOverlay} />
      <ProfileOverlay   open={overlay === "profile"}    onClose={closeOverlay} />
      <AdminAuthOverlay
        open={overlay === "adminAuth"}
        onClose={closeOverlay}
        onSuccess={handleAdminSuccess}
      />
      <BlackbuckAI
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onGameGenerated={isLoggedIn ? handleGameGenerated : undefined}
        onPublishGame={isAdmin ? handlePublishGame : undefined}
        onPlayGame={(config) => {
          setActiveGame(config as unknown as GameConfig)
          setPage("game")
          setAiOpen(false)
        }}
        isAdmin={isAdmin}
      />
    </>
  )

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  // ── Game page ──────────────────────────────────────────────────────────────
  if (page === "game" && activeGame) {
    return (
      <div style={{ minHeight: "100vh" }} data-board={boardMode ? "true" : "false"}>
        <HexBackground />
        {!boardMode && <TopRibbon {...ribbonProps} />}
        {/* Board Mode badge — visible during board mode */}
        {boardMode && (
          <div style={{
            position: "fixed", top: 16, right: 16, zIndex: 9999,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.4)",
              borderRadius: 99, padding: "6px 18px",
              color: "#00D4FF", fontFamily: "Orbitron, monospace",
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: 2,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00D4FF", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              BOARD MODE
            </div>
            <button onClick={toggleBoardMode} style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 99, padding: "6px 14px", color: "rgba(255,255,255,0.5)",
              cursor: "pointer", fontSize: "0.75rem",
            }}>✕ Exit</button>
          </div>
        )}
        <div className="app-shell" style={{ paddingTop: boardMode ? "0" : "20px" }}>
          <GameRenderer
            config={activeGame}
            onBack={() => { if (boardMode) toggleBoardMode(); setPage("library") }}
            onCorrect={triggerCorrect}
            onWrong={triggerWrong}
            onVictory={triggerVictory}
          />
        </div>
        {!boardMode && <DeerMascot state={deerState} triggerKey={triggerKey} showLabel onAIClick={() => setAiOpen(true)} />}
        {overlays}
      </div>
    )
  }

  // ── Multiplayer page ───────────────────────────────────────────────────────
  if (page === "multiplayer") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <MultiplayerPage
            games={allGames}
            onBack={() => { setPendingLiveCode(null); setPage("library") }}
            pendingRoomCode={pendingLiveCode ?? undefined}
          />
        </div>
        <DeerMascot state="idle" size={80} onAIClick={() => setAiOpen(true)} />
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
        <DeerMascot state="idle" size={80} onAIClick={() => setAiOpen(true)} />
        {overlays}
      </div>
    )
  }

  // ── Skills Dashboard page ──────────────────────────────────────────────────
  if (page === "skills") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <SkillsDashboard onBack={() => setPage("library")} />
        </div>
        <DeerMascot state="idle" size={80} onAIClick={() => setAiOpen(true)} />
        {overlays}
      </div>
    )
  }

  // ── Engine Showcase page ───────────────────────────────────────────────────
  if (page === "engine") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <EngineShowcase games={allGames} onBack={() => setPage("library")} />
        </div>
        {overlays}
      </div>
    )
  }

  // ── Live Room page ─────────────────────────────────────────────────────────
  if (page === "liveroom") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <LiveRoomPage
            games={allGames}
            onBack={() => setPage("library")}
            onJoinRoom={(roomCode) => {
              setPendingLiveCode(roomCode)
              setPage("multiplayer")
            }}
          />
        </div>
        <DeerMascot state="idle" size={80} onAIClick={() => setAiOpen(true)} />
        {overlays}
      </div>
    )
  }

  // ── CEO Control Room (hidden — reached via 5-click logo Easter egg) ────────
  if (page === "ceo") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <CEOPanel onBack={() => setPage("library")} />
        </div>
      </div>
    )
  }

  // ── Admin page ─────────────────────────────────────────────────────────────
  if (page === "admin" && isAdmin) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <HexBackground />
        <TopRibbon {...ribbonProps} />
        <div className="app-shell" style={{ paddingTop: "20px" }}>
          <AdminPanel
            games={publicGames}
            onBack={() => setPage("library")}
            onSave={setPublicGames}
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
      {!boardMode && <TopRibbon {...ribbonProps} />}
      {/* Board mode top bar on library page */}
      {boardMode && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "rgba(0,12,30,0.95)", borderBottom: "1px solid rgba(0,212,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00D4FF", display: "inline-block", animation: "pulse 1.5s infinite" }} />
            <span style={{ color: "#00D4FF", fontFamily: "Orbitron, monospace", fontSize: "0.72rem", fontWeight: 700, letterSpacing: 2 }}>
              📺 DIGITAL BOARD MODE · LIBRARY
            </span>
          </div>
          <button onClick={toggleBoardMode} style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 99, padding: "6px 14px", color: "rgba(255,255,255,0.6)",
            cursor: "pointer", fontSize: "0.75rem",
          }}>✕ Exit Board Mode</button>
        </div>
      )}

      <div className="app-shell" style={{ flex: 1, paddingTop: boardMode ? "64px" : "24px" }}>
        <header className="app-header animate-in" style={{ marginBottom: "28px" }}>
          <div className="app-logo-mark">
            <div onClick={handleLogoClick} style={{ cursor: "default", userSelect: "none" }} title="">
              <AppLogoImg />
            </div>
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
          <p style={{ marginTop: "10px" }}>
            Adaptive · Plugin-based · JSON-driven · 8 Game Types · Multiplayer · AI-Powered
          </p>
        </header>

        {/* ── Digital Board banner — visible hint for judges on smartboards ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.08))",
          border: "1px solid rgba(0,212,255,0.2)",
          borderRadius: 14, padding: "12px 20px",
          marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.3rem" }}>📺</span>
            <div>
              <div style={{ color: "#00D4FF", fontFamily: "Orbitron, monospace", fontSize: "0.72rem", fontWeight: 700, letterSpacing: 1 }}>
                DIGITAL BOARD READY
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.72rem", marginTop: 2 }}>
                Click the <strong style={{ color: "#00D4FF" }}>📺</strong> icon on any game card to launch fullscreen board mode
              </div>
            </div>
          </div>
          <button
            onClick={() => enterBoardMode()}
            style={{
              background: boardMode ? "rgba(0,212,255,0.25)" : "rgba(0,212,255,0.15)",
              border: `1px solid rgba(0,212,255,${boardMode ? "0.7" : "0.35"})`,
              borderRadius: 99, padding: "8px 20px", cursor: "pointer",
              color: "#00D4FF", fontFamily: "Orbitron, monospace",
              fontSize: "0.68rem", fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
            }}
          >
            {boardMode ? "📺 Board Active · Esc to Exit" : "📺 Enable Board Mode →"}
          </button>
        </div>

        <nav className="app-nav animate-in stagger-1">
          <button className="nav-btn nav-btn-active">🎮 Games</button>
          <button className="nav-btn" onClick={() => setPage("multiplayer")}>🌐 Multiplayer</button>
          <button className="nav-btn" onClick={() => setPage("liveroom")} style={{ position: "relative" }}>
            🟢 Live Room
            <span style={{
              position: "absolute", top: "4px", right: "6px",
              width: "7px", height: "7px", borderRadius: "50%",
              background: "#22FFAA",
              boxShadow: "0 0 6px #22FFAA",
              animation: "pulse 1.5s infinite",
            }} />
          </button>
          <button className="nav-btn" onClick={() => setPage("leaderboard")}>🏆 Leaderboard</button>
          {isLoggedIn && (
            <button className="nav-btn" onClick={() => setPage("skills")}>📊 My Skills</button>
          )}
          <button className="nav-btn" onClick={() => setPage("engine")}>⚙️ Engine</button>
          {isLoggedIn && (
            <button className="nav-btn" onClick={() => setAiOpen(true)}>
              🤖 AI Studio
            </button>
          )}
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
            <span>🔍 Results for "<strong style={{ color: "#A855F7" }}>{searchQuery}</strong>" — {filteredPublic.length + filteredMy.length} found</span>
            <button onClick={() => setSearchQuery("")}
              style={{ background: "transparent", color: "rgba(232,224,255,0.4)", fontSize: "0.8rem", marginLeft: "auto", cursor: "pointer", border: "none" }}>
              Clear ✕
            </button>
          </div>
        )}

        {/* ── My Games section (only if user is logged in and has private games) ── */}
        {isLoggedIn && filteredMy.length > 0 && (
          <section style={{ marginBottom: "32px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px",
            }}>
              <h2 style={{
                fontFamily: "Orbitron, monospace", fontSize: "0.85rem", fontWeight: 800,
                color: "#A855F7", margin: 0, letterSpacing: "0.1em",
              }}>
                🔒 MY GAMES
              </h2>
              <div style={{
                flex: 1, height: 1,
                background: "linear-gradient(90deg, rgba(168,85,247,0.4), transparent)",
              }} />
              <button
                onClick={() => setAiOpen(true)}
                style={{
                  background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                  borderRadius: "20px", padding: "4px 12px",
                  color: "#A855F7", fontSize: "0.72rem",
                  fontFamily: "Orbitron, monospace", fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + AI Generate
              </button>
            </div>
            <GameGrid
              games={filteredMy}
              onPlay={game => { setActiveGame(game); setPage("game") }}
              onBoardPlay={game => { setActiveGame(game); enterBoardMode(); setPage("game") }}
              showPrivateBadge
            />
          </section>
        )}

        {/* ── Sign-in prompt for AI features ── */}
        {!isLoggedIn && (
          <div style={{
            marginBottom: "20px", padding: "14px 20px",
            background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: "12px", display: "flex", alignItems: "center", gap: "14px",
          }}>
            <div style={{ fontSize: "1.8rem" }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#A855F7", fontFamily: "Orbitron, monospace", fontSize: "0.78rem", fontWeight: 800 }}>
                AI FEATURES UNLOCKED WITH SIGN-IN
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginTop: "3px" }}>
                Generate custom quizzes, get AI explanations, track skill progress, chat with Blackbuck
              </div>
            </div>
            <button
              onClick={() => openOverlay("signin")}
              style={{
                background: "linear-gradient(135deg, #A855F7, #7C3AED)",
                border: "none", borderRadius: "8px",
                padding: "8px 16px", color: "white",
                fontFamily: "Orbitron, monospace", fontSize: "0.72rem",
                fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Sign In
            </button>
          </div>
        )}

        {/* ── Public Games section ── */}
        <section>
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px",
          }}>
            <h2 style={{
              fontFamily: "Orbitron, monospace", fontSize: "0.85rem", fontWeight: 800,
              color: "rgba(255,255,255,0.5)", margin: 0, letterSpacing: "0.1em",
            }}>
              🌐 ALL GAMES
            </h2>
            <div style={{
              flex: 1, height: 1,
              background: "linear-gradient(90deg, rgba(255,255,255,0.1), transparent)",
            }} />
          </div>

          <GameGrid
            games={filteredPublic}
            onPlay={game => { setActiveGame(game); setPage("game") }}
            onBoardPlay={game => { setActiveGame(game); enterBoardMode(); setPage("game") }}
            searchQuery={searchQuery}
          />
        </section>

        <Footer gameCount={publicGames.length} questionCount={publicGames.reduce((s, g) => s + g.questions.length, 0)} />
      </div>

      <DeerMascot
        state={deerState}
        triggerKey={triggerKey}
        showLabel
        size={85}
        onAIClick={isLoggedIn ? () => setAiOpen(true) : undefined}
      />
      {overlays}
    </div>
  )
}

// ── GameGrid sub-component ────────────────────────────────────────────────────

function GameGrid({
  games, onPlay, onBoardPlay, searchQuery, showPrivateBadge,
}: {
  games:            GameConfig[]
  onPlay:           (g: GameConfig) => void
  onBoardPlay?:     (g: GameConfig) => void
  searchQuery?:     string
  showPrivateBadge?: boolean
}) {
  const [qrGame, setQrGame] = useState<GameConfig | null>(null)

  if (games.length === 0 && searchQuery) {
    return (
      <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px", color: "rgba(232,224,255,0.3)", fontFamily: "Orbitron, monospace", fontSize: "0.88rem" }}>
        No games found for "{searchQuery}"
      </div>
    )
  }

  return (
    <>
    <div className="game-library">
      {games.map((game, i) => (
        <div
          key={game.id}
          className={`game-card animate-in stagger-${Math.min(i + 2, 6)}`}
          style={{
            "--card-accent": PLUGIN_COLORS[game.plugin] ?? "var(--grad-brand)",
            background: "rgba(10, 8, 30, 0.6)",
            backdropFilter: "blur(20px) saturate(160%)",
          } as React.CSSProperties}
          onClick={() => onPlay(game)}
        >
          <div className="game-card-inner-glow" />
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "40%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
            borderRadius: "inherit", pointerEvents: "none",
          }} />
          <div className="card-top">
            <span className="card-emoji">{game.ui?.emoji ?? "🎮"}</span>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {showPrivateBadge && (
                <span style={{
                  background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)",
                  borderRadius: "4px", padding: "1px 6px",
                  color: "#A855F7", fontSize: "0.6rem",
                  fontFamily: "Orbitron, monospace", fontWeight: 700,
                }}>
                  PRIVATE
                </span>
              )}
              {game.isAiGenerated && (
                <span style={{
                  background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: "4px", padding: "1px 6px",
                  color: "#00D4FF", fontSize: "0.6rem",
                  fontFamily: "Orbitron, monospace", fontWeight: 700,
                }}>
                  AI
                </span>
              )}
              <span className="card-plugin-tag" style={{ color: PLUGIN_TEXT[game.plugin] ?? "#A855F7" }}>
                {game.plugin}
              </span>
            </div>
          </div>
          <h2 className="card-title">{game.title}</h2>
          <p className="card-desc">{game.description}</p>

          {/* Auto-derived skill tags */}
          {(() => {
            const skills = getGameSkills(game)
            if (!skills.length) return null
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                {skills.map(sk => {
                  const col = skillColor(sk)
                  return (
                    <span key={sk} style={{
                      background: `${col}18`,
                      border: `1px solid ${col}44`,
                      borderRadius: "4px", padding: "2px 7px",
                      color: col, fontSize: "0.6rem",
                      fontFamily: "Exo 2, sans-serif", fontWeight: 600,
                      letterSpacing: "0.03em",
                    }}>
                      {skillLabel(sk)}
                    </span>
                  )
                })}
              </div>
            )
          })()}

          <div className="card-footer">
            <div className="card-meta">
              <span>📚 {(game.levels ?? []).length} levels</span>
              <span>❓ {(game.questions ?? []).length} questions</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* QR Challenge Card button */}
              <button
                title="Get QR Challenge Card — share or print to invite others"
                onClick={e => { e.stopPropagation(); setQrGame(game) }}
                style={{
                  background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)",
                  borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                  color: "#C084FC", fontSize: "0.75rem",
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                  <path d="M14 14h.01M14 17h.01M17 14h.01M17 17h.01M17 20h.01M20 14h.01M20 17h.01M20 20h.01"/>
                </svg>
              </button>
              {onBoardPlay && (
                <button
                  title="Launch in Board Mode (fullscreen for smartboards)"
                  onClick={e => { e.stopPropagation(); onBoardPlay(game) }}
                  style={{
                    background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                    borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                    color: "#00D4FF", fontSize: "0.75rem", fontWeight: 700,
                    fontFamily: "Orbitron, monospace", letterSpacing: 1,
                  }}>
                  📺
                </button>
              )}
              <button className="btn-play"
                onClick={e => { e.stopPropagation(); onPlay(game) }}>
                Play →
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
    {/* QR Challenge Card modal */}
    {qrGame && <QRChallengeCard game={qrGame} onClose={() => setQrGame(null)} />}
    </>
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
