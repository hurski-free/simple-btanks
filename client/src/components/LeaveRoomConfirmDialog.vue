<script setup lang="ts">
const emit = defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="leave-room-title" @click.self="emit('cancel')">
    <div class="card dialog">
      <h2 id="leave-room-title" class="section-title">Leave this room?</h2>
      <p class="leave-warning">
        You will leave the current session. If you are the host, the room closes for your guest. Match progress is not
        saved on the server.
      </p>
      <div class="row">
        <button type="button" class="btn ghost" @click="emit('cancel')">Cancel</button>
        <button type="button" class="btn primary leave-confirm" @click="emit('confirm')">Leave room</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leave-warning {
  margin: 0 0 1rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #f0d4a0;
  background: rgba(200, 140, 50, 0.12);
  border: 1px solid rgba(200, 140, 50, 0.35);
}

.leave-confirm {
  background: linear-gradient(135deg, #d4a85c, #a07030) !important;
  color: #1a1208 !important;
}

.leave-confirm:not(:disabled):hover {
  filter: brightness(1.06);
}
</style>
