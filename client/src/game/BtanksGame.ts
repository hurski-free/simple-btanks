import type { ITankConfig } from './objects/ITankConfig'
import {
  drawFlashParticles,
  drawSmokeParticles,
  pushMuzzleFlash,
  pushSmoke,
  updateFxParticles,
  type FxParticle,
} from './fx/worldParticles'
import { satMtvMoveAFromB } from './collision/polyCollision'
import { getTankPreset, type TankPresetId } from './presets/TankPresets'
import { DEFAULT_MAP_PRESET_ID, getMapPreset, type MapPresetId } from './presets/MapPresets'
import { buildMapObstacles } from './mapObstacles'
import { Obstacle } from './objects/Obstacle'
import { Tank } from './objects/Tank'
import { RockObstacle, WallObstacle } from './objects/obstacles'
import { WORLD_H, WORLD_W } from './world'

export const BTANKS_SHELL_HIT_RADIUS = 3.2

/** Who fired the shell in online PvP (`host` / `guest` are the same on both clients). */
export type BtanksShellOwner = 'host' | 'guest'

export type BtanksShell = {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  bornMs: number
  lifetimeMs: number
  /** Multiplayer: stable id for sync and removal. */
  shotId?: string
  firedBy?: BtanksShellOwner
}

export type TrackStampAnchor = { x: number; y: number; a: number }

export function resolveTankConfig(v?: ITankConfig | TankPresetId): ITankConfig {
  if (v === undefined) return getTankPreset('lightTank')
  if (typeof v === 'string') return getTankPreset(v)
  return v
}

export abstract class BtanksGame {
  static readonly worldWidth = WORLD_W
  static readonly worldHeight = WORLD_H

  protected readonly canvas: HTMLCanvasElement
  protected readonly ctx: CanvasRenderingContext2D
  protected readonly shells: BtanksShell[] = []
  protected readonly obstacles: Obstacle[] = []
  protected readonly fxParticles: FxParticle[] = []
  protected readonly trackLayerCanvas: HTMLCanvasElement
  protected readonly trackLayerCtx: CanvasRenderingContext2D
  protected mapPresetId: MapPresetId

  private readonly exhaustAccumulatorByTank = new Map<Tank, number>()
  private readonly stampAnchorByTank = new Map<Tank, TrackStampAnchor>()

  private raf = 0
  private lastTs = performance.now()
  private resizeObserver: ResizeObserver | null = null

  /** Scale: CSS pixels per world unit (fitting 1500×1000 into the container). */
  private _worldScale = 1
  protected dpr = 1

  get worldScale(): number {
    return this._worldScale
  }

