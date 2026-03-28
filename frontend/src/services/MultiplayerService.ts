// ─────────────────────────────────────────────────────────────────────────────
// MultiplayerService.ts
// Thin wrapper around socket.io-client.
// One singleton connection shared by the whole app.
// ─────────────────────────────────────────────────────────────────────────────

import { io, Socket } from "socket.io-client"

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:3001"

let _socket: Socket | null = null

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(BACKEND_URL, {
      autoConnect:  false,
      transports:   ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay:    1500,
    })
  }
  return _socket
}

export function connectSocket(): void {
  const s = getSocket()
  if (!s.connected) s.connect()
}

export function disconnectSocket(): void {
  if (_socket?.connected) _socket.disconnect()
}
