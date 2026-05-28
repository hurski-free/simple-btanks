import type { ITankConfig } from '../objects/ITankConfig'
import type { GunPart, HullPart, MovementExhaustSpec, TankModel, TrackSpec, TurretPart } from '../models/TankModel'

/** Shared hull and tracks for demo presets. */
const hullLight: HullPart = {
  offsetFromTankCenter: { x: 0, y: 0 },
  polygon: [
    { x: 26, y: 0 },
    { x: 18, y: 14 },
    { x: -22, y: 14 },
    { x: -26, y: 10 },
    { x: -26, y: -10 },
    { x: -22, y: -14 },
    { x: 18, y: -14 },
  ],
}

const hullMedium: HullPart = {
  offsetFromTankCenter: { x: 0, y: 0 },
  polygon: [
    { x: 30, y: 0 },
    { x: 23, y: 16 },
    { x: -24, y: 16 },
    { x: -30, y: 7 },
    { x: -30, y: -7 },
    { x: -24, y: -16 },
    { x: 23, y: -16 },
  ],
}

const hullHeavy: HullPart = {
  offsetFromTankCenter: { x: 0, y: 0 },
  polygon: [
    { x: 34, y: 0 },
    { x: 26, y: 18 },
    { x: -34, y: 18 },
    { x: -34, y: 10 },
    { x: -34, y: -10 },
    { x: -34, y: -18 },
    { x: 26, y: -18 },
  ],
}

/** Compact turret — low silhouette. */
export const turretCompact: TurretPart = {
  offsetFromHullPivot: { x: 2, y: 0 },
  polygon: [
    { x: 14, y: 0 },
    { x: 10, y: 11 },
    { x: -8, y: 12 },
    { x: -12, y: 8 },
    { x: -12, y: -8 },
    { x: -8, y: -12 },
    { x: 10, y: -11 },
  ],
}

/** Medium turret. */
export const turretMedium: TurretPart = {
  offsetFromHullPivot: { x: 0, y: 0 },
  polygon: [
    { x: 16, y: 0 },
    { x: 12, y: 13 },
    { x: -6, y: 14 },
    { x: -14, y: 10 },
    { x: -15, y: 0 },
    { x: -14, y: -10 },
    { x: -6, y: -14 },
    { x: 12, y: -13 },
  ],
}

/** Heavy turret. */
export const turretHeavy: TurretPart = {
  offsetFromHullPivot: { x: 10, y: 0 },
  polygon: [
    { x: 12, y: 0 },
    { x: 10, y: 15 },
    { x: -4, y: 16 },
    { x: -16, y: 12 },
    { x: -18, y: 0 },
    { x: -16, y: -12 },
    { x: -4, y: -16 },
    { x: 10, y: -15 },
  ],
}

/** Gun without muzzle brake — narrow barrel. */
export const gunPlain: GunPart = {
  offsetFromTurretPivot: { x: 8, y: 0 },
  polygon: [
    { x: -4, y: -3 },
    { x: 22, y: -2.5 },
    { x: 24, y: 0 },
    { x: 22, y: 2.5 },
    { x: -4, y: 3 },
  ],
}

/** Gun with muzzle brake / blast deflector at the muzzle (wide cap only past the barrel). */
export const gunWithMuzzleBrake: GunPart = {
  offsetFromTurretPivot: { x: 8, y: 0 },
  polygon: [
    { x: -4, y: -3 },
    { x: 21, y: -2.5 },
    { x: 23, y: -5 },
    { x: 29, y: -4 },
    { x: 32, y: 0 },
    { x: 29, y: 4 },
    { x: 23, y: 5 },
    { x: 21, y: 2.5 },
    { x: -4, y: 3 },
  ],
}

function buildTracks(base: { width: number; length: number; lateralOffset: number }): { leftTrack: TrackSpec; rightTrack: TrackSpec } {
  return {
    leftTrack: { width: base.width, length: base.length, lateralOffset: -base.lateralOffset },
    rightTrack: { width: base.width, length: base.length, lateralOffset: base.lateralOffset },
  }
}

