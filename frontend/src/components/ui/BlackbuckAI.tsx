/**
 * BlackbuckAI — AI companion panel
 * Slides in from the right when the deer mascot is clicked.
 * Supports: chat, quick quiz generation, skill report, in-game explanations.
 */
import React, { useState, useRef, useEffect, useCallback } from "react"
import { AIService } from "../../services/AIService"
import type { MascotMessage, SkillReport } from "../../services/AIService"
import { useAuth } from "../../context/AuthContext"

interface Props {
  isOpen:          boolean
  onClose:         () => void
  /** If provided, the panel starts with a pre-loaded explanation context */
  explainContext?: {
    concept:       string
    question?:     string
    correctAnswer?: string
    studentAnswer?: string
  }
  /** Called when user saves an AI-generated game to My Games */
  onGameGenerated?: (config: Record<string, unknown>) => void
  /** Called when ADMIN publishes game to all users (global library) */
  onPublishGame?: (config: Record<string, unknown>) => void
  /** True if current user is admin */
  isAdmin?: boolean
}

type Tab = "chat" | "generate" | "report"

interface ChatMsg {
  role:    "user" | "assistant"
  text:    string
  loading?: boolean
}

const QUICK_QUESTIONS = [
  "What is binary search and how does it work?",
  "Explain time complexity in simple terms.",
  "What's the difference between stack and queue?",
  "Help me understand logical operators.",
  "What aptitude topics should I focus on for TCS NQT?",
]

