import type { Tank } from '../objects/Tank'

type Snapshot = {
  x: number
  y: number
  hullAngle: number
  turretAngle: number
  forwardSpeed: number
  recvMs: number
}

/**
 * Guest-side display smoothing for the remote (host) tank: dead-reckoning from snapshots
 * + soft correction toward the latest authoritative state.
 */
export class RemoteTankPredictor {
  private snap: Snapshot | null = null
  private displayX = 0
  private displayY = 0
  private displayHull = 0
  private displayTurret = 0

  reset(tank: Tank, snap: Omit<Snapshot, 'recvMs'>, recvMs: number): void {
    this.snap = { ...snap, recvMs }
    this.displayX = snap.x
    this.displayY = snap.y
    this.displayHull = snap.hullAngle
    this.displayTurret = snap.turretAngle
    tank.x = this.displayX
    tank.y = this.displayY
    tank.hullAngle = this.displayHull
    tank.turretAngle = this.displayTurret
    tank.forwardSpeed = snap.forwardSpeed
  }

  onSnapshot(tank: Tank, snap: Omit<Snapshot, 'recvMs'>, recvMs: number): void {
    if (!this.snap) {
      this.reset(tank, snap, recvMs)
      return
    }
    this.snap = { ...snap, recvMs }
  }

  step(tank: Tank, dtSec: number, nowMs: number): void {
    const s = this.snap
    if (!s) return

    const ch = Math.cos(this.displayHull)
    const sh = Math.sin(this.displayHull)
    const predX = this.displayX + ch * s.forwardSpeed * dtSec
    const predY = this.displayY + sh * s.forwardSpeed * dtSec

    const ageSec = Math.max(0, (nowMs - s.recvMs) / 1000)
    const tx = s.x + Math.cos(s.hullAngle) * s.forwardSpeed * ageSec
    const ty = s.y + Math.sin(s.hullAngle) * s.forwardSpeed * ageSec

    const blendPos = 1 - Math.exp(-dtSec * 10)
    const blendAng = 1 - Math.exp(-dtSec * 14)

    this.displayX = predX + (tx - predX) * blendPos
    this.displayY = predY + (ty - predY) * blendPos

    let dh = s.hullAngle - this.displayHull
    dh = Math.atan2(Math.sin(dh), Math.cos(dh))
    this.displayHull += dh * blendAng

    let dt = s.turretAngle - this.displayTurret
    dt = Math.atan2(Math.sin(dt), Math.cos(dt))
    this.displayTurret += dt * blendAng

    tank.x = this.displayX
    tank.y = this.displayY
    tank.hullAngle = this.displayHull
    tank.turretAngle = this.displayTurret
    tank.forwardSpeed = s.forwardSpeed
  }
}

/**
 * Host-side: simple chase toward latest guest snapshot (interpolation feel).
 */
export class RemoteTankInterpolator {
  private target: Omit<Snapshot, 'recvMs'> | null = null
  private displayX = 0
  private displayY = 0
  private displayHull = 0
  private displayTurret = 0

  reset(tank: Tank, snap: Omit<Snapshot, 'recvMs'>): void {
    this.target = { ...snap }
    this.displayX = snap.x
    this.displayY = snap.y
    this.displayHull = snap.hullAngle
    this.displayTurret = snap.turretAngle
    tank.x = this.displayX
    tank.y = this.displayY
    tank.hullAngle = this.displayHull
    tank.turretAngle = this.displayTurret
    tank.forwardSpeed = snap.forwardSpeed
  }

  onSnapshot(tank: Tank, snap: Omit<Snapshot, 'recvMs'>): void {
    if (!this.target) {
      this.reset(tank, snap)
      return
    }
    this.target = { ...snap }
  }

  step(tank: Tank, dtSec: number): void {
    const s = this.target
    if (!s) return

    const k = 1 - Math.exp(-dtSec * 12)
    this.displayX += (s.x - this.displayX) * k
    this.displayY += (s.y - this.displayY) * k

    let dh = s.hullAngle - this.displayHull
    dh = Math.atan2(Math.sin(dh), Math.cos(dh))
    this.displayHull += dh * k

    let dt = s.turretAngle - this.displayTurret
    dt = Math.atan2(Math.sin(dt), Math.cos(dt))
    this.displayTurret += dt * k

    tank.x = this.displayX
    tank.y = this.displayY
    tank.hullAngle = this.displayHull
    tank.turretAngle = this.displayTurret
    tank.forwardSpeed = s.forwardSpeed
  }
}
