import { WebSocket, WebSocketServer } from "ws";
import { ServerMessage } from "./message.type";

export function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function broadcastMessage(wss: WebSocketServer, msg: ServerMessage): void {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(msg));
    }
  }
}

export function broadcastOnlineCount(wss: WebSocketServer): void {
  let count = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      count += 1;
    }
  }

  broadcastMessage(wss, { type: "online-count", count } satisfies ServerMessage);
}
