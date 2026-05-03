export type ClientMessage =
  | { type: 'create-room'; hostUsername: string; displayName: string; password?: string }
  | { type: 'list-rooms' }
  | { type: 'join-room'; roomId: string; guestUsername: string; password?: string }
  | { type: 'signal'; payload: unknown }
  | { type: 'leave-room' }
  | { type: 'chat-send'; nickname: string; text: string }

export type ServerMessage =
  | { type: 'room-created'; roomId: string; displayName: string; password?: string }
  | {
      type: 'room-list'
      rooms: Array<{ roomId: string; displayName: string; hasPassword: boolean }>
    }
  | {
      type: 'joined-room'
      roomId: string
      displayName: string
      role: 'guest'
      hostUsername: string
    }
  | { type: 'peer-joined'; peerUsername: string }
  | { type: 'signal'; payload: unknown }
  | { type: 'peer-left' }
  | { type: 'room-closed'; reason: string }
  | { type: 'left-room' }
  | { type: 'online-count'; count: number }
  | {
      type: 'chat-history'
      messages: Array<{ id: string; at: string; nickname: string; text: string }>
    }
  | { type: 'chat-message'; id: string; at: string; nickname: string; text: string }
  | { type: 'error'; code: string; message: string }

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const o = data as Record<string, unknown>
    if (typeof o.type !== 'string') return null
    return data as ServerMessage
  } catch {
    return null
  }
}

export function wsUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined
  if (fromEnv) return fromEnv
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}
