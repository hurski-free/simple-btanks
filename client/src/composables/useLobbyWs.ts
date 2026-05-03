import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { GAME_WS_CHANNEL } from '../game/const'
import { isMpGamePayload } from '../game/mp/signalTypes'
import { DEFAULT_MAP_PRESET_ID, type MapPresetId } from '../game/presets/MapPresets'
import { DEFAULT_TANK_PRESET_ID, type TankPresetId } from '../game/presets/TankPresets'
import type { ClientMessage, ServerMessage } from '../protocol'
import { parseServerMessage, wsUrl } from '../protocol'

export type RoomListItem = { roomId: string; displayName: string; hasPassword: boolean }

export type ChatMessageItem = { id: string; at: string; nickname: string; text: string }

const MAX_CHAT_CLIENT = 200
const CHAT_COOLDOWN_MS = 10_000

const NICKNAME_STORAGE_KEY = 'simple-btanks-nickname'

function readStoredNicknameDraft(): string {
  try {
    const raw = localStorage.getItem(NICKNAME_STORAGE_KEY)
    if (raw == null) return ''
    const trimmed = raw.trim().slice(0, 64)
    return trimmed
  } catch {
    return ''
  }
}

function persistNickname(n: string): void {
  try {
    localStorage.setItem(NICKNAME_STORAGE_KEY, n)
  } catch {
    // ignore quota / private mode
  }
}

