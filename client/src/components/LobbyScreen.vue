<script setup lang="ts">
import type { RoomListItem } from '../composables/useLobbyWs'

defineProps<{
  connectionError: string | null
  actionError: string | null
  roomName: string
  createPassword: string
  rooms: RoomListItem[]
}>()

const emit = defineEmits<{
  'update:roomName': [v: string]
  'update:createPassword': [v: string]
  createRoom: []
  openJoin: [room: RoomListItem]
  openSoloGameDialog: []
}>()
</script>

<template>
  <div class="lobby-screen">
    <p v-if="connectionError" class="banner error">{{ connectionError }}</p>
    <p v-else-if="actionError" class="banner error">{{ actionError }}</p>

    <section class="card solo-card">
      <h2 class="section-title">Solo</h2>
      <p class="solo-hint">Practice alone before playing online.</p>
      <button type="button" class="btn ghost" @click="emit('openSoloGameDialog')">Practice alone</button>
    </section>

    <section class="card">
      <h2 class="section-title">Create a room</h2>
      <label class="field">
        <span class="label">Name</span>
        <input
          :value="roomName"
          class="input"
          type="text"
          maxlength="64"
          autocomplete="off"
          @input="emit('update:roomName', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="field">
        <span class="label">Password (optional)</span>
        <input
          :value="createPassword"
          class="input"
          type="password"
          maxlength="128"
          autocomplete="new-password"
          @input="emit('update:createPassword', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <button type="button" class="btn primary" @click="emit('createRoom')">Create room</button>
    </section>

    <section class="card">
      <h2 class="section-title">Open rooms</h2>
      <ul v-if="rooms.length" class="room-list">
        <li v-for="r in rooms" :key="r.roomId" class="room-row">
          <span class="room-name">{{ r.displayName }}</span>
          <span v-if="r.hasPassword" class="lock" title="Password protected">🔒</span>
          <button type="button" class="btn small" @click="emit('openJoin', r)">Join</button>
        </li>
      </ul>
      <p v-else class="empty">No open rooms right now</p>
    </section>
  </div>
</template>

<style scoped>
.solo-hint {
  margin: 0 0 1rem;
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.4;
}

.solo-card {
  margin-bottom: 0.25rem;
}
</style>
