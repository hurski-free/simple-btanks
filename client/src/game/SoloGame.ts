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

const SHELL_HIT_RADIUS = 3.2

type Shell = {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  bornMs: number
}

function resolveTankConfig(v?: ITankConfig | TankPresetId): ITankConfig {
  if (v === undefined) return getTankPreset('lightTank')
  if (typeof v === 'string') return getTankPreset(v)
  return v
}

export class SoloGame {
  static readonly worldWidth = WORLD_W
  static readonly worldHeight = WORLD_H

  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly tank: Tank
  private readonly shells: Shell[] = []
  private readonly obstacles: Obstacle[] = []
  private readonly fxParticles: FxParticle[] = []
  private readonly trackLayerCanvas: HTMLCanvasElement
  private readonly trackLayerCtx: CanvasRenderingContext2D
  private readonly mapPresetId: MapPresetId
  private lastTrackStampX = 0
  private lastTrackStampY = 0
  private lastTrackStampA = 0
  private exhaustAccumulator = 0
  private readonly keysBound = new Set<string>()
  private raf = 0
  private lastTs = performance.now()
  private resizeObserver: ResizeObserver | null = null

  /** Scale: CSS pixels per world unit (fitting 1500×1000 into the container). */
  private _worldScale = 1
  private dpr = 1

