import { BtanksGame, BTANKS_SHELL_HIT_RADIUS, hpBarFill, type BtanksShell } from './BtanksGame'
import { GAME_WS_CHANNEL } from './const'
import { circleIntersectsConvexPolygon } from './collision/polyCollision'
import { pushMuzzleFlash, pushSmoke } from './fx/worldParticles'
import type { MpFirePayload, MpPlayerSlot, MpShellConsumedPayload, MpStatePayload } from './mp/signalTypes'
import { isMpGamePayload } from './mp/signalTypes'
import { RemoteTankInterpolator, RemoteTankPredictor } from './mp/RemoteTankPredictor'
import { Tank } from './objects/Tank'
import { DEFAULT_MAP_PRESET_ID, getMapPreset, type MapPresetId } from './presets/MapPresets'
import { getTankPreset, type TankPresetId } from './presets/TankPresets'
import { WORLD_H, WORLD_W } from './world'

export type MultiplayerGameOptions = {
  isHost: boolean
  mapPresetId: MapPresetId
  hostTankPresetId: TankPresetId
  guestTankPresetId: TankPresetId
  sendSignal: (payload: unknown) => void
}

export class MultiplayerGame extends BtanksGame {
  private readonly isHost: boolean
  private readonly localSlot: MpPlayerSlot
  private readonly sendSignal: (payload: unknown) => void

  private readonly localTank: Tank
  private readonly remoteTank: Tank
  private readonly remotePredictor: RemoteTankPredictor | RemoteTankInterpolator

