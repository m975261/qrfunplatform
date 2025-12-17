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
  hostId: varchar("host_id"),
  gameType: varchar("game_type", { enum: ["uno", "xo"] }).notNull().default("uno"),
  status: varchar("status", { enum: ["waiting", "playing", "finished", "paused"] }).notNull().default("waiting"),
  isStreamingMode: boolean("is_streaming_mode").default(false),
  isViewerMode: boolean("is_viewer_mode").default(false),
  streamPageConnectionId: text("stream_page_connection_id"),
  maxPlayers: integer("max_players").notNull().default(4),
  currentPlayerIndex: integer("current_player_index").default(0),
  direction: varchar("direction", { enum: ["clockwise", "counterclockwise"] }).default("clockwise"),
  currentColor: varchar("current_color", { enum: ["red", "blue", "green", "yellow"] }),
  deck: jsonb("deck").$type<any[]>().default([]),
  discardPile: jsonb("discard_pile").$type<any[]>().default([]),
  pendingDraw: integer("pending_draw").default(0),
  positionHands: jsonb("position_hands").$type<{[key: string]: any[]}>().default({}),
  activePositions: jsonb("active_positions").$type<number[]>().default([]),
  hostElectionActive: boolean("host_election_active").default(false),
  hostElectionStartTime: timestamp("host_election_start_time"),
  hostElectionVotes: jsonb("host_election_votes").$type<{[voterId: string]: string}>().default({}),
  hostElectionEligibleVoters: jsonb("host_election_eligible_voters").$type<string[]>().default([]),
  hostDisconnectedAt: timestamp("host_disconnected_at"),
  hostPreviousId: varchar("host_previous_id"),
  hostPreviousPosition: integer("host_previous_position"),
  noHostMode: boolean("no_host_mode").default(false),
  xoState: jsonb("xo_state").$type<XOGameState | null>().default(null),
  xoSettings: jsonb("xo_settings").$type<XOSettings | null>().default(null),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// XO Game Types
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
}

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nickname: text("nickname").notNull(),
  roomId: varchar("room_id").notNull(),
  hand: jsonb("hand").$type<any[]>().default([]),
  savedHand: jsonb("saved_hand").$type<any[]>().default([]), // Store hand when kicked to restore on rejoin
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

// Admin schema
export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  totpSecret: text("totp_secret"), // Google Authenticator secret
  isInitialSetup: boolean("is_initial_setup").default(true),
  emailVerified: boolean("email_verified").default(false),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const adminSessions = pgTable("admin_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Guru users schema - special authenticated players created by admin
export const guruUsers = pgTable("guru_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(), // Hidden login credential
  playerName: text("player_name").notNull(), // Visible game name
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  gameType: varchar("game_type", { enum: ["uno", "xo"] }).notNull(),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").notNull(), // Admin ID who created this user
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Game sessions for restart functionality
export const gameSessions = pgTable("game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomCode: varchar("room_code", { length: 6 }).notNull(),
  gameType: varchar("game_type", { enum: ["uno", "xo"] }).notNull(),
  status: varchar("status", { enum: ["waiting", "playing", "finished", "paused"] }).notNull(),
  playerCount: integer("player_count").default(0),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
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

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertAdminSessionSchema = createInsertSchema(adminSessions).omit({
  id: true,
  createdAt: true,
});

export const insertGuruUserSchema = createInsertSchema(guruUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
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
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertGuruUser = z.infer<typeof insertGuruUserSchema>;
export type GuruUser = typeof guruUsers.$inferSelect;
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

// Game state schema
export const gameStateSchema = z.object({
  room: z.any(),
  players: z.array(z.any()),
  currentCard: cardSchema.optional(),
  timer: z.number().default(30),
  gameStarted: z.boolean().default(false),
});

export type GameState = z.infer<typeof gameStateSchema>;
