import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "nanoid";

const generateId = () => nanoid();

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(generateId),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey().$defaultFn(generateId),
  code: text("code").notNull().unique(),
  hostId: text("host_id"),
  gameType: text("game_type", { enum: ["uno", "xo"] }).notNull().default("uno"),
  status: text("status", { enum: ["waiting", "playing", "finished", "paused"] }).notNull().default("waiting"),
  isStreamingMode: integer("is_streaming_mode", { mode: "boolean" }).default(false),
  isViewerMode: integer("is_viewer_mode", { mode: "boolean" }).default(false),
  streamPageConnectionId: text("stream_page_connection_id"),
  maxPlayers: integer("max_players").notNull().default(4),
  currentPlayerIndex: integer("current_player_index").default(0),
  direction: text("direction", { enum: ["clockwise", "counterclockwise"] }).default("clockwise"),
  currentColor: text("current_color", { enum: ["red", "blue", "green", "yellow"] }),
  deck: text("deck", { mode: "json" }).$type<any[]>().default([]),
  discardPile: text("discard_pile", { mode: "json" }).$type<any[]>().default([]),
  pendingDraw: integer("pending_draw").default(0),
  positionHands: text("position_hands", { mode: "json" }).$type<{[key: string]: any[]}>().default({}),
  activePositions: text("active_positions", { mode: "json" }).$type<number[]>().default([]),
  hostElectionActive: integer("host_election_active", { mode: "boolean" }).default(false),
  hostElectionStartTime: integer("host_election_start_time", { mode: "timestamp" }),
  hostElectionVotes: text("host_election_votes", { mode: "json" }).$type<{[voterId: string]: string}>().default({}),
  hostElectionEligibleVoters: text("host_election_eligible_voters", { mode: "json" }).$type<string[]>().default([]),
  hostDisconnectedAt: integer("host_disconnected_at", { mode: "timestamp" }),
  hostPreviousId: text("host_previous_id"),
  hostPreviousPosition: integer("host_previous_position"),
  noHostMode: integer("no_host_mode", { mode: "boolean" }).default(false),
  xoState: text("xo_state", { mode: "json" }).$type<XOGameState | null>().default(null),
  xoSettings: text("xo_settings", { mode: "json" }).$type<XOSettings | null>().default(null),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

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

export const players = sqliteTable("players", {
  id: text("id").primaryKey().$defaultFn(generateId),
  nickname: text("nickname").notNull(),
  roomId: text("room_id").notNull(),
  hand: text("hand", { mode: "json" }).$type<any[]>().default([]),
  savedHand: text("saved_hand", { mode: "json" }).$type<any[]>().default([]),
  position: integer("position"),
  isSpectator: integer("is_spectator", { mode: "boolean" }).default(false),
  hasCalledUno: integer("has_called_uno", { mode: "boolean" }).default(false),
  socketId: text("socket_id"),
  hasLeft: integer("has_left", { mode: "boolean" }).default(false),
  finishPosition: integer("finish_position"),
  leftAt: integer("left_at", { mode: "timestamp" }),
  joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const gameMessages = sqliteTable("game_messages", {
  id: text("id").primaryKey().$defaultFn(generateId),
  roomId: text("room_id").notNull(),
  playerId: text("player_id"),
  message: text("message"),
  emoji: text("emoji"),
  type: text("type", { enum: ["chat", "emoji", "system"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const admins = sqliteTable("admins", {
  id: text("id").primaryKey().$defaultFn(generateId),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  totpSecret: text("totp_secret"),
  isInitialSetup: integer("is_initial_setup", { mode: "boolean" }).default(true),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  lastLogin: integer("last_login", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey().$defaultFn(generateId),
  adminId: text("admin_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  used: integer("used", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey().$defaultFn(generateId),
  adminId: text("admin_id").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const guruUsers = sqliteTable("guru_users", {
  id: text("id").primaryKey().$defaultFn(generateId),
  username: text("username").notNull().unique(),
  playerName: text("player_name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  gameType: text("game_type", { enum: ["uno", "xo"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdBy: text("created_by").notNull(),
  lastLogin: integer("last_login", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const gameSessions = sqliteTable("game_sessions", {
  id: text("id").primaryKey().$defaultFn(generateId),
  roomCode: text("room_code").notNull(),
  gameType: text("game_type", { enum: ["uno", "xo"] }).notNull(),
  status: text("status", { enum: ["waiting", "playing", "finished", "paused"] }).notNull(),
  playerCount: integer("player_count").default(0),
  startedAt: integer("started_at", { mode: "timestamp" }),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const cardSchema = z.object({
  type: z.enum(["number", "skip", "reverse", "draw2", "wild", "wild4"]),
  color: z.enum(["red", "blue", "green", "yellow", "wild"]).optional(),
  number: z.number().min(0).max(9).optional(),
});

export type Card = z.infer<typeof cardSchema>;

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

export const gameStateSchema = z.object({
  room: z.any(),
  players: z.array(z.any()),
  currentCard: cardSchema.optional(),
  timer: z.number().default(30),
  gameStarted: z.boolean().default(false),
});

export type GameState = z.infer<typeof gameStateSchema>;