  private readonly keysBound = new Set<string>()
  private stateSeq = 0
  private remoteStateSeq = -1
  private syncTimer: ReturnType<typeof setInterval> | null = null

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.canvas.isConnected) return
    this.localTank.setKey(e.code, true)
    this.keysBound.add(e.code)
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyT', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.localTank.setKey(e.code, false)
    this.keysBound.delete(e.code)
  }

  private readonly onBlur = (): void => {
    for (const code of this.keysBound) {
      this.localTank.setKey(code, false)
    }
    this.keysBound.clear()
  }

  constructor(canvas: HTMLCanvasElement, options: MultiplayerGameOptions) {
    super(canvas, options.mapPresetId ?? DEFAULT_MAP_PRESET_ID)
    this.isHost = options.isHost
    this.localSlot = options.isHost ? 'host' : 'guest'
    this.sendSignal = options.sendSignal

    const localPreset = options.isHost ? options.hostTankPresetId : options.guestTankPresetId
    const remotePreset = options.isHost ? options.guestTankPresetId : options.hostTankPresetId
    this.localTank = new Tank(getTankPreset(localPreset))
    this.remoteTank = new Tank(getTankPreset(remotePreset))

    this.remotePredictor = options.isHost
      ? new RemoteTankInterpolator()
      : new RemoteTankPredictor()
  }

  onPeerPayload(raw: unknown): void {
    if (!isMpGamePayload(raw)) return
    switch (raw.kind) {
      case 'mp-state':
        this.applyRemoteState(raw)
        break
      case 'mp-fire':
        this.applyRemoteFire(raw)
        break
      case 'mp-shell-consumed':
        this.removeShellById((raw as MpShellConsumedPayload).shotId)
        break
      default:
        break
    }
  }

  private applyRemoteState(msg: MpStatePayload): void {
    if (msg.seq <= this.remoteStateSeq) return
    this.remoteStateSeq = msg.seq
    const snap = {
      x: msg.x,
      y: msg.y,
      hullAngle: msg.hullAngle,
      turretAngle: msg.turretAngle,
      forwardSpeed: msg.forwardSpeed,
    }
    const nowMs = performance.now()
    if (this.remotePredictor instanceof RemoteTankPredictor) {
      this.remotePredictor.onSnapshot(this.remoteTank, snap, nowMs)
    } else {
      this.remotePredictor.onSnapshot(this.remoteTank, snap)
    }
    this.remoteTank.hitPoints = msg.hitPoints
  }

  private applyRemoteFire(msg: MpFirePayload): void {
    if (msg.from === this.localSlot) return
    const nowMs = performance.now()
    this.shells.push({
      x: msg.x,
      y: msg.y,
      vx: msg.vx,
      vy: msg.vy,
      damage: msg.damage,
      bornMs: nowMs,
      lifetimeMs: msg.lifetimeMs,
      shotId: msg.shotId,
      firedBy: msg.from,
    })
  }

  private removeShellById(shotId: string): void {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]!
      if (s.shotId === shotId) {
        this.shells.splice(i, 1)
        return
      }
    }
  }

  protected enrichShellMetadata(shell: BtanksShell, _tank: Tank, _nowMs: number): void {
    void _tank
    void _nowMs
    shell.shotId = globalThis.crypto?.randomUUID?.() ?? `s-${Math.random().toString(36).slice(2)}`
    shell.firedBy = this.localSlot
  }

  protected consumeShellIfHitTank(s: BtanksShell, nowMs: number): boolean {
    void nowMs
    if (!s.firedBy || !s.shotId) return false

    const remotePoly = this.remoteTank.getCollisionWorldPolygon()
    const localPoly = this.localTank.getCollisionWorldPolygon()

    if (s.firedBy === this.localSlot) {
      if (circleIntersectsConvexPolygon(s.x, s.y, BTANKS_SHELL_HIT_RADIUS, remotePoly)) {
        return true
      }
      return false
    }

    if (!circleIntersectsConvexPolygon(s.x, s.y, BTANKS_SHELL_HIT_RADIUS, localPoly)) {
      return false
    }

    this.localTank.hitPoints = Math.max(0, this.localTank.hitPoints - s.damage)
    this.sendSignal({
      channel: GAME_WS_CHANNEL,
      kind: 'mp-shell-consumed',
      shotId: s.shotId,
    })
    return true
  }

  protected beginSession(): void {
    this.bindInput()
    this.clearTrackMarks()
    this.seedObstacles()

    const map = getMapPreset(this.mapPresetId)
    if (this.isHost) {
      this.layoutTankAtSpawn(this.localTank, map.spawns.player1, 0)
      this.layoutTankAtSpawn(this.remoteTank, map.spawns.player2, Math.PI)
    } else {
      this.layoutTankAtSpawn(this.localTank, map.spawns.player2, Math.PI)
      this.layoutTankAtSpawn(this.remoteTank, map.spawns.player1, 0)
    }

    this.syncTrackStampAnchor(this.localTank)
    this.syncTrackStampAnchor(this.remoteTank)

    const nowMs = performance.now()
    const initialRemote = {
      x: this.remoteTank.x,
      y: this.remoteTank.y,
      hullAngle: this.remoteTank.hullAngle,
      turretAngle: this.remoteTank.turretAngle,
      forwardSpeed: 0,
    }
    if (this.remotePredictor instanceof RemoteTankPredictor) {
      this.remotePredictor.reset(this.remoteTank, initialRemote, nowMs)
    } else {
      this.remotePredictor.reset(this.remoteTank, initialRemote)
    }

    this.stateSeq = 0
    this.remoteStateSeq = -1

    this.syncTimer = setInterval(() => this.sendLocalState(), 50)
  }

  protected endSession(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    this.unbindInput()
  }

  private layoutTankAtSpawn(tank: Tank, spawn: { x: number; y: number }, hullAngle: number): void {
    tank.x = spawn.x
    tank.y = spawn.y
    tank.hullAngle = hullAngle
    tank.turretAngle = 0
    tank.forwardSpeed = 0
    tank.hitPoints = tank.config.hitPoints
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

  private sendLocalState(): void {
    this.stateSeq += 1
    this.sendSignal({
      channel: GAME_WS_CHANNEL,
      kind: 'mp-state',
      seq: this.stateSeq,
      x: this.localTank.x,
      y: this.localTank.y,
      hullAngle: this.localTank.hullAngle,
      turretAngle: this.localTank.turretAngle,
      forwardSpeed: this.localTank.forwardSpeed,
      hitPoints: this.localTank.hitPoints,
    })
  }

  protected simulateFrame(dtSec: number, nowMs: number): void {
    this.localTank.update(dtSec, nowMs)
    this.clampTankInWorld(this.localTank)
    this.resolveTankAgainstObstacles(this.localTank, nowMs)
    this.clampTankInWorld(this.localTank)

    if (this.remotePredictor instanceof RemoteTankPredictor) {
      this.remotePredictor.step(this.remoteTank, dtSec, nowMs)
    } else {
      this.remotePredictor.step(this.remoteTank, dtSec)
    }
    this.clampTankInWorld(this.remoteTank)

    this.maybeStampTrackMarks(this.localTank)
    this.maybeStampTrackMarks(this.remoteTank)
    this.updateExhaustSmoke([this.localTank, this.remoteTank], dtSec)
    this.processTankFireWithNet(this.localTank, nowMs)
  }

  private processTankFireWithNet(tank: Tank, nowMs: number): void {
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

    this.sendSignal({
      channel: GAME_WS_CHANNEL,
      kind: 'mp-fire',
      shotId: shell.shotId!,
      from: this.localSlot,
      x: shell.x,
      y: shell.y,
      vx: shell.vx,
      vy: shell.vy,
      damage: shell.damage,
      bornMs: shell.bornMs,
      lifetimeMs: shell.lifetimeMs,
    })

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

  protected drawTanks(ctx: CanvasRenderingContext2D, nowMs: number): void {
    void nowMs
    const lp = this.localTank.hitPoints
    const rp = this.remoteTank.hitPoints
    if (lp > 0) this.localTank.draw(ctx)
    if (rp > 0) this.remoteTank.draw(ctx)
  }

  protected drawUiOverlays(nowMs: number, fontPx: number): void {
    const ctx = this.ctx
    const h = WORLD_H

    ctx.fillStyle = 'rgba(232, 234, 238, 0.55)'
    ctx.font = `${fontPx}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('WASD — hull  ·  QE — turret  ·  T — fire', 12, h - 12)

    this.drawMpHud(nowMs, fontPx)

    if (this.localTank.hitPoints <= 0) {
      ctx.fillStyle = 'rgba(240, 90, 72, 0.92)'
      ctx.font = `${fontPx * 1.6}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('You were destroyed', WORLD_W * 0.5, h * 0.45)
    } else if (this.remoteTank.hitPoints <= 0) {
      ctx.fillStyle = 'rgba(120, 168, 92, 0.92)'
      ctx.font = `${fontPx * 1.6}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Enemy destroyed', WORLD_W * 0.5, h * 0.45)
    }
    ctx.textAlign = 'left'
  }

  private drawMpHud(nowMs: number, fontPx: number): void {
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

    const labelW =
      Math.max(ctx.measureText('You').width, ctx.measureText('Enemy').width, ctx.measureText('CD').width) +
      gapAfterLabel
    const xBar = pad + labelW

    let rowY = pad + barH * 0.5

    const drawRow = (label: string, tank: Tank, isEnemy: boolean): void => {
      const maxHp = tank.config.hitPoints
      const hp = Math.max(0, tank.hitPoints)
      const hpRatio = maxHp > 0 ? Math.min(1, hp / maxHp) : 0
      ctx.fillStyle = 'rgba(232, 234, 238, 0.78)'
      ctx.fillText(label, pad, rowY)
      this.drawHudBar(ctx, xBar, rowY - barH * 0.5, barW, barH, hpRatio, hpBarFill(hpRatio))
      ctx.fillStyle = 'rgba(232, 234, 238, 0.92)'
      ctx.fillText(`${Math.round(hp)} / ${Math.round(maxHp)}`, xBar + barW + numsGap, rowY)
      rowY += barH + rowGap
      if (!isEnemy) {
        ctx.fillStyle = 'rgba(232, 234, 238, 0.78)'
        ctx.fillText('CD', pad, rowY)
        const reload = tank.gunReloadProgress(nowMs)
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
      }
    }

    drawRow('You', this.localTank, false)
    drawRow('Enemy', this.remoteTank, true)

    ctx.textBaseline = 'alphabetic'
  }
}