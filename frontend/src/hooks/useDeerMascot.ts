import { useState, useCallback } from "react"
import type { DeerState } from "../components/ui/DeerMascot"

export function useDeerMascot() {
  const [deerState, setDeerState] = useState<DeerState>("idle")

  // useCallback ensures stable refs so GameRenderer's engine.on useEffect
  // doesn't re-register listeners on every render
  const triggerCorrect = useCallback(() => setDeerState("happy"),  [])
  const triggerWrong   = useCallback(() => setDeerState("sad"),    [])
  const triggerVictory = useCallback(() => setDeerState("victory"), [])
  const triggerIdle = () => setDeerState("idle")

  return { deerState, triggerCorrect, triggerWrong, triggerVictory, triggerIdle }
}