export function useLobbyWs() {
  const nickname = ref('')
  const nicknameDraft = ref(readStoredNicknameDraft())
  const nicknameSet = ref(false)

  const roomName = ref('')
  const createPassword = ref('')

  const rooms = ref<RoomListItem[]>([])
  const connectionError = ref<string | null>(null)
  const actionError = ref<string | null>(null)
  const onlineCount = ref<number | null>(null)
  const chatMessages = ref<ChatMessageItem[]>([])
  const chatCooldownUntil = ref(0)
  const chatCooldownSeconds = ref(0)
  let chatCooldownTick: ReturnType<typeof setInterval> | null = null

  const inRoom = ref(false)
  const isHost = ref(false)
  const currentRoomId = ref<string | null>(null)
  const currentRoomTitle = ref('')
  const peerNickname = ref<string | null>(null)

  const soloGameDialogOpen = ref(false)
  const soloMapPresetId = ref<MapPresetId>(DEFAULT_MAP_PRESET_ID)
  const soloTankPresetId = ref<TankPresetId>(DEFAULT_TANK_PRESET_ID)
  const soloMode = ref(false)
  const multiplayerActive = ref(false)
  const gameSessionId = ref(0)
  const peerSignal = ref<{ seq: number; payload: unknown } | null>(null)
  let signalSeq = 0

  const joinTarget = ref<RoomListItem | null>(null)
  const joinPassword = ref('')

  const mpLobbyMapId = ref<MapPresetId>(DEFAULT_MAP_PRESET_ID)
  const mpLobbyTankId = ref<TankPresetId>(DEFAULT_TANK_PRESET_ID)
  const mpSelfReady = ref(false)
  const mpPeerPrep = ref<{ mapPresetId: MapPresetId; tankPresetId: TankPresetId } | null>(null)
  const mpCountdownEndsAt = ref<number | null>(null)
  const mpCountdownSeconds = ref<number | null>(null)
  const mpMatchConfig = ref<{
    mapPresetId: MapPresetId
    hostTankPresetId: TankPresetId
    guestTankPresetId: TankPresetId
  } | null>(null)

  let mpFightTimer: ReturnType<typeof setTimeout> | null = null
  const mpScheduleSent = ref(false)
  let mpCountdownUiTimer: ReturnType<typeof setInterval> | null = null

  let ws: WebSocket | null = null
  let listTimer: ReturnType<typeof setInterval> | null = null

  function clearMpFightTimer(): void {
    if (mpFightTimer) {
      clearTimeout(mpFightTimer)
      mpFightTimer = null
    }
  }

  function clearMpCountdownUi(): void {
    if (mpCountdownUiTimer) {
      clearInterval(mpCountdownUiTimer)
      mpCountdownUiTimer = null
    }
  }

  function resetMpPrep(): void {
    clearMpFightTimer()
    clearMpCountdownUi()
    mpSelfReady.value = false
    mpPeerPrep.value = null
    mpCountdownEndsAt.value = null
    mpCountdownSeconds.value = null
    mpMatchConfig.value = null
    mpScheduleSent.value = false
  }

  function startCountdownUi(): void {
    clearMpCountdownUi()
    const tick = (): void => {
      const end = mpCountdownEndsAt.value
      if (end == null) {
        mpCountdownSeconds.value = null
        return
      }
      mpCountdownSeconds.value = Math.max(0, Math.ceil((end - Date.now()) / 1000))
    }
    tick()
    mpCountdownUiTimer = setInterval(tick, 250)
  }

  function armFightTimer(startAtMs: number): void {
    clearMpFightTimer()
    const delay = Math.max(0, startAtMs - Date.now())
    mpFightTimer = setTimeout(() => {
      mpFightTimer = null
      beginFight()
    }, delay)
  }

  function beginFight(): void {
    clearMpCountdownUi()
    mpCountdownEndsAt.value = null
    mpCountdownSeconds.value = null
    if (!mpMatchConfig.value) return
    gameSessionId.value += 1
    multiplayerActive.value = true
  }

  function tryHostSchedule(): void {
    if (!isHost.value || !mpSelfReady.value || !mpPeerPrep.value || mpScheduleSent.value) return
    if (mpPeerPrep.value.mapPresetId !== mpLobbyMapId.value) return

    mpScheduleSent.value = true
    const startAtMs = Date.now() + 5000
    mpMatchConfig.value = {
      mapPresetId: mpLobbyMapId.value,
      hostTankPresetId: mpLobbyTankId.value,
      guestTankPresetId: mpPeerPrep.value.tankPresetId,
    }
    mpCountdownEndsAt.value = startAtMs
    send({
      type: 'signal',
      payload: {
        channel: GAME_WS_CHANNEL,
        kind: 'mp-schedule',
        startAtMs,
        mapPresetId: mpLobbyMapId.value,
        hostTankPresetId: mpLobbyTankId.value,
        guestTankPresetId: mpPeerPrep.value.tankPresetId,
      },
    })
    armFightTimer(startAtMs)
    startCountdownUi()
  }

  function stopListPolling(): void {
    if (listTimer) {
      clearInterval(listTimer)
      listTimer = null
    }
  }

  function startListPolling(): void {
    stopListPolling()
    listTimer = setInterval(() => {
      if (
        ws?.readyState === WebSocket.OPEN &&
        nicknameSet.value &&
        !inRoom.value &&
        !soloMode.value &&
        !soloGameDialogOpen.value &&
        !multiplayerActive.value
      ) {
        send({ type: 'list-rooms' })
      }
    }, 2500)
  }

  function send(msg: ClientMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function refreshChatCooldownSeconds(): void {
    chatCooldownSeconds.value = Math.max(0, Math.ceil((chatCooldownUntil.value - Date.now()) / 1000))
  }

  function startChatCooldownTimer(): void {
    stopChatCooldownTimer()
    refreshChatCooldownSeconds()
    if (chatCooldownSeconds.value <= 0) return
    chatCooldownTick = setInterval(() => {
      refreshChatCooldownSeconds()
      if (chatCooldownSeconds.value <= 0) stopChatCooldownTimer()
    }, 1000)
  }

  function stopChatCooldownTimer(): void {
    if (chatCooldownTick) {
      clearInterval(chatCooldownTick)
      chatCooldownTick = null
    }
  }

  function connectSocket(): void {
    connectionError.value = null
    if (ws) {
      ws.close()
      ws = null
    }
    try {
      const socket = new WebSocket(wsUrl())
      ws = socket
      socket.onopen = () => {
        send({ type: 'list-rooms' })
        startListPolling()
      }
      socket.onmessage = (ev) => {
        const msg = parseServerMessage(String(ev.data))
        if (!msg) return
        handleServer(msg)
      }
      socket.onerror = () => {
        connectionError.value = 'Connection error'
      }
      socket.onclose = (ev) => {
        stopListPolling()
        onlineCount.value = null
        if (!ev.wasClean && nicknameSet.value) {
          connectionError.value = 'Connection interrupted'
        }
      }
    } catch {
      connectionError.value = 'Could not connect'
    }
  }

  function handleServer(msg: ServerMessage): void {
    if (msg.type !== 'chat-message' && msg.type !== 'chat-history') {
      actionError.value = null
    }
    switch (msg.type) {
      case 'online-count':
        onlineCount.value = typeof msg.count === 'number' && Number.isFinite(msg.count) ? Math.max(0, msg.count) : 0
        break
      case 'room-list':
        rooms.value = msg.rooms
        break
      case 'room-created':
        inRoom.value = true
        isHost.value = true
        currentRoomId.value = msg.roomId
        currentRoomTitle.value = msg.displayName
        peerNickname.value = null
        stopListPolling()
        resetMpPrep()
        break
      case 'joined-room':
        inRoom.value = true
        isHost.value = false
        currentRoomId.value = msg.roomId
        currentRoomTitle.value = msg.displayName
        peerNickname.value = msg.hostUsername
        stopListPolling()
        resetMpPrep()
        break
      case 'peer-joined':
        peerNickname.value = msg.peerUsername
        break
      case 'peer-left':
        peerNickname.value = null
        multiplayerActive.value = false
        resetMpPrep()
        break
      case 'signal': {
        const p = msg.payload
        if (isMpGamePayload(p)) {
          if (p.kind === 'mp-prep') {
            mpPeerPrep.value = { mapPresetId: p.mapPresetId, tankPresetId: p.tankPresetId }
            if (!isHost.value && mpSelfReady.value && p.mapPresetId !== mpLobbyMapId.value) {
              mpSelfReady.value = false
              actionError.value = 'Same map as the host is required. Match the map, then Ready again.'
            }
            if (isHost.value && mpSelfReady.value && p.mapPresetId !== mpLobbyMapId.value) {
              send({
                type: 'signal',
                payload: { channel: GAME_WS_CHANNEL, kind: 'mp-prep-mismatch' },
              })
              actionError.value = 'Both players must pick the same map.'
            } else {
              tryHostSchedule()
            }
          } else if (p.kind === 'mp-schedule' && !isHost.value) {
            mpMatchConfig.value = {
              mapPresetId: p.mapPresetId,
              hostTankPresetId: p.hostTankPresetId,
              guestTankPresetId: p.guestTankPresetId,
            }
            mpCountdownEndsAt.value = p.startAtMs
            armFightTimer(p.startAtMs)
            startCountdownUi()
          } else if (p.kind === 'mp-prep-mismatch' && !isHost.value) {
            actionError.value = 'Same map required. Match the host map and tap Ready again.'
            mpSelfReady.value = false
          }
        }
        signalSeq += 1
        peerSignal.value = { seq: signalSeq, payload: msg.payload }
        break
      }
      case 'left-room':
        resetLobbyAfterLeave()
        break
      case 'room-closed':
        resetLobbyAfterLeave()
        actionError.value = 'Room closed (host left)'
        break
      case 'chat-history': {
        if (!Array.isArray(msg.messages)) break
        const seen = new Set(chatMessages.value.map((m) => m.id))
        for (const row of msg.messages) {
          if (!row || typeof row !== 'object') continue
          const r = row as Record<string, unknown>
          if (
            typeof r.id !== 'string' ||
            typeof r.at !== 'string' ||
            typeof r.nickname !== 'string' ||
            typeof r.text !== 'string'
          ) {
            continue
          }
          if (seen.has(r.id)) continue
          seen.add(r.id)
          chatMessages.value.push({ id: r.id, at: r.at, nickname: r.nickname, text: r.text })
        }
        break
      }
      case 'chat-message':
        if (!chatMessages.value.some((m) => m.id === msg.id)) {
          chatMessages.value.push({
            id: msg.id,
            at: msg.at,
            nickname: msg.nickname,
            text: msg.text,
          })
        }
        break
      case 'error':
        actionError.value = msg.message
        if (msg.code === 'chat-cooldown') {
          const m = /^Wait (\d+)s\b/.exec(msg.message)
          const sec = m
            ? Math.min(CHAT_COOLDOWN_MS / 1000, Math.max(1, Number(m[1]) || 10))
            : 10
          chatCooldownUntil.value = Date.now() + sec * 1000
          startChatCooldownTimer()
        }
        break
      default:
        break
    }
  }

  function resetLobbyAfterLeave(): void {
    inRoom.value = false
    isHost.value = false
    currentRoomId.value = null
    currentRoomTitle.value = ''
    peerNickname.value = null
    multiplayerActive.value = false
    peerSignal.value = null
    resetMpPrep()
    send({ type: 'list-rooms' })
    startListPolling()
  }

  function confirmNickname(): void {
    const n = nicknameDraft.value.trim()
    if (!n) return
    nickname.value = n
    nicknameSet.value = true
    persistNickname(n)
    connectSocket()
  }

  function createRoom(): void {
    const name = roomName.value.trim()
    if (!name) {
      actionError.value = 'Enter a room name'
      return
    }
    const pwd = createPassword.value.trim()
    send({
      type: 'create-room',
      hostUsername: nickname.value,
      displayName: name,
      ...(pwd ? { password: pwd } : {}),
    })
  }

  function openJoinDialog(room: RoomListItem): void {
    joinTarget.value = room
    joinPassword.value = ''
  }

  function confirmJoin(): void {
    const target = joinTarget.value
    if (!target) return
    send({
      type: 'join-room',
      roomId: target.roomId,
      guestUsername: nickname.value,
      ...(joinPassword.value.trim() ? { password: joinPassword.value.trim() } : {}),
    })
    joinTarget.value = null
  }

  function closeJoinDialog(): void {
    joinTarget.value = null
  }

  function leaveRoom(): void {
    send({ type: 'leave-room' })
  }

  function sendPeerSignal(payload: unknown): void {
    send({ type: 'signal', payload })
  }

  function openSoloGameDialog(): void {
    actionError.value = null
    soloGameDialogOpen.value = true
  }

  function cancelSoloGameDialog(): void {
    soloGameDialogOpen.value = false
  }

  function confirmSoloGameDialog(payload: { mapId: MapPresetId; tankId: TankPresetId }): void {
    actionError.value = null
    soloMapPresetId.value = payload.mapId
    soloTankPresetId.value = payload.tankId
    soloGameDialogOpen.value = false
    gameSessionId.value += 1
    soloMode.value = true
  }

  function leaveSoloGame(): void {
    soloMode.value = false
  }

  function confirmMpReady(): void {
    if (!inRoom.value || peerNickname.value === null) {
      actionError.value = 'Wait for a guest to join.'
      return
    }
    actionError.value = null
    mpSelfReady.value = true
    send({
      type: 'signal',
      payload: {
        channel: GAME_WS_CHANNEL,
        kind: 'mp-prep',
        mapPresetId: mpLobbyMapId.value,
        tankPresetId: mpLobbyTankId.value,
      },
    })
    tryHostSchedule()
  }

  function cancelMpReady(): void {
    mpSelfReady.value = false
    clearMpFightTimer()
    clearMpCountdownUi()
    mpCountdownEndsAt.value = null
    mpCountdownSeconds.value = null
    mpScheduleSent.value = false
    mpMatchConfig.value = null
  }

  function sendChatMessage(text: string): void {
    if (Date.now() < chatCooldownUntil.value) return
    const t = text.trim().slice(0, MAX_CHAT_CLIENT)
    if (!t) return
    chatCooldownUntil.value = Date.now() + CHAT_COOLDOWN_MS
    startChatCooldownTimer()
    send({ type: 'chat-send', nickname: nickname.value, text: t })
  }

  const hasPeer = computed(() => peerNickname.value !== null)

  const gameActive = computed(() => soloMode.value || multiplayerActive.value)

  const canMpReady = computed(() => inRoom.value && peerNickname.value !== null && !mpSelfReady.value)

  const mpPrepUiLocked = computed(() => mpScheduleSent.value || mpCountdownEndsAt.value !== null)

  watch(nicknameSet, (set) => {
    if (!set && ws) {
      soloGameDialogOpen.value = false
      soloMode.value = false
      multiplayerActive.value = false
      peerSignal.value = null
      resetMpPrep()
      chatMessages.value = []
      chatCooldownUntil.value = 0
      chatCooldownSeconds.value = 0
      stopChatCooldownTimer()
      onlineCount.value = null
      ws.close()
      ws = null
      stopListPolling()
    }
  })

  onBeforeUnmount(() => {
    stopListPolling()
    stopChatCooldownTimer()
    clearMpFightTimer()
    clearMpCountdownUi()
    ws?.close()
  })

  return reactive({
    nickname,
    nicknameDraft,
    nicknameSet,
    roomName,
    createPassword,
    rooms,
    connectionError,
    actionError,
    onlineCount,
    chatMessages,
    chatCooldownSeconds,
    inRoom,
    isHost,
    currentRoomId,
    currentRoomTitle,
    peerNickname,
    hasPeer,
    soloGameDialogOpen,
    soloMapPresetId,
    soloTankPresetId,
    soloMode,
    multiplayerActive,
    gameActive,
    gameSessionId,
    peerSignal,
    canMpReady,
    mpLobbyMapId,
    mpLobbyTankId,
    mpSelfReady,
    mpPeerPrep,
    mpCountdownSeconds,
    mpMatchConfig,
    mpPrepUiLocked,
    confirmMpReady,
    cancelMpReady,
    joinTarget,
    joinPassword,
    confirmNickname,
    createRoom,
    openJoinDialog,
    closeJoinDialog,
    confirmJoin,
    leaveRoom,
    sendChatMessage,
    sendPeerSignal,
    openSoloGameDialog,
    cancelSoloGameDialog,
    confirmSoloGameDialog,
    leaveSoloGame,
  })
}
