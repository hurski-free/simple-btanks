import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import { ErrorMessage, ServerMessage } from "../socket/message.type";
import { broadcastMessage } from "../socket/websocket.helper";

export type ChatMessagePublic = {
  id: string;
  at: string;
  nickname: string;
  text: string;
};

const MAX_MESSAGES_STORE = 50;
const MAX_TEXT_LEN = 200;
const MAX_NICK_LEN = 30;

const CHAT_SEND_MIN_INTERVAL_MS = 10_000;

export class ChatStore {
  private readonly messages: ChatMessagePublic[] = [];
  private readonly lastChatSendAt = new WeakMap<WebSocket, number>();

  broadcastChatMessage(wss: WebSocketServer, entry: ChatMessagePublic): void {
    broadcastMessage(wss, { type: "chat-message", ...entry } satisfies ServerMessage);
  }

  getChatHistory(): ChatMessagePublic[] {
    return [...this.messages];
  }

  appendChatMessage(ws: WebSocket, nickname?: string, message?: string): ChatMessagePublic | ErrorMessage {
    const now = Date.now();
    const last = this.lastChatSendAt.get(ws) ?? 0;
    const elapsed = now - last;

    if (last > 0 && elapsed < CHAT_SEND_MIN_INTERVAL_MS) {
      const waitSec = Math.ceil((CHAT_SEND_MIN_INTERVAL_MS - elapsed) / 1000);
      return {
        type: "error",
        code: "chat-cooldown",
        message: `Wait ${waitSec}s before sending another message.`
      };
    }

    const text = message ? message.trim().slice(0, MAX_TEXT_LEN) : "";
    if (text.length === 0) {
      return {
        type: "error",
        code: "chat-empty",
        message: "Message cannot be empty."
      };
    }

    const n = nickname ? nickname.trim().slice(0, MAX_NICK_LEN) : "";
    if (n.length === 0) {
      return {
        type: "error",
        code: "nickname-empty",
        message: "Nickname cannot be empty."
      };
    }

    const entry: ChatMessagePublic = {
      id: randomUUID(),
      at: new Date().toISOString(),
      nickname: n,
      text: text,
    };
    this.messages.push(entry);

    while (this.messages.length > MAX_MESSAGES_STORE) {
      this.messages.shift();
    }

    this.lastChatSendAt.set(ws, now);

    return entry;
  }
}
