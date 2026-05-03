<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SoloGame } from '../game/SoloGame'
import { DEFAULT_MAP_PRESET_ID, type MapPresetId } from '../game/presets/MapPresets'
import { DEFAULT_TANK_PRESET_ID, type TankPresetId } from '../game/presets/TankPresets'

const props = withDefaults(
  defineProps<{
    gameSessionId: number
    tankPreset?: TankPresetId
    mapPresetId?: MapPresetId
  }>(),
  { tankPreset: DEFAULT_TANK_PRESET_ID, mapPresetId: DEFAULT_MAP_PRESET_ID },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engine = ref<SoloGame | null>(null)

function mountEngine(): void {
  const el = canvasRef.value
  if (!el) return
  engine.value?.destroy()
  const g = new SoloGame(el, props.tankPreset, props.mapPresetId)
  g.start()
  engine.value = g
  void el.focus()
}

watch(
  () => props.gameSessionId,
  () => {
    void nextTick(mountEngine)
  },
  { flush: 'post' },
)

watch(
  () => props.tankPreset,
  () => {
    void nextTick(mountEngine)
  },
)

watch(
  () => props.mapPresetId,
  () => {
    void nextTick(mountEngine)
  },
)

onMounted(() => {
  void nextTick(mountEngine)
})

onBeforeUnmount(() => {
  engine.value?.destroy()
  engine.value = null
})
</script>

<template>
  <div class="game-shell">
    <canvas ref="canvasRef" class="solo-canvas" tabindex="0" aria-label="Solo battle" />
  </div>
</template>

<style scoped>
.game-shell {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.solo-canvas {
  display: block;
  flex: 0 0 auto;
  align-self: center;
  max-width: 100%;
  max-height: 100%;
  outline: none;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #0a0c08;
}
</style>
