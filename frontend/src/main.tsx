import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { EngineCore } from "./engine/EngineCore"

const sampleGame = {
  gameName: "Logical Reasoning Challenge",
  levels: [
    { levelId: 1, difficulty: "easy", timeLimit: 60 },
    { levelId: 2, difficulty: "medium", timeLimit: 45 },
    { levelId: 3, difficulty: "hard", timeLimit: 30 }
  ]
}

const testMetrics = {
  accuracy: 85,
  responseTime: 40,
  attempts: 1
}

EngineCore.run(sampleGame, testMetrics)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)