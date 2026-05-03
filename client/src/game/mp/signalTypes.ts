import { GAME_WS_CHANNEL } from '../const'
import type { MapPresetId } from '../presets/MapPresets'
import type { TankPresetId } from '../presets/TankPresets'

export type MpPlayerSlot = 'host' | 'guest'

export type MpPrepPayload = {
  channel: typeof GAME_WS_CHANNEL
  kind: 'mp-prep'
  mapPresetId: MapPresetId
  tankPresetId: TankPresetId
}

export type MpSchedulePayload = {
  channel: typeof GAME_WS_CHANNEL
  kind: 'mp-schedule'
  /** Wall-clock ms (`Date.now()`), when combat simulation should begin. */
  startAtMs: number
  mapPresetId: MapPresetId
  hostTankPresetId: TankPresetId
  guestTankPresetId: TankPresetId
}

export type MpGameStartPayload = {
  channel: typeof GAME_WS_CHANNEL
  kind: 'game-start'
  mapPresetId: MapPresetId
  hostTankPresetId: TankPresetId
  guestTankPresetId: TankPresetId
}

export type MpStatePayload = {
  channel: typeof GAME_WS_CHANNEL
  kind: 'mp-state'
  seq: number
  x: number
  y: number
  hullAngle: number
  turretAngle: number
  forwardSpeed: number
  hitPoints: number
}

export type MpFirePayload = {
  channel: typeof GAME_WS_CHANNEL
  kind: 'mp-fire'
  shotId: string
  from: MpPlayerSlot
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  bornMs: number
  lifetimeMs: number
}

export type MpShellConsumedPayload = {
  channel: typeof GAME_WS_CHANNEL
  kind: 'mp-shell-consumed'
  shotId: string
}

export type MpPrepMismatchPayload = {
  channel: typeof GAME_WS_CHANNEL
  kind: 'mp-prep-mismatch'
}

export type MpGamePayload =
  | MpPrepPayload
  | MpSchedulePayload
  | MpGameStartPayload
  | MpStatePayload
  | MpFirePayload
  | MpShellConsumedPayload
  | MpPrepMismatchPayload

export function isMpGamePayload(p: unknown): p is MpGamePayload {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false
  const o = p as Record<string, unknown>
  if (o.channel !== GAME_WS_CHANNEL) return false
  return typeof o.kind === 'string'
}
