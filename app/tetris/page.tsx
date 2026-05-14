"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLS = 10;
const ROWS = 20;
const HIDDEN_ROWS = 2;
const TOTAL_ROWS = ROWS + HIDDEN_ROWS;
const CELL = 28;

type Cell = 0 | TetrominoKey;
type DisplayCell = Cell | "ghost";
type TetrominoKey = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Shape = number[][];

const SHAPES: Record<TetrominoKey, Shape[]> = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  O: [
    [
      [1, 1],
      [1, 1],
    ],
  ],
  T: [
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  S: [
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 0],
    ],
    [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  Z: [
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
  ],
};

const COLORS: Record<TetrominoKey, { fill: string; edge: string; glow: string }> = {
  I: { fill: "#22d3ee", edge: "#67e8f9", glow: "rgba(34,211,238,0.55)" },
  O: { fill: "#facc15", edge: "#fde68a", glow: "rgba(250,204,21,0.55)" },
  T: { fill: "#a855f7", edge: "#d8b4fe", glow: "rgba(168,85,247,0.55)" },
  S: { fill: "#22c55e", edge: "#86efac", glow: "rgba(34,197,94,0.55)" },
  Z: { fill: "#ef4444", edge: "#fca5a5", glow: "rgba(239,68,68,0.55)" },
  J: { fill: "#3b82f6", edge: "#93c5fd", glow: "rgba(59,130,246,0.55)" },
  L: { fill: "#f97316", edge: "#fdba74", glow: "rgba(249,115,22,0.55)" },
};

const KEYS: TetrominoKey[] = ["I", "O", "T", "S", "Z", "J", "L"];

type Piece = {
  key: TetrominoKey;
  rot: number;
  row: number;
  col: number;
};

type Board = Cell[][];

const emptyBoard = (): Board =>
  Array.from({ length: TOTAL_ROWS }, () => Array<Cell>(COLS).fill(0));

const shapeOf = (p: Piece): Shape => SHAPES[p.key][p.rot % SHAPES[p.key].length];

const spawnPiece = (key: TetrominoKey): Piece => {
  const shape = SHAPES[key][0];
  const col = Math.floor((COLS - shape[0].length) / 2);
  return { key, rot: 0, row: 0, col };
};

const randomBag = (): TetrominoKey[] => {
  const bag = [...KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

const collides = (board: Board, piece: Piece): boolean => {
  const shape = shapeOf(piece);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const br = piece.row + r;
      const bc = piece.col + c;
      if (bc < 0 || bc >= COLS || br >= TOTAL_ROWS) return true;
      if (br >= 0 && board[br][bc]) return true;
    }
  }
  return false;
};

const merge = (board: Board, piece: Piece): Board => {
  const next = board.map((row) => row.slice());
  const shape = shapeOf(piece);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const br = piece.row + r;
      const bc = piece.col + c;
      if (br >= 0 && br < TOTAL_ROWS && bc >= 0 && bc < COLS) {
        next[br][bc] = piece.key;
      }
    }
  }
  return next;
};

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const kept = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = board.length - kept.length;
  const empties = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(0));
  return { board: [...empties, ...kept], cleared };
};

const dropDistance = (board: Board, piece: Piece): number => {
  let d = 0;
  while (!collides(board, { ...piece, row: piece.row + d + 1 })) d++;
  return d;
};

const levelGravity = (level: number) => {
  const frames = Math.max(1, 48 - (level - 1) * 5);
  return (frames / 60) * 1000;
};

const scoreFor = (lines: number, level: number): number => {
  const base = [0, 100, 300, 500, 800][lines] ?? 0;
  return base * level;
};

