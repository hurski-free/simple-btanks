import http from "http";

import { WebSocketServer } from "ws";
import { ChatStore } from "../stores/chatStore";
import { RoomStore } from "../stores/roomStore";
import { onClientSocketMessage, type MessageHandlerContext } from "./clientMessage.handlers";
import { broadcastOnlineCount, send } from "./websocket.helper";

export type WebsocketDeps = {
  roomStore: RoomStore;
  chatStore: ChatStore;
};

const WS_PATH = "/ws";

export function createWebsocket(server: http.Server, deps: WebsocketDeps): void {
  const { roomStore, chatStore } = deps;
  const wss = new WebSocketServer({ server, path: WS_PATH });

  wss.on("connection", (ws) => {
    console.log("User connected");
    send(ws, { type: "chat-history", messages: chatStore.getChatHistory() });

    const ctx: MessageHandlerContext = { wss, ws, roomStore, chatStore };
    ws.on("message", (data) => onClientSocketMessage(ctx, data));

    const onGone = (): void => {
      roomStore.removeSocket(ws);
      queueMicrotask(() => broadcastOnlineCount(wss));
    };

    ws.on("close", onGone);
    ws.on("error", onGone);
    queueMicrotask(() => broadcastOnlineCount(wss));
  });
}
