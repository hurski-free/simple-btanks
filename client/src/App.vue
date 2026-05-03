<script setup lang="ts">
import { ref } from 'vue'
import JoinRoomDialog from './components/JoinRoomDialog.vue'
import LeaveRoomConfirmDialog from './components/LeaveRoomConfirmDialog.vue'
import LobbyChat from './components/LobbyChat.vue'
import LobbyScreen from './components/LobbyScreen.vue'
import MultiplayerGame from './components/multiplayer/MultiplayerGame.vue'
import NicknameGate from './components/NicknameGate.vue'
import RoomLobbyPanel from './components/RoomLobbyPanel.vue'
import SoloGameDialog from './components/solo/SoloGameDialog.vue'
import SoloGame from './components/solo/SoloGame.vue'
import { useLobbyWs } from './composables/useLobbyWs'

const lobby = useLobbyWs()
const leaveConfirmOpen = ref(false)

function requestLeaveRoom(): void {
  leaveConfirmOpen.value = true
}

function cancelLeaveRoom(): void {
  leaveConfirmOpen.value = false
}

function confirmLeaveRoom(): void {
  leaveConfirmOpen.value = false
  lobby.leaveRoom()
}
</script>

<template>
  <div class="app-root" :class="{ 'app-root--game': lobby.gameActive }">
    <header v-if="lobby.nicknameSet" class="nickname-badge">{{ lobby.nickname }}</header>
    <p v-if="lobby.nicknameSet && lobby.onlineCount !== null" class="online-count-badge">
      online: {{ lobby.onlineCount }}
    </p>

    <main
      v-if="!lobby.gameActive"
      :class="['main', lobby.nicknameSet && !lobby.inRoom ? 'main-lobby-wide' : '']"
    >
      <NicknameGate v-if="!lobby.nicknameSet" v-model="lobby.nicknameDraft" @submit="lobby.confirmNickname" />

      <div v-else-if="!lobby.inRoom" class="lobby-split">
        <div class="lobby-split-main">
          <LobbyScreen
            :connection-error="lobby.connectionError"
            :action-error="lobby.actionError"
            v-model:room-name="lobby.roomName"
            v-model:create-password="lobby.createPassword"
            :rooms="lobby.rooms"
            @create-room="lobby.createRoom"
            @open-join="lobby.openJoinDialog"
            @open-solo-game-dialog="lobby.openSoloGameDialog"
          />
        </div>
        <aside class="card lobby-split-chat">
          <LobbyChat
            :messages="lobby.chatMessages"
            :current-nickname="lobby.nickname"
            :cooldown-seconds="lobby.chatCooldownSeconds"
            @send="lobby.sendChatMessage"
          />
        </aside>
      </div>

      <RoomLobbyPanel
        v-else
        v-model:map-id="lobby.mpLobbyMapId"
        v-model:tank-id="lobby.mpLobbyTankId"
        :is-host="lobby.isHost"
        :peer-nickname="lobby.peerNickname"
        :current-room-title="lobby.currentRoomTitle"
        :current-room-id="lobby.currentRoomId"
        :has-peer="lobby.hasPeer"
        :can-mp-ready="lobby.canMpReady"
        :self-ready="lobby.mpSelfReady"
        :peer-prep="lobby.mpPeerPrep"
        :countdown-seconds="lobby.mpCountdownSeconds"
        :schedule-locked="lobby.mpPrepUiLocked"
        @leave="requestLeaveRoom"
        @mp-ready="lobby.confirmMpReady"
        @mp-cancel-ready="lobby.cancelMpReady"
      />
    </main>

    <div v-else class="game-layout">
      <div class="game-toolbar row">
        <p v-if="lobby.actionError" class="banner error game-toolbar-msg">{{ lobby.actionError }}</p>
        <button v-if="lobby.soloMode" type="button" class="btn ghost" @click="lobby.leaveSoloGame">
          Back to lobby
        </button>
        <button v-else type="button" class="btn ghost" @click="requestLeaveRoom">Leave room</button>
      </div>
      <SoloGame
        v-if="lobby.soloMode"
        :game-session-id="lobby.gameSessionId"
        :map-preset-id="lobby.soloMapPresetId"
        :tank-preset="lobby.soloTankPresetId"
      />
      <MultiplayerGame
        v-else
        :game-session-id="lobby.gameSessionId"
        :is-host="lobby.isHost"
        :match="lobby.mpMatchConfig"
        :peer-signal="lobby.peerSignal"
        :send-game-signal="lobby.sendPeerSignal"
      />
    </div>

    <SoloGameDialog
      v-if="lobby.soloGameDialogOpen"
      :initial-map-id="lobby.soloMapPresetId"
      :initial-tank-id="lobby.soloTankPresetId"
      @cancel="lobby.cancelSoloGameDialog"
      @confirm="lobby.confirmSoloGameDialog"
    />

    <JoinRoomDialog
      v-if="lobby.joinTarget"
      :target="lobby.joinTarget"
      v-model:password="lobby.joinPassword"
      @cancel="lobby.closeJoinDialog"
      @confirm="lobby.confirmJoin"
    />

    <LeaveRoomConfirmDialog
      v-if="leaveConfirmOpen"
      @cancel="cancelLeaveRoom"
      @confirm="confirmLeaveRoom"
    />
  </div>
</template>
