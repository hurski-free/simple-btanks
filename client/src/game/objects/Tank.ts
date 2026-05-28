import type { ITankConfig } from './ITankConfig'
import type { HullPart, TankModel } from '../models/TankModel'
import { convexHull } from '../collision/polyCollision'
import { add, rot, type Vec2 } from '../math'
import { fillPolygon, strokePolygon } from '../draw.helpers'

const KEY_W = 'KeyW'
const KEY_S = 'KeyS'
const KEY_A = 'KeyA'
const KEY_D = 'KeyD'

export class Tank {
  readonly config: ITankConfig

  x = 0
  y = 0
  hullAngle = 0
  /** Turret angle relative to hull, rad. */
  turretAngle = 0
  /** Speed along hull axis (+ forward), world units/s. */
  forwardSpeed = 0
  hitPoints: number
  private readonly keys = new Set<string>()
  private fireHeld = false
  private lastFireMs = 0
  /** Scrolls tread stripe pattern along track length (world units, same as `forwardSpeed` integration). */
  private treadScroll = 0

  constructor(config: ITankConfig) {
    this.config = config
    this.hitPoints = config.hitPoints
  }

  /**
   * Convex hull of hull + both tracks in world space (hull rotation applied; turret not included).
   */
  getCollisionWorldPolygon(): Vec2[] {
    const m = this.config.model
    const h = this.hullAngle
    const ch = Math.cos(h)
    const sh = Math.sin(h)
    const pts: Vec2[] = []
    const { hull } = m
    const ox = hull.offsetFromTankCenter.x
    const oy = hull.offsetFromTankCenter.y
    for (const p of hull.polygon) {
      const lx = p.x + ox
      const ly = p.y + oy
      pts.push({
        x: this.x + ch * lx - sh * ly,
        y: this.y + sh * lx + ch * ly,
      })
    }
    for (const tr of [m.leftTrack, m.rightTrack]) {
      const hw = tr.length * 0.5
      const hh = tr.width * 0.5
      const ly = tr.lateralOffset
      for (const [lx, lyy] of [
        [-hw, ly - hh],
        [hw, ly - hh],
        [-hw, ly + hh],
        [hw, ly + hh],
      ] as const) {
        pts.push({
          x: this.x + ch * lx - sh * lyy,
          y: this.y + sh * lx + ch * lyy,
        })
      }
    }
    return convexHull(pts)
  }

  setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code)
    else this.keys.delete(code)
  }

  setFiring(down: boolean): void {
    this.fireHeld = down
  }

  /** 0 at shot moment, ramps to 1 when `fireCooldownMs` has elapsed (ready to fire). */
  gunReloadProgress(nowMs: number): number {
    const cd = this.config.fireCooldownMs
    if (cd <= 0) return 1
    return Math.min(1, (nowMs - this.lastFireMs) / cd)
  }

  tryFire(nowMs: number): { damage: number; speed: number; vx: number; vy: number } | null {
    if (!this.fireHeld) return null
    if (nowMs - this.lastFireMs < this.config.fireCooldownMs) return null
    this.lastFireMs = nowMs
    const dir = this.barrelWorldDir()
    return {
      damage: this.config.gunDamage,
      speed: this.config.shellSpeed,
      vx: dir.x * this.config.shellSpeed,
      vy: dir.y * this.config.shellSpeed,
    }
  }

  /**
   * Barrel direction in world space (unit vector).
   * Uses gun local +X (bore axis per `TankModel`); do not use vector pivot→muzzle — that chord
   * diverges from the bore when the turret is offset from the hull pivot.
   */
  barrelWorldDir(): { x: number; y: number } {
    const d1 = rot(1, 0, this.turretAngle)
    const d2 = rot(d1.x, d1.y, this.hullAngle)
    const L = Math.hypot(d2.x, d2.y)
    if (L < 1e-9) return { x: 1, y: 0 }
    return { x: d2.x / L, y: d2.y / L }
  }

  /** Projectile spawn point (muzzle) in world coordinates. */
  muzzleWorld(): { x: number; y: number } {
    return this.gunPointToWorld(this.muzzleInGunSpace())
  }

  private muzzleInGunSpace(): Vec2 {
    const { polygon } = this.config.model.gun
    let best = polygon[0]!
    let mx = best.x
    for (const p of polygon) {
      if (p.x > mx) {
        mx = p.x
        best = p
      }
    }
    return best
  }

  private gunPointToWorld(pGun: Vec2): { x: number; y: number } {
    const { gun, turret } = this.config.model
    const pTurret = add(pGun, gun.offsetFromTurretPivot)
    const r1 = rot(pTurret.x, pTurret.y, this.turretAngle)
    const pHull = add(r1, turret.offsetFromHullPivot)
    const r2 = rot(pHull.x, pHull.y, this.hullAngle)
    return { x: this.x + r2.x, y: this.y + r2.y }
  }

  update(dtSec: number, nowMs: number): void {
    void nowMs
    const c = this.config

    if (this.keys.has(KEY_A)) this.hullAngle -= c.hullTurnSpeed * dtSec
    if (this.keys.has(KEY_D)) this.hullAngle += c.hullTurnSpeed * dtSec
    let accel = 0
    if (this.keys.has(KEY_W)) accel += c.forwardAccel
    if (this.keys.has(KEY_S)) accel -= c.backwardAccel

    this.forwardSpeed += accel * dtSec
    const vmaxF = c.maxForwardSpeed
    const vmaxB = c.maxBackwardSpeed
    if (this.forwardSpeed > vmaxF) this.forwardSpeed = vmaxF
    if (this.forwardSpeed < -vmaxB) this.forwardSpeed = -vmaxB

    if (!this.keys.has(KEY_W) && !this.keys.has(KEY_S)) {
      const damp = Math.exp(-2.4 * dtSec)
      this.forwardSpeed *= damp
      if (Math.abs(this.forwardSpeed) < 2) this.forwardSpeed = 0
    }

    const ch = Math.cos(this.hullAngle)
    const sh = Math.sin(this.hullAngle)
    this.x += ch * this.forwardSpeed * dtSec
    this.y += sh * this.forwardSpeed * dtSec

    this.treadScroll += this.forwardSpeed * dtSec
  }

  /**
   * How hard to spawn track exhaust (0 = none). Stronger while W/S/A/D are held;
   * forward speed adds a bit of extra plume when driving keys are down.
   */
  getTrackSmokeIntensity(): number {
    let b = 0
    if (this.keys.has(KEY_W)) b += 0.88
    else if (this.keys.has(KEY_S)) b += 0.78
    if (this.keys.has(KEY_A) || this.keys.has(KEY_D)) b += 0.34
    const vmax = Math.max(this.config.maxForwardSpeed, this.config.maxBackwardSpeed, 1)
    const spdN = Math.min(1, Math.abs(this.forwardSpeed) / vmax)
    if (this.keys.has(KEY_W) || this.keys.has(KEY_S)) {
      b += spdN * 0.28
    } else if (this.keys.has(KEY_A) || this.keys.has(KEY_D)) {
      b += spdN * 0.12
    }
    return Math.min(1.45, b)
  }

  /** World positions for movement exhaust (from hull `movementExhaust` in model space). */
  getExhaustSpawnPoints(): { x: number; y: number }[] {
    const { movementExhaust } = this.config.model
    const h = this.hullAngle
    const ch = Math.cos(h)
    const sh = Math.sin(h)
    const pts: { x: number; y: number }[] = []
    for (const local of [movementExhaust.left, movementExhaust.right]) {
      pts.push({
        x: this.x + ch * local.x - sh * local.y,
        y: this.y + sh * local.x + ch * local.y,
      })
    }
    return pts
  }

  /**
   * Paints a semi-transparent tread imprint in world space (call on a persistent world-sized buffer).
   * Striped cleats along the track (gaps between), not a solid smear.
   */
  stampTrackMarks(ctx: CanvasRenderingContext2D, alpha: number): void {
    const m = this.config.model
    const a = Math.max(0, Math.min(0.35, alpha))
    const cleat = `rgba(34, 40, 28, ${a * 0.9})`
    const cleatShade = `rgba(18, 22, 14, ${a * 0.52})`
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.hullAngle)
    for (const tr of [m.leftTrack, m.rightTrack]) {
      const hw = tr.length * 0.5
      const hh = tr.width * 0.5
      ctx.save()
      ctx.translate(0, tr.lateralOffset)
      const pitch = Math.max(5.5, tr.length * 0.1)
      const cleatW = Math.min(4.2, pitch * 0.38)
      const y0 = -hh * 0.9
      const cleatH = tr.width * 0.84
      const edgeW = Math.max(0.85, cleatW * 0.22)
      for (let x = -hw + cleatW * 0.2; x < hw - cleatW * 0.1; x += pitch) {
        ctx.fillStyle = cleat
        ctx.fillRect(x, y0, cleatW, cleatH)
        ctx.fillStyle = cleatShade
        ctx.fillRect(x, y0, edgeW, cleatH * 0.52)
      }
      ctx.restore()
    }
    ctx.restore()
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const m = this.config.model
    ctx.save()
    if (this.hitPoints <= 0) {
      ctx.filter = 'grayscale(1)'
      ctx.globalAlpha = 0.82
    }
    ctx.translate(this.x, this.y)
    ctx.rotate(this.hullAngle)

    this.drawTracks(ctx, m)
    this.drawHull(ctx, m.hull)
    this.drawTurretAndGun(ctx, m)

    ctx.restore()
  }

  private drawTracks(ctx: CanvasRenderingContext2D, m: TankModel): void {
    const fill = '#2d3528'
    const stroke = '#1a1f16'
    for (const tr of [m.leftTrack, m.rightTrack]) {
      const hw = tr.length * 0.5
      const hh = tr.width * 0.5
      ctx.save()
      ctx.translate(0, tr.lateralOffset)
      ctx.beginPath()
      ctx.rect(-hw, -hh, tr.length, tr.width)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1
      ctx.stroke()

      const pitch = Math.max(2, tr.length * 0.1)
      const phase = mod(this.treadScroll, pitch)
      const stripeW = pitch * 0.42
      ctx.beginPath()
      ctx.rect(-hw, -hh, tr.length, tr.width)
      ctx.clip()
      ctx.fillStyle = 'rgba(12, 14, 10, 0.38)'
      for (let x = -hw - pitch + phase; x < hw + pitch; x += pitch) {
        ctx.fillRect(x, -hh, stripeW, tr.width)
      }
      ctx.restore()
    }
  }

  private drawHull(ctx: CanvasRenderingContext2D, hull: HullPart): void {
    ctx.save()
    ctx.translate(hull.offsetFromTankCenter.x, hull.offsetFromTankCenter.y)
    fillPolygon(ctx, hull.polygon, '#4d5c42')
    strokePolygon(ctx, hull.polygon, '#2a3224', 1.25)
    ctx.restore()
  }

  private drawTurretAndGun(ctx: CanvasRenderingContext2D, m: TankModel): void {
    const { turret, gun } = m
    ctx.save()
    ctx.translate(turret.offsetFromHullPivot.x, turret.offsetFromHullPivot.y)
    ctx.rotate(this.turretAngle)
    fillPolygon(ctx, turret.polygon, '#5a6b4c')
    strokePolygon(ctx, turret.polygon, '#2a3224', 1)

    ctx.translate(gun.offsetFromTurretPivot.x, gun.offsetFromTurretPivot.y)
    fillPolygon(ctx, gun.polygon, '#3a4434')
    strokePolygon(ctx, gun.polygon, '#1e2418', 1)

    ctx.restore()
  }
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}
