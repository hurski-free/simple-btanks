<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { MultiplayerGame } from '../../game/MultiplayerGame'

const props = defineProps<{
  gameSessionId: number
  isHost: boolean
}>()

const engine = shallowRef<MultiplayerGame | null>(null)

watch(
  () => props.gameSessionId,
  () => {
    engine.value = new MultiplayerGame()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  engine.value = null
})
</script>

<template>
  <div class="game-shell">
    <p class="game-placeholder">
      Multiplayer game (canvas later) — {{ isHost ? 'host' : 'guest' }}
    </p>
  </div>
</template>

<style scoped>
.game-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: min(70vh, 560px);
  padding: 1rem;
}

.game-placeholder {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
  text-align: center;
  max-width: 28rem;
}
</style>
