import { readAllowedCorsOriginsFromEnv } from "./http/cors";
import { createHttpServer } from "./http/createHttpServer";
import { createWebsocket } from "./socket/websocket";
import { ChatStore } from "./stores/chatStore";
import { RoomStore } from "./stores/roomStore";

const port = Number(process.env.PORT) || 3000;

const server = createHttpServer(readAllowedCorsOriginsFromEnv());

const roomStore = new RoomStore();
const chatStore = new ChatStore();
createWebsocket(server, { roomStore, chatStore });

server.listen(port, () => {
  console.log(`HTTP http://localhost:${port}/`);
});
