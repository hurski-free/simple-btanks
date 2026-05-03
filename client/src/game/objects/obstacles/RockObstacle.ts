import { circleIntersectsConvexPolygon } from '../../collision/polyCollision'
import type { Vec2 } from '../../math'
import { fillPolygon, strokePolygon } from '../../draw.helpers'
import { Obstacle } from '../Obstacle'
import { getRockPreset, rockTierWorldPolygon, type RockPresetId, type RockStackSpec } from '../../presets/RockPresets'

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/** HP range for rocks (inclusive). */
export const ROCK_HP_MIN = 500
export const ROCK_HP_MAX = 1000

export class RockObstacle extends Obstacle {
  readonly preset: RockStackSpec

  /**
   * @param cx World X of rock center (top-down).
   * @param cy World Y of rock center (top-down).
   */
  constructor(cx: number, cy: number, presetId: RockPresetId, hitPoints?: number) {
    const hp = hitPoints ?? randInt(ROCK_HP_MIN, ROCK_HP_MAX)
    super(cx, cy, hp)
    this.preset = getRockPreset(presetId)
  }

  /** Lowest (largest) tier footprint in world space — used for hits and tank collision. */
  getBottomTierWorldPolygon(): Vec2[] {
    return rockTierWorldPolygon(this.x, this.y, this.preset.tiers[0]!)
  }

  draw(ctx: CanvasRenderingContext2D, nowMs: number): void {
    const a = this.fadeAlpha(nowMs)
    if (a <= 0) return
    ctx.save()
    ctx.globalAlpha = a
    for (const t of this.preset.tiers) {
      const poly = rockTierWorldPolygon(this.x, this.y, t)
      fillPolygon(ctx, poly, t.fill)
      strokePolygon(ctx, poly, t.stroke, 1.25)
    }
    ctx.restore()
  }

  intersectsDisk(sx: number, sy: number, radius: number): boolean {
    return circleIntersectsConvexPolygon(sx, sy, radius, this.getBottomTierWorldPolygon())
  }
}
