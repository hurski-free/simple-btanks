import type { TankModel } from '../models/TankModel'

/** Gameplay parameters for a tank plus geometry for rendering. */
export interface ITankConfig {
  hitPoints: number
  /** Relative mass for collisions (higher = harder to push). */
  mass: number
  gunDamage: number
  /** Forward acceleration (world units / s²). */
  forwardAccel: number
  /** Reverse acceleration magnitude (applied to negative speed). */
  backwardAccel: number
  maxForwardSpeed: number
  maxBackwardSpeed: number
  /** Hull rotation speed, rad/s. */
  hullTurnSpeed: number
  /** Turret rotation speed relative to hull, rad/s. */
  turretTurnSpeed: number
  /** Time between shots, ms. */
  fireCooldownMs: number
  /** Projectile speed (world units / s). */
  shellSpeed: number
  /** Projectile lifetime, ms. */
  shellLifetimeMs: number
  model: TankModel
}
