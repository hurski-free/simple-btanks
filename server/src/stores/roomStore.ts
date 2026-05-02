import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import { ErrorMessage, ServerMessage } from "../socket/message.type";
import { serverError } from "../socket/serverError";
import { send } from "../socket/websocket.helper";

const MAX_DISPLAY_NAME = 64;
const MAX_SIGNAL_JSON = 64_000;

type Role = "host" | "guest";

type Attachment = {
  roomId: string | null;
  role: Role | null;
};

export type Room = {
  id: string;
  displayName: string;
  host: WebSocket;
  hostUsername: string;
  guest: WebSocket | null;
  guestUsername: string | null;
  password?: string;
};

export type RelaySignalResult = { ok: true } | { ok: false; error: ErrorMessage };

function safeDisplayName(raw: string | undefined): string {
  const s = (raw ?? "").trim().slice(0, MAX_DISPLAY_NAME);
  return s.length > 0 ? s : "Room";
}

export class RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly attachment = new WeakMap<WebSocket, Attachment>();

  private getAtt(ws: WebSocket): Attachment {
    let a = this.attachment.get(ws);
    if (!a) {
      a = { roomId: null, role: null };
      this.attachment.set(ws, a);
    }
    return a;
  }

  createRoom(host: WebSocket, hostUsername?: string, displayName?: string, password?: string): ServerMessage {
    const att = this.getAtt(host);
    if (att.roomId) {
      return serverError("already-in-room", "Leave the current room before creating a new one.");
    }

    if (!hostUsername) {
      return serverError("host-username-required", "Host username is required.");
    }

    const id = randomUUID();
    const name = safeDisplayName(displayName);

    this.rooms.set(id, {
      id,
      hostUsername,
      displayName: name,
      host,
      guest: null,
      guestUsername: null,
      password,
    });

    att.roomId = id;
    att.role = "host";
    console.log("room created", id, name);
    return { type: "room-created", roomId: id, displayName: name, password };
  }

  listRooms(): ServerMessage {
    const rooms = [...this.rooms.values()]
      .filter((r) => r.guest === null)
      .map((r) => ({
        roomId: r.id,
        displayName: r.displayName,
        hasPassword: Boolean(r.password),
      }));
    return { type: "room-list", rooms };
  }

  joinRoom(guest: WebSocket, roomId: string, guestUsername?: string, password?: string): ServerMessage {
    const att = this.getAtt(guest);
    if (att.roomId) {
      return serverError("already-in-room", "Already in a room.");
    }

    if (!guestUsername) {
      return serverError("guest-username-required", "Guest username is required.");
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return serverError("room-not-found", "Room does not exist.");
    }
    if (room.guest !== null) {
      return serverError("room-full", "This room already has a guest (1v1).");
    }

    if (room.password && room.password !== password) {
      return serverError("wrong-password", "Wrong password.");
    }

    room.guest = guest;
    room.guestUsername = guestUsername;
    att.roomId = room.id;
    att.role = "guest";

    send(room.host, { type: "peer-joined", peerUsername: guestUsername });
    return {
      type: "joined-room",
      roomId: room.id,
      displayName: room.displayName,
      role: "guest",
      hostUsername: room.hostUsername,
    };
  }

  relaySignal(from: WebSocket, payload: unknown): RelaySignalResult {
    const att = this.attachment.get(from);
    if (!att?.roomId || !att.role) {
      return {
        ok: false,
        error: serverError("not-in-room", "Join or create a room before signaling."),
      };
    }

    const room = this.rooms.get(att.roomId);
    if (!room) {
      return {
        ok: false,
        error: serverError("room-missing", "Room no longer exists."),
      };
    }

    const peer = att.role === "host" ? room.guest : room.host;

    if (!peer || peer.readyState !== WebSocket.OPEN) {
      return {
        ok: false,
        error: serverError("peer-not-ready", "The other peer is not connected yet."),
      };
    }

    let json: string;
    try {
      json = JSON.stringify(payload);
    } catch {
      return {
        ok: false,
        error: serverError("bad-signal", "Signal payload is not JSON-serializable."),
      };
    }
    if (json.length > MAX_SIGNAL_JSON) {
      return {
        ok: false,
        error: serverError("signal-too-large", "Signal payload is too large."),
      };
    }

    send(peer, { type: "signal", payload });
    return { ok: true };
  }

  leaveRoom(ws: WebSocket): void {
    const att = this.attachment.get(ws);
    if (!att?.roomId) return;

    const room = this.rooms.get(att.roomId);
    if (!room) {
      att.roomId = null;
      att.role = null;
      return;
    }

    if (att.role === "host") {
      const guest = room.guest;
      this.rooms.delete(room.id);
      att.roomId = null;
      att.role = null;
      if (guest) {
        const ga = this.attachment.get(guest);
        if (ga) {
          ga.roomId = null;
          ga.role = null;
        }
        send(guest, { type: "room-closed", reason: "host-left" });
      }
      send(ws, { type: "left-room" });
      return;
    }

    if (att.role === "guest") {
      room.guest = null;
      att.roomId = null;
      att.role = null;
      send(room.host, { type: "peer-left" });
      send(ws, { type: "left-room" });
    }
  }

  removeSocket(ws: WebSocket): void {
    this.leaveRoom(ws);
  }
}
