<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { MultiplayerGame } from '../../game/MultiplayerGame'
import { DEFAULT_MAP_PRESET_ID } from '../../game/presets/MapPresets'

const props = defineProps<{
  gameSessionId: number
  isHost: boolean
}>()

const canvasRef = shallowRef<HTMLCanvasElement | null>(null)
const engine = shallowRef<MultiplayerGame | null>(null)

function mountEngine(): void {
  const el = canvasRef.value
  if (!el) return
  engine.value?.destroy()
  const g = new MultiplayerGame(el, DEFAULT_MAP_PRESET_ID)
  g.start()
  engine.value = g
}

watch(
  () => props.gameSessionId,
  () => {
    void nextTick(mountEngine)
  },
  { flush: 'post' },
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
    <p class="game-role">{{ isHost ? 'Host' : 'Guest' }}</p>
    <canvas ref="canvasRef" class="mp-canvas" aria-label="Multiplayer battle" />
  </div>
</template>

<style scoped>
.game-shell {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.game-role {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.mp-canvas {
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
