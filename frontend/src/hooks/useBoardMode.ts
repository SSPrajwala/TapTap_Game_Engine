/**
 * useBoardMode — manages Digital Board Mode state
 * Board mode: fullscreen + large-text + smartboard-optimised UI
 */
import { useState, useCallback, useEffect } from "react"

export function useBoardMode() {
  const [boardMode, setBoardMode] = useState(false)

  // Apply / remove CSS class on document root
  useEffect(() => {
    if (boardMode) {
      document.documentElement.classList.add("board-mode")
    } else {
      document.documentElement.classList.remove("board-mode")
    }
    return () => document.documentElement.classList.remove("board-mode")
  }, [boardMode])

  const enterBoardMode = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // fullscreen may be blocked in some browsers — still apply the mode
    }
    setBoardMode(true)
  }, [])

  const exitBoardMode = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen()
      }
    } catch { /* ignore */ }
    setBoardMode(false)
  }, [])

  const toggleBoardMode = useCallback(() => {
    if (boardMode) exitBoardMode()
    else            enterBoardMode()
  }, [boardMode, enterBoardMode, exitBoardMode])

  // Auto-exit board mode if user presses Escape
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && boardMode) {
        setBoardMode(false)
        document.documentElement.classList.remove("board-mode")
      }
    }
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [boardMode])

  return { boardMode, toggleBoardMode, enterBoardMode, exitBoardMode }
}
