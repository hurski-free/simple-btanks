import type { Vec2 } from "./math"

export function fillPolygon(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], style: string): void {
  if (pts.length === 0) return
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)

  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y)
  }

  ctx.closePath()
  ctx.fillStyle = style
  ctx.fill()
}

export function strokePolygon(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], stroke: string, lineWidth: number): void {
  if (pts.length === 0) return
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)

  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y)
  }

  ctx.closePath()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.stroke()
}
