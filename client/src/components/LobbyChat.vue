<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { ChatMessageItem } from '../composables/useLobbyWs'

const MAX_MESSAGE_CHARS = 200

const props = defineProps<{
  messages: ChatMessageItem[]
  currentNickname: string
  /** Seconds until next send allowed; 0 = ready. */
  cooldownSeconds: number
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const draft = ref('')
const listRef = ref<HTMLElement | null>(null)

const charCount = computed(() => draft.value.length)
const overLimit = computed(() => charCount.value > MAX_MESSAGE_CHARS)
const sendDisabled = computed(
  () =>
    props.cooldownSeconds > 0 ||
    !draft.value.trim() ||
    overLimit.value,
)

const sendButtonTitle = computed(() => {
  if (props.cooldownSeconds > 0) return ''
  if (overLimit.value) return `Message exceeds ${MAX_MESSAGE_CHARS} characters`
  if (!draft.value.trim()) return 'Enter a message'
  return ''
})

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
})

function formatAt(iso: string): string {
  const d = Date.parse(iso)
  if (!Number.isFinite(d)) return ''
  return timeFmt.format(d)
}

function submit(): void {
  if (sendDisabled.value) return
  emit('send', draft.value)
  draft.value = ''
}

function scrollToBottom(): void {
  const el = listRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

watch(
  () => props.messages.length,
  () => {
    void nextTick(() => scrollToBottom())
  },
)

onMounted(() => {
  void nextTick(() => scrollToBottom())
})
</script>

<template>
  <div class="lobby-chat">
    <h2 class="section-title">Lobby chat</h2>
    <div ref="listRef" class="lobby-chat-list" role="log" aria-live="polite">
      <p v-if="!messages.length" class="lobby-chat-empty">No messages yet. Say hi.</p>
      <template v-else>
        <div
          v-for="m in messages"
          :key="m.id"
          class="lobby-chat-row"
          :class="{ self: m.nickname === currentNickname }"
        >
          <span class="lobby-chat-meta">
            <span class="lobby-chat-nick">{{ m.nickname }}</span>
            <span class="lobby-chat-time">{{ formatAt(m.at) }}</span>
          </span>
          <span class="lobby-chat-text">{{ m.text }}</span>
        </div>
      </template>
    </div>
    <p v-if="cooldownSeconds > 0" class="lobby-chat-cooldown">Next message in {{ cooldownSeconds }}s</p>
    <div class="lobby-chat-compose">
      <div class="lobby-chat-input-row">
        <textarea
          v-model="draft"
          class="input lobby-chat-textarea"
          rows="3"
          :disabled="cooldownSeconds > 0"
          placeholder="Message (max 200 characters)"
          autocomplete="off"
          @keydown.enter.exact.prevent="submit"
        />
        <div class="lobby-chat-send-col">
          <div class="send-button-wrap">
            <button
              type="button"
              class="btn primary small lobby-chat-send"
              :disabled="sendDisabled"
              :title="sendButtonTitle || undefined"
              @click="submit"
            >
              Send
            </button>
            <div
              v-if="cooldownSeconds > 0"
              class="send-hover-blocker"
            />
          </div>
        </div>
      </div>
      <p
        class="lobby-chat-counter"
        :class="{
          warn: charCount >= 180 && !overLimit,
          over: overLimit,
        }"
      >
        {{ charCount }} / {{ MAX_MESSAGE_CHARS }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.lobby-chat {
  display: flex;
  flex-direction: column;
  min-height: min(52vh, 440px);
  max-height: min(62vh, 520px);
}

.lobby-chat-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 0 0.85rem;
  padding: 0.35rem 0.15rem;
  border-radius: 8px;
  background: var(--input-bg);
  border: 1px solid var(--border);
}

.lobby-chat-empty {
  margin: 0.75rem 0.5rem;
  font-size: 0.88rem;
  color: var(--muted);
}

.lobby-chat-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.45rem 0.55rem;
  margin-bottom: 0.35rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
}

.lobby-chat-row.self {
  background: rgba(184, 201, 74, 0.1);
}

.lobby-chat-meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.lobby-chat-nick {
  font-weight: 600;
  color: var(--text-h);
}

.lobby-chat-time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.lobby-chat-text {
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
}

.lobby-chat-cooldown {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.lobby-chat-compose {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lobby-chat-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.lobby-chat-textarea {
  flex: 1;
  min-width: 0;
  min-height: 4.5rem;
  resize: vertical;
  max-height: 12rem;
  font-family: inherit;
  line-height: 1.4;
}

.lobby-chat-send-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.send-button-wrap {
  position: relative;
  display: inline-flex;
}

.lobby-chat-send {
  align-self: flex-start;
}

.send-hover-blocker {
  position: absolute;
  inset: 0;
  cursor: not-allowed;
  border-radius: inherit;
}

.lobby-chat-counter {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.lobby-chat-counter.warn {
  color: var(--accent-dim);
}

.lobby-chat-counter.over {
  color: #e07a7a;
  font-weight: 600;
}
</style>
