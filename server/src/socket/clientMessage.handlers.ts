import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { ChatStore, type ChatMessagePublic } from "../stores/chatStore";
import { RoomStore } from "../stores/roomStore";
import { parseClientMessage } from "./message.parser";
import type { ClientMessage, ErrorMessage } from "./message.type";
import { serverError } from "./serverError";
import { send } from "./websocket.helper";

export type MessageHandlerContext = {
  wss: WebSocketServer;
  ws: WebSocket;
  roomStore: RoomStore;
  chatStore: ChatStore;
};

function isChatAppendError(entry: ChatMessagePublic | ErrorMessage): entry is ErrorMessage {
  return "type" in entry && entry.type === "error";
}

function handleCreateRoom(ctx: MessageHandlerContext, msg: Extract<ClientMessage, { type: "create-room" }>): void {
  send(ctx.ws, ctx.roomStore.createRoom(ctx.ws, msg.hostUsername, msg.displayName, msg.password));
}

function handleListRooms(ctx: MessageHandlerContext, msg: Extract<ClientMessage, { type: "list-rooms" }>): void {
  void msg;
  send(ctx.ws, ctx.roomStore.listRooms());
}

function handleJoinRoom(ctx: MessageHandlerContext, msg: Extract<ClientMessage, { type: "join-room" }>): void {
  send(ctx.ws, ctx.roomStore.joinRoom(ctx.ws, msg.roomId, msg.guestUsername, msg.password));
}

function handleLeaveRoom(ctx: MessageHandlerContext, msg: Extract<ClientMessage, { type: "leave-room" }>): void {
  void msg;
  ctx.roomStore.leaveRoom(ctx.ws);
}

function handleSignal(ctx: MessageHandlerContext, msg: Extract<ClientMessage, { type: "signal" }>): void {
  const result = ctx.roomStore.relaySignal(ctx.ws, msg.payload);
  if (!result.ok) {
    send(ctx.ws, result.error);
  }
}

function handleChatSend(ctx: MessageHandlerContext, msg: Extract<ClientMessage, { type: "chat-send" }>): void {
  const entry = ctx.chatStore.appendChatMessage(ctx.ws, msg.nickname, msg.text);
  if (isChatAppendError(entry)) {
    send(ctx.ws, entry);
    return;
  }
  ctx.chatStore.broadcastChatMessage(ctx.wss, entry);
}

const clientMessageHandlers: {
  [K in ClientMessage["type"]]: (ctx: MessageHandlerContext, msg: Extract<ClientMessage, { type: K }>) => void;
} = {
  "create-room": handleCreateRoom,
  "list-rooms": handleListRooms,
  "join-room": handleJoinRoom,
  "leave-room": handleLeaveRoom,
  signal: handleSignal,
  "chat-send": handleChatSend,
};

function dispatchClientMessage(ctx: MessageHandlerContext, msg: ClientMessage): void {
  const run = clientMessageHandlers[msg.type] as (c: MessageHandlerContext, m: ClientMessage) => void;
  run(ctx, msg);
}

export function onClientSocketMessage(ctx: MessageHandlerContext, raw: RawData): void {
  const text = typeof raw === "string" ? raw : raw.toString("utf8");
  const msg = parseClientMessage(text);
  if (!msg) {
    send(ctx.ws, serverError("bad-message", "Invalid or unknown message."));
    return;
  }

  dispatchClientMessage(ctx, msg);
}
