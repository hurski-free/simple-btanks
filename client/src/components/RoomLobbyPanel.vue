<script setup lang="ts">
import type { MapPresetId } from '../game/presets/MapPresets'
import type { TankPresetId } from '../game/presets/TankPresets'
import SoloMapPicker from './solo/SoloMapPicker.vue'
import SoloTankPicker from './solo/SoloTankPicker.vue'

const mapId = defineModel<MapPresetId>('mapId', { required: true })
const tankId = defineModel<TankPresetId>('tankId', { required: true })

defineProps<{
  isHost: boolean
  peerNickname: string | null
  currentRoomTitle: string
  currentRoomId: string | null
  hasPeer: boolean
  canMpReady: boolean
  selfReady: boolean
  peerPrep: { mapPresetId: MapPresetId; tankPresetId: TankPresetId } | null
  countdownSeconds: number | null
  scheduleLocked: boolean
}>()

const emit = defineEmits<{
  leave: []
  mpReady: []
  mpCancelReady: []
}>()
</script>

<template>
  <section class="card room-active">
    <template v-if="isHost">
      <p v-if="!peerNickname" class="wait">Waiting for a guest…</p>
      <p v-else class="peers">
        Guest: <strong>{{ peerNickname }}</strong>
      </p>
    </template>
    <template v-else>
      <p class="peers">
        Host: <strong>{{ peerNickname }}</strong>
      </p>
    </template>

    <p class="room-meta">Room: {{ currentRoomTitle || currentRoomId }}</p>

    <div v-if="countdownSeconds !== null" class="countdown-banner">
      Battle starts in <strong>{{ countdownSeconds }}</strong>s
    </div>

    <p v-if="hasPeer && !scheduleLocked" class="game-hint">
      Choose the same map as your opponent. Each picks a tank. When both tap Ready, a 5-second countdown runs, then the duel starts.
    </p>
    <p v-else-if="hasPeer && scheduleLocked" class="game-hint muted">Match is locked in — get ready…</p>

    <div v-if="hasPeer" class="mp-prep" :class="{ 'mp-prep--locked': scheduleLocked }">
      <SoloMapPicker v-model:map-id="mapId" />
      <SoloTankPicker v-model:tank-id="tankId" />
      <p v-if="peerPrep" class="peer-prep">
        Opponent tank preset: <strong>{{ peerPrep.tankPresetId }}</strong>
        · map: <strong>{{ peerPrep.mapPresetId }}</strong>
      </p>
    </div>

    <div class="row">
      <button type="button" class="btn ghost" @click="emit('leave')">Leave room</button>
      <template v-if="hasPeer && !scheduleLocked">
        <button
          v-if="!selfReady"
          type="button"
          class="btn primary"
          :disabled="!canMpReady"
          @click="emit('mpReady')"
        >
          Ready
        </button>
        <button v-else type="button" class="btn ghost" @click="emit('mpCancelReady')">Cancel ready</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.countdown-banner {
  margin: 0.5rem 0 0;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: rgba(184, 201, 74, 0.12);
  border: 1px solid rgba(184, 201, 74, 0.35);
  color: var(--text);
  font-size: 1rem;
}

.mp-prep {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mp-prep--locked {
  pointer-events: none;
  opacity: 0.72;
}

.peer-prep {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
}

.game-hint.muted {
  opacity: 0.85;
}

@media (max-width: 640px) {
  .mp-prep {
    gap: 0.5rem;
  }

  .mp-prep :deep(.solo-picker-section) {
    margin-bottom: 0.75rem;
  }

  .mp-prep :deep(.picker-buttons) {
    gap: 0.4rem;
    margin-bottom: 0.55rem;
  }
}
</style>
