<script setup lang="ts">
import { ref } from 'vue'
import { DEFAULT_MAP_PRESET_ID, type MapPresetId } from '../game/presets/MapPresets'
import { DEFAULT_TANK_PRESET_ID, type TankPresetId } from '../game/presets/TankPresets'
import SoloMapPicker from './SoloMapPicker.vue'
import SoloTankPicker from './SoloTankPicker.vue'

const props = defineProps<{
  initialMapId?: MapPresetId
  initialTankId?: TankPresetId
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [payload: { mapId: MapPresetId; tankId: TankPresetId }]
}>()

const mapId = ref<MapPresetId>(props.initialMapId ?? DEFAULT_MAP_PRESET_ID)
const tankId = ref<TankPresetId>(props.initialTankId ?? DEFAULT_TANK_PRESET_ID)

function onConfirm(): void {
  emit('confirm', { mapId: mapId.value, tankId: tankId.value })
}
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="card dialog solo-game-dialog" role="dialog" aria-labelledby="solo-game-dialog-title">
      <h2 id="solo-game-dialog-title" class="section-title">Solo practice</h2>
      <p class="solo-game-lead">Choose a map and a tank, then confirm to start.</p>

      <SoloMapPicker v-model:map-id="mapId" />
      <SoloTankPicker v-model:tank-id="tankId" />

      <div class="row solo-game-actions">
        <button type="button" class="btn ghost" @click="emit('cancel')">Cancel</button>
        <button type="button" class="btn primary" @click="onConfirm">Confirm</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.solo-game-dialog {
  max-width: min(640px, calc(100vw - 2rem));
  width: 100%;
}

.solo-game-lead {
  margin: -0.25rem 0 1rem;
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.4;
}

.solo-game-actions {
  justify-content: flex-end;
  margin-top: 0.5rem;
}
</style>
