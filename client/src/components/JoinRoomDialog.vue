<script setup lang="ts">
import type { RoomListItem } from '../composables/useLobbyWs'

defineProps<{
  target: RoomListItem
  password: string
}>()

const emit = defineEmits<{
  'update:password': [v: string]
  cancel: []
  confirm: []
}>()
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="card dialog">
      <h2 class="section-title">Join: {{ target.displayName }}</h2>
      <label class="field">
        <span class="label">Password</span>
        <input
          :value="password"
          class="input"
          type="password"
          maxlength="128"
          autocomplete="off"
          placeholder=""
          @input="emit('update:password', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="emit('confirm')"
        />
      </label>
      <div class="row">
        <button type="button" class="btn ghost" @click="emit('cancel')">Cancel</button>
        <button type="button" class="btn primary" @click="emit('confirm')">Connect</button>
      </div>
    </div>
  </div>
</template>