export default function TetrisPage() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [bag, setBag] = useState<TetrominoKey[]>(() => randomBag());
  const [piece, setPiece] = useState<Piece | null>(null);
  const [next, setNext] = useState<TetrominoKey | null>(null);
  const [hold, setHold] = useState<TetrominoKey | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({ board, piece, bag, next, hold, canHold, level, running, paused, gameOver });
  useEffect(() => {
    stateRef.current = { board, piece, bag, next, hold, canHold, level, running, paused, gameOver };
  });

  const drawNext = useCallback((currentBag: TetrominoKey[]): { key: TetrominoKey; bag: TetrominoKey[] } => {
    const queue = currentBag.length > 0 ? currentBag : randomBag();
    const [head, ...rest] = queue;
    return { key: head, bag: rest.length === 0 ? randomBag() : rest };
  }, []);

  const startGame = useCallback(() => {
    const first = randomBag();
    const second = randomBag();
    const startKey = first[0];
    const peek = first[1] ?? second[0];
    setBoard(emptyBoard());
    setBag(first.slice(2).length === 0 ? second : first.slice(2));
    setPiece(spawnPiece(startKey));
    setNext(peek);
    setHold(null);
    setCanHold(true);
    setScore(0);
    setLines(0);
    setLevel(1);
    setRunning(true);
    setPaused(false);
    setGameOver(false);
  }, []);

  const spawnNext = useCallback(
    (boardAfter: Board) => {
      setBoard(boardAfter);
      setCanHold(true);
      const upcoming = stateRef.current.next;
      if (!upcoming) return;
      const drawn = drawNext(stateRef.current.bag);
      setBag(drawn.bag);
      setNext(drawn.key);
      const newPiece = spawnPiece(upcoming);
      if (collides(boardAfter, newPiece)) {
        setPiece(null);
        setRunning(false);
        setGameOver(true);
      } else {
        setPiece(newPiece);
      }
    },
    [drawNext]
  );

  const lockPiece = useCallback(
    (b: Board, p: Piece) => {
      const merged = merge(b, p);
      const { board: cleared, cleared: lineCount } = clearLines(merged);
      if (lineCount > 0) {
        setLines((l) => {
          const total = l + lineCount;
          setLevel(Math.floor(total / 10) + 1);
          return total;
        });
        setScore((s) => s + scoreFor(lineCount, stateRef.current.level));
      }
      spawnNext(cleared);
    },
    [spawnNext]
  );

  const tryMove = useCallback((dr: number, dc: number): boolean => {
    const { board: b, piece: p } = stateRef.current;
    if (!p) return false;
    const moved = { ...p, row: p.row + dr, col: p.col + dc };
    if (!collides(b, moved)) {
      setPiece(moved);
      return true;
    }
    return false;
  }, []);

  const tryRotate = useCallback((dir: 1 | -1) => {
    const { board: b, piece: p } = stateRef.current;
    if (!p) return;
    const variants = SHAPES[p.key].length;
    const nextRot = (p.rot + dir + variants) % variants;
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      const candidate = { ...p, rot: nextRot, col: p.col + k };
      if (!collides(b, candidate)) {
        setPiece(candidate);
        return;
      }
    }
  }, []);

  const softDrop = useCallback(() => {
    const moved = tryMove(1, 0);
    if (moved) {
      setScore((s) => s + 1);
    } else {
      const { board: b, piece: p } = stateRef.current;
      if (p) lockPiece(b, p);
    }
  }, [tryMove, lockPiece]);

  const hardDrop = useCallback(() => {
    const { board: b, piece: p } = stateRef.current;
    if (!p) return;
    const d = dropDistance(b, p);
    const landed = { ...p, row: p.row + d };
    setScore((s) => s + d * 2);
    lockPiece(b, landed);
  }, [lockPiece]);

  const doHold = useCallback(() => {
    const { piece: p, hold: h, canHold: ok } = stateRef.current;
    if (!p || !ok) return;
    if (h === null) {
      const drawn = drawNext(stateRef.current.bag);
      setBag(drawn.bag);
      const nextKey = stateRef.current.next;
      setNext(drawn.key);
      setHold(p.key);
      if (nextKey) setPiece(spawnPiece(nextKey));
    } else {
      setHold(p.key);
      setPiece(spawnPiece(h));
    }
    setCanHold(false);
  }, [drawNext]);

  useEffect(() => {
    if (!running || paused || gameOver) return;
    const interval = levelGravity(level);
    const id = window.setInterval(() => {
      const moved = tryMove(1, 0);
      if (!moved) {
        const { board: b, piece: p } = stateRef.current;
        if (p) lockPiece(b, p);
      }
    }, interval);
    return () => window.clearInterval(id);
  }, [running, paused, gameOver, level, tryMove, lockPiece]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (!running || gameOver) {
          e.preventDefault();
          startGame();
          return;
        }
      }
      if (!running || gameOver) return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPaused((v) => !v);
        return;
      }
      if (paused) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          tryMove(0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          tryMove(0, 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          softDrop();
          break;
        case "ArrowUp":
        case "x":
        case "X":
          e.preventDefault();
          tryRotate(1);
          break;
        case "z":
        case "Z":
          e.preventDefault();
          tryRotate(-1);
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
        case "c":
        case "C":
        case "Shift":
          e.preventDefault();
          doHold();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, paused, gameOver, startGame, tryMove, tryRotate, softDrop, hardDrop, doHold]);

  const ghost = useMemo(() => {
    if (!piece) return null;
    const d = dropDistance(board, piece);
    return { ...piece, row: piece.row + d };
  }, [board, piece]);

  const display = useMemo<DisplayCell[][]>(() => {
    const b: DisplayCell[][] = board.map((row) => row.slice());
    if (ghost && piece) {
      const shape = shapeOf(ghost);
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const br = ghost.row + r;
          const bc = ghost.col + c;
          if (br >= 0 && br < TOTAL_ROWS && b[br][bc] === 0) {
            b[br][bc] = "ghost";
          }
        }
      }
    }
    if (piece) {
      const shape = shapeOf(piece);
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const br = piece.row + r;
          const bc = piece.col + c;
          if (br >= 0 && br < TOTAL_ROWS) b[br][bc] = piece.key;
        }
      }
    }
    return b.slice(HIDDEN_ROWS);
  }, [board, piece, ghost]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] bg-indigo-600/20 rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] bg-fuchsia-500/15 rounded-full blur-[140px]" />
      </div>

      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center font-black text-slate-900 shadow-lg shadow-cyan-500/30">
          T
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">TETRIS</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em]">Next.js 16 · React 19.2</p>
        </div>
      </header>

      <div className="flex gap-6 items-start">
        <Sidebar label="HOLD">
          <MiniPreview keyOf={hold} dim={!canHold} />
          <div className="mt-6 text-[10px] uppercase tracking-[0.3em] text-slate-500">Controls</div>
          <ul className="mt-3 text-[11px] text-slate-400 space-y-1 leading-relaxed">
            <li>← → 移動</li>
            <li>↓ ソフトドロップ</li>
            <li>↑ / X 右回転</li>
            <li>Z 左回転</li>
            <li>Space ハードドロップ</li>
            <li>C / Shift ホールド</li>
            <li>P 一時停止</li>
          </ul>
        </Sidebar>

        <div
          className="relative rounded-2xl border border-slate-700/60 bg-slate-950/80 shadow-2xl shadow-indigo-900/40"
          style={{ width: COLS * CELL + 8, height: ROWS * CELL + 8, padding: 4 }}
        >
          <Grid display={display} />
          {(!running || paused || gameOver) && (
            <Overlay
              gameOver={gameOver}
              paused={paused}
              running={running}
              onStart={startGame}
              onResume={() => setPaused(false)}
            />
          )}
        </div>

        <Sidebar label="NEXT">
          <MiniPreview keyOf={next} />
          <div className="mt-6 space-y-4">
            <Stat label="SCORE" value={score.toLocaleString()} />
            <Stat label="LINES" value={lines.toString()} />
            <Stat label="LEVEL" value={level.toString()} />
          </div>
        </Sidebar>
      </div>

      <p className="mt-8 text-[10px] uppercase tracking-[0.4em] text-slate-600">Enter で開始 / リスタート</p>
    </div>
  );
}

