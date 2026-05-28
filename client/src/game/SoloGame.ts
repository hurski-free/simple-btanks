import {
  BTANKS_SHELL_HIT_RADIUS,
  BtanksGame,
  type BtanksShell,
  hpBarFill,
  resolveTankConfig,
} from './BtanksGame'
import { circleIntersectsConvexPolygon } from './collision/polyCollision'
import { RockObstacle, WallObstacle } from './objects/obstacles'
import type { ITankConfig } from './objects/ITankConfig'
import type { TankPresetId } from './presets/TankPresets'
import { getTankPreset } from './presets/TankPresets'
import { DEFAULT_MAP_PRESET_ID, getMapPreset, type MapPresetId } from './presets/MapPresets'
import { Tank } from './objects/Tank'
import { WORLD_H } from './world'

export class SoloGame extends BtanksGame {
  private readonly tank: Tank
  private readonly botTank: Tank
  private readonly keysBound = new Set<string>()

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
    super(canvas, mapPresetId)
    this.tank = new Tank(resolveTankConfig(configOrPreset))
    this.botTank = new Tank(getTankPreset('mediumTank'))
  }

  protected beginSession(): void {
    this.bindInput()
    this.layoutTank()
  }

  protected endSession(): void {
    this.unbindInput()
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

  private layoutTank(): void {
    const map = getMapPreset(this.mapPresetId)
    this.tank.x = map.spawns.player1.x
    this.tank.y = map.spawns.player1.y
    this.tank.hullAngle = 0
    this.tank.turretAngle = 0
    this.tank.forwardSpeed = 0
    this.tank.hitPoints = this.tank.config.hitPoints
    this.botTank.x = map.spawns.player2.x
    this.botTank.y = map.spawns.player2.y
    this.botTank.hullAngle = Math.PI
    this.botTank.turretAngle = 0
    this.botTank.forwardSpeed = 0
    this.botTank.hitPoints = this.botTank.config.hitPoints
    this.clearTrackMarks()
    this.syncTrackStampAnchor(this.tank)
    this.syncTrackStampAnchor(this.botTank)
    this.seedObstacles()
  }

  protected simulateFrame(dtSec: number, nowMs: number): void {
    this.updateBotAi(nowMs)
    this.tank.update(dtSec, nowMs)
    this.botTank.update(dtSec, nowMs)

    this.clampTankInWorld(this.tank)
    this.clampTankInWorld(this.botTank)
    this.resolveTankAgainstObstacles(this.tank, nowMs)
    this.resolveTankAgainstObstacles(this.botTank, nowMs)
    this.clampTankInWorld(this.tank)
    this.clampTankInWorld(this.botTank)
    this.resolveTankAgainstTank(this.tank, this.botTank)
    this.clampTankInWorld(this.tank)
    this.clampTankInWorld(this.botTank)

    this.maybeStampTrackMarks(this.tank)
    this.maybeStampTrackMarks(this.botTank)
    this.updateExhaustSmoke([this.tank, this.botTank], dtSec)
    this.processTankFire(this.tank, nowMs)
    this.processTankFire(this.botTank, nowMs)
  }

  protected drawTanks(ctx: CanvasRenderingContext2D, _nowMs: number): void {
    if (this.botTank.hitPoints > 0) this.botTank.draw(ctx)
    if (this.tank.hitPoints > 0) this.tank.draw(ctx)
  }

  protected enrichShellMetadata(shell: BtanksShell, tank: Tank, _nowMs: number): void {
    shell.firedBy = tank === this.tank ? 'host' : 'guest'
  }

  protected consumeShellIfHitTank(shell: BtanksShell, _nowMs: number): boolean {
    const shooter = shell.firedBy
    if (!shooter) return false
    const victim = shooter === 'host' ? this.botTank : this.tank
    if (victim.hitPoints <= 0) return false
    const poly = victim.getCollisionWorldPolygon()
    if (!circleIntersectsConvexPolygon(shell.x, shell.y, BTANKS_SHELL_HIT_RADIUS, poly)) return false
    victim.hitPoints = Math.max(0, victim.hitPoints - shell.damage)
    if (victim.hitPoints <= 0) {
      victim.forwardSpeed = 0
      victim.setKey('KeyW', false)
      victim.setKey('KeyS', false)
      victim.setKey('KeyA', false)
      victim.setKey('KeyD', false)
      victim.setKey('KeyQ', false)
      victim.setKey('KeyE', false)
      victim.setKey('KeyT', false)
    }
    return true
  }

  protected drawUiOverlays(_nowMs: number, fontPx: number): void {
    const ctx = this.ctx
    const h = WORLD_H

    ctx.fillStyle = 'rgba(232, 234, 238, 0.55)'
    ctx.font = `${fontPx}px system-ui, sans-serif`
    const hint = 'WASD — hull  ·  QE — turret  ·  T — fire'
    ctx.textAlign = 'left'
    ctx.fillText(hint, 12, h - 12)

    this.drawSoloHud(_nowMs, fontPx)
  }

  private drawSoloHud(nowMs: number, fontPx: number): void {
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

    const labelW = Math.max(ctx.measureText('HP').width, ctx.measureText('Enemy').width, ctx.measureText('CD').width) + gapAfterLabel
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
    this.drawHudBar(
      ctx,
      xBar,
      rowY - barH * 0.5,
      barW,
      barH,
      reload,
      reload >= 1 ? 'rgba(120, 168, 92, 0.92)' : 'rgba(168, 152, 88, 0.92)',
    )

    rowY += barH + rowGap
    ctx.fillStyle = 'rgba(232, 234, 238, 0.78)'
    ctx.fillText('Enemy', pad, rowY)
    const enemyMaxHp = this.botTank.config.hitPoints
    const enemyHp = Math.max(0, this.botTank.hitPoints)
    const enemyRatio = enemyMaxHp > 0 ? Math.min(1, enemyHp / enemyMaxHp) : 0
    this.drawHudBar(ctx, xBar, rowY - barH * 0.5, barW, barH, enemyRatio, hpBarFill(enemyRatio))
    ctx.fillStyle = 'rgba(232, 234, 238, 0.92)'
    ctx.fillText(`${Math.round(enemyHp)} / ${Math.round(enemyMaxHp)}`, xBar + barW + numsGap, rowY)

    ctx.textBaseline = 'alphabetic'
  }

  private updateBotAi(nowMs: number): void {
    if (this.botTank.hitPoints <= 0 || this.tank.hitPoints <= 0) {
      this.botTank.setKey('KeyW', false)
      this.botTank.setKey('KeyS', false)
      this.botTank.setKey('KeyA', false)
      this.botTank.setKey('KeyD', false)
      this.botTank.setKey('KeyT', false)
      return
    }

    const dx = this.tank.x - this.botTank.x
    const dy = this.tank.y - this.botTank.y
    const dist = Math.hypot(dx, dy)
    const desiredToTarget = Math.atan2(dy, dx)
    const avoidSteer = this.computeObstacleAvoidanceSteer(this.botTank, desiredToTarget)
    const desired = desiredToTarget + avoidSteer
    const deltaHull = Math.atan2(Math.sin(desired - this.botTank.hullAngle), Math.cos(desired - this.botTank.hullAngle))
    const absDelta = Math.abs(deltaHull)

    this.botTank.setKey('KeyA', deltaHull < -0.08)
    this.botTank.setKey('KeyD', deltaHull > 0.08)

    const preferForward = absDelta < 0.85 && dist > 150
    const preferBack = dist < 90 && absDelta < 1.25
    this.botTank.setKey('KeyW', preferForward)
    this.botTank.setKey('KeyS', !preferForward && preferBack)

    const desiredTurretWorld = Math.atan2(dy, dx)
    this.botTank.turretAngle = Math.atan2(
      Math.sin(desiredTurretWorld - this.botTank.hullAngle),
      Math.cos(desiredTurretWorld - this.botTank.hullAngle),
    )

    const alignedForShot = Math.abs(deltaHull) < 0.22
    const inRange = dist < 560
    const firePulse = Math.floor(nowMs / 110) % 2 === 0
    this.botTank.setKey('KeyT', alignedForShot && inRange && firePulse)
  }

  private computeObstacleAvoidanceSteer(bot: Tank, desiredAngle: number): number {
    const forwardX = Math.cos(bot.hullAngle)
    const forwardY = Math.sin(bot.hullAngle)
    const lookAhead = Math.max(95, 95 + Math.abs(bot.forwardSpeed) * 0.55)
    const feelerX = bot.x + forwardX * lookAhead
    const feelerY = bot.y + forwardY * lookAhead
    const guardRadius = 52

    let steer = 0
    for (const o of this.obstacles) {
      if (o.isBreaking) continue
      let threat = o.intersectsDisk(feelerX, feelerY, guardRadius)
      threat ||= o.intersectsDisk(bot.x + forwardX * (lookAhead * 0.65), bot.y + forwardY * (lookAhead * 0.65), guardRadius * 0.75)
      if (!threat) continue

      const toObsX = o.x - bot.x
      const toObsY = o.y - bot.y
      const ahead = toObsX * forwardX + toObsY * forwardY
      if (ahead < -20) continue

      const side = Math.sign(forwardX * toObsY - forwardY * toObsX) || 1
      const dist = Math.hypot(toObsX, toObsY)
      const nearFactor = Math.max(0.2, 1 - Math.min(1, dist / (lookAhead + 70)))
      const obstacleFactor = o instanceof WallObstacle ? 1.05 : o instanceof RockObstacle ? 0.92 : 1
      steer += -side * 0.62 * nearFactor * obstacleFactor
    }

    const desiredDelta = Math.atan2(Math.sin(desiredAngle - bot.hullAngle), Math.cos(desiredAngle - bot.hullAngle))
    const maxSteer = Math.abs(desiredDelta) > 1.15 ? 0.58 : 0.82
    return Math.max(-maxSteer, Math.min(maxSteer, steer))
  }
}
