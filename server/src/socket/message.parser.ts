import { ClientMessage } from "./message.type";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.type !== "string") return null;

  switch (data.type) {
    case "create-room":
      return {
        type: "create-room",
        hostUsername:
          typeof data.hostUsername === "string" ? data.hostUsername : undefined,
        displayName:
          typeof data.displayName === "string" ? data.displayName : undefined,
        password:
          typeof data.password === "string" ? data.password : undefined,
      };
    case "list-rooms":
      return { type: "list-rooms" };
    case "join-room":
      return typeof data.roomId === "string"
        ? {
          type: "join-room",
          roomId: data.roomId,
          guestUsername:
            typeof data.guestUsername === "string"
              ? data.guestUsername
              : undefined,
          password: typeof data.password === "string" ? data.password : undefined,
        }
        : null;
    case "signal":
      return {
        type: "signal",
        payload: data.payload,
      };
    case "leave-room":
      return {
        type: "leave-room",
      };
    case "chat-send":
      if (typeof data.nickname !== "string" || typeof data.text !== "string") return null;
      return { type: "chat-send", nickname: data.nickname, text: data.text };
    default:
      return null;
  }
}
