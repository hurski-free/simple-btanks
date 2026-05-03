/** Fade-out duration when HP reaches zero (ms). */
export const OBSTACLE_BREAK_MS = 500

export abstract class Obstacle {
  /** World-space anchor (subclasses define meaning, usually center or bottom-center). */
  x: number
  y: number
  hitPoints: number
  /** When non-null, obstacle is vanishing until removal. */
  protected breakingStartMs: number | null = null

  constructor(x: number, y: number, hitPoints: number) {
    this.x = x
    this.y = y
    this.hitPoints = hitPoints
  }

  get isBreaking(): boolean {
    return this.breakingStartMs !== null
  }

  /** Visual opacity 1 → 0 while breaking; 1 while alive. */
  fadeAlpha(nowMs: number): number {
    if (this.breakingStartMs === null) return 1
    const t = nowMs - this.breakingStartMs
    return Math.max(0, 1 - t / OBSTACLE_BREAK_MS)
  }

  /** Remove from game list after break animation completes. */
  shouldRemove(nowMs: number): boolean {
    if (this.breakingStartMs === null) return false
    return nowMs - this.breakingStartMs >= OBSTACLE_BREAK_MS
  }

  takeDamage(amount: number, nowMs: number): void {
    if (this.breakingStartMs !== null) return
    this.hitPoints -= amount
    if (this.hitPoints <= 0) {
      this.hitPoints = 0
      this.breakingStartMs = nowMs
    }
  }

  abstract draw(ctx: CanvasRenderingContext2D, nowMs: number): void

  /** Geometry hit test (shell, tank hull disk, etc.). Ignores breaking state — use `intersectsShell` for shells. */
  abstract intersectsDisk(cx: number, cy: number, radius: number): boolean

  /** Hit test for a circular shell (inactive while breaking). */
  intersectsShell(sx: number, sy: number, radius: number): boolean {
    if (this.isBreaking) return false
    return this.intersectsDisk(sx, sy, radius)
  }
}
