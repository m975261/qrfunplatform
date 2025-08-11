import { type Room, type InsertRoom, type Player, type InsertPlayer, type GameMessage, type InsertGameMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Room methods
  createRoom(room: InsertRoom): Promise<Room>;
  getRoom(id: string): Promise<Room | undefined>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getAllRooms(): Promise<Room[]>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;

  // Player methods
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayersByRoom(roomId: string): Promise<Player[]>;
  updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined>;
  deletePlayer(id: string): Promise<boolean>;
  deletePlayersByRoom(roomId: string): Promise<boolean>;

  // Message methods
  createMessage(message: InsertGameMessage): Promise<GameMessage>;
  getMessagesByRoom(roomId: string, limit?: number): Promise<GameMessage[]>;
}

export class MemStorage implements IStorage {
  private rooms: Map<string, Room>;
  private players: Map<string, Player>;
  private messages: Map<string, GameMessage>;

  constructor() {
    this.rooms = new Map();
    this.players = new Map();
    this.messages = new Map();
  }

  // Room methods
  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const id = randomUUID();
    const room: Room = {
      ...insertRoom,
      id,
      createdAt: new Date(),
      status: insertRoom.status || "waiting",
      direction: insertRoom.direction || "clockwise",
      currentPlayerIndex: insertRoom.currentPlayerIndex || 0,
      maxPlayers: insertRoom.maxPlayers || 4,
      deck: insertRoom.deck || [],
      discardPile: insertRoom.discardPile || [],
      currentColor: insertRoom.currentColor || null,
      pendingDraw: insertRoom.pendingDraw || null,
      positionHands: insertRoom.positionHands || {},
      activePositions: insertRoom.activePositions || [] as number[],
    };
    this.rooms.set(id, room);
    return room;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    return Array.from(this.rooms.values()).find(room => room.code === code);
  }

  async getAllRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const room = this.rooms.get(id);
    if (!room) return undefined;

    const updatedRoom = { ...room, ...updates };
    this.rooms.set(id, updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(id: string): Promise<boolean> {
    return this.rooms.delete(id);
  }

  // Player methods
  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = randomUUID();
    const player: Player = {
      ...insertPlayer,
      id,
      joinedAt: new Date(),
      hand: insertPlayer.hand || null,
      savedHand: insertPlayer.savedHand || null,
      hasLeft: insertPlayer.hasLeft || null,
      position: insertPlayer.position ?? null,
      isSpectator: insertPlayer.isSpectator || false,
      hasCalledUno: insertPlayer.hasCalledUno || false,
      socketId: insertPlayer.socketId || null,
      leftAt: insertPlayer.leftAt || null,
      finishPosition: insertPlayer.finishPosition || null,
    };
    this.players.set(id, player);
    return player;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayersByRoom(roomId: string): Promise<Player[]> {
    return Array.from(this.players.values()).filter(player => player.roomId === roomId);
  }

  async updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined> {
    const player = this.players.get(id);
    if (!player) return undefined;

    const updatedPlayer = { ...player, ...updates };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  async deletePlayer(id: string): Promise<boolean> {
    return this.players.delete(id);
  }

  async deletePlayersByRoom(roomId: string): Promise<boolean> {
    const players = Array.from(this.players.values()).filter(player => player.roomId === roomId);
    players.forEach(player => this.players.delete(player.id));
    return true;
  }

  // Message methods
  async createMessage(insertMessage: InsertGameMessage): Promise<GameMessage> {
    const id = randomUUID();
    const message: GameMessage = {
      ...insertMessage,
      id,
      createdAt: new Date(),
      playerId: insertMessage.playerId || null,
      message: insertMessage.message || null,
      emoji: insertMessage.emoji || null,
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessagesByRoom(roomId: string, limit = 50): Promise<GameMessage[]> {
    return Array.from(this.messages.values())
      .filter(message => message.roomId === roomId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0))
      .slice(-limit);
  }
}

export const storage = new MemStorage();
