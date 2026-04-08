/**
 * EngineShowcase — visual "under the hood" page
 * Shows judges the engine architecture, plugin registry, game types, and live stats.
 * No code reading required — the engine explains itself.
 */
import React, { useState, useEffect } from "react"
import { pluginRegistry }             from "../plugins"
import type { GameConfig }            from "../types/engine.types"

// ── helpers ───────────────────────────────────────────────────────────────────

const PLUGIN_INFO: Record<string, { icon: string; color: string; desc: string; aptitude: string }> = {
  quiz:        { icon: "❓", color: "#A855F7", desc: "Multiple-choice questions with adaptive difficulty, time bonus and streak multiplier", aptitude: "Verbal · Reasoning · Domain" },
  flashcard:   { icon: "🃏", color: "#00D4FF", desc: "Flip-card learning with spaced repetition and self-assessment scoring", aptitude: "Vocabulary · Memory · Recall" },
  memory:      { icon: "🧩", color: "#4ADE80", desc: "Emoji pair-matching game that trains visual memory and attention span", aptitude: "Memory · Attention to Detail" },
  puzzle:      { icon: "🔮", color: "#F59E0B", desc: "Pattern recognition sequences — find the next element in the series", aptitude: "Pattern Recognition · Logical Reasoning" },
  wordbuilder: { icon: "📝", color: "#EC4899", desc: "Anagram-style word construction from shuffled letters with bonus scoring", aptitude: "Vocabulary · Verbal Ability" },
  sudoku:      { icon: "🔢", color: "#06B6D4", desc: "Classic 9×9 constraint-satisfaction puzzle for numerical and logical training", aptitude: "Numerical Ability · Logical Reasoning" },
  tapblitz:    { icon: "⚡", color: "#FBBF24", desc: "Motion-based tap-the-target game that trains focus, reflexes and precision", aptitude: "Focus · Attention to Detail" },
  binaryrunner:{ icon: "🏃", color: "#34D399", desc: "3-lane endless runner with live binary/logic gate challenges embedded mid-game", aptitude: "Algorithms · Logical Reasoning" },
}

const ENGINE_LAYERS = [
  { name: "Game Config (JSON)", icon: "📄", color: "#6B7280", desc: "Declarative game definition — questions, levels, rules, UI config. No code needed to create a game." },
  { name: "Plugin Registry",    icon: "🔌", color: "#A855F7", desc: "pluginRegistry.register() maps plugin IDs to React components. Single line to add a new game type." },
  { name: "EngineCore",         icon: "⚙️", color: "#00D4FF", desc: "Pure reducer pattern. state + action → new state. Drives all game logic deterministically." },
  { name: "AdaptiveEngine",     icon: "🧠", color: "#4ADE80", desc: "Rule-based difficulty adjuster. Reads accuracy + streak → decides next difficulty in real time." },
  { name: "ScoreEngine",        icon: "🏆", color: "#FBBF24", desc: "Time bonus + streak multiplier scoring. Configurable per game via ScoringConfig JSON." },
  { name: "LevelManager",       icon: "📊", color: "#F59E0B", desc: "Manages level progression with unlock conditions. Levels can require minScore from previous level." },
  { name: "Plugin Component",   icon: "🎮", color: "#EC4899", desc: "React component for each game type. Receives question + stats, fires onAnswer(result)." },
]

// ── sub-components ────────────────────────────────────────────────────────────

const LayerCard: React.FC<typeof ENGINE_LAYERS[0]> = ({ name, icon, color, desc }) => (
  <div style={{
    display: "flex", gap: 14, alignItems: "flex-start",
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    borderLeft: `3px solid ${color}`,
    borderRadius: 12, padding: "16px 18px",
  }}>
    <div style={{ fontSize: "1.5rem", lineHeight: 1, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ color, fontFamily: "Orbitron, monospace", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 1 }}>
        {name}
      </div>
      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", marginTop: 6, lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  </div>
)

