import {
  BtanksGame,
  hpBarFill,
  resolveTankConfig,
} from './BtanksGame'
import type { ITankConfig } from './objects/ITankConfig'
import type { TankPresetId } from './presets/TankPresets'
import { DEFAULT_MAP_PRESET_ID, getMapPreset, type MapPresetId } from './presets/MapPresets'
import { Tank } from './objects/Tank'
import { WORLD_H } from './world'

export class SoloGame extends BtanksGame {
  private readonly tank: Tank
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
    this.clearTrackMarks()
    this.syncTrackStampAnchor(this.tank)
    this.seedObstacles()
  }

  protected simulateFrame(dtSec: number, nowMs: number): void {
    this.tank.update(dtSec, nowMs)

    this.clampTankInWorld(this.tank)
    this.resolveTankAgainstObstacles(this.tank, nowMs)
    this.clampTankInWorld(this.tank)

    this.maybeStampTrackMarks(this.tank)
    this.updateExhaustSmoke([this.tank], dtSec)
    this.processTankFire(this.tank, nowMs)
  }

  protected drawTanks(ctx: CanvasRenderingContext2D, _nowMs: number): void {
    this.tank.draw(ctx)
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
    this.drawHudBar(
      ctx,
      xBar,
      rowY - barH * 0.5,
      barW,
      barH,
      reload,
      reload >= 1 ? 'rgba(120, 168, 92, 0.92)' : 'rgba(168, 152, 88, 0.92)',
    )

    ctx.textBaseline = 'alphabetic'
  }
}
