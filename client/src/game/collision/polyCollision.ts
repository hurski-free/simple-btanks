import type { Vec2 } from '../math'

/** Andrew's monotone chain; returns vertices in CCW order (excluding collinear middle points on hull). */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  if (points.length <= 1) return [...points]
  const uniq: Vec2[] = []
  const seen = new Set<string>()
  for (const p of points) {
    const k = `${p.x.toFixed(4)},${p.y.toFixed(4)}`
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push({ x: p.x, y: p.y })
  }
  if (uniq.length <= 2) return uniq
  const sorted = [...uniq].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Vec2[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }
  const upper: Vec2[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  const h = lower.concat(upper)
  let a = 0
  for (let i = 0; i < h.length; i++) {
    const p = h[i]!
    const q = h[(i + 1) % h.length]!
    a += p.x * q.y - p.y * q.x
  }
  if (a < 0) h.reverse()
  return h
}

function centroid(poly: readonly Vec2[]): Vec2 {
  let sx = 0
  let sy = 0
  for (const p of poly) {
    sx += p.x
    sy += p.y
  }
  const n = poly.length
  return { x: sx / n, y: sy / n }
}

function projectInterval(poly: readonly Vec2[], ax: number, ay: number): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const p of poly) {
    const d = p.x * ax + p.y * ay
    min = Math.min(min, d)
    max = Math.max(max, d)
  }
  return { min, max }
}

function unitEdgeNormals(poly: readonly Vec2[]): { x: number; y: number }[] {
  const n = poly.length
  const axes: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const p0 = poly[i]!
    const p1 = poly[(i + 1) % n]!
    const ex = p1.x - p0.x
    const ey = p1.y - p0.y
    const L = Math.hypot(ex, ey)
    if (L < 1e-9) continue
    axes.push({ x: -ey / L, y: ex / L })
  }
  return axes
}

/**
 * If convex polygons overlap, returns minimum translation to apply to `polyA` (in world space)
 * to separate it from `polyB` (fixed). Returns null if separated.
 */
export function satMtvMoveAFromB(polyA: readonly Vec2[], polyB: readonly Vec2[]): { dx: number; dy: number } | null {
  if (polyA.length < 2 || polyB.length < 2) return null
  const axes = [...unitEdgeNormals(polyA), ...unitEdgeNormals(polyB)]
  let minPen = Infinity
  let bestAx = 0
  let bestAy = 0
  for (const { x: ax, y: ay } of axes) {
    const A = projectInterval(polyA, ax, ay)
    const B = projectInterval(polyB, ax, ay)
    const pen = Math.min(A.max, B.max) - Math.max(A.min, B.min)
    if (pen < 0) return null
    if (pen < minPen) {
      minPen = pen
      bestAx = ax
      bestAy = ay
    }
  }
  const ca = centroid(polyA)
  const cb = centroid(polyB)
  let dx = bestAx * minPen
  let dy = bestAy * minPen
  const sep = (ca.x - cb.x) * dx + (ca.y - cb.y) * dy
  if (sep < 0) {
    dx = -dx
    dy = -dy
  }
  const eps = 0.35
  const extra = 1 + eps / Math.max(minPen, 1e-6)
  return { dx: dx * extra, dy: dy * extra }
}

function distSqPointSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const ab2 = abx * abx + aby * aby
  if (ab2 < 1e-12) return apx * apx + apy * apy
  let t = (apx * abx + apy * aby) / ab2
  t = Math.max(0, Math.min(1, t))
  const qx = ax + abx * t
  const qy = ay + aby * t
  const dx = px - qx
  const dy = py - qy
  return dx * dx + dy * dy
}

/** Point in strictly convex polygon (any consistent winding). */
export function pointInConvexPolygon(px: number, py: number, poly: readonly Vec2[]): boolean {
  const n = poly.length
  if (n < 3) return false
  let w = 0
  for (let i = 0; i < n; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % n]!
    const c = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)
    if (Math.abs(c) < 1e-9) continue
    const s = c > 0 ? 1 : -1
    if (w === 0) w = s
    else if (s !== w) return false
  }
  return w !== 0
}

export function circleIntersectsConvexPolygon(cx: number, cy: number, r: number, poly: readonly Vec2[]): boolean {
  if (poly.length < 3) return false
  if (pointInConvexPolygon(cx, cy, poly)) return true
  const r2 = r * r
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % n]!
    if (distSqPointSegment(cx, cy, a.x, a.y, b.x, b.y) <= r2) return true
  }
  return false
}