function Sidebar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <aside className="w-40 rounded-2xl border border-slate-700/60 bg-slate-900/60 backdrop-blur p-4">
      <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">{label}</div>
      {children}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.3em] text-slate-500">{label}</div>
      <div className="text-2xl font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

function MiniPreview({ keyOf, dim = false }: { keyOf: TetrominoKey | null; dim?: boolean }) {
  const size = 18;
  const grid = useMemo(() => {
    if (!keyOf) return null;
    const shape = SHAPES[keyOf][0];
    const rows = shape.length;
    const cols = shape[0].length;
    return { shape, rows, cols };
  }, [keyOf]);

  return (
    <div className="h-20 flex items-center justify-center">
      {grid && keyOf ? (
        <div
          className={dim ? "opacity-40" : "opacity-100"}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${grid.cols}, ${size}px)`,
            gridTemplateRows: `repeat(${grid.rows}, ${size}px)`,
            gap: 2,
          }}
        >
          {grid.shape.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                style={{
                  width: size,
                  height: size,
                  background: v ? COLORS[keyOf].fill : "transparent",
                  border: v ? `1px solid ${COLORS[keyOf].edge}` : "none",
                  borderRadius: 3,
                  boxShadow: v ? `0 0 8px ${COLORS[keyOf].glow}` : "none",
                }}
              />
            ))
          )}
        </div>
      ) : (
        <div className="text-slate-700 text-xs">—</div>
      )}
    </div>
  );
}

function Grid({ display }: { display: DisplayCell[][] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
        gap: 1,
        background: "rgba(15,23,42,0.9)",
        borderRadius: 12,
        padding: 1,
      }}
    >
      {display.flatMap((row, r) =>
        row.map((cell, c) => {
          const key = `${r}-${c}`;
          if (cell === 0) {
            return (
              <div
                key={key}
                style={{
                  width: CELL,
                  height: CELL,
                  background: "rgba(30,41,59,0.5)",
                  borderRadius: 3,
                }}
              />
            );
          }
          if (cell === "ghost") {
            return (
              <div
                key={key}
                style={{
                  width: CELL,
                  height: CELL,
                  background: "transparent",
                  border: "1px dashed rgba(148,163,184,0.45)",
                  borderRadius: 3,
                }}
              />
            );
          }
          const palette = COLORS[cell];
          return (
            <div
              key={key}
              style={{
                width: CELL,
                height: CELL,
                background: `linear-gradient(135deg, ${palette.edge}, ${palette.fill})`,
                border: `1px solid ${palette.edge}`,
                borderRadius: 4,
                boxShadow: `inset 0 0 6px rgba(255,255,255,0.25), 0 0 10px ${palette.glow}`,
              }}
            />
          );
        })
      )}
    </div>
  );
}

function Overlay({
  gameOver,
  paused,
  running,
  onStart,
  onResume,
}: {
  gameOver: boolean;
  paused: boolean;
  running: boolean;
  onStart: () => void;
  onResume: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur rounded-2xl">
      {gameOver ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.4em] text-rose-400 mb-2">Game Over</p>
          <button
            onClick={onStart}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-900 font-bold shadow-lg shadow-cyan-500/30 active:scale-[0.98]"
          >
            もう一度プレイ
          </button>
        </>
      ) : paused ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400 mb-2">Paused</p>
          <button
            onClick={onResume}
            className="px-6 py-3 rounded-2xl bg-slate-800 text-white font-bold border border-slate-600"
          >
            再開
          </button>
        </>
      ) : !running ? (
        <>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400 mb-2">Ready</p>
          <button
            onClick={onStart}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-900 font-bold shadow-lg shadow-cyan-500/30 active:scale-[0.98]"
          >
            ゲーム開始
          </button>
        </>
      ) : null}
    </div>
  );
}
