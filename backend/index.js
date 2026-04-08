// import { WebSocketServer } from "ws";
// import { GameManager } from "./gameManager.js";

// const wss = new WebSocketServer({ port: 8080 });
// const gameManager = new GameManager();

// wss.on("connection", function connection(ws) {
//   gameManager.addPlayer(ws);
//   ws.on("close", () => {
//     gameManager.removePlayer(ws);
//   });
// });

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { GameManager } from "./gameManager.js";

const app = express();

app.get("/", (_, res) => {
  res.send("Server is running 🚀");
});

const server = http.createServer(app);

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

const wss = new WebSocketServer({ server });

const gameManager = new GameManager();

wss.on("connection", function connection(ws) {
  gameManager.addPlayer(ws);

  ws.on("close", () => {
    gameManager.removePlayer(ws);
  });
});