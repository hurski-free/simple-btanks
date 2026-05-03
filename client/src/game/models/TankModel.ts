import type { Vec2 } from "../math"

/**
 * One track: dimensions and lateral offset of the track center from the tank center
 * (along local Y across the hull).
 */
export type TrackSpec = {
  /** Extent along the tank width axis (across movement). */
  width: number
  /** Extent along the tank length axis (forward). */
  length: number
  /** Track center offset from tank center along width (+ to the right in local axes). */
  lateralOffset: number
}

/** Hull polygon and offset of its reference point from the tank pivot (hull rotates around tank center). */
export type HullPart = {
  /** Vertices in hull axes (+X forward), before applying offset. */
  polygon: readonly Vec2[]
  /** Hull mesh offset from the tank center (often slightly back for visual balance). */
  offsetFromTankCenter: Vec2
}

/**
 * Turret: polygon and offset of the turret pivot from the tank pivot (hull-aligned axes).
 */
export type TurretPart = {
  polygon: readonly Vec2[]
  /**
   * Turret pivot in hull space (tank pivot is origin; hull mesh is additionally shifted by hull offset — see Tank.draw).
   */
  offsetFromHullPivot: Vec2
}

/** Gun: polygon in turret axes (+X along the barrel), offset from the turret pivot. */
export type GunPart = {
  polygon: readonly Vec2[]
  /** Barrel base offset from the turret pivot. */
  offsetFromTurretPivot: Vec2
}

/**
 * Movement exhaust in hull space (+X forward, +Y to the right), relative to the tank pivot.
 * Placed on the rear deck so plume reads as hull/engine exhaust, not track dust behind the treads.
 */
export type MovementExhaustSpec = {
  /** Port-side spawn (same side as `leftTrack` lateral offset sign in presets). */
  left: Vec2
  /** Starboard-side spawn (same side as `rightTrack`). */
  right: Vec2
}

/**
 * Geometric tank model for 2D rendering.
 * Tank center is the hull rotation pivot; forward is +X after applying hullAngle.
 */
export type TankModel = {
  leftTrack: TrackSpec
  rightTrack: TrackSpec
  hull: HullPart
  turret: TurretPart
  gun: GunPart
  movementExhaust: MovementExhaustSpec
}