  get worldScale(): number {
    return this._worldScale
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.canvas.isConnected) return
    this.tank.setKey(e.code, true)
    this.keysBound.add(e.code)
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyT', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.tank.setKey(e.code, false)
    this.keysBound.delete(e.code)
  }

  private readonly onBlur = (): void => {
    for (const code of this.keysBound) {
      this.tank.setKey(code, false)
    }
    this.keysBound.clear()
  }

  constructor(
    canvas: HTMLCanvasElement,
    configOrPreset?: ITankConfig | TankPresetId,
    mapPresetId: MapPresetId = DEFAULT_MAP_PRESET_ID,
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('SoloGame: 2d context unavailable')
    }
    this.canvas = canvas
    this.ctx = ctx
    this.mapPresetId = mapPresetId
    this.tank = new Tank(resolveTankConfig(configOrPreset))

    const trackCv = document.createElement('canvas')
    trackCv.width = WORLD_W
    trackCv.height = WORLD_H
    const trackCtx = trackCv.getContext('2d')
    if (!trackCtx) {
      throw new Error('SoloGame: track layer 2d context unavailable')
    }
    this.trackLayerCanvas = trackCv
    this.trackLayerCtx = trackCtx
  }

  start(): void {
    this.stop()
    this.bindInput()
    this.setupResize()
    this.layoutTank()
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
    this.unbindInput()
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }

  destroy(): void {
    this.stop()
  }

  private bindInput(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  private unbindInput(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.onBlur()
  }

  private setupResize(): void {
    const ro = new ResizeObserver(() => this.fitCanvas())
    ro.observe(this.canvas.parentElement ?? this.canvas)
    this.resizeObserver = ro
    this.fitCanvas()
  }

  private fitCanvas(): void {
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

  private layoutTank(): void {
    const map = getMapPreset(this.mapPresetId)
    this.tank.x = map.spawns.player1.x
    this.tank.y = map.spawns.player1.y
    this.clearTrackMarks()
    this.syncTrackStampAnchor()
    this.seedObstacles()
  }

  private seedObstacles(): void {
    this.obstacles.length = 0
    this.obstacles.push(...buildMapObstacles(getMapPreset(this.mapPresetId)))
  }

  private clearTrackMarks(): void {
    this.trackLayerCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.trackLayerCtx.clearRect(0, 0, WORLD_W, WORLD_H)
  }

  private syncTrackStampAnchor(): void {
    this.lastTrackStampX = this.tank.x
    this.lastTrackStampY = this.tank.y
    this.lastTrackStampA = this.tank.hullAngle
  }

  /** Leave skid marks when the hull moves or turns enough while the tracks are loaded. */
  /** Tank vs obstacles: SAT on hull+tracks convex hull vs rock base tier or wall quad; walls break. */
  private resolveTankAgainstObstacles(nowMs: number): void {
    let tx = this.tank.x
    let ty = this.tank.y

    for (let iter = 0; iter < 10; iter++) {
      let changed = false
      this.tank.x = tx
      this.tank.y = ty
      for (const o of this.obstacles) {
        if (o.isBreaking) continue
        const tankPoly = this.tank.getCollisionWorldPolygon()
        if (o instanceof WallObstacle) {
          const mtv = satMtvMoveAFromB(tankPoly, o.getWorldPolygon())
          if (mtv) {
            o.takeDamage(o.hitPoints + 1, nowMs)
            this.tank.forwardSpeed = 0
            changed = true
            continue
          }
        } else if (o instanceof RockObstacle) {
          const mtv = satMtvMoveAFromB(tankPoly, o.getBottomTierWorldPolygon())
          if (mtv) {
            tx += mtv.dx
            ty += mtv.dy
            this.tank.x = tx
            this.tank.y = ty
            this.tank.forwardSpeed = 0
            changed = true
            continue
          }
        }
      }
      this.tank.x = tx
      this.tank.y = ty
      if (!changed) break
    }
  }

  private maybeStampTrackMarks(): void {
    const ex = this.tank.getTrackSmokeIntensity()
    const spd = Math.abs(this.tank.forwardSpeed)
    if (ex < 0.11 && spd < 4.5) return

    const dx = this.tank.x - this.lastTrackStampX
    const dy = this.tank.y - this.lastTrackStampY
    const dist = Math.hypot(dx, dy)
    const dAng = Math.abs(
      Math.atan2(
        Math.sin(this.tank.hullAngle - this.lastTrackStampA),
        Math.cos(this.tank.hullAngle - this.lastTrackStampA),
      ),
    )
    if (dist < 2.5 && dAng < 0.052) return

    const alpha = Math.min(0.2, 0.048 + ex * 0.042 + spd * 0.00032)
    this.tank.stampTrackMarks(this.trackLayerCtx, alpha)
    this.syncTrackStampAnchor()
  }

  private beginFrameTransform(): void {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const s = this._worldScale * this.dpr
    ctx.setTransform(s, 0, 0, s, 0, 0)
  }

  private tick(dtSec: number, nowMs: number): void {
    this.tank.update(dtSec, nowMs)

    const pad = 40
    this.tank.x = Math.min(WORLD_W - pad, Math.max(pad, this.tank.x))
    this.tank.y = Math.min(WORLD_H - pad, Math.max(pad, this.tank.y))

    this.resolveTankAgainstObstacles(nowMs)
    this.tank.x = Math.min(WORLD_W - pad, Math.max(pad, this.tank.x))
    this.tank.y = Math.min(WORLD_H - pad, Math.max(pad, this.tank.y))

    this.maybeStampTrackMarks()

    const ex = this.tank.getTrackSmokeIntensity()
    this.exhaustAccumulator += ex * dtSec * (26 + ex * 42)
    let exhaustSpawns = Math.floor(this.exhaustAccumulator)
    this.exhaustAccumulator -= exhaustSpawns
    const exhaustPts = this.tank.getExhaustSpawnPoints()
    const bh = this.tank.hullAngle
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

    const shot = this.tank.tryFire(nowMs)
    if (shot) {
      const muzzle = this.tank.muzzleWorld()
      this.shells.push({
        x: muzzle.x,
        y: muzzle.y,
        vx: shot.vx,
        vy: shot.vy,
        damage: shot.damage,
        bornMs: nowMs,
      })
      const dmg = shot.damage
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

    updateFxParticles(this.fxParticles, dtSec)

    const maxLife = this.tank.config.shellLifetimeMs
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]!
      if (nowMs - s.bornMs > maxLife) {
        this.shells.splice(i, 1)
        continue
      }
      s.x += s.vx * dtSec
      s.y += s.vy * dtSec

      let hitObstacle = false
      for (const o of this.obstacles) {
        if (o.intersectsShell(s.x, s.y, SHELL_HIT_RADIUS)) {
          o.takeDamage(s.damage, nowMs)
          hitObstacle = true
          break
        }
      }
      if (hitObstacle) {
        this.shells.splice(i, 1)
        continue
      }

      if (s.x < -20 || s.y < -20 || s.x > WORLD_W + 20 || s.y > WORLD_H + 20) {
        this.shells.splice(i, 1)
      }
    }

    for (let oi = this.obstacles.length - 1; oi >= 0; oi--) {
      if (this.obstacles[oi]!.shouldRemove(nowMs)) {
        this.obstacles.splice(oi, 1)
      }
    }

    this.draw(nowMs)
  }

  private draw(nowMs: number): void {
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
      ctx.arc(s.x, s.y, 3.2, 0, Math.PI * 2)
      ctx.fillStyle = '#e8d060'
      ctx.fill()
      ctx.strokeStyle = '#5a5020'
      ctx.lineWidth = lineW
      ctx.stroke()
    }

    this.tank.draw(ctx)

    drawFlashParticles(ctx, this.fxParticles)

    const fontPx = Math.max(8, Math.round(12 / this._worldScale))
    ctx.fillStyle = 'rgba(232, 234, 238, 0.55)'
    ctx.font = `${fontPx}px system-ui, sans-serif`
    const hint = 'WASD — hull  ·  QE — turret  ·  T — fire'
    ctx.textAlign = 'left'
    ctx.fillText(hint, 12, h - 12)

    this.drawHud(nowMs, fontPx)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  private drawHud(nowMs: number, fontPx: number): void {
    const ctx = this.ctx
    const pad = 12
    const barW = 128
    const barH = 12
    const rowGap = 10
    const gapAfterLabel = 6
    const numsGap = 6

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `${fontPx}px system-ui, sans-serif`

    const labelW = Math.max(ctx.measureText('HP').width, ctx.measureText('CD').width) + gapAfterLabel
    const xBar = pad + labelW

    const maxHp = this.tank.config.hitPoints
    const hp = Math.max(0, this.tank.hitPoints)
    const hpRatio = maxHp > 0 ? Math.min(1, hp / maxHp) : 0

    let rowY = pad + barH * 0.5

    ctx.fillStyle = 'rgba(232, 234, 238, 0.78)'
    ctx.fillText('HP', pad, rowY)
    this.drawHudBar(ctx, xBar, rowY - barH * 0.5, barW, barH, hpRatio, hpBarFill(hpRatio))
    ctx.fillStyle = 'rgba(232, 234, 238, 0.92)'
    ctx.fillText(`${Math.round(hp)} / ${Math.round(maxHp)}`, xBar + barW + numsGap, rowY)

    rowY += barH + rowGap
    ctx.fillStyle = 'rgba(232, 234, 238, 0.78)'
    ctx.fillText('CD', pad, rowY)
    const reload = this.tank.gunReloadProgress(nowMs)
    this.drawHudBar(ctx, xBar, rowY - barH * 0.5, barW, barH, reload, reload >= 1 ? 'rgba(120, 168, 92, 0.92)' : 'rgba(168, 152, 88, 0.92)')

    ctx.textBaseline = 'alphabetic'
  }

  private drawHudBar(
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