  protected constructor(canvas: HTMLCanvasElement, mapPresetId: MapPresetId = DEFAULT_MAP_PRESET_ID) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('BtanksGame: 2d context unavailable')
    }
    this.canvas = canvas
    this.ctx = ctx
    this.mapPresetId = mapPresetId

    const trackCv = document.createElement('canvas')
    trackCv.width = WORLD_W
    trackCv.height = WORLD_H
    const trackCtx = trackCv.getContext('2d')
    if (!trackCtx) {
      throw new Error('BtanksGame: track layer 2d context unavailable')
    }
    this.trackLayerCanvas = trackCv
    this.trackLayerCtx = trackCtx
  }

  start(): void {
    this.stop()
    this.beginSession()
    this.setupResize()
    this.lastTs = performance.now()
    const loop = (ts: number): void => {
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000)
      this.lastTs = ts
      this.tick(dt, ts)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.endSession()
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }

  destroy(): void {
    this.stop()
  }

  /** Input binding, spawn layout, etc. Called once when `start()` begins. */
  protected abstract beginSession(): void

  /** Release input and other session hooks. Called from `stop()`. */
  protected abstract endSession(): void

  /** Per-frame simulation for all tanks, tracks, firing — before shells/FX integration in `tick`. */
  protected abstract simulateFrame(dtSec: number, nowMs: number): void

  /** Draw all tanks in world space (after obstacles and shells, before flash FX). */
  protected abstract drawTanks(ctx: CanvasRenderingContext2D, nowMs: number): void

  /** Hint text, HUD, etc. World-space coordinates; `fontPx` matches solo scaling. */
  protected abstract drawUiOverlays(nowMs: number, fontPx: number): void

  /** Optional multiplayer metadata on spawned shells (shot id, owner). Solo: no-op. */
  protected enrichShellMetadata(_shell: BtanksShell, _tank: Tank, _nowMs: number): void {
    void _shell
    void _tank
    void _nowMs
  }

  /**
   * PvP: remove a shell that hit a tank. Default: never. Implement victim + shooter cosmetic removal online.
   */
  protected consumeShellIfHitTank(_shell: BtanksShell, _nowMs: number): boolean {
    void _shell
    void _nowMs
    return false
  }

  protected setupResize(): void {
    const ro = new ResizeObserver(() => this.fitCanvas())
    ro.observe(this.canvas.parentElement ?? this.canvas)
    this.resizeObserver = ro
    this.fitCanvas()
  }

  protected fitCanvas(): void {
    const parent = this.canvas.parentElement
    const availW = parent ? parent.clientWidth : this.canvas.clientWidth
    const availH = parent ? parent.clientHeight : this.canvas.clientHeight
    this.dpr = Math.min(2, window.devicePixelRatio || 1)

    const safeW = Math.max(1, availW)
    const safeH = Math.max(1, availH)
    this._worldScale = Math.min(safeW / WORLD_W, safeH / WORLD_H)

    const cssPx = WORLD_W * this._worldScale
    this.canvas.style.width = `${cssPx}px`
    this.canvas.style.height = `${WORLD_H * this._worldScale}px`
    this.canvas.width = Math.max(1, Math.floor(cssPx * this.dpr))
    this.canvas.height = Math.max(1, Math.floor(WORLD_H * this._worldScale * this.dpr))
  }

  protected seedObstacles(): void {
    this.obstacles.length = 0
    this.obstacles.push(...buildMapObstacles(getMapPreset(this.mapPresetId)))
  }

  protected clearTrackMarks(): void {
    this.trackLayerCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.trackLayerCtx.clearRect(0, 0, WORLD_W, WORLD_H)
  }

  protected syncTrackStampAnchor(tank: Tank): void {
    this.stampAnchorByTank.set(tank, {
      x: tank.x,
      y: tank.y,
      a: tank.hullAngle,
    })
  }

  /** Leave skid marks when the hull moves or turns enough while the tracks are loaded. */
  protected maybeStampTrackMarks(tank: Tank): void {
    const anchor = this.stampAnchorByTank.get(tank)
    if (!anchor) {
      this.syncTrackStampAnchor(tank)
      return
    }

    const ex = tank.getTrackSmokeIntensity()
    const spd = Math.abs(tank.forwardSpeed)
    if (ex < 0.11 && spd < 4.5) return

    const dx = tank.x - anchor.x
    const dy = tank.y - anchor.y
    const dist = Math.hypot(dx, dy)
    const dAng = Math.abs(
      Math.atan2(Math.sin(tank.hullAngle - anchor.a), Math.cos(tank.hullAngle - anchor.a)),
    )
    if (dist < 2.5 && dAng < 0.052) return

    const alpha = Math.min(0.2, 0.048 + ex * 0.042 + spd * 0.00032)
    tank.stampTrackMarks(this.trackLayerCtx, alpha)
    this.syncTrackStampAnchor(tank)
  }

  /**
   * Tank vs obstacles: SAT on hull+tracks convex hull vs rock base tier or wall quad; walls break.
   */
  protected resolveTankAgainstObstacles(tank: Tank, nowMs: number): void {
    let tx = tank.x
    let ty = tank.y

    for (let iter = 0; iter < 10; iter++) {
      let changed = false
      tank.x = tx
      tank.y = ty
      for (const o of this.obstacles) {
        if (o.isBreaking) continue
        const tankPoly = tank.getCollisionWorldPolygon()
        if (o instanceof WallObstacle) {
          const mtv = satMtvMoveAFromB(tankPoly, o.getWorldPolygon())
          if (mtv) {
            o.takeDamage(o.hitPoints + 1, nowMs)
            tank.forwardSpeed = 0
            changed = true
            continue
          }
        } else if (o instanceof RockObstacle) {
          const mtv = satMtvMoveAFromB(tankPoly, o.getBottomTierWorldPolygon())
          if (mtv) {
            tx += mtv.dx
            ty += mtv.dy
            tank.x = tx
            tank.y = ty
            tank.forwardSpeed = 0
            changed = true
            continue
          }
        }
      }
      tank.x = tx
      tank.y = ty
      if (!changed) break
    }
  }

  protected clampTankInWorld(tank: Tank, pad = 40): void {
    tank.x = Math.min(WORLD_W - pad, Math.max(pad, tank.x))
    tank.y = Math.min(WORLD_H - pad, Math.max(pad, tank.y))
  }

  protected updateExhaustSmoke(tanks: readonly Tank[], dtSec: number): void {
    for (const tank of tanks) {
      const ex = tank.getTrackSmokeIntensity()
      let acc = this.exhaustAccumulatorByTank.get(tank) ?? 0
      acc += ex * dtSec * (26 + ex * 42)
      let exhaustSpawns = Math.floor(acc)
      acc -= exhaustSpawns
      this.exhaustAccumulatorByTank.set(tank, acc)

      const exhaustPts = tank.getExhaustSpawnPoints()
      const bh = tank.hullAngle
      const backX = -Math.cos(bh)
      const backY = -Math.sin(bh)
      while (exhaustSpawns-- > 0 && exhaustPts.length > 0) {
        const pick = exhaustPts[Math.floor(Math.random() * exhaustPts.length)]!
        pushSmoke(
          this.fxParticles,
          pick.x + (Math.random() - 0.5) * 10,
          pick.y + (Math.random() - 0.5) * 10,
          backX * (12 + Math.random() * 26) + (Math.random() - 0.5) * 16,
          backY * (12 + Math.random() * 26) + (Math.random() - 0.5) * 16,
          3.5 + Math.random() * 5 + ex * 1.2,
          0.38 + Math.random() * 0.55 + ex * 0.18,
        )
      }
    }
  }

  protected processTankFire(tank: Tank, nowMs: number): void {
    const shot = tank.tryFire(nowMs)
    if (!shot) return

    const muzzle = tank.muzzleWorld()
    const shell: BtanksShell = {
      x: muzzle.x,
      y: muzzle.y,
      vx: shot.vx,
      vy: shot.vy,
      damage: shot.damage,
      bornMs: nowMs,
      lifetimeMs: tank.config.shellLifetimeMs,
    }
    this.enrichShellMetadata(shell, tank, nowMs)
    this.shells.push(shell)
    const dmg = shot.damage
    const bh = tank.hullAngle
    const backX = -Math.cos(bh)
    const backY = -Math.sin(bh)
    const vm = Math.hypot(shot.vx, shot.vy)
    const bx = vm > 1e-6 ? -shot.vx / vm : backX
    const by = vm > 1e-6 ? -shot.vy / vm : backY
    const px = -by
    const py = bx
    const flashR = 5 + dmg * 0.24
    const flashLife = 0.052 + Math.min(0.045, dmg * 0.0011)
    pushMuzzleFlash(this.fxParticles, muzzle.x, muzzle.y, flashR, flashLife)
    const puffCount = Math.round(2 + dmg * 0.22)
    const smokeR0 = 2.2 + dmg * 0.065
    const smokeLife = 0.32 + dmg * 0.006
    const blow = 10 + dmg * 0.35
    for (let i = 0; i < puffCount; i++) {
      const spread = (Math.random() - 0.5) * (4 + dmg * 0.08)
      pushSmoke(
        this.fxParticles,
        muzzle.x + px * spread * 0.4 + (Math.random() - 0.5) * 6,
        muzzle.y + py * spread * 0.4 + (Math.random() - 0.5) * 6,
        bx * (blow + Math.random() * (8 + dmg * 0.15)) + px * (Math.random() - 0.5) * 14,
        by * (blow + Math.random() * (8 + dmg * 0.15)) + py * (Math.random() - 0.5) * 14,
        smokeR0 + Math.random() * (1.4 + dmg * 0.04),
        smokeLife + Math.random() * (0.18 + dmg * 0.003),
      )
    }
  }

  protected beginFrameTransform(): void {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const s = this._worldScale * this.dpr
    ctx.setTransform(s, 0, 0, s, 0, 0)
  }

  protected tick(dtSec: number, nowMs: number): void {
    this.simulateFrame(dtSec, nowMs)
    updateFxParticles(this.fxParticles, dtSec)
    this.advanceShells(dtSec, nowMs)
    this.pruneObstacles(nowMs)
    this.draw(nowMs)
  }

  private advanceShells(dtSec: number, nowMs: number): void {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]!
      if (nowMs - s.bornMs > s.lifetimeMs) {
        this.shells.splice(i, 1)
        continue
      }
      s.x += s.vx * dtSec
      s.y += s.vy * dtSec

      let hitObstacle = false
      for (const o of this.obstacles) {
        if (o.intersectsShell(s.x, s.y, BTANKS_SHELL_HIT_RADIUS)) {
          o.takeDamage(s.damage, nowMs)
          hitObstacle = true
          break
        }
      }
      if (hitObstacle) {
        this.shells.splice(i, 1)
        continue
      }

      if (this.consumeShellIfHitTank(s, nowMs)) {
        this.shells.splice(i, 1)
        continue
      }

      if (s.x < -20 || s.y < -20 || s.x > WORLD_W + 20 || s.y > WORLD_H + 20) {
        this.shells.splice(i, 1)
      }
    }
  }

  private pruneObstacles(nowMs: number): void {
    for (let oi = this.obstacles.length - 1; oi >= 0; oi--) {
      if (this.obstacles[oi]!.shouldRemove(nowMs)) {
        this.obstacles.splice(oi, 1)
      }
    }
  }

  protected draw(nowMs: number): void {
    this.beginFrameTransform()
    const ctx = this.ctx
    const w = WORLD_W
    const h = WORLD_H

    ctx.fillStyle = '#121510'
    ctx.fillRect(0, 0, w, h)

    const lineW = Math.max(0.35, 1 / (this._worldScale * this.dpr))
    ctx.strokeStyle = 'rgba(184, 201, 74, 0.08)'
    ctx.lineWidth = lineW
    const grid = 48
    for (let x = 0; x <= w; x += grid) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += grid) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.drawImage(this.trackLayerCanvas, 0, 0)

    drawSmokeParticles(ctx, this.fxParticles)

    for (const o of this.obstacles) {
      o.draw(ctx, nowMs)
    }

    for (const s of this.shells) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, BTANKS_SHELL_HIT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#e8d060'
      ctx.fill()
      ctx.strokeStyle = '#5a5020'
      ctx.lineWidth = lineW
      ctx.stroke()
    }

    this.drawTanks(ctx, nowMs)

    drawFlashParticles(ctx, this.fxParticles)

    const fontPx = Math.max(8, Math.round(12 / this._worldScale))
    this.drawUiOverlays(nowMs, fontPx)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  protected drawHudBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fillRatio: number,
    fillColor: string,
  ): void {
    const r = Math.min(4, h * 0.45)
    ctx.fillStyle = 'rgba(8, 10, 6, 0.72)'
    roundRectPath(ctx, x, y, w, h, r)
    ctx.fill()
    const fw = Math.max(0, w * fillRatio)
    if (fw > 0.5) {
      ctx.fillStyle = fillColor
      ctx.save()
      roundRectPath(ctx, x, y, w, h, r)
      ctx.clip()
      ctx.beginPath()
      ctx.rect(x, y, fw, h)
      ctx.fill()
      ctx.restore()
    }
    ctx.strokeStyle = 'rgba(184, 201, 74, 0.28)'
    ctx.lineWidth = Math.max(0.5, 1 / (this._worldScale * this.dpr))
    roundRectPath(ctx, x, y, w, h, r)
    ctx.stroke()
  }
}

function hpBarFill(ratio: number): string {
  if (ratio > 0.55) return 'rgba(108, 158, 78, 0.95)'
  if (ratio > 0.28) return 'rgba(196, 168, 64, 0.95)'
  return 'rgba(196, 88, 72, 0.95)'
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w * 0.5, h * 0.5)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export { hpBarFill, roundRectPath }
