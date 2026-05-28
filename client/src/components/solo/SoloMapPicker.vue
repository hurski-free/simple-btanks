<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildMapObstacles } from '../../game/mapObstacles'
import { DEFAULT_MAP_PRESET_ID, getMapPreset, MAP_PRESET_IDS, type MapPresetId } from '../../game/presets/MapPresets'
import { WORLD_H, WORLD_W } from '../../game/world'

const mapId = defineModel<MapPresetId>('mapId', { default: DEFAULT_MAP_PRESET_ID })

const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewHostRef = ref<HTMLElement | null>(null)

const mapButtons = computed(() => MAP_PRESET_IDS.map((id) => ({ id, name: getMapPreset(id).name })))

const previewObstacles = computed(() => buildMapObstacles(getMapPreset(mapId.value)))

function pickMap(id: MapPresetId): void {
  mapId.value = id
}

function paintPreview(): void {
  const canvas = canvasRef.value
  const host = previewHostRef.value
  if (!canvas || !host) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cssW = Math.max(1, host.clientWidth)
  const viewportH = Math.max(1, window.innerHeight || 1)
  const isCompact = cssW <= 420
  const minH = isCompact ? 120 : 160
  const maxH = Math.max(minH, Math.min(320, Math.round(viewportH * (isCompact ? 0.24 : 0.34))))
  const cssH = Math.min(maxH, Math.max(minH, Math.round(cssW * (WORLD_H / WORLD_W))))
  const worldScale = Math.min(cssW / WORLD_W, cssH / WORLD_H)
  const offsetX = (cssW - WORLD_W * worldScale) * 0.5
  const offsetY = (cssH - WORLD_H * worldScale) * 0.5

  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.width = Math.max(1, Math.floor(cssW * dpr))
  canvas.height = Math.max(1, Math.floor(cssH * dpr))

  const nowMs = performance.now()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const s = worldScale * dpr
  ctx.setTransform(s, 0, 0, s, offsetX * dpr, offsetY * dpr)
  const w = WORLD_W
  const h = WORLD_H

  ctx.fillStyle = '#121510'
  ctx.fillRect(0, 0, w, h)

  const lineW = Math.max(0.35, 1 / (worldScale * dpr))
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

  for (const o of previewObstacles.value) {
    o.draw(ctx, nowMs)
  }

  const def = getMapPreset(mapId.value)
  const { player1, player2 } = def.spawns
  const r = 14
  ctx.beginPath()
  ctx.arc(player1.x, player1.y, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(108, 168, 120, 0.85)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(232, 240, 236, 0.5)'
  ctx.lineWidth = lineW * 1.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(player2.x, player2.y, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(196, 120, 88, 0.85)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(240, 228, 220, 0.45)'
  ctx.lineWidth = lineW * 1.5
  ctx.stroke()

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.font = `${Math.round(11 * dpr)}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(232, 234, 238, 0.55)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('P1', (offsetX + player1.x * worldScale) * dpr - 4 * dpr, (offsetY + player1.y * worldScale) * dpr - 22 * dpr)
  ctx.fillText('P2', (offsetX + player2.x * worldScale) * dpr - 4 * dpr, (offsetY + player2.y * worldScale) * dpr - 22 * dpr)
}

let ro: ResizeObserver | null = null

onMounted(() => {
  void nextTick(() => {
    paintPreview()
    const host = previewHostRef.value
    if (host && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => paintPreview())
      ro.observe(host)
    }
  })
  window.addEventListener('resize', paintPreview)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', paintPreview)
  ro?.disconnect()
  ro = null
})

watch(mapId, () => {
  void nextTick(paintPreview)
})
</script>

<template>
  <section class="solo-picker-section" aria-labelledby="solo-map-heading">
    <h3 id="solo-map-heading" class="picker-heading">Select map</h3>
    <div class="picker-buttons" role="group" aria-label="Maps">
      <button
        v-for="m in mapButtons"
        :key="m.id"
        type="button"
        class="btn"
        :class="{ primary: mapId === m.id, ghost: mapId !== m.id }"
        @click="pickMap(m.id)"
      >
        {{ m.name }}
      </button>
    </div>
    <div ref="previewHostRef" class="preview-host">
      <canvas ref="canvasRef" class="preview-canvas" aria-label="Map preview" />
    </div>
  </section>
</template>

<style scoped>
.solo-picker-section {
  margin-bottom: 1.25rem;
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