export const BlackbuckAI: React.FC<Props> = ({ isOpen, onClose, explainContext, onGameGenerated, onPublishGame, isAdmin }) => {
  const { token, user } = useAuth()
  const [tab,         setTab]         = useState<Tab>("chat")
  const [messages,    setMessages]    = useState<ChatMsg[]>([])
  const [input,       setInput]       = useState("")
  const [loading,     setLoading]     = useState(false)
  const [genTopic,    setGenTopic]    = useState("")
  const [genType,     setGenType]     = useState<"quiz" | "flashcard">("quiz")
  const [genCount,    setGenCount]    = useState(10)
  const [genLoading,  setGenLoading]  = useState(false)
  const [genResult,   setGenResult]   = useState<Record<string, unknown> | null>(null)
  const [report,      setReport]      = useState<SkillReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // When panel opens with an explain context, auto-send the explanation request
  useEffect(() => {
    if (isOpen && explainContext && token && messages.length === 0) {
      const welcomeMsg: ChatMsg = {
        role: "assistant",
        text: `👋 Hi ${user?.username ?? "there"}! I'm Blackbuck, your AI study buddy. Let me explain that for you...`,
      }
      setMessages([welcomeMsg])
      fetchExplanation()
    } else if (isOpen && messages.length === 0) {
      const welcomeMsg: ChatMsg = {
        role: "assistant",
        text: `👋 Hello ${user?.username ?? "there"}! I'm Blackbuck 🦌 — your AI-powered study companion. Ask me anything about aptitude, algorithms, or your preparation journey!`,
      }
      setMessages([welcomeMsg])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const fetchExplanation = useCallback(async () => {
    if (!token || !explainContext) return
    setLoading(true)
    const loadingMsg: ChatMsg = { role: "assistant", text: "Thinking...", loading: true }
    setMessages(prev => [...prev, loadingMsg])
    try {
      const explanation = await AIService.getExplanation(token, explainContext)
      setMessages(prev => prev.filter(m => !m.loading).concat({ role: "assistant", text: explanation }))
    } catch {
      setMessages(prev => prev.filter(m => !m.loading).concat({
        role: "assistant",
        text: "Hmm, I had trouble loading that explanation. Try asking me directly!",
      }))
    } finally {
      setLoading(false)
    }
  }, [token, explainContext])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || !token || loading) return
    setInput("")

    const history: MascotMessage[] = messages.slice(-6).map(m => ({ role: m.role, text: m.text }))
    setMessages(prev => [...prev, { role: "user", text: msg }, { role: "assistant", text: "Thinking...", loading: true }])
    setLoading(true)

    try {
      const reply = await AIService.chat(token, msg, history)
      setMessages(prev => prev.filter(m => !m.loading).concat({ role: "assistant", text: reply }))
    } catch {
      setMessages(prev => prev.filter(m => !m.loading).concat({
        role: "assistant",
        text: "I got a bit distracted 🦌 Try again in a moment!",
      }))
    } finally {
      setLoading(false)
    }
  }, [input, token, loading, messages])

  const generateGame = useCallback(async () => {
    if (!token || !genTopic.trim() || genLoading) return
    setGenLoading(true)
    setGenResult(null)
    try {
      const result = genType === "quiz"
        ? await AIService.generateQuiz(token, { topic: genTopic, questionCount: genCount, targetCompany: user?.profile?.targetCompany ?? undefined })
        : await AIService.generateFlashcard(token, { topic: genTopic, cardCount: genCount })
      setGenResult(result.config)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed. Please try again."
      alert(msg)
    } finally {
      setGenLoading(false)
    }
  }, [token, genTopic, genCount, genType, genLoading, user])

  const loadReport = useCallback(async () => {
    if (!token || reportLoading) return
    setReportLoading(true)
    setReport(null)
    try {
      const r = await AIService.generateReport(token)
      setReport(r)
    } catch {
      alert("Failed to generate report. Make sure you have played some games first!")
    } finally {
      setReportLoading(false)
    }
  }, [token, reportLoading])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position:  "fixed", top: 0, right: 0, bottom: 0,
        width:     "min(420px, 100vw)",
        zIndex:    2001,
        background: "linear-gradient(180deg, #0D0821 0%, #0A1628 100%)",
        borderLeft: "1px solid rgba(0,212,255,0.25)",
        display:   "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,212,255,0.15)",
        animation: "slideInRight 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "16px 20px", borderBottom: "1px solid rgba(0,212,255,0.15)",
          background: "rgba(0,212,255,0.05)",
        }}>
          <div style={{ fontSize: "28px" }}>🦌</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#00D4FF", fontFamily: "Orbitron, monospace", fontWeight: 800, fontSize: "0.9rem" }}>
              BLACKBUCK AI
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>
              Powered by Gemini · Your Study Companion
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.08)", border: "none", color: "white",
            width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
            fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
          {(["chat", "generate", "report"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "10px 4px",
              background: tab === t ? "rgba(0,212,255,0.12)" : "transparent",
              border: "none", borderBottom: tab === t ? "2px solid #00D4FF" : "2px solid transparent",
              color: tab === t ? "#00D4FF" : "rgba(255,255,255,0.5)",
              fontFamily: "Orbitron, monospace", fontSize: "0.65rem",
              fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
              transition: "all 0.2s",
            }}>
              {t === "chat" ? "💬 Chat" : t === "generate" ? "⚡ Generate" : "📊 Report"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* ── CHAT TAB ── */}
          {tab === "chat" && (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {messages.map((m, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "8px",
                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  }}>
                    {m.role === "assistant" && (
                      <div style={{ fontSize: "20px", flexShrink: 0, marginTop: "2px" }}>🦌</div>
                    )}
                    <div style={{
                      maxWidth: "80%",
                      background: m.role === "user"
                        ? "linear-gradient(135deg, #7C3AED, #4F46E5)"
                        : "rgba(255,255,255,0.07)",
                      borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                      padding: "10px 14px",
                      color: m.loading ? "rgba(255,255,255,0.5)" : "white",
                      fontSize: "0.84rem",
                      lineHeight: "1.5",
                      border: m.role === "assistant" ? "1px solid rgba(0,212,255,0.1)" : "none",
                      fontStyle: m.loading ? "italic" : "normal",
                    }}>
                      {m.loading ? "● ● ●" : m.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Quick questions */}
              {messages.length <= 1 && (
                <div style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", marginBottom: "2px" }}>QUICK QUESTIONS</div>
                  {QUICK_QUESTIONS.slice(0, 3).map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)} style={{
                      background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)",
                      borderRadius: "8px", color: "rgba(255,255,255,0.75)", fontSize: "0.77rem",
                      padding: "8px 12px", textAlign: "left", cursor: "pointer",
                      transition: "all 0.2s",
                    }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{
                padding: "12px 16px", borderTop: "1px solid rgba(0,212,255,0.1)",
                display: "flex", gap: "8px",
              }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Ask Blackbuck anything..."
                  disabled={loading}
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(0,212,255,0.2)", borderRadius: "10px",
                    color: "white", padding: "10px 14px", fontSize: "0.84rem",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  style={{
                    background: "linear-gradient(135deg, #00D4FF, #7C3AED)",
                    border: "none", borderRadius: "10px",
                    width: 42, height: 42, cursor: "pointer",
                    fontSize: "1.1rem", flexShrink: 0,
                    opacity: loading || !input.trim() ? 0.4 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  ➤
                </button>
              </div>
            </>
          )}

          {/* ── GENERATE TAB ── */}
          {tab === "generate" && (
            <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                Generate a custom game and save it to <strong style={{ color: "#00D4FF" }}>My Games</strong>. Only you can see it!
              </div>

              {/* Type */}
              <div>
                <label style={labelStyle}>Game Type</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  {(["quiz", "flashcard"] as const).map(t => (
                    <button key={t} onClick={() => setGenType(t)} style={{
                      flex: 1, padding: "10px",
                      background: genType === t ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${genType === t ? "#00D4FF" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: "10px", color: genType === t ? "#00D4FF" : "rgba(255,255,255,0.6)",
                      fontFamily: "Orbitron, monospace", fontSize: "0.72rem",
                      fontWeight: 700, cursor: "pointer", textTransform: "uppercase",
                    }}>
                      {t === "quiz" ? "⚡ Quiz" : "📇 Flashcard"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div>
                <label style={labelStyle}>Topic</label>
                <input
                  value={genTopic}
                  onChange={e => setGenTopic(e.target.value)}
                  placeholder={`e.g. "Binary Trees", "Probability", "English Vocabulary"`}
                  style={inputStyle}
                />
              </div>

              {/* Count */}
              <div>
                <label style={labelStyle}>Number of Questions: {genCount}</label>
                <input type="range" min={5} max={20} value={genCount}
                  onChange={e => setGenCount(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#00D4FF", marginTop: "6px" }}
                />
              </div>

              <button
                onClick={generateGame}
                disabled={genLoading || !genTopic.trim()}
                style={{
                  ...btnStyle,
                  background: genLoading || !genTopic.trim()
                    ? "rgba(0,212,255,0.2)"
                    : "linear-gradient(135deg, #00D4FF, #7C3AED)",
                  cursor: genLoading || !genTopic.trim() ? "not-allowed" : "pointer",
                }}
              >
                {genLoading ? "🤖 Generating..." : "⚡ Generate Game"}
              </button>

              {/* Result */}
              {genResult && (
                <div style={{
                  background: "rgba(34,255,170,0.08)", border: "1px solid rgba(34,255,170,0.3)",
                  borderRadius: "12px", padding: "16px",
                }}>
                  <div style={{ color: "#22FFAA", fontFamily: "Orbitron, monospace", fontSize: "0.8rem", fontWeight: 800, marginBottom: "8px" }}>
                    ✅ {(genResult.title as string) ?? "Game Ready!"}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", marginBottom: "12px" }}>
                    {(genResult.questions as unknown[])?.length ?? 0} questions generated
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {onGameGenerated && (
                      <button onClick={() => onGameGenerated(genResult)} style={{
                        ...btnStyle, background: "linear-gradient(135deg, #22FFAA, #00D4FF)",
                        color: "#0A0A1A", fontWeight: 800,
                      }}>
                        💾 Save to My Games
                      </button>
                    )}
                    {isAdmin && onPublishGame && (
                      <button onClick={() => onPublishGame(genResult)} style={{
                        ...btnStyle, background: "linear-gradient(135deg, #FF6B35, #FF3CAC)",
                        color: "#fff", fontWeight: 800,
                      }}>
                        🌐 Publish to All Games
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── REPORT TAB ── */}
          {tab === "report" && (
            <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              {!report ? (
                <>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.82rem", lineHeight: 1.7 }}>
                    Blackbuck will analyse your skill progress across all games and give you a personalised placement readiness report.
                  </div>
                  <button
                    onClick={loadReport}
                    disabled={reportLoading}
                    style={{
                      ...btnStyle,
                      background: reportLoading
                        ? "rgba(168,85,247,0.2)"
                        : "linear-gradient(135deg, #A855F7, #7C3AED)",
                    }}
                  >
                    {reportLoading ? "📊 Analysing your data..." : "📊 Generate My Report"}
                  </button>
                </>
              ) : (
                <ReportView report={report} onRefresh={loadReport} loading={reportLoading} />
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReportView({ report, onRefresh, loading }: {
  report: SkillReport
  onRefresh: () => void
  loading: boolean
}) {
  const readiness    = report.readiness
  const strengths    = report.strengths
  const improvements = report.improvements
  const recs         = report.recommendations

  const scoreColor = (readiness?.score ?? 0) >= 70 ? "#22FFAA" : (readiness?.score ?? 0) >= 40 ? "#FFD700" : "#FF6B6B"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Readiness score */}
      <div style={{
        background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px",
        border: `1px solid ${scoreColor}40`, textAlign: "center",
      }}>
        <div style={{ color: scoreColor, fontFamily: "Orbitron, monospace", fontSize: "2rem", fontWeight: 900 }}>
          {readiness?.score ?? "—"}
        </div>
        <div style={{ color: scoreColor, fontFamily: "Orbitron, monospace", fontSize: "0.75rem", fontWeight: 700 }}>
          {readiness?.level ?? "ANALYSING"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginTop: "6px" }}>
          {readiness?.message}
        </div>
      </div>

      {/* Summary */}
      <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.82rem", lineHeight: 1.6, margin: 0 }}>
        {report.summary}
      </p>

      {strengths && strengths.length > 0 && (
        <Section title="✅ Strengths" color="#22FFAA" items={strengths} />
      )}
      {improvements && improvements.length > 0 && (
        <Section title="📈 Improve" color="#FFD700" items={improvements} />
      )}

      {recs && recs.length > 0 && (
        <div>
          <SectionHeader title="🎯 Recommendations" color="#00D4FF" />
          {recs.slice(0, 3).map((r, i) => (
            <div key={i} style={{
              background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: "8px", padding: "10px 12px", marginTop: "6px",
            }}>
              <div style={{ color: "#00D4FF", fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize" }}>
                {r.skill.replace(/_/g, " ")}
              </div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.78rem", marginTop: "2px" }}>
                {r.action}
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onRefresh} disabled={loading} style={{
        ...btnStyle, background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)",
      }}>
        {loading ? "Refreshing..." : "🔄 Regenerate Report"}
      </button>
    </div>
  )
}

function Section({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div>
      <SectionHeader title={title} color={color} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
        {items.map((item, i) => (
          <span key={i} style={{
            background: `${color}15`, border: `1px solid ${color}40`,
            borderRadius: "20px", padding: "3px 10px",
            color, fontSize: "0.75rem", textTransform: "capitalize",
          }}>
            {item.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div style={{
      color, fontFamily: "Orbitron, monospace", fontSize: "0.72rem",
      fontWeight: 800, letterSpacing: "0.05em", marginTop: "4px",
    }}>
      {title}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.5)", fontSize: "0.72rem",
  fontFamily: "Orbitron, monospace", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.05em",
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(0,212,255,0.2)", borderRadius: "10px",
  color: "white", padding: "10px 14px", fontSize: "0.84rem",
  outline: "none", marginTop: "6px", boxSizing: "border-box",
}

const btnStyle: React.CSSProperties = {
  width: "100%", padding: "12px",
  border: "none", borderRadius: "10px",
  color: "white", fontFamily: "Orbitron, monospace",
  fontSize: "0.78rem", fontWeight: 800,
  cursor: "pointer", transition: "all 0.2s",
}
