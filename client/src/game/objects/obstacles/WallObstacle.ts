import type { Vec2 } from '../../math'
import { Obstacle } from '../Obstacle'

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/** HP range for walls (inclusive). */
export const WALL_HP_MIN = 30
export const WALL_HP_MAX = 50

/**
 * Thin axis-aligned slab in the ground plane (top-down fence plank).
 * @param cx Center X
 * @param cy Center Y
 * @param length Longer extent (along fence axis, here X)
 * @param thickness Narrow extent (here Y), a few world units
 */
export class WallObstacle extends Obstacle {
  readonly halfL: number
  readonly halfT: number

  constructor(cx: number, cy: number, length: number, thickness: number, hitPoints?: number) {
    const hp = hitPoints ?? randInt(WALL_HP_MIN, WALL_HP_MAX)
    super(cx, cy, hp)
    this.halfL = length * 0.5
    this.halfT = thickness * 0.5
  }

  /** World-space rectangle corners (axis-aligned, CCW). */
  getWorldPolygon(): Vec2[] {
    return [
      { x: this.x - this.halfL, y: this.y - this.halfT },
      { x: this.x + this.halfL, y: this.y - this.halfT },
      { x: this.x + this.halfL, y: this.y + this.halfT },
      { x: this.x - this.halfL, y: this.y + this.halfT },
    ]
  }

  draw(ctx: CanvasRenderingContext2D, nowMs: number): void {
    const a = this.fadeAlpha(nowMs)
    if (a <= 0) return
    const x0 = this.x - this.halfL
    const y0 = this.y - this.halfT
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = '#3a3d36'
    ctx.strokeStyle = '#1e2118'
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.rect(x0, y0, this.halfL * 2, this.halfT * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 0.75
    ctx.beginPath()
    ctx.moveTo(x0 + 1, y0 + this.halfT)
    ctx.lineTo(x0 + this.halfL * 2 - 1, y0 + this.halfT)
    ctx.stroke()
    ctx.restore()
  }

  intersectsDisk(sx: number, sy: number, radius: number): boolean {
    const nx = Math.max(this.x - this.halfL, Math.min(this.x + this.halfL, sx))
    const ny = Math.max(this.y - this.halfT, Math.min(this.y + this.halfT, sy))
    const dx = sx - nx
    const dy = sy - ny
    return dx * dx + dy * dy <= radius * radius
  }
}

/**
 * Fence from above: thin planks along X with gaps.
 * @param segmentLength plank length along X
 * @param thickness plank width along Y (thin)
 */
export function createWallFence(
  centerX: number,
  centerY: number,
  segmentCount: number,
  segmentLength: number,
  thickness: number,
  gap: number,
): WallObstacle[] {
  const span = segmentCount * segmentLength + (segmentCount - 1) * gap
  const x0 = centerX - span * 0.5 + segmentLength * 0.5
  const out: WallObstacle[] = []
  for (let i = 0; i < segmentCount; i++) {
    const x = x0 + i * (segmentLength + gap)
    out.push(new WallObstacle(x, centerY, segmentLength, thickness))
  }
  return out
}
