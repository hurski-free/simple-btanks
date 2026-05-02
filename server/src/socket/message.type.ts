export type ErrorMessage = { type: "error"; code: string; message: string };

export type ClientMessage =
  | { type: "create-room"; hostUsername?: string; displayName?: string; password?: string }
  | { type: "list-rooms" }
  | { type: "join-room"; roomId: string; guestUsername?: string; password?: string }
  | { type: "signal"; payload: unknown }
  | { type: "leave-room" }
  | { type: "chat-send"; nickname?: string; text?: string };

export type ServerMessage =
  | { type: "room-created"; roomId: string; displayName: string; password?: string }
  | {
      type: "room-list";
      rooms: Array<{
        roomId: string;
        displayName: string;
        hasPassword: boolean;
      }>;
    }
  | {
      type: "joined-room";
      roomId: string;
      displayName: string;
      role: "guest";
      hostUsername: string;
    }
  | { type: "peer-joined"; peerUsername: string }
  | { type: "signal"; payload: unknown }
  | ErrorMessage
  | { type: "peer-left" }
  | { type: "room-closed"; reason: string }
  | { type: "left-room" }
  | { type: "online-count"; count: number }
  | {
      type: "chat-history";
      messages: Array<{ id: string; at: string; nickname: string; text: string }>;
    }
  | { type: "chat-message"; id: string; at: string; nickname: string; text: string };
