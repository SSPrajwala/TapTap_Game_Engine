import { useState, useCallback, useRef } from "react"
import type { DeerState } from "../components/ui/DeerMascot"

export function useDeerMascot() {
  const [deerState,  setDeerState]  = useState<DeerState>("idle")
  // triggerKey increments on every trigger — DeerMascot watches it as an
  // extra useEffect dependency so even consecutive same-type answers
  // (e.g. 3 correct in a row) re-run the animation each time.
  const [triggerKey, setTriggerKey] = useState(0)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fire = useCallback((s: DeerState, ms: number) => {
    // Cancel any pending auto-reset so state doesn't flicker mid-animation
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setDeerState(s)
    setTriggerKey(k => k + 1)           // force DeerMascot useEffect to re-run
    resetTimer.current = setTimeout(() => setDeerState("idle"), ms)
  }, [])

  const triggerCorrect = useCallback(() => fire("happy",   1300), [fire])
  const triggerWrong   = useCallback(() => fire("sad",     1000), [fire])
  const triggerVictory = useCallback(() => fire("victory", 2100), [fire])
  const triggerIdle    = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setDeerState("idle")
  }, [])

  return { deerState, triggerKey, triggerCorrect, triggerWrong, triggerVictory, triggerIdle }
}
