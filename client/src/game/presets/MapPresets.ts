import type { RockPresetId } from './RockPresets'

/** Single axis-aligned wall slab (same semantics as `WallObstacle`: length along X, thickness along Y). */
export type MapWallEntry = {
  readonly cx: number
  readonly cy: number
  readonly length: number
  readonly thickness: number
}

/** Horizontal fence strip (`createWallFence`). */
export type MapFenceEntry = {
  readonly centerX: number
  readonly centerY: number
  readonly segmentCount: number
  readonly segmentLength: number
  readonly thickness: number
  readonly gap: number
}

export type MapRockEntry = {
  readonly x: number
  readonly y: number
  readonly preset: RockPresetId
}

export type MapSpawnPair = {
  readonly player1: { readonly x: number; readonly y: number }
  readonly player2: { readonly x: number; readonly y: number }
}

export type MapPresetDef = {
  readonly id: MapPresetId
  readonly name: string
  readonly rocks: readonly MapRockEntry[]
  readonly fences: readonly MapFenceEntry[]
  readonly walls: readonly MapWallEntry[]
  readonly spawns: MapSpawnPair
}

export const MAP_PRESET_IDS = ['sandstormGulch', 'twinMesas', 'fenceCorridor'] as const
export type MapPresetId = (typeof MAP_PRESET_IDS)[number]

export const DEFAULT_MAP_PRESET_ID: MapPresetId = MAP_PRESET_IDS[0]!

/** Arid arena: upper/lower fence lines, central vertical slab, scattered rocks. */
const sandstormGulch: MapPresetDef = {
  id: 'sandstormGulch',
  name: 'Sandstorm Gulch',
  rocks: [
    { x: 400, y: 260, preset: 'mesa' },
    { x: 1080, y: 300, preset: 'pillar' },
    { x: 620, y: 620, preset: 'boulder' },
  ],
  fences: [
    { centerX: 750, centerY: 115, segmentCount: 11, segmentLength: 24, thickness: 3.5, gap: 5 },
    { centerX: 750, centerY: 885, segmentCount: 11, segmentLength: 24, thickness: 3.5, gap: 5 },
  ],
  walls: [{ cx: 750, cy: 500, length: 16, thickness: 220 }],
  spawns: {
    player1: { x: 165, y: 500 },
    player2: { x: 1335, y: 500 },
  },
}

/** Two large mesas and a broken center fence — open flanks. */
const twinMesas: MapPresetDef = {
  id: 'twinMesas',
  name: 'Twin Mesas',
  rocks: [
    { x: 340, y: 500, preset: 'mesa' },
    { x: 1160, y: 500, preset: 'mesa' },
    { x: 750, y: 260, preset: 'boulder' },
    { x: 750, y: 760, preset: 'pillar' },
  ],
  fences: [{ centerX: 750, centerY: 500, segmentCount: 5, segmentLength: 22, thickness: 3.2, gap: 8 }],
  walls: [],
  spawns: {
    player1: { x: 195, y: 500 },
    player2: { x: 1305, y: 500 },
  },
}

/** Side corridors framed by long walls; horizontal fence bands and corner pillars. */
const fenceCorridor: MapPresetDef = {
  id: 'fenceCorridor',
  name: 'Fence Corridor',
  rocks: [
    { x: 380, y: 500, preset: 'pillar' },
    { x: 1120, y: 500, preset: 'pillar' },
    { x: 750, y: 180, preset: 'boulder' },
  ],
  fences: [
    { centerX: 750, centerY: 320, segmentCount: 13, segmentLength: 20, thickness: 3.2, gap: 4 },
    { centerX: 750, centerY: 680, segmentCount: 13, segmentLength: 20, thickness: 3.2, gap: 4 },
  ],
  walls: [
    { cx: 240, cy: 500, length: 100, thickness: 12 },
    { cx: 1260, cy: 500, length: 100, thickness: 12 },
  ],
  spawns: {
    player1: { x: 130, y: 500 },
    player2: { x: 1370, y: 500 },
  },
}

export const MapPresets: Record<MapPresetId, MapPresetDef> = {
  sandstormGulch,
  twinMesas,
  fenceCorridor,
}

export function getMapPreset(id: MapPresetId): MapPresetDef {
  return MapPresets[id]
}
