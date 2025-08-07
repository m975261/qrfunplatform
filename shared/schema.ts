import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 6 }).notNull().unique(),
  hostId: varchar("host_id").notNull(),
  status: varchar("status", { enum: ["waiting", "playing", "finished", "paused"] }).notNull().default("waiting"),
  maxPlayers: integer("max_players").notNull().default(4),
  currentPlayerIndex: integer("current_player_index").default(0),
  direction: varchar("direction", { enum: ["clockwise", "counterclockwise"] }).default("clockwise"),
  currentColor: varchar("current_color", { enum: ["red", "blue", "green", "yellow"] }),
  deck: jsonb("deck").$type<any[]>().default([]),
  discardPile: jsonb("discard_pile").$type<any[]>().default([]),
  pendingDraw: integer("pending_draw").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nickname: text("nickname").notNull(),
  roomId: varchar("room_id").notNull(),
  hand: jsonb("hand").$type<any[]>().default([]),
  position: integer("position"), // 0-3 for game positions
  isSpectator: boolean("is_spectator").default(false),
  hasCalledUno: boolean("has_called_uno").default(false),
  socketId: text("socket_id"),
  hasLeft: boolean("has_left").default(false),
  finishPosition: integer("finish_position"), // 1st, 2nd, 3rd, 4th place
  leftAt: timestamp("left_at"),
  joinedAt: timestamp("joined_at").default(sql`now()`),
});

export const gameMessages = pgTable("game_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  playerId: varchar("player_id"),
  message: text("message"),
  emoji: text("emoji"),
  type: varchar("type", { enum: ["chat", "emoji", "system"] }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Card schema
export const cardSchema = z.object({
  type: z.enum(["number", "skip", "reverse", "draw2", "wild", "wild4"]),
  color: z.enum(["red", "blue", "green", "yellow", "wild"]).optional(),
  number: z.number().min(0).max(9).optional(),
});

export type Card = z.infer<typeof cardSchema>;

// Insert schemas
export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  joinedAt: true,
});

export const insertGameMessageSchema = createInsertSchema(gameMessages).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;
export type InsertGameMessage = z.infer<typeof insertGameMessageSchema>;
export type GameMessage = typeof gameMessages.$inferSelect;

// Game state schema
export const gameStateSchema = z.object({
  room: z.any(),
  players: z.array(z.any()),
  currentCard: cardSchema.optional(),
  timer: z.number().default(30),
  gameStarted: z.boolean().default(false),
});

export type GameState = z.infer<typeof gameStateSchema>;
