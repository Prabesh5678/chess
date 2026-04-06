import { Game } from "./game.js";

export class GameManager {
  constructor() {
    this.games = [];
    this.pendingUser = null;
    this.users = [];
  }

  addPlayer(socket) {
    this.users.push(socket);
    this.addHandler(socket);
  }

  removePlayer(socket) {
    this.users = this.users.filter((user) => user !== socket);

    if (this.pendingUser === socket) {
      this.pendingUser = null;
    }

    const gameIndex = this.games.findIndex(
      (game) => game.player1 === socket || game.player2 === socket,
    );
    if (gameIndex !== -1) {
      this.games[gameIndex].notifyOpponentLeft(socket);
      this.games.splice(gameIndex, 1);
    }
  }

  addHandler(socket) {
    socket.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (message.type === "init_game") {
        const existingIndex = this.games.findIndex(
          (game) => game.player1 === socket || game.player2 === socket,
        );
        if (existingIndex !== -1) {
          this.games.splice(existingIndex, 1);
        }

        if (this.pendingUser && this.pendingUser !== socket) {
          const game = new Game(this.pendingUser, socket);
          this.games.push(game);
          this.pendingUser = null;
        } else {
          this.pendingUser = socket;
        }
      }

      if (message.type === "move") {
        const game = this.games.find(
          (game) => game.player1 === socket || game.player2 === socket,
        );
        if (!game) return;
        game.makeMove(socket, message.move);
      }

      if (message.type === "chat") {
        const game = this.games.find(
          (game) => game.player1 === socket || game.player2 === socket,
        );
        if (!game) return;
        game.sendChat(socket, message.message);
      }
    });
  }
}