const PluginCard: React.FC<{ id: string; info: typeof PLUGIN_INFO[string] }> = ({ id, info }) => (
  <div style={{
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${info.color}33`,
    borderRadius: 14, padding: "18px 20px",
    display: "flex", flexDirection: "column", gap: 8,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{
        fontSize: "1.6rem",
        background: `radial-gradient(circle, ${info.color}22, transparent)`,
        borderRadius: "50%", padding: 6,
      }}>{info.icon}</span>
      <div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>
          {id.charAt(0).toUpperCase() + id.slice(1)} Plugin
        </div>
        <div style={{
          background: `${info.color}22`, border: `1px solid ${info.color}44`,
          borderRadius: 99, padding: "1px 8px",
          color: info.color, fontSize: "0.6rem", fontFamily: "Orbitron, monospace",
          display: "inline-block", marginTop: 3,
        }}>
          {id}
        </div>
      </div>
    </div>
    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", lineHeight: 1.5 }}>
      {info.desc}
    </div>
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
      {info.aptitude.split(" · ").map(tag => (
        <span key={tag} style={{
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 99, padding: "2px 8px",
          color: "rgba(255,255,255,0.5)", fontSize: "0.62rem",
        }}>
          {tag}
        </span>
      ))}
    </div>
  </div>
)

// ── main page ─────────────────────────────────────────────────────────────────

interface Props {
  games:  GameConfig[]
  onBack: () => void
}

export const EngineShowcase: React.FC<Props> = ({ games, onBack }) => {
  const [registeredPlugins, setRegisteredPlugins] = useState<string[]>([])
  const [activeSection, setActiveSection]         = useState<"architecture" | "plugins" | "stats">("architecture")
  useEffect(() => {
    setRegisteredPlugins(pluginRegistry.list())
  }, [])

  const totalQuestions = games.reduce((s, g) => s + (g.questions?.length ?? 0), 0)
  const totalLevels    = games.reduce((s, g) => s + (g.levels?.length ?? 0), 0)
  const gameTypes      = [...new Set(games.map(g => g.plugin))]

  return (
    <div style={{
      minHeight: "100vh", background: "#0A1628", padding: "clamp(16px,4vw,40px)",
      color: "#fff", fontFamily: "'Inter', 'Segoe UI', sans-serif", boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "8px 16px", color: "rgba(255,255,255,0.6)",
          cursor: "pointer", fontSize: "0.8rem",
        }}>← Back</button>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Orbitron, monospace", fontSize: "clamp(1rem,3vw,1.5rem)", fontWeight: 900, letterSpacing: 2 }}>
            ⚙️ ENGINE SHOWCASE
          </h1>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: 4 }}>
            TapTap Adaptive Game Engine — Architecture & Capabilities
          </div>
        </div>
      </div>

      {/* Hero stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12, marginBottom: 32,
      }}>
        {[
          { label: "Plugin Types",    value: registeredPlugins.length, icon: "🔌", color: "#A855F7" },
          { label: "Games Loaded",    value: games.length,             icon: "🎮", color: "#00D4FF" },
          { label: "Questions",       value: totalQuestions,           icon: "❓", color: "#4ADE80" },
          { label: "Levels",          value: totalLevels,              icon: "📊", color: "#FBBF24" },
          { label: "Aptitude Areas",  value: 6,                        icon: "🎯", color: "#EC4899" },
          { label: "AI Endpoints",    value: 7,                        icon: "🤖", color: "#34D399" },
        ].map(s => (
          <div key={s.label} style={{
            background: "rgba(255,255,255,0.04)", border: `1px solid ${s.color}22`,
            borderRadius: 14, padding: "18px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: "1.8rem" }}>{s.icon}</div>
            <div style={{ color: s.color, fontFamily: "Orbitron, monospace", fontSize: "1.8rem", fontWeight: 900, lineHeight: 1, marginTop: 8 }}>
              {s.value}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {(["architecture", "plugins", "stats"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveSection(tab)} style={{
            padding: "9px 22px", borderRadius: 99, border: "none", cursor: "pointer",
            fontFamily: "Orbitron, monospace", fontSize: "0.68rem", fontWeight: 700, letterSpacing: 1,
            background: activeSection === tab ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
            color:      activeSection === tab ? "#00D4FF" : "rgba(255,255,255,0.4)",
          }}>
            {{ architecture: "🏗 ARCHITECTURE", plugins: "🔌 PLUGINS", stats: "📊 LIVE STATS" }[tab]}
          </button>
        ))}
      </div>

      {/* Architecture tab */}
      {activeSection === "architecture" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontFamily: "Orbitron", letterSpacing: 2, marginBottom: 8 }}>
            EXECUTION PIPELINE — each game flows through these layers
          </div>
          {ENGINE_LAYERS.map((layer, i) => (
            <div key={layer.name} style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              {/* Step number + connector */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${layer.color}44, ${layer.color}22)`,
                  border: `2px solid ${layer.color}66`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Orbitron, monospace", fontSize: "0.7rem", fontWeight: 900, color: layer.color,
                }}>{i + 1}</div>
                {i < ENGINE_LAYERS.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 16, background: "rgba(255,255,255,0.06)", marginTop: 4 }} />
                )}
              </div>
              <div style={{ flex: 1, paddingBottom: 10 }}>
                <LayerCard {...layer} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plugins tab */}
      {activeSection === "plugins" && (
        <div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontFamily: "Orbitron", letterSpacing: 2, marginBottom: 16 }}>
            {registeredPlugins.length} PLUGINS REGISTERED — all loaded from a single JSON config
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {registeredPlugins.map(id => (
              <PluginCard key={id} id={id} info={PLUGIN_INFO[id] ?? { icon: "🎮", color: "#00D4FF", desc: "Custom game plugin.", aptitude: "General" }} />
            ))}
          </div>
          <div style={{
            marginTop: 24, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: 14, padding: "20px 24px",
          }}>
            <div style={{ color: "#A855F7", fontFamily: "Orbitron", fontSize: "0.75rem", fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>
              HOW TO ADD A NEW GAME TYPE
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", lineHeight: 2 }}>
              <span style={{ color: "#A855F7" }}>1.</span> Create <code style={{ color: "#00D4FF" }}>MyPlugin.tsx</code> implementing <code style={{ color: "#4ADE80" }}>GamePlugin</code> interface<br/>
              <span style={{ color: "#A855F7" }}>2.</span> Call <code style={{ color: "#00D4FF" }}>pluginRegistry.register(myPlugin)</code> in <code style={{ color: "#4ADE80" }}>plugins/index.ts</code><br/>
              <span style={{ color: "#A855F7" }}>3.</span> Set <code style={{ color: "#00D4FF" }}>"plugin": "my-type"</code> in any game JSON config<br/>
              <span style={{ color: "#A855F7" }}>4.</span> The engine handles all scoring, difficulty, and state automatically ✓
            </div>
          </div>
        </div>
      )}

      {/* Live Stats tab */}
      {activeSection === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", fontFamily: "Orbitron", letterSpacing: 2 }}>
            CURRENT SESSION — LIVE ENGINE METRICS
          </div>

          {/* Game breakdown */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "20px 24px",
          }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontFamily: "Orbitron", letterSpacing: 2, marginBottom: 16 }}>
              LOADED GAMES BREAKDOWN
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {games.slice(0, 8).map(game => {
                const info = PLUGIN_INFO[game.plugin]
                return (
                  <div key={game.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10 }}>
                    <span style={{ fontSize: "1.2rem" }}>{info?.icon ?? "🎮"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 600 }}>{game.title}</div>
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.68rem" }}>
                        {game.plugin} · {game.levels?.length ?? 0} levels · {game.questions?.length ?? 0} questions
                      </div>
                    </div>
                    <div style={{
                      background: `${info?.color ?? "#00D4FF"}22`,
                      border: `1px solid ${info?.color ?? "#00D4FF"}44`,
                      borderRadius: 99, padding: "2px 10px",
                      color: info?.color ?? "#00D4FF", fontSize: "0.62rem",
                      fontFamily: "Orbitron, monospace",
                    }}>
                      {game.plugin}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Adaptive engine spec */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}>
            {[
              { label: "Difficulty Levels",   value: "Easy · Medium · Hard", color: "#4ADE80", icon: "⚙️" },
              { label: "Adaptive Trigger",    value: "Accuracy threshold",   color: "#00D4FF", icon: "🧠" },
              { label: "Score Formula",       value: "pts + time bonus + streak", color: "#FBBF24", icon: "🏆" },
              { label: "Unlock Conditions",   value: "minScore per level",   color: "#A855F7", icon: "🔓" },
              { label: "AI Generation",       value: "Gemini 1.5 Flash",     color: "#34D399", icon: "🤖" },
              { label: "Skill XP System",     value: "5 levels × 6 areas",  color: "#EC4899", icon: "📈" },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22`,
                borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ fontSize: "1.3rem" }}>{s.icon}</div>
                <div style={{ color: s.color, fontFamily: "Orbitron", fontSize: "0.75rem", fontWeight: 700, marginTop: 8 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.65rem", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Plugin type coverage bar */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "20px 24px",
          }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontFamily: "Orbitron", letterSpacing: 2, marginBottom: 14 }}>
              GAME TYPE COVERAGE
            </div>
            <div style={{ display: "flex", height: 40, borderRadius: 8, overflow: "hidden", gap: 2 }}>
              {gameTypes.map((type) => {
                const info = PLUGIN_INFO[type]
                return (
                  <div key={type} title={type} style={{
                    flex: 1, background: info?.color ?? "#666",
                    opacity: 0.8, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1rem",
                  }}>{info?.icon ?? "🎮"}</div>
                )
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {gameTypes.map(type => {
                const info = PLUGIN_INFO[type]
                return (
                  <span key={type} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    color: "rgba(255,255,255,0.5)", fontSize: "0.68rem",
                  }}>
                    <span style={{ color: info?.color ?? "#666" }}>●</span> {type}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 60 }} />
    </div>
  )
}
