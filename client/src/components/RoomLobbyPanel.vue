<script setup lang="ts">
defineProps<{
  isHost: boolean
  peerNickname: string | null
  currentRoomTitle: string
  currentRoomId: string | null
  hasPeer: boolean
  canStartMultiplayer: boolean
}>()

const emit = defineEmits<{
  leave: []
  startMultiplayer: []
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

    <p v-if="isHost && hasPeer" class="game-hint">You run the match; the guest follows your state over the network.</p>
    <p v-else-if="!isHost && hasPeer" class="game-hint">Waiting for the host to start the battle…</p>

    <div class="row">
      <button type="button" class="btn ghost" @click="emit('leave')">Leave room</button>
      <button
        v-if="isHost"
        type="button"
        class="btn primary"
        :disabled="!canStartMultiplayer"
        @click="emit('startMultiplayer')"
      >
        Start battle
      </button>
    </div>
  </section>
</template>
