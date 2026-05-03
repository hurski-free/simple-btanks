import type { Vec2 } from '../math'

/** One elevation contour: polygon in the horizontal plane, local coords centered at (0,0). */
export type RockTierDef = {
  readonly polygon: readonly Vec2[]
  fill: string
  stroke: string
}

export type RockStackSpec = {
  readonly tiers: readonly RockTierDef[]
}

/** Regular octagon in local space (top-down footprint). */
function octLocal(radius: number, squashY = 1): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 8
    out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius * squashY })
  }
  return out
}

const ROCK_VISUAL_SCALE = 1.5

/** Slightly irregular outline for a more natural rock silhouette (top-down). */
function blobLocal(scale: number): Vec2[] {
  const r = 69 * scale
  const angles = [0, 0.45, 0.95, 1.55, 2.15, 2.75, 3.35, 4.0, 4.6, 5.2]
  const k = [1, 0.88, 0.95, 0.82, 0.9, 0.85, 0.92, 0.8, 0.87, 0.9]
  return angles.map((t, i) => ({
    x: Math.cos(t) * r * k[i]!,
    y: Math.sin(t) * r * k[i]! * 0.92,
  }))
}

/** Wide mesa — 3 nested footprints, largest outer. */
export const rockPresetMesa: RockStackSpec = {
  tiers: [
    { polygon: octLocal(52 * ROCK_VISUAL_SCALE, 0.88), fill: '#4a4f52', stroke: '#2a2d30' },
    { polygon: octLocal(36 * ROCK_VISUAL_SCALE, 0.9), fill: '#5a5f62', stroke: '#32363a' },
    { polygon: octLocal(20 * ROCK_VISUAL_SCALE, 0.92), fill: '#6a6f72', stroke: '#3a3e42' },
  ],
}

/** Narrow pillar — 4 tight rings. */
export const rockPresetPillar: RockStackSpec = {
  tiers: [
    { polygon: octLocal(26 * ROCK_VISUAL_SCALE, 0.82), fill: '#454850', stroke: '#282b32' },
    { polygon: octLocal(20 * ROCK_VISUAL_SCALE, 0.84), fill: '#525660', stroke: '#30343c' },
    { polygon: octLocal(14 * ROCK_VISUAL_SCALE, 0.86), fill: '#5e6368', stroke: '#383c44' },
    { polygon: octLocal(8 * ROCK_VISUAL_SCALE, 0.88), fill: '#6a6f76', stroke: '#40444c' },
  ],
}

/** Boulder — irregular outer mass, 3 tiers. */
export const rockPresetBoulder: RockStackSpec = {
  tiers: [
    { polygon: blobLocal(1), fill: '#3d4248', stroke: '#22262c' },
    { polygon: blobLocal(0.62), fill: '#4d5258', stroke: '#2c3036' },
    { polygon: blobLocal(0.32), fill: '#5c6168', stroke: '#343840' },
  ],
}

export const RockPresets = {
  mesa: rockPresetMesa,
  pillar: rockPresetPillar,
  boulder: rockPresetBoulder,
} as const

export type RockPresetId = keyof typeof RockPresets

export function getRockPreset(id: RockPresetId): RockStackSpec {
  return RockPresets[id]
}

/** World-space vertices for one tier (common center `cx`, `cy`). */
export function rockTierWorldPolygon(cx: number, cy: number, tier: RockTierDef): Vec2[] {
  return tier.polygon.map((p) => ({ x: cx + p.x, y: cy + p.y }))
}
