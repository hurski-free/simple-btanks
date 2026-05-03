<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()
</script>

<template>
  <section class="card modal-card">
    <div class="nickname-brand">
      <svg class="nickname-brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
        <use href="/icons.svg#tank-app" width="64" height="64" />
      </svg>
      <h1 class="nickname-brand-title">Simple BTanks</h1>
    </div>
    <p class="hint">Choose a nickname to enter the lobby</p>
    <label class="field">
      <span class="label">Nickname</span>
      <input
        :value="modelValue"
        class="input"
        type="text"
        maxlength="64"
        autocomplete="off"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('submit')"
      />
    </label>
    <button type="button" class="btn primary" :disabled="!modelValue.trim()" @click="emit('submit')">
      Continue
    </button>
  </section>
</template>

<style scoped>
.nickname-brand-title {
  margin: 0;
  font-size: 1.65rem;
  font-weight: 700;
  color: var(--text-h);
}
</style>