function model(base: {
  turret: TurretPart
  hull: HullPart
  gun: GunPart
  tracks: TrackSpec
  movementExhaust: MovementExhaustSpec
}): TankModel {
  return {
    ...buildTracks(base.tracks),
    hull: base.hull,
    turret: base.turret,
    gun: base.gun,
    movementExhaust: base.movementExhaust,
  }
}

/** Rear-deck exhaust: slightly forward of the hull stern, inset from track centers. */
const exhaustLight: MovementExhaustSpec = {
  left: { x: -21, y: 11.5 },
  right: { x: -21, y: -11.5 },
}
const exhaustMedium: MovementExhaustSpec = {
  left: { x: -23, y: 12.5 },
  right: { x: -23, y: -12.5 },
}
const exhaustHeavy: MovementExhaustSpec = {
  left: { x: -28, y: 14 },
  right: { x: -28, y: -14 },
}

/** Built models (hull + turret and gun variants). */
export const TankModels = {
  lightTank: model({
    hull: hullLight,
    turret: turretCompact,
    gun: gunPlain,
    tracks: { width: 10, length: 58, lateralOffset: -15 },
    movementExhaust: exhaustLight,
  }),
  mediumTank: model({
    hull: hullMedium,
    turret: turretMedium,
    gun: gunWithMuzzleBrake,
    tracks: { width: 12, length: 68, lateralOffset: -16 },
    movementExhaust: exhaustMedium,
  }),
  heavyTank: model({
    hull: hullHeavy,
    turret: turretHeavy,
    gun: gunWithMuzzleBrake,
    tracks: { width: 15, length: 88, lateralOffset: -18 },
    movementExhaust: exhaustHeavy,
  }),
} as const

const baseStats = {
  forwardAccel: 240,
  backwardAccel: 140,
  maxForwardSpeed: 175,
  maxBackwardSpeed: 95,
  hullTurnSpeed: 2.2,
  turretTurnSpeed: 1.8,
  fireCooldownMs: 650,
  shellSpeed: 1220,
  shellLifetimeMs: 2400,
} as const

/** Full `Tank` configuration presets. */
export const TankPresets = {
  lightTank: {
    hitPoints: 150,
    mass: 0.85,
    gunDamage: 18,
    ...baseStats,
    model: TankModels.lightTank,
  } satisfies ITankConfig,

  mediumTank: {
    hitPoints: 240,
    mass: 1.15,
    gunDamage: 28,
    ...baseStats,
    maxForwardSpeed: 130,
    maxBackwardSpeed: 70,
    hullTurnSpeed: 2.0,
    turretTurnSpeed: 1.6,
    fireCooldownMs: 820,
    model: TankModels.mediumTank,
  } satisfies ITankConfig,

  heavyTank: {
    hitPoints: 320,
    mass: 1.65,
    gunDamage: 40,
    forwardAccel: 110,
    backwardAccel: 85,
    maxForwardSpeed: 95,
    maxBackwardSpeed: 45,
    hullTurnSpeed: 1.65,
    turretTurnSpeed: 1.35,
    fireCooldownMs: 1500,
    shellSpeed: 800,
    shellLifetimeMs: 2400,
    model: TankModels.heavyTank,
  } satisfies ITankConfig,
} as const

export type TankPresetId = keyof typeof TankPresets

/** Stable order for UI lists (light → heavy). */
export const TANK_PRESET_ORDER: readonly TankPresetId[] = ['lightTank', 'mediumTank', 'heavyTank']

export const TANK_PRESET_LABELS: Record<TankPresetId, string> = {
  lightTank: 'Light',
  mediumTank: 'Medium',
  heavyTank: 'Heavy',
}

export const DEFAULT_TANK_PRESET_ID: TankPresetId = 'heavyTank'

export function getTankPreset(id: TankPresetId): ITankConfig {
  return TankPresets[id]
}
