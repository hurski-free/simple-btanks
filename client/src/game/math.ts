/** Point in 2D space. */
export type Vec2 = { readonly x: number; readonly y: number }

export function rot(x: number, y: number, a: number): Vec2 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: x * c - y * s, y: x * s + y * c }
}

export function add(a: Vec2, b: Vec2): { x: number; y: number } {
  return { x: a.x + b.x, y: a.y + b.y }
}
