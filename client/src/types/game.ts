import { Card } from "@shared/schema";

export interface GameState {
  room: any;
  players: any[];
  messages: any[];
  currentPlayer?: any;
  timer: number;
  isMyTurn: boolean;
}

export interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  playerId: string;
}

export type GameScreen = "lobby" | "roomLobby" | "game";
