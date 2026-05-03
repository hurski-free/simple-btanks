import type { Obstacle } from './objects/Obstacle'
import { RockObstacle, WallObstacle, createWallFence } from './objects/obstacles'
import type { MapPresetDef } from './presets/MapPresets'

export function buildMapObstacles(def: MapPresetDef): Obstacle[] {
  const out: Obstacle[] = []
  for (const r of def.rocks) {
    out.push(new RockObstacle(r.x, r.y, r.preset))
  }
  for (const w of def.walls) {
    out.push(new WallObstacle(w.cx, w.cy, w.length, w.thickness))
  }
  for (const f of def.fences) {
    out.push(...createWallFence(f.centerX, f.centerY, f.segmentCount, f.segmentLength, f.thickness, f.gap))
  }
  return out
}
