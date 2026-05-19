import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { useSocket } from './hooks/useSocket'
import LobbyPage from './pages/LobbyPage'
import ConnectionBanner from './components/ConnectionBanner'
import KickNotice from './components/KickNotice'
import { capturePageview } from './lib/analytics'

const WaitingRoomPage = lazy(() => import('./pages/WaitingRoomPage'))
const GamePage = lazy(() => import('./pages/GamePage'))
const GameOverPage = lazy(() => import('./pages/GameOverPage'))

const App = () => {
  useSocket()
  const location = useLocation()
  useEffect(() => { capturePageview(location.pathname) }, [location.pathname])

  // Unlock the browser's audio context on first user interaction.
  // Must live here (not per-AudioPlayer) so it fires during the lobby/waiting
  // room, before any audio:play socket event can arrive.
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = new AudioContext()
        const buf = ctx.createBuffer(1, 1, 22050)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(0)
        ctx.resume().catch(() => {})
      } catch (_) {}
    }
    document.addEventListener('pointerdown', unlock, { once: true })
    return () => document.removeEventListener('pointerdown', unlock)
  }, [])

  return (
    <>
      <ConnectionBanner />
      <KickNotice />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/lobby" element={<WaitingRoomPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/over" element={<GameOverPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
