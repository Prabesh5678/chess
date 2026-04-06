import { WebSocketServer } from "ws";
import { GameManager } from "./gameManager.js";

const wss = new WebSocketServer({ port: 8080 });
const gameManager = new GameManager();

wss.on("connection", function connection(ws) {
  gameManager.addPlayer(ws);
  ws.on("close", () => {
    gameManager.removePlayer(ws);
  });
});
