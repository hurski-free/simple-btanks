<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Tank } from '../game/objects/Tank'
import {
  DEFAULT_TANK_PRESET_ID,
  getTankPreset,
  TANK_PRESET_LABELS,
  TANK_PRESET_ORDER,
  type TankPresetId,
} from '../game/presets/TankPresets'

const tankId = defineModel<TankPresetId>('tankId', { default: DEFAULT_TANK_PRESET_ID })

const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewHostRef = ref<HTMLElement | null>(null)

/** World half-extent so largest preset fits in preview. */
const PREVIEW_HALF = 78

let previewTank: Tank | null = null

function syncTank(): void {
  previewTank = new Tank(getTankPreset(tankId.value))
}

watch(tankId, syncTank, { immediate: true })

function pickTank(id: TankPresetId): void {
  tankId.value = id
}

function paintPreview(): void {
  const canvas = canvasRef.value
  const host = previewHostRef.value
  if (!canvas || !host || !previewTank) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cssW = Math.max(1, host.clientWidth)
  const cssH = Math.min(280, Math.max(200, cssW * 0.55))

  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.width = Math.max(1, Math.floor(cssW * dpr))
  canvas.height = Math.max(1, Math.floor(cssH * dpr))

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const fitPx = Math.min(canvas.width, canvas.height) * 0.88
  const s = fitPx / (2 * PREVIEW_HALF)

  ctx.fillStyle = '#121510'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const lineW = Math.max(0.35, 1 / s)
  ctx.strokeStyle = 'rgba(184, 201, 74, 0.06)'
  ctx.lineWidth = lineW
  const gridW = 24
  const gx0 = canvas.width * 0.5
  const gy0 = canvas.height * 0.5
  ctx.save()
  ctx.translate(gx0, gy0)
  ctx.scale(s, s)
  for (let x = -PREVIEW_HALF; x <= PREVIEW_HALF; x += gridW) {
    ctx.beginPath()
    ctx.moveTo(x, -PREVIEW_HALF)
    ctx.lineTo(x, PREVIEW_HALF)
    ctx.stroke()
  }
  for (let y = -PREVIEW_HALF; y <= PREVIEW_HALF; y += gridW) {
    ctx.beginPath()
    ctx.moveTo(-PREVIEW_HALF, y)
    ctx.lineTo(PREVIEW_HALF, y)
    ctx.stroke()
  }
  ctx.restore()

  previewTank.x = 0
  previewTank.y = 0
  previewTank.hullAngle = 0
  previewTank.turretAngle = 0

  ctx.save()
  ctx.translate(gx0, gy0)
  ctx.scale(s, s)
  previewTank.draw(ctx)
  ctx.restore()
}

let ro: ResizeObserver | null = null

onMounted(() => {
  void nextTick(() => {
    paintPreview()
    const h = previewHostRef.value
    if (h && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => paintPreview())
      ro.observe(h)
    }
  })
  window.addEventListener('resize', paintPreview)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', paintPreview)
  ro?.disconnect()
  ro = null
  previewTank = null
})

watch(tankId, () => {
  void nextTick(paintPreview)
})
</script>

<template>
  <section class="solo-picker-section" aria-labelledby="solo-tank-heading">
    <h3 id="solo-tank-heading" class="picker-heading">Select tank</h3>
    <div class="picker-buttons" role="group" aria-label="Tanks">
      <button
        v-for="id in TANK_PRESET_ORDER"
        :key="id"
        type="button"
        class="btn"
        :class="{ primary: tankId === id, ghost: tankId !== id }"
        @click="pickTank(id)"
      >
        {{ TANK_PRESET_LABELS[id] }}
      </button>
    </div>
    <div ref="previewHostRef" class="preview-host">
      <canvas ref="canvasRef" class="preview-canvas" aria-label="Tank preview" />
    </div>
  </section>
</template>

<style scoped>
.solo-picker-section {
  margin-bottom: 0.25rem;
}

.picker-heading {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-h);
}

.picker-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.preview-host {
  width: 100%;
}

.preview-canvas {
  display: block;
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #0a0c08;
}
</style>
