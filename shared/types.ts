import { z } from "zod";

export type XOPlayer = "X" | "O";
export type XOCell = XOPlayer | null;

export interface XOGameState {
  board: XOCell[][];
  boardSize: number;
  winLength: number;
  currentPlayer: XOPlayer;
  winner: XOPlayer | null;
  winningLine: { row: number; col: number }[] | null;
  moveHistory: { row: number; col: number; player: XOPlayer }[];
  isDraw: boolean;
  gameNumber: number;
  xPlayerId: string | null;
  oPlayerId: string | null;
  scores: { x: number; o: number; draws: number };
}

export interface XOSettings {
  difficulty: "easy" | "medium" | "hard" | "hardest";
  isBotGame: boolean;
  botPlayer: "X" | "O" | null;
  isGuruPlayer: boolean;
  guruPlayerId: string | null;
  guruPlayerXId: string | null;
  guruPlayerOId: string | null;
}

export const cardSchema = z.object({
  type: z.enum(["number", "skip", "reverse", "draw2", "wild", "wild4"]),
  color: z.enum(["red", "blue", "green", "yellow", "wild"]).optional(),
  number: z.number().min(0).max(9).optional(),
});

export type Card = z.infer<typeof cardSchema>;

export const gameStateSchema = z.object({
  room: z.any(),
  players: z.array(z.any()),
  currentCard: cardSchema.optional(),
  timer: z.number().default(30),
  gameStarted: z.boolean().default(false),
});

export type GameState = z.infer<typeof gameStateSchema>;
