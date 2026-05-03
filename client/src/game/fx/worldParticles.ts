/** Exhaust / dust trail behind the tank. */
export type SmokeParticle = {
  kind: 'smoke'
  x: number
  y: number
  vx: number
  vy: number
  age: number
  maxAge: number
  r0: number
}

/** Brief additive muzzle flash. */
export type FlashParticle = {
  kind: 'flash'
  x: number
  y: number
  age: number
  maxAge: number
  r: number
}

export type FxParticle = SmokeParticle | FlashParticle

export const FX_MAX_PARTICLES = 520

export function updateFxParticles(list: FxParticle[], dt: number): void {
  const drag = Math.exp(-1.1 * dt)
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!
    if (p.kind === 'smoke') {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= drag
      p.vy *= drag
    }
    p.age += dt
    if (p.age >= p.maxAge) {
      list.splice(i, 1)
    }
  }
}

export function pushSmoke(
  list: FxParticle[],
  x: number,
  y: number,
  vx: number,
  vy: number,
  r0: number,
  maxAge: number,
): void {
  if (list.length >= FX_MAX_PARTICLES) {
    list.splice(0, list.length - FX_MAX_PARTICLES + 1)
  }
  list.push({
    kind: 'smoke',
    x,
    y,
    vx,
    vy,
    age: 0,
    maxAge,
    r0,
  })
}

export function pushMuzzleFlash(list: FxParticle[], x: number, y: number, radius: number, maxAgeSec: number): void {
  if (list.length >= FX_MAX_PARTICLES) {
    list.splice(0, list.length - FX_MAX_PARTICLES + 1)
  }
  list.push({
    kind: 'flash',
    x,
    y,
    age: 0,
    maxAge: maxAgeSec,
    r: radius,
  })
}

export function drawSmokeParticles(ctx: CanvasRenderingContext2D, list: readonly FxParticle[]): void {
  for (const p of list) {
    if (p.kind !== 'smoke') continue
    const t = p.age / p.maxAge
    const alpha = (1 - t) * 0.55
    const r = p.r0 * (1 + t * 1.8)
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
    g.addColorStop(0, `rgba(70,72,68,${alpha})`)
    g.addColorStop(0.45, `rgba(45,46,44,${alpha * 0.85})`)
    g.addColorStop(1, `rgba(30,30,28,0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawFlashParticles(ctx: CanvasRenderingContext2D, list: readonly FxParticle[]): void {
  const prev = ctx.globalCompositeOperation
  ctx.globalCompositeOperation = 'lighter'
  for (const p of list) {
    if (p.kind !== 'flash') continue
    const t = p.age / p.maxAge
    const alpha = (1 - t) * 0.95
    const r = p.r * (1 + t * 0.35)
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
    g.addColorStop(0, `rgba(255,252,220,${alpha})`)
    g.addColorStop(0.35, `rgba(255,210,120,${alpha * 0.5})`)
    g.addColorStop(0.7, `rgba(255,140,40,${alpha * 0.2})`)
    g.addColorStop(1, 'rgba(255,80,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = prev
}
