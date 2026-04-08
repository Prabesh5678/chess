import { useEffect, useState, useRef } from "react";
import { Chess } from "chess.js";
import { useNavigate } from "react-router-dom";

const WS_URL = "https://chess-1vxo.onrender.com" || "ws://localhost:8080";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const PIECE_UNICODE = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

const PROMOTION_PIECES = [
  { key: "q", label: "Queen", white: "♕", black: "♛" },
  { key: "r", label: "Rook", white: "♖", black: "♜" },
  { key: "b", label: "Bishop", white: "♗", black: "♝" },
  { key: "n", label: "Knight", white: "♘", black: "♞" },
];

function isPromotionMove(chess, from, to) {
  const piece = chess.get(from);
  if (!piece || piece.type !== "p") return false;
  return (
    (piece.color === "w" && to[1] === "8") ||
    (piece.color === "b" && to[1] === "1")
  );
}

export default function Game() {
  const navigate = useNavigate();
  const wsRef = useRef(null);
  const chessRef = useRef(new Chess());
  const chatEndRef = useRef(null);

  const colorRef = useRef(null);
  const statusRef = useRef("connecting");
  const selectedRef = useRef(null);
  const legalSquaresRef = useRef([]);
  const pendingPromotionRef = useRef(null);
  const draggingFromRef = useRef(null);

  const [status, setStatus] = useState("connecting");
  const [color, setColor] = useState(null);
  const [moveCount, setMoveCount] = useState(0); // incremented to trigger re-render after moves
  const [selected, setSelected] = useState(null);
  const [legalSquares, setLegalSquares] = useState([]);
  const [dragOver, setDragOver] = useState(null);
  const [winner, setWinner] = useState(null);
  const [gameOverReason, setGameOverReason] = useState(null);
  const [promotionPending, setPromotionPending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  function applyColor(c) {
    colorRef.current = c;
    setColor(c);
  }
  function applyStatus(s) {
    statusRef.current = s;
    setStatus(s);
  }
  function applySelected(s) {
    selectedRef.current = s;
    setSelected(s);
  }
  function applyLegalSquares(l) {
    legalSquaresRef.current = l;
    setLegalSquares(l);
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ws
  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "init_game" }));
      applyStatus("waiting");
    };

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "game_start") {
        applyColor(msg.color);
        chessRef.current.reset();
        setMoveCount(0);
        applySelected(null);
        applyLegalSquares([]);
        pendingPromotionRef.current = null;
        draggingFromRef.current = null;
        setDragOver(null);
        setPromotionPending(false);
        setWinner(null);
        setGameOverReason(null);
        setMessages([]);
        setChatInput("");
        applyStatus("playing");
      }

      if (msg.type === "move_made") {
        try {
          const result = chessRef.current.move(msg.move);
          if (result) {
            applySelected(null);
            applyLegalSquares([]);
          }
        } catch {
        }
      }

      if (msg.type === "game_over") {
        setWinner(msg.result.winner);
        setGameOverReason(msg.result.reason);
        applyStatus("game_over");
      }

      if (msg.type === "opponent_disconnected") {
        setWinner(colorRef.current);
        setGameOverReason("opponent_disconnected");
        applyStatus("game_over");
      }

      if (msg.type === "chat") {
        setMessages((prev) => [...prev, { from: msg.from, text: msg.message }]);
      }
    };

    socket.onerror = () => applyStatus("error");
    socket.onclose = () => {
      if (statusRef.current !== "game_over") applyStatus("disconnected");
    };

    return () => socket.close();
  }, []);

  function sendChat() {
    const text = chatInput.trim();
    if (!text || statusRef.current !== "playing") return;
    wsRef.current?.send(JSON.stringify({ type: "chat", message: text }));
    setChatInput("");
  }

  function tryMove(from, to) {
    const chess = chessRef.current;
    const myColor = colorRef.current === "white" ? "w" : "b";
    if (chess.turn() !== myColor) return false;

    const legalTargets = chess
      .moves({ square: from, verbose: true }) //extract legal moves
      .map((m) => m.to);// return an arrauy of legal target squares
    if (!legalTargets.includes(to)) return false;

    if (isPromotionMove(chess, from, to)) {
      pendingPromotionRef.current = { from, to };
      setPromotionPending(true);
      applySelected(from);
      applyLegalSquares(legalTargets);
      return true;
    }

    wsRef.current?.send(JSON.stringify({ type: "move", move: { from, to } }));
    applySelected(null);
    applyLegalSquares([]);
    return true;
  }

  function handlePromotion(pieceKey) {
    const pending = pendingPromotionRef.current;
    if (!pending) return;
    wsRef.current?.send(
      JSON.stringify({
        type: "move",
        move: { from: pending.from, to: pending.to, promotion: pieceKey },
      }),
    );
    pendingPromotionRef.current = null;
    setPromotionPending(false);
    applySelected(null);
    applyLegalSquares([]);
  }

  function handleSquareClick(sq) {
    if (statusRef.current !== "playing") return;
    if (pendingPromotionRef.current) return;
    if (draggingFromRef.current) {
      draggingFromRef.current = null;
      return;
    }

    const chess = chessRef.current;
    const myColor = colorRef.current === "white" ? "w" : "b";
    if (chess.turn() !== myColor) return;

    const currentSelected = selectedRef.current;
    const currentLegal = legalSquaresRef.current;

    if (currentSelected) {
      if (currentSelected === sq) {
        applySelected(null);
        applyLegalSquares([]);
        return;
      }
      if (currentLegal.includes(sq)) {
        tryMove(currentSelected, sq);
        return;
      }
      const piece = chess.get(sq);
      if (piece && piece.color === myColor) {
        const targets = chess
          .moves({ square: sq, verbose: true })
          .map((m) => m.to);
        applySelected(sq);
        applyLegalSquares(targets);
        return;
      }
      applySelected(null);
      applyLegalSquares([]);
      return;
    }

    const piece = chess.get(sq);
    if (!piece || piece.color !== myColor) return;
    const targets = chess.moves({ square: sq, verbose: true }).map((m) => m.to);
    applySelected(sq);
    applyLegalSquares(targets);
  }

  // ── drag handlers ──
  function handleDragStart(e, sq) {
    if (statusRef.current !== "playing" || pendingPromotionRef.current) {
      e.preventDefault();
      return;
    }
    const chess = chessRef.current;
    const myColor = colorRef.current === "white" ? "w" : "b";
    const piece = chess.get(sq);
    if (!piece || piece.color !== myColor || chess.turn() !== myColor) {
      e.preventDefault();
      return;
    }

    draggingFromRef.current = sq;
    const targets = chess.moves({ square: sq, verbose: true }).map((m) => m.to);
    applySelected(sq);
    applyLegalSquares(targets);

    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-999px;left:-999px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, sq) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(sq);
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  function handleDrop(e, sq) {
    e.preventDefault();
    setDragOver(null);
    const from = draggingFromRef.current;
    draggingFromRef.current = null;
    if (!from || from === sq) {
      applySelected(null);
      applyLegalSquares([]);
      return;
    }
    tryMove(from, sq);
  }

  function handleDragEnd() {
    draggingFromRef.current = null;
    setDragOver(null);
  }

  // ── board map — reads chessRef directly, re-runs when moveCount changes ──
  function getBoardMap() {
    const map = {};
    for (const file of FILES)
      for (const rank of RANKS) {
        const sq = file + rank;
        const p = chessRef.current.get(sq);
        map[sq] = p ? p.color + p.type.toUpperCase() : null;
      }
    return map;
  }

  const boardMap = getBoardMap();
  const myColor = color === "white" ? "w" : "b";
  const myTurn = status === "playing" && chessRef.current.turn() === myColor;
  const displayRanks = color === "black" ? [...RANKS].reverse() : RANKS;
  const displayFiles = color === "black" ? [...FILES].reverse() : FILES;

  // ── labels ──
  const gameOverLabel = () => {
    if (gameOverReason === "opponent_disconnected")
      return "Opponent left — You win!";
    if (winner === "draw") {
      const r = {
        stalemate: "Draw — Stalemate",
        insufficient_material: "Draw — Insufficient Material",
        threefold_repetition: "Draw — Threefold Repetition",
        "50_move_rule": "Draw — 50 Move Rule",
      };
      return r[gameOverReason] || "Draw";
    }
    return winner === color ? "You won!" : "You lost";
  };

  const statusLabel = () => {
    if (status === "connecting") return "Connecting…";
    if (status === "waiting") return "Waiting for opponent…";
    if (status === "error") return "Connection error";
    if (status === "disconnected") return "Disconnected";
    if (status === "game_over") return gameOverLabel();
    if (promotionPending) return "Choose promotion piece";
    return myTurn ? "▶ Your turn" : "Opponent's turn";
  };

  const statusColor = () => {
    if (status === "playing") return myTurn ? "text-white" : "text-zinc-500";
    if (status === "game_over") {
      if (gameOverReason === "opponent_disconnected" || winner === color)
        return "text-green-400";
      if (winner === "draw") return "text-yellow-400";
      return "text-red-400";
    }
    if (status === "error" || status === "disconnected") return "text-red-400";
    return "text-zinc-400";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-6 p-6">
      {/* status */}
      <div className="flex items-center gap-2 text-xs tracking-widest uppercase">
        <span className="text-xl select-none">♟</span>
        <span className={statusColor()}>{statusLabel()}</span>
        {color && status !== "connecting" && (
          <span className="text-zinc-700">· {color}</span>
        )}
      </div>

      {/* board + chat */}
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* board */}
        <div className="relative">
          {status === "connecting" || status === "waiting" ? (
            <div className="w-[400px] h-[400px] bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <span className="text-zinc-600 text-sm animate-pulse tracking-widest uppercase">
                {statusLabel()}
              </span>
            </div>
          ) : (
            <div className="flex gap-1">
              <div className="flex flex-col">
                {displayRanks.map((r) => (
                  <div
                    key={r}
                    className="h-[50px] w-4 flex items-center justify-center text-[10px] text-zinc-600"
                  >
                    {r}
                  </div>
                ))}
              </div>

              <div>
                <div
                  className="border border-zinc-700"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8, 50px)",
                    gridTemplateRows: "repeat(8, 50px)",
                  }}
                >
                  {displayRanks.map((rank) =>
                    displayFiles.map((file) => {
                      const sq = file + rank;
                      const piece = boardMap[sq];
                      const isLight =
                        (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0;
                      const isSelected = selected === sq;
                      const isLegal = legalSquares.includes(sq);
                      const isDragTarget = dragOver === sq && isLegal;

                      let bgColor = isLight ? "#c8b89a" : "#8b6c4a";
                      if (isSelected) bgColor = "#f0d060";
                      else if (isDragTarget)
                        bgColor = isLight ? "#7ec87a" : "#3d8c38";
                      else if (isLegal)
                        bgColor = isLight ? "#a8d8a0" : "#5a9e52";

                      const isDraggable = (() => {
                        if (statusRef.current !== "playing") return false;
                        if (!piece) return false;
                        const pColor = piece.startsWith("w") ? "w" : "b";
                        return (
                          pColor === myColor &&
                          chessRef.current.turn() === myColor
                        );
                      })();

                      return (
                        <div
                          key={sq}
                          onClick={() => handleSquareClick(sq)}
                          onDragOver={(e) => handleDragOver(e, sq)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, sq)}
                          style={{
                            backgroundColor: bgColor,
                            width: 50,
                            height: 50,
                          }}
                          className="flex items-center justify-center relative"
                        >
                          {isLegal && !piece && (
                            <div className="w-3 h-3 rounded-full bg-green-700 opacity-70 pointer-events-none" />
                          )}
                          {piece && (
                            <span
                              draggable={isDraggable}
                              onDragStart={(e) => handleDragStart(e, sq)}
                              onDragEnd={handleDragEnd}
                              className="select-none"
                              style={{
                                fontSize: 32,
                                lineHeight: 1,
                                cursor: isDraggable ? "grab" : "default",
                                color: piece.startsWith("w")
                                  ? "#ffffff"
                                  : "#1c1917",
                                textShadow: piece.startsWith("w")
                                  ? "0 1px 3px #0009"
                                  : "0 1px 3px #fff5",
                                touchAction: "none",
                              }}
                            >
                              {PIECE_UNICODE[piece]}
                            </span>
                          )}
                        </div>
                      );
                    }),
                  )}
                </div>

                <div className="flex mt-1">
                  {displayFiles.map((f) => (
                    <div
                      key={f}
                      className="w-[50px] text-center text-[10px] text-zinc-600"
                    >
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* promotion modal */}
          {promotionPending && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
              <div className="bg-zinc-900 border border-zinc-700 p-5 flex flex-col items-center gap-4">
                <p className="text-xs tracking-widest uppercase text-zinc-400">
                  Promote pawn to
                </p>
                <div className="flex gap-3">
                  {PROMOTION_PIECES.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => handlePromotion(p.key)}
                      className="w-16 h-16 bg-zinc-800 border border-zinc-600 hover:border-white hover:bg-zinc-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
                    >
                      <span
                        style={{
                          fontSize: 30,
                          lineHeight: 1,
                          color: color === "white" ? "#fff" : "#1c1917",
                          textShadow:
                            color === "white"
                              ? "0 1px 3px #0009"
                              : "0 1px 3px #fff5",
                        }}
                      >
                        {color === "white" ? p.white : p.black}
                      </span>
                      <span className="text-[9px] text-zinc-500 tracking-widest uppercase">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* chat panel — only shown once game is matched */}
        {(status === "playing" || status === "game_over") && (
          <div className="flex flex-col gap-2 w-64">
            <span className="text-[10px] tracking-widest uppercase text-zinc-600">
              Chat
            </span>

            {/* message list */}
            <div
              className="bg-zinc-900 border border-zinc-800 rounded p-3 flex flex-col gap-2 overflow-y-auto"
              style={{ height: "415px" }}
            >
              {messages.length === 0 && (
                <span className="text-zinc-700 text-xs">No messages yet…</span>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.from === color ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">
                    {m.from === color ? "you" : "opponent"}
                  </span>
                  <span //
                    className={`text-xs px-3 py-1.5 rounded max-w-[95%] break-words leading-relaxed
                    ${m.from === color ? "bg-white text-zinc-950" : "bg-zinc-800 text-zinc-200"}`}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Say something…"
                maxLength={200}
                disabled={status !== "playing"}
                className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 text-white text-xs px-3 py-2 outline-none focus:border-zinc-600 disabled:opacity-40 placeholder:text-zinc-700"
              />
              <button
                onClick={sendChat}
                disabled={status !== "playing" || !chatInput.trim()}
                className="px-3 py-2 bg-white text-zinc-950 text-xs font-semibold uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-40 active:scale-95 transition-all"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* game over actions */}
      {status === "game_over" && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              chessRef.current.reset();
              setMoveCount(0);
              setWinner(null);
              setGameOverReason(null);
              applySelected(null);
              applyLegalSquares([]);
              pendingPromotionRef.current = null;
              draggingFromRef.current = null;
              setDragOver(null);
              setPromotionPending(false);
              applyStatus("waiting");
              wsRef.current?.send(JSON.stringify({ type: "init_game" }));
            }}
            className="px-5 py-2 bg-white text-zinc-950 text-xs font-semibold tracking-widest uppercase hover:bg-zinc-200 active:scale-95 transition-all"
          >
            Play Again
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2 border border-zinc-700 text-zinc-400 text-xs tracking-widest uppercase hover:text-white hover:border-zinc-500 active:scale-95 transition-all"
          >
            Home
          </button>
        </div>
      )}

      {(status === "disconnected" || status === "error") && (
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 border border-zinc-700 text-zinc-400 text-xs tracking-widest uppercase hover:text-white hover:border-zinc-500 active:scale-95 transition-all"
        >
          Back to Home
        </button>
      )}
    </div>
  );
}
