import { BtanksGame } from './BtanksGame'
import { DEFAULT_MAP_PRESET_ID, type MapPresetId } from './presets/MapPresets'
import { WORLD_H } from './world'

/** Host/guest P2P session; tank sync and second player to be wired on top of `BtanksGame`. */
export class MultiplayerGame extends BtanksGame {
  constructor(canvas: HTMLCanvasElement, mapPresetId: MapPresetId = DEFAULT_MAP_PRESET_ID) {
    super(canvas, mapPresetId)
  }

  protected beginSession(): void {
    this.clearTrackMarks()
    this.seedObstacles()
  }

  protected endSession(): void {}

  protected simulateFrame(_dtSec: number, _nowMs: number): void {}

  protected drawTanks(_ctx: CanvasRenderingContext2D, _nowMs: number): void {}

  protected drawUiOverlays(_nowMs: number, fontPx: number): void {
    const ctx = this.ctx
    const h = WORLD_H
    ctx.fillStyle = 'rgba(232, 234, 238, 0.55)'
    ctx.font = `${fontPx}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('Multiplayer (tanks / sync — next)', 12, h - 12)
  }
}
