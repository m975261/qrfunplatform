import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { UnoGameLogic } from "./gameLogic";
import { z } from "zod";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { Card, guruUsers, gameSessions } from "@shared/schema";
import { adminAuthService } from "./adminAuth";
import { db } from "./db";
import { eq, and, or, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateImage, generateGameAssets, checkApiStatus } from "./leonardo";

interface SocketConnection {
  ws: WebSocket;
  playerId?: string | null;
  roomId?: string;
  lastSeen?: number;
  tabVisible?: boolean;
  lastActivity?: number;
  userFingerprint?: string;
  sessionId?: string;
}

const connections = new Map<string, SocketConnection>();

export async function registerRoutes(app: Express): Promise<Server> {
  const JWT_SECRET = process.env.JWT_SECRET || "uno-game-secret";
  
  // Initialize default admin on server start
  await adminAuthService.initializeDefaultAdmin();

  // Admin authentication middleware
  const requireAdminAuth = async (req: any, res: any, next: any) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const session = await adminAuthService.validateSession(token);
      if (!session.success) {
        return res.status(401).json({ error: 'Invalid session' });
      }
      
      req.adminUser = session.admin;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  };
  
  // Admin authentication routes
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }).parse(req.body);

      const result = await adminAuthService.validateInitialLogin(username, password);
      
      if (!result.success) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({
        success: true,
        admin: result.admin,
        requiresSetup: result.requiresSetup
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/setup", async (req, res) => {
    try {
      const { adminId, email, newPassword } = z.object({
        adminId: z.string().min(1),
        email: z.string().email(),
        newPassword: z.string().min(8),
      }).parse(req.body);

      const result = await adminAuthService.setupAdminEmail(adminId, email, newPassword);
      
      if (!result.success) {
        return res.status(400).json({ error: "Setup failed" });
      }

      res.json({
        success: true,
        qrCode: result.qrCode,
        totpSecret: result.totpSecret
      });
    } catch (error) {
      console.error("Admin setup error:", error);
      res.status(500).json({ error: "Setup failed" });
    }
  });

  app.post("/api/admin/verify-2fa", async (req, res) => {
    try {
      const { username, password, totpCode } = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        totpCode: z.string().length(6),
      }).parse(req.body);

      const result = await adminAuthService.validateLogin(username, password, totpCode);
      
      if (!result.success) {
        return res.status(401).json({ error: "Invalid credentials or 2FA code" });
      }

      res.json({
        success: true,
        admin: result.admin,
        sessionToken: result.sessionToken
      });
    } catch (error) {
      console.error("Admin 2FA verification error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.post("/api/admin/reset-request", async (req, res) => {
    try {
      const { email } = z.object({
        email: z.string().email(),
      }).parse(req.body);

      const result = await adminAuthService.generatePasswordResetToken(email);
      
      res.json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      console.error("Admin reset request error:", error);
      res.status(500).json({ error: "Reset request failed" });
    }
  });

  app.post("/api/admin/reset-confirm", async (req, res) => {
    try {
      const { token, newPassword, totpCode } = z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8),
        totpCode: z.string().length(6),
      }).parse(req.body);

      const result = await adminAuthService.validatePasswordReset(token, newPassword, totpCode);
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error("Admin reset confirm error:", error);
      res.status(500).json({ error: "Password reset failed" });
    }
  });

  app.get("/api/admin/validate-session", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: "No session token provided" });
      }

      const result = await adminAuthService.validateSession(token);
      
      if (!result.success) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }

      res.json({
        success: true,
        admin: result.admin
      });
    } catch (error) {
      console.error("Admin session validation error:", error);
      res.status(500).json({ error: "Session validation failed" });
    }
  });

  // Admin middleware for protected routes
  async function validateAdminSession(req: any, res: any, next: any) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: "Admin authentication required" });
      }

      const result = await adminAuthService.validateSession(token);
      
      if (!result.success) {
        return res.status(401).json({ error: "Invalid admin session" });
      }

      req.adminUser = result.admin;
      next();
    } catch (error) {
      return res.status(500).json({ error: "Session validation failed" });
    }
  }

  // Get all active game sessions
  app.get("/api/admin/games", validateAdminSession, async (req, res) => {
    try {
      // Get active rooms from storage
      const allRooms = await storage.getAllRooms();
      const activeGames = allRooms.map(room => ({
        roomCode: room.code,
        roomId: room.id,
        status: room.status,
        playerCount: 0, // Will be populated by player count
        gameType: 'uno', // Currently only UNO supported
        createdAt: room.createdAt
      }));

      // Get player counts for each room
      for (const game of activeGames) {
        const players = await storage.getPlayersByRoom(game.roomId);
        game.playerCount = players.filter(p => !p.isSpectator && !p.hasLeft).length;
      }

      res.json({ games: activeGames });
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  // Restart a specific game
  app.post("/api/admin/games/:roomCode/restart", validateAdminSession, async (req, res) => {
    try {
      const { roomCode } = req.params;
      
      // Find the room by code
      const room = await storage.getRoomByCode(roomCode.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Game not found" });
      }

      // Reset room to waiting status and clear game state
      await storage.updateRoom(room.id, {
        status: "waiting",
        deck: [],
        discardPile: [],
        currentPlayerIndex: 0,
        currentColor: null,
        pendingDraw: 0,
        positionHands: {},
        activePositions: []
      });

      // Get all players and convert them to spectators, except keep host at position 0
      const players = await storage.getPlayersByRoom(room.id);
      
      for (const player of players) {
        if (player.id === room.hostId) {
          // Host stays at position 0 as a player
          await storage.updatePlayer(player.id, {
            isSpectator: false,
            position: 0,
            hand: [],
            hasCalledUno: false,
            finishPosition: null,
            hasLeft: false,
            leftAt: null
          });
        } else {
          // All other players become spectators
          await storage.updatePlayer(player.id, {
            isSpectator: true,
            position: null,
            hand: [],
            hasCalledUno: false,
            finishPosition: null,
            hasLeft: false,
            leftAt: null
          });
        }
      }

      // Broadcast room state to all connected players
      await broadcastRoomState(room.id);

      res.json({ success: true, message: "Game restarted successfully" });
    } catch (error) {
      console.error("Error restarting game:", error);
      res.status(500).json({ error: "Failed to restart game" });
    }
  });

  // Get all guru users endpoint for admin dashboard
  app.get("/api/admin/guru-users", requireAdminAuth, async (req, res) => {
    try {
      console.log("Admin fetching all guru users...");
      const allGuruUsers = await db.select({
        id: guruUsers.id,
        playerName: guruUsers.playerName,
        username: guruUsers.username,
        email: guruUsers.email,
        gameType: guruUsers.gameType,
        isActive: guruUsers.isActive,
        lastLogin: guruUsers.lastLogin,
        createdAt: guruUsers.createdAt
      }).from(guruUsers);
      
      console.log("Found guru users:", allGuruUsers.length);
      res.json(allGuruUsers);
    } catch (error) {
      console.error("Error fetching guru users:", error);
      res.status(500).json({ error: "Failed to fetch guru users" });
    }
  });

  // Get guru users for a specific game
  app.get("/api/admin/guru-users/:gameType", validateAdminSession, async (req, res) => {
    try {
      const { gameType } = req.params;
      
      if (!['uno', 'xo'].includes(gameType)) {
        return res.status(400).json({ error: "Invalid game type" });
      }

      const guruUsersList = await db.select({
        id: guruUsers.id,
        playerName: guruUsers.playerName,
        email: guruUsers.email,
        gameType: guruUsers.gameType,
        isActive: guruUsers.isActive,
        lastLogin: guruUsers.lastLogin,
        createdAt: guruUsers.createdAt
      })
      .from(guruUsers)
      .where(eq(guruUsers.gameType, gameType as "uno" | "xo"));

      res.json({ guruUsers: guruUsersList });
    } catch (error) {
      console.error("Error fetching guru users:", error);
      res.status(500).json({ error: "Failed to fetch guru users" });
    }
  });

  // Create new guru user
  app.post("/api/admin/guru-users", requireAdminAuth, async (req, res) => {
    try {
      const { username, playerName, email, password, gameType } = z.object({
        username: z.string().min(3).max(20),
        playerName: z.string().min(1).max(20),
        email: z.string().email(),
        password: z.string().min(6),
        gameType: z.enum(["uno", "xo"])
      }).parse(req.body);

      // Check if username already exists
      const existingUser = await db.select()
        .from(guruUsers)
        .where(eq(guruUsers.username, username))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create guru user
      const [newGuruUser] = await db.insert(guruUsers).values({
        username,
        playerName,
        email,
        passwordHash,
        gameType,
        createdBy: req.adminUser.id,
        isActive: true
      }).returning({
        id: guruUsers.id,
        playerName: guruUsers.playerName,
        email: guruUsers.email,
        gameType: guruUsers.gameType,
        isActive: guruUsers.isActive,
        createdAt: guruUsers.createdAt
      });

      res.json({ success: true, guruUser: newGuruUser });
    } catch (error) {
      console.error("Error creating guru user:", error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Failed to create guru user" });
      }
    }
  });

  // Toggle guru user active status  
  app.post("/api/admin/guru-users/:id/toggle", requireAdminAuth, async (req, res) => {
    try {
      const { id: userId } = req.params;

      // Get current user
      const [currentUser] = await db.select()
        .from(guruUsers)
        .where(eq(guruUsers.id, userId))
        .limit(1);

      if (!currentUser) {
        return res.status(404).json({ error: "Guru user not found" });
      }

      // Toggle active status
      const [updatedUser] = await db.update(guruUsers)
        .set({ 
          isActive: !currentUser.isActive,
          updatedAt: new Date()
        })
        .where(eq(guruUsers.id, userId))
        .returning({
          id: guruUsers.id,
          playerName: guruUsers.playerName,
          email: guruUsers.email,
          gameType: guruUsers.gameType,
          isActive: guruUsers.isActive,
          lastLogin: guruUsers.lastLogin,
          createdAt: guruUsers.createdAt
        });

      res.json({ success: true, guruUser: updatedUser });
    } catch (error) {
      console.error("Error toggling guru user:", error);
      res.status(500).json({ error: "Failed to update guru user" });
    }
  });

  // Guru user login validation endpoint
  app.post("/api/guru-login", async (req, res) => {
    try {
      const { playerName, password } = z.object({
        playerName: z.string().min(1),
        password: z.string().min(1)
      }).parse(req.body);

      // Check if playerName exists as a guru user (check ONLY by username, trim spaces)
      const trimmedPlayerName = playerName.trim();
      const [guruUser] = await db.select()
        .from(guruUsers)
        .where(and(
          eq(guruUsers.username, trimmedPlayerName),
          eq(guruUsers.isActive, true)
        ))
        .limit(1);

      if (!guruUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // If password is "check", just return that user exists (for checking purposes)
      if (password === "check") {
        return res.status(200).json({ error: "Password required", userExists: true, requiresPassword: true });
      }

      // Validate password
      const isValidPassword = await bcrypt.compare(password, guruUser.passwordHash);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Update last login
      await db.update(guruUsers)
        .set({ lastLogin: new Date() })
        .where(eq(guruUsers.id, guruUser.id));

      res.json({
        success: true,
        guruUser: {
          id: guruUser.id,
          playerName: guruUser.playerName,
          gameType: guruUser.gameType,
          isGuru: true
        }
      });
    } catch (error) {
      console.error("Error in guru login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Game status endpoint for admin
  app.get("/api/admin/game-status", requireAdminAuth, async (req, res) => {
    try {
      const gameStatuses = [
        {
          name: "UNO",
          type: "uno",
          status: "up", // TODO: Implement actual status checking
          activeRooms: (await storage.getAllRooms()).filter(room => room.gameType === 'uno').length,
          activePlayers: (await storage.getAllRooms())
            .filter(room => room.gameType === 'uno')
            .reduce((total, room) => total + room.players.length, 0)
        },
        {
          name: "XO (Tic Tac Toe)",
          type: "xo", 
          status: "maintenance", // XO is not implemented yet
          activeRooms: 0,
          activePlayers: 0
        }
      ];
      
      res.json(gameStatuses);
    } catch (error) {
      console.error("Error fetching game status:", error);
      res.status(500).json({ error: "Failed to fetch game status" });
    }
  });

  // Restart specific game endpoint
  app.post("/api/admin/restart-game/:gameType", requireAdminAuth, async (req, res) => {
    try {
      const { gameType } = req.params;
      
      // Get all rooms for this game type and restart them
      const rooms = (await storage.getAllRooms()).filter(room => room.gameType === gameType);
      
      for (const room of rooms) {
        // Reset room to waiting state
        room.status = "waiting";
        room.currentPlayerIndex = 0;
        // Clear game state but keep players
        if (room.gameState) {
          delete room.gameState;
        }
      }
      
      res.json({ success: true, message: `${gameType.toUpperCase()} game restarted`, restartedRooms: rooms.length });
    } catch (error) {
      console.error("Error restarting game:", error);
      res.status(500).json({ error: "Failed to restart game" });
    }
  });

  // Toggle maintenance mode endpoint
  app.post("/api/admin/game-maintenance/:gameType", requireAdminAuth, async (req, res) => {
    try {
      const { gameType } = req.params;
      const { status } = req.body;
      
      // TODO: Implement actual maintenance mode storage
      // For now, just acknowledge the request
      res.json({ success: true, gameType, status });
    } catch (error) {
      console.error("Error setting maintenance mode:", error);
      res.status(500).json({ error: "Failed to set maintenance mode" });
    }
  });

  // System health endpoint
  app.get("/api/admin/system-health", requireAdminAuth, async (req, res) => {
    try {
      const startTime = process.uptime();
      const hours = Math.floor(startTime / 3600);
      const minutes = Math.floor((startTime % 3600) / 60);
      const seconds = Math.floor(startTime % 60);
      
      const systemHealth = {
        serverUptime: `${hours}h ${minutes}m ${seconds}s`,
        databaseStatus: "connected", // TODO: Implement actual DB health check
        websocketStatus: "active", // TODO: Check WebSocket server status
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      };
      
      res.json(systemHealth);
    } catch (error) {
      console.error("Error fetching system health:", error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  // System restart endpoint
  app.post("/api/admin/system-restart", requireAdminAuth, async (req, res) => {
    try {
      res.json({ success: true, message: "System restart initiated" });
      
      // Delay the restart slightly to allow response to be sent
      setTimeout(() => {
        console.log("Admin initiated system restart");
        process.exit(0); // Replit will automatically restart the process
      }, 1000);
    } catch (error) {
      console.error("Error restarting system:", error);
      res.status(500).json({ error: "Failed to restart system" });
    }
  });

  // Update guru user endpoint
  app.put("/api/admin/guru-users/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { playerName, username, email, gameType } = z.object({
        playerName: z.string().min(1),
        username: z.string().min(1),
        email: z.string().email(),
        gameType: z.enum(['uno', 'xo'])
      }).parse(req.body);

      // Check if username is already taken by another user
      const [existingUser] = await db.select()
        .from(guruUsers)
        .where(and(
          eq(guruUsers.username, username),
          ne(guruUsers.id, id)
        ))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const [updatedUser] = await db.update(guruUsers)
        .set({
          playerName,
          username,
          email,
          gameType,
          updatedAt: new Date()
        })
        .where(eq(guruUsers.id, id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "Guru user not found" });
      }

      res.json({
        success: true,
        guruUser: {
          id: updatedUser.id,
          playerName: updatedUser.playerName,
          username: updatedUser.username,
          email: updatedUser.email,
          gameType: updatedUser.gameType,
          isActive: updatedUser.isActive,
          lastLogin: updatedUser.lastLogin,
          createdAt: updatedUser.createdAt
        }
      });
    } catch (error) {
      console.error("Error updating guru user:", error);
      res.status(500).json({ error: "Failed to update guru user" });
    }
  });
  
  // Create room (supports normal and streaming mode)
  app.post("/api/rooms", async (req, res) => {
    try {
      const { hostNickname, isStreamingMode } = z.object({
        hostNickname: z.string().min(1).max(20).optional(),
        isStreamingMode: z.boolean().optional().default(false)
      }).parse(req.body);

      const code = UnoGameLogic.generateRoomCode();
      
      // Create the room first
      const room = await storage.createRoom({
        code,
        hostId: "", // Will be set when first player joins (streaming mode) or host joins (normal mode)
        status: "waiting",
        isStreamingMode: isStreamingMode
      });

      // STREAMING MODE: Create empty lobby - no host player needed (first joiner becomes host)
      if (isStreamingMode) {
        // Generate QR code for streaming mode room
        let domain;
        let roomLink;
        
        if (process.env.REPL_SLUG && process.env.REPLIT_DEPLOYMENT_ID) {
          domain = `${process.env.REPL_SLUG}.replit.app`;
        } else if (process.env.REPLIT_DOMAINS) {
          domain = process.env.REPLIT_DOMAINS.split(',')[0].replace(/^https?:\/\//, '');
        } else {
          domain = req.get('host') || 'localhost:5000';
        }
        
        roomLink = `https://${domain}?room=${code}`;
        roomLink = roomLink.replace(/([^:]\/)\/+/g, "$1");
        
        const qrCode = await QRCode.toDataURL(roomLink, {
          errorCorrectionLevel: 'M',
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        
        // Streaming mode: No host created - first joiner becomes host automatically
        console.log(`[STREAMING MODE] Room ${code} created - empty lobby waiting for first joiner to become host`);
        
        return res.json({ 
          room, 
          qrCode,
          isStreamingMode: true,
          streamLobbyUrl: `/stream/${room.id}/lobby?code=${code}`
        });
      }
      
      // NORMAL MODE: Require hostNickname
      if (!hostNickname) {
        return res.status(400).json({ error: "Host nickname is required for normal mode" });
      }

      // NORMAL MODE: Create the host player immediately (existing behavior)
      const hostPlayer = await storage.createPlayer({
        nickname: hostNickname,
        roomId: room.id,
        isSpectator: false,
        position: 0
      });

      // Update room with host ID
      const updatedRoom = await storage.updateRoom(room.id, { hostId: hostPlayer.id });

      // Generate QR code with room link - iOS-friendly format
      // Always force HTTPS protocol for QR codes to ensure iOS recognition
      let domain;
      let roomLink;
      
      // iOS Camera app URL recognition - Force HTTPS
      if (process.env.REPL_SLUG && process.env.REPLIT_DEPLOYMENT_ID) {
        domain = `${process.env.REPL_SLUG}.replit.app`;
      } else if (process.env.REPLIT_DOMAINS) {
        domain = process.env.REPLIT_DOMAINS.split(',')[0].replace(/^https?:\/\//, '');
      } else {
        domain = req.get('host') || 'localhost:5000';
      }
      
      // Create URL with HTTPS for iOS recognition
      roomLink = `https://${domain}?room=${code}`;
      
      // Clean up any double slashes or malformed URLs
      roomLink = roomLink.replace(/([^:]\/)\/+/g, "$1");
      
      console.log('Generated QR code URL:', roomLink);
      console.log('QR code URL length:', roomLink.length);
      console.log('Environment - REPL_SLUG:', process.env.REPL_SLUG, 'DEPLOYMENT_ID:', process.env.REPLIT_DEPLOYMENT_ID);
      
      // Generate QR code with additional options for better iOS recognition
      const qrCode = await QRCode.toDataURL(roomLink, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.json({ room: updatedRoom, qrCode, player: hostPlayer, hostNickname });
    } catch (error) {
      console.error("Room creation error:", error);
      res.status(400).json({ error: "Failed to create room", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Stream mode join - explicitly for streaming rooms
  app.post("/api/stream/join", async (req, res) => {
    try {
      const { roomId, nickname } = z.object({
        roomId: z.string().min(1),
        nickname: z.string().min(2).max(20)
      }).parse(req.body);

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (!room.isStreamingMode) {
        return res.status(400).json({ error: "This is not a streaming room" });
      }

      const existingPlayers = await storage.getPlayersByRoom(room.id);
      
      // Check for duplicate nickname (case-insensitive, exclude players who have left)
      const duplicateNickname = existingPlayers.find(p => 
        p.nickname.toLowerCase() === nickname.toLowerCase() && !p.hasLeft
      );
      
      if (duplicateNickname) {
        return res.status(409).json({ 
          error: "Nickname already taken",
          message: "This nickname is already in use. Please choose a different one."
        });
      }
      
      const hasHost = room.hostId && room.hostId.length > 0;
      
      let isHost = false;
      let playerPosition = null;
      let isSpectator = true;
      
      // First joiner becomes host at position 0
      if (!hasHost && existingPlayers.length === 0) {
        isHost = true;
        isSpectator = false;
        playerPosition = 0;
        console.log(`[STREAM JOIN] ${nickname} is the FIRST joiner - becomes HOST at position 0`);
      } else {
        // All other joiners are spectators
        isSpectator = true;
        playerPosition = null;
        console.log(`[STREAM JOIN] ${nickname} joining as SPECTATOR (room already has host)`);
      }

      // Create the player
      const player = await storage.createPlayer({
        nickname,
        roomId: room.id,
        isSpectator,
        position: playerPosition
      });

      // If this is the first joiner, set them as host
      if (isHost) {
        await storage.updateRoom(room.id, { hostId: player.id });
        console.log(`[STREAM JOIN] Room ${room.code} now has host: ${player.id}`);
      }

      res.json({
        playerId: player.id,
        isHost,
        isSpectator,
        position: playerPosition,
        room: {
          id: room.id,
          code: room.code
        }
      });
    } catch (error) {
      console.error("Stream join error:", error);
      res.status(400).json({ error: "Failed to join streaming room" });
    }
  });

  // Lookup room by code (for universal join feature)
  app.get("/api/rooms/code/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json({ room });
    } catch (error) {
      console.error("Room lookup error:", error);
      res.status(400).json({ error: "Failed to lookup room" });
    }
  });

  // Join room by code
  app.post("/api/rooms/:code/join", async (req, res) => {
    try {
      const { code } = req.params;
      const { nickname } = z.object({
        nickname: z.string().min(1).max(20)
      }).parse(req.body);

      let room = await storage.getRoomByCode(code.toUpperCase());
      if (!room) {
        // If room doesn't exist, create it automatically
        console.log(`Room ${code} not found, creating new room`);
        room = await storage.createRoom({
          code: code.toUpperCase(),
          hostId: "", // Will be set when first player joins
          status: "waiting"
        });
      }

      const existingPlayers = await storage.getPlayersByRoom(room.id);
      const nonSpectatorPlayers = existingPlayers.filter(p => !p.isSpectator);

      let playerPosition = null;
      let playerHand: any[] = [];
      let isSpectator = true; // NEW SPECTATOR SYSTEM: All new joiners start as spectators

      // Track if this player becomes the streaming host
      let isStreamingHost = false;
      
      // STREAMING MODE: Only first joiner becomes host, everyone else is a spectator
      if (room.isStreamingMode) {
        if (existingPlayers.length === 0) {
          // First joiner in streaming mode becomes host at position 0
          isSpectator = false;
          playerPosition = 0;
          isStreamingHost = true;
          console.log(`[STREAMING MODE] First joiner ${nickname} becomes host at position 0`);
        } else {
          // All subsequent joiners in streaming mode are forced to be spectators
          isSpectator = true;
          playerPosition = null;
          console.log(`[STREAMING MODE] Player ${nickname} joining as spectator (streaming room)`);
        }
      }
      // NORMAL MODE: Existing behavior
      else if (existingPlayers.length === 0) {
        // First joiner becomes host at position 0
        isSpectator = false;
        playerPosition = 0;
      } else if (room.status === "playing" || room.status === "paused") {
        // For active games, new joiners always start as spectators
        // They can take positions using the take-slot endpoint if they want
        console.log(`New player ${nickname} joining active/paused game as spectator`);
        isSpectator = true;
      }

      const player = await storage.createPlayer({
        nickname,
        roomId: room.id,
        isSpectator,
        position: playerPosition,
        hand: playerHand
      });
      
      // Mark player as online after creation
      await storage.updatePlayer(player.id, { isOnline: true });

      // Set this player as host if room had no host
      if (!room.hostId || room.hostId === "") {
        await storage.updateRoom(room.id, { hostId: player.id });
        const updatedRoom = await storage.getRoom(room.id);
        if (updatedRoom) room = updatedRoom;
      }

      res.json({ player, room, isStreamingHost });
    } catch (error) {
      console.error("Join room error:", error);
      res.status(400).json({ error: "Failed to join room" });
    }
  });

  // Get room state
  app.get("/api/rooms/:roomId", async (req, res) => {
    try {
      // Try both room ID and room code lookup
      let room = await storage.getRoom(req.params.roomId);
      if (!room) {
        room = await storage.getRoomByCode(req.params.roomId);
      }
      
      if (!room) {
        console.log(`Room ${req.params.roomId} not found via HTTP GET (tried both ID and code)`);
        return res.status(404).json({ error: "Room not found" });
      }

      const players = await storage.getPlayersByRoom(room.id);
      const messages = await storage.getMessagesByRoom(room.id, 20);

      // Generate QR code for sharing - Force HTTPS for iOS compatibility
      let baseUrl;
      if (process.env.REPLIT_DOMAINS) {
        const domain = process.env.REPLIT_DOMAINS.split(',')[0];
        baseUrl = `https://${domain.replace(/^https?:\/\//, '')}`;
      } else {
        const host = req.get('host') || 'localhost:5000';
        baseUrl = `https://${host}`;
      }
      const roomLink = `${baseUrl}?room=${room.code}`;
      console.log('QR code URL (room state):', roomLink);
      const qrCode = await QRCode.toDataURL(roomLink);

      res.json({ room, players, messages, qrCode });
    } catch (error) {
      res.status(500).json({ error: "Failed to get room state" });
    }
  });

  // Update player nickname
  app.patch("/api/players/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const { nickname } = z.object({
        nickname: z.string().min(1).max(20)
      }).parse(req.body);

      const updatedPlayer = await storage.updatePlayer(playerId, { nickname });
      
      if (!updatedPlayer) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Broadcast updated room state to all players in the room
      if (updatedPlayer.roomId) {
        await broadcastRoomState(updatedPlayer.roomId);
      }
      
      res.json({ success: true, player: updatedPlayer });
    } catch (error) {
      res.status(500).json({ error: "Failed to update player nickname" });
    }
  });

  // Kick player from room (host only) - POST endpoint for frontend
  app.post("/api/rooms/:roomId/kick", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { playerIdToKick } = req.body;
      const hostId = req.headers.authorization?.replace('Bearer ', '');
      
      if (!hostId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (room.hostId !== hostId) {
        return res.status(403).json({ error: "Only the host can kick players" });
      }

      const playerToKick = await storage.getPlayer(playerIdToKick);
      if (!playerToKick || playerToKick.roomId !== roomId) {
        return res.status(404).json({ error: "Player not found in this room" });
      }

      console.log(`Converting player ${playerIdToKick} (${playerToKick.nickname}) to spectator via POST`);
      
      // Before kicking, update position hands with current cards
      if (playerToKick.position !== null && room.positionHands) {
        const updatedPositionHands = { ...room.positionHands };
        updatedPositionHands[playerToKick.position.toString()] = playerToKick.hand || [];
        await storage.updateRoom(roomId, { positionHands: updatedPositionHands });
        console.log(`Saved ${(playerToKick.hand || []).length} cards for position ${playerToKick.position}`);
      }
      
      // Convert player to spectator
      await storage.updatePlayer(playerIdToKick, {
        isSpectator: true,
        hasLeft: false, // Keep as false so they remain visible as spectator
        leftAt: null,   // Don't set left time
        position: null,
        hand: [], // Clear active hand since they're spectator
        hasCalledUno: false,
        finishPosition: null
      });
      
      // Verify the update worked
      const updatedPlayer = await storage.getPlayer(playerIdToKick);
      console.log(`Player after POST kick update:`, {
        id: updatedPlayer?.id,
        nickname: updatedPlayer?.nickname,
        isSpectator: updatedPlayer?.isSpectator,
        hasLeft: updatedPlayer?.hasLeft,
        position: updatedPlayer?.position
      });
      
      // Don't send kick message at all - just let room state update handle it
      // The player will see they became a spectator through the room state broadcast

      // Broadcast updated room state
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: "Player kicked successfully" });
    } catch (error) {
      console.error("Error in POST kick endpoint:", error);
      res.status(500).json({ error: "Failed to kick player" });
    }
  });

  // Kick player from room (host only) - DELETE endpoint (legacy)
  app.delete("/api/rooms/:roomId/players/:playerId", async (req, res) => {
    try {
      const { roomId, playerId } = req.params;
      const hostId = req.headers.authorization?.replace('Bearer ', '');
      
      if (!hostId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (room.hostId !== hostId) {
        return res.status(403).json({ error: "Only the host can kick players" });
      }

      const playerToKick = await storage.getPlayer(playerId);
      if (!playerToKick || playerToKick.roomId !== roomId) {
        return res.status(404).json({ error: "Player not found in this room" });
      }

      console.log(`Converting player ${playerId} (${playerToKick.nickname}) to spectator`);
      
      // Before kicking, update position hands with current cards
      if (playerToKick.position !== null && room.positionHands) {
        const updatedPositionHands = { ...room.positionHands };
        updatedPositionHands[playerToKick.position.toString()] = playerToKick.hand || [];
        await storage.updateRoom(roomId, { positionHands: updatedPositionHands });
        console.log(`Saved ${(playerToKick.hand || []).length} cards for position ${playerToKick.position}`);
      }
      
      // Convert player to spectator
      await storage.updatePlayer(playerId, {
        isSpectator: true,
        hasLeft: false, // Keep as false so they remain visible as spectator
        leftAt: null,   // Don't set left time
        position: null,
        hand: [], // Clear active hand since they're spectator
        hasCalledUno: false,
        finishPosition: null
      });
      
      // Verify the update worked
      const updatedPlayer = await storage.getPlayer(playerId);
      console.log(`Player after kick update:`, {
        id: updatedPlayer?.id,
        nickname: updatedPlayer?.nickname,
        isSpectator: updatedPlayer?.isSpectator,
        hasLeft: updatedPlayer?.hasLeft,
        position: updatedPlayer?.position
      });
      
      // Send kick message but don't close connection - let them stay as spectator
      connections.forEach((connection, connId) => {
        if (connection.playerId === playerId && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(JSON.stringify({
            type: 'kicked',
            message: 'You have been removed from the room'
          }));
          // Don't close connection - let them stay as spectator
        }
      });

      // Broadcast updated room state
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: "Player kicked successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to kick player" });
    }
  });

  // Take player slot (for spectators to join as players)
  app.post("/api/rooms/:roomId/take-slot", async (req, res) => {
    try {
      const { roomId } = req.params;
      const { position } = z.object({
        position: z.number().min(0).max(3)
      }).parse(req.body);
      const playerId = req.headers.authorization?.replace('Bearer ', '');
      
      if (!playerId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const player = await storage.getPlayer(playerId);
      if (!player || player.roomId !== roomId) {
        return res.status(404).json({ error: "Player not found in this room" });
      }

      // Check if player is already in a position (and not a kicked/left spectator)
      if (player.position !== null && !player.isSpectator && !player.hasLeft) {
        return res.status(400).json({ error: "Player already has a position" });
      }

      // Check if the position is available
      const roomPlayers = await storage.getPlayersByRoom(roomId);
      const positionTaken = roomPlayers.some(p => p.position === position && !p.isSpectator && !p.hasLeft);
      
      if (positionTaken) {
        return res.status(400).json({ error: "Position already taken" });
      }

      // CRITICAL FIX: Check for duplicate nicknames and clean them up
      const duplicatePlayer = roomPlayers.find(p => 
        p.nickname.toLowerCase() === player.nickname.toLowerCase() && 
        p.id !== player.id && 
        p.isSpectator
      );
      
      if (duplicatePlayer) {
        console.log(`Removing duplicate player entry: ${duplicatePlayer.id} (${duplicatePlayer.nickname})`);
        await storage.deletePlayer(duplicatePlayer.id);
      }

      // Get cards for this position - either from positionHands or deal new ones
      let newHand: Card[] = [];
      if (room.positionHands && room.positionHands[position.toString()]) {
        // Use cards assigned to this position when game started or when last player left
        newHand = room.positionHands[position.toString()];
        console.log(`🃏 RESTORING CARDS: Player ${player.nickname} taking position ${position} gets ${newHand.length} saved cards`);
      } else if (room.status === "playing" && room.deck && room.deck.length > 0) {
        // Deal 7 cards for new position in active game
        const cardsNeeded = Math.min(7, room.deck.length);
        newHand = room.deck.slice(0, cardsNeeded);
        const updatedDeck = room.deck.slice(cardsNeeded);
        
        // Update room deck and save cards for this position
        const updatedPositionHands = { ...room.positionHands, [position.toString()]: newHand };
        await storage.updateRoom(roomId, { 
          deck: updatedDeck,
          positionHands: updatedPositionHands
        });
        
        console.log(`🃏 CARD DEALING: Player ${player.nickname} joining position ${position}`);
        console.log(`🃏 Deck size before: ${room.deck.length}, Cards needed: ${cardsNeeded}, Cards dealt: ${newHand.length}`);
        console.log(`🃏 Deck size after: ${updatedDeck.length}`);
        console.log(`🃏 Player hand now: ${newHand.length} cards`);
      } else {
        console.log(`🃏 NO CARDS DEALT: Player ${player.nickname} joining position ${position}`);
        console.log(`🃏 Room status: ${room.status}, Deck exists: ${!!room.deck}, Deck length: ${room.deck?.length || 0}`);
        console.log(`🃏 Position hands exist: ${!!room.positionHands}, Has position cards: ${!!(room.positionHands && room.positionHands[position.toString()])}`);
      }

      // Update player to take the position with position-specific cards
      await storage.updatePlayer(playerId, {
        position,
        isSpectator: false,
        hasLeft: false,
        leftAt: null,
        hand: newHand, // Use position-specific cards
        hasCalledUno: false,
        finishPosition: null
      });
      
      console.log(`🎮 FINAL: Player ${player.nickname} assigned to position ${position} with ${newHand.length} cards`);

      // Broadcast updated room state
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: "Player slot taken successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to take player slot" });
    }
  });

  // WebSocket endpoint - must be before any catch-all routes  
  app.get("/ws", (req, res) => {
    if (req.headers.upgrade?.toLowerCase() === 'websocket') {
      res.status(426).send('Upgrade Required');
    } else {
      res.status(200).send('WebSocket endpoint - use WebSocket client to connect');
    }
  });

  // Game end data retrieval for disconnected players (P3 winner modal fix)
  app.get("/api/rooms/:roomId/game-end-data", async (req, res) => {
    try {
      const { roomId } = req.params;
      const playerId = req.headers.authorization?.replace('Bearer ', '');
      
      if (!playerId) {
        return res.status(401).json({ error: 'Player ID required' });
      }
      
      const room = await storage.getRoom(roomId);
      if (!room || room.status !== 'finished') {
        return res.status(404).json({ error: 'Game not finished or room not found' });
      }
      
      // Return game end data if available
      if (room.winner && room.rankings) {
        console.log(`🏆 Retrieved game end data for player ${playerId} in room ${roomId}`);
        res.json({
          winner: room.winner,
          rankings: room.rankings,
          timestamp: Date.now()
        });
      } else {
        res.status(404).json({ error: 'Game end data not available' });
      }
    } catch (error) {
      console.error("Error retrieving game end data:", error);
      res.status(500).json({ error: 'Failed to retrieve game end data' });
    }
  });

  // Guru card replacement endpoint
  app.post("/api/rooms/:roomId/guru-replace-card", async (req, res) => {
    try {
      const { roomId } = req.params;
      const playerId = req.headers.authorization?.replace('Bearer ', '');
      const { cardIndex, newCard } = z.object({
        cardIndex: z.number().min(0),
        newCard: z.object({
          type: z.string(),
          color: z.string(),
          number: z.number().optional()
        })
      }).parse(req.body);
      
      if (!playerId) {
        return res.status(401).json({ error: 'Player ID required' });
      }
      
      const player = await storage.getPlayer(playerId);
      if (!player || player.roomId !== roomId) {
        return res.status(403).json({ error: 'Not authorized for this room' });
      }
      
      // Verify player is guru user (this should be validated on login)
      // For now, we trust the client-side guru flag but this should be enhanced
      console.log(`🧙‍♂️ Guru ${player.nickname} replacing card ${cardIndex} in room ${roomId}`);
      
      // Replace the card in player's hand
      const currentPlayer = await storage.getPlayer(playerId);
      if (!currentPlayer || !currentPlayer.hand || cardIndex >= currentPlayer.hand.length) {
        return res.status(400).json({ error: 'Invalid card index' });
      }
      
      // Update the specific card in the hand array
      const updatedHand = [...currentPlayer.hand];
      updatedHand[cardIndex] = newCard;
      
      const updatedPlayer = await storage.updatePlayer(playerId, {
        hand: updatedHand
      });
      
      // Broadcast the update to room
      broadcastToRoom(roomId, {
        type: 'card_replaced',
        playerId,
        cardIndex,
        message: `${player.nickname} replaced a card`
      });
      
      res.json({ success: true, message: 'Card replaced successfully' });
    } catch (error) {
      console.error("Error replacing card:", error);
      res.status(500).json({ error: 'Failed to replace card' });
    }
  });

  // Guru Wild Draw 4 response - allows guru to instantly play +4 when facing a pending draw
  app.post("/api/rooms/:roomId/guru-wild4-response", async (req, res) => {
    try {
      const { roomId } = req.params;
      const playerId = req.headers.authorization?.replace('Bearer ', '');
      const { color } = z.object({
        color: z.enum(['red', 'blue', 'green', 'yellow'])
      }).parse(req.body);
      
      if (!playerId) {
        return res.status(401).json({ error: 'Player ID required' });
      }
      
      const room = await storage.getRoom(roomId);
      if (!room || room.status !== 'playing') {
        return res.status(400).json({ error: 'Game not in progress' });
      }
      
      const player = await storage.getPlayer(playerId);
      if (!player || player.roomId !== roomId) {
        return res.status(403).json({ error: 'Not authorized for this room' });
      }
      
      // Verify there's a pending draw targeting this player
      const players = await storage.getPlayersByRoom(roomId);
      const gamePlayers = players.filter(p => !p.isSpectator).sort((a, b) => (a.position || 0) - (b.position || 0));
      const currentPlayerIndex = room.currentPlayerIndex || 0;
      const currentPlayer = gamePlayers[currentPlayerIndex];
      
      if (!currentPlayer || currentPlayer.id !== playerId) {
        return res.status(400).json({ error: 'Not your turn' });
      }
      
      if (!room.pendingDraw || room.pendingDraw === 0) {
        return res.status(400).json({ error: 'No pending draw to respond to' });
      }
      
      console.log(`🧙‍♂️ GURU WILD4: ${player.nickname} using guru privilege to play Wild Draw 4 response (stacking ${room.pendingDraw + 4} cards)`);
      
      // Create a Wild Draw 4 card
      const wild4Card: Card = {
        type: 'wild4',
        color: 'wild'
      };
      
      // Add the card to discard pile
      const newDiscardPile = [wild4Card, ...(room.discardPile || [])];
      
      // Stack the penalty: existing pending + 4 more
      const newPendingDraw = (room.pendingDraw || 0) + 4;
      
      // Get finished player indices for turn calculation
      const finishedPlayerIndices = gamePlayers
        .map((p, idx) => ({ player: p, index: idx }))
        .filter(item => item.player.finishPosition)
        .map(item => item.index);
      
      // Move to next player (they now have the stacked penalty)
      const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        room.direction || "clockwise",
        false, // Don't skip - next player gets the penalty
        false,
        finishedPlayerIndices
      );
      
      // Update room state
      await storage.updateRoom(roomId, {
        discardPile: newDiscardPile,
        currentColor: color,
        pendingDraw: newPendingDraw,
        currentPlayerIndex: nextPlayerIndex
      });
      
      // Broadcast the guru Wild Draw 4 response
      broadcastToRoom(roomId, {
        type: 'guru_wild4_response',
        player: player.nickname,
        color: color,
        newPendingDraw: newPendingDraw,
        message: `${player.nickname} used GURU POWER to play Wild Draw 4! (Total penalty: ${newPendingDraw} cards)`
      });
      
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: 'Guru Wild Draw 4 played successfully', newPendingDraw });
      // No auto-apply penalty - next player must explicitly choose to draw or play +4
    } catch (error) {
      console.error("Error with guru Wild4 response:", error);
      res.status(500).json({ error: 'Failed to play guru Wild Draw 4' });
    }
  });

  // Guru +2 card - guru can play +2 with any color by sacrificing a card
  app.post("/api/rooms/:roomId/guru-plus2", async (req, res) => {
    try {
      const { roomId } = req.params;
      const playerId = req.headers.authorization?.replace('Bearer ', '');
      const { color, sacrificeCardIndex } = z.object({
        color: z.enum(['red', 'blue', 'green', 'yellow']),
        sacrificeCardIndex: z.number().min(0)
      }).parse(req.body);
      
      if (!playerId) {
        return res.status(401).json({ error: 'Player ID required' });
      }
      
      const room = await storage.getRoom(roomId);
      if (!room || room.status !== 'playing') {
        return res.status(400).json({ error: 'Game not in progress' });
      }
      
      const player = await storage.getPlayer(playerId);
      if (!player || player.roomId !== roomId) {
        return res.status(403).json({ error: 'Not authorized for this room' });
      }
      
      // Verify it's this player's turn
      const players = await storage.getPlayersByRoom(roomId);
      const gamePlayers = players.filter(p => !p.isSpectator).sort((a, b) => (a.position || 0) - (b.position || 0));
      const currentPlayerIndex = room.currentPlayerIndex || 0;
      const currentPlayer = gamePlayers[currentPlayerIndex];
      
      if (!currentPlayer || currentPlayer.id !== playerId) {
        return res.status(400).json({ error: 'Not your turn' });
      }
      
      // Verify player has a card to sacrifice
      const hand = player.hand || [];
      if (sacrificeCardIndex < 0 || sacrificeCardIndex >= hand.length) {
        return res.status(400).json({ error: 'Invalid card index' });
      }
      
      console.log(`🧙‍♂️ GURU +2: ${player.nickname} using guru privilege to play +2 (color: ${color}, sacrificing card at index ${sacrificeCardIndex})`);
      
      // Create a +2 card with chosen color
      const plus2Card: Card = {
        type: 'draw2',
        color: color
      };
      
      // Remove the sacrificed card from hand
      const newHand = [...hand];
      newHand.splice(sacrificeCardIndex, 1);
      
      // Add the +2 card to discard pile
      const newDiscardPile = [plus2Card, ...(room.discardPile || [])];
      
      // Stack the penalty
      const newPendingDraw = (room.pendingDraw || 0) + 2;
      
      // Get finished player indices for turn calculation
      const finishedPlayerIndices = gamePlayers
        .map((p, idx) => ({ player: p, index: idx }))
        .filter(item => item.player.finishPosition)
        .map(item => item.index);
      
      // Move to next player
      const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        room.direction || "clockwise",
        false,
        false,
        finishedPlayerIndices
      );
      
      // Update player hand
      await storage.updatePlayer(playerId, { 
        hand: newHand,
        hasCalledUno: newHand.length > 1 ? false : player.hasCalledUno
      });
      
      // Update position hands
      if (player.position !== null) {
        const updatedPositionHands = { ...room.positionHands };
        updatedPositionHands[player.position.toString()] = newHand;
        await storage.updateRoom(roomId, { positionHands: updatedPositionHands });
      }
      
      // Update room state
      await storage.updateRoom(roomId, {
        discardPile: newDiscardPile,
        currentColor: color,
        pendingDraw: newPendingDraw,
        currentPlayerIndex: nextPlayerIndex
      });
      
      // Broadcast the guru +2 play
      broadcastToRoom(roomId, {
        type: 'guru_plus2',
        player: player.nickname,
        color: color,
        newPendingDraw: newPendingDraw,
        message: `${player.nickname} used GURU POWER to play +2! (Total penalty: ${newPendingDraw} cards)`
      });
      
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: 'Guru +2 played successfully', newPendingDraw, cardsRemaining: newHand.length });
    } catch (error) {
      console.error("Error with guru +2:", error);
      res.status(500).json({ error: 'Failed to play guru +2' });
    }
  });

  // Guru +4 card with sacrifice - guru can play +4 anytime by sacrificing a card
  app.post("/api/rooms/:roomId/guru-plus4", async (req, res) => {
    try {
      const { roomId } = req.params;
      const playerId = req.headers.authorization?.replace('Bearer ', '');
      const { color, sacrificeCardIndex } = z.object({
        color: z.enum(['red', 'blue', 'green', 'yellow']),
        sacrificeCardIndex: z.number().min(0)
      }).parse(req.body);
      
      if (!playerId) {
        return res.status(401).json({ error: 'Player ID required' });
      }
      
      const room = await storage.getRoom(roomId);
      if (!room || room.status !== 'playing') {
        return res.status(400).json({ error: 'Game not in progress' });
      }
      
      const player = await storage.getPlayer(playerId);
      if (!player || player.roomId !== roomId) {
        return res.status(403).json({ error: 'Not authorized for this room' });
      }
      
      // Verify it's this player's turn
      const players = await storage.getPlayersByRoom(roomId);
      const gamePlayers = players.filter(p => !p.isSpectator).sort((a, b) => (a.position || 0) - (b.position || 0));
      const currentPlayerIndex = room.currentPlayerIndex || 0;
      const currentPlayer = gamePlayers[currentPlayerIndex];
      
      if (!currentPlayer || currentPlayer.id !== playerId) {
        return res.status(400).json({ error: 'Not your turn' });
      }
      
      // Verify player has a card to sacrifice
      const hand = player.hand || [];
      if (sacrificeCardIndex < 0 || sacrificeCardIndex >= hand.length) {
        return res.status(400).json({ error: 'Invalid card index' });
      }
      
      console.log(`🧙‍♂️ GURU +4: ${player.nickname} using guru privilege to play +4 (color: ${color}, sacrificing card at index ${sacrificeCardIndex})`);
      
      // Create a Wild Draw 4 card
      const wild4Card: Card = {
        type: 'wild4',
        color: 'wild'
      };
      
      // Remove the sacrificed card from hand
      const newHand = [...hand];
      newHand.splice(sacrificeCardIndex, 1);
      
      // Add the +4 card to discard pile
      const newDiscardPile = [wild4Card, ...(room.discardPile || [])];
      
      // Stack the penalty
      const newPendingDraw = (room.pendingDraw || 0) + 4;
      
      // Get finished player indices for turn calculation
      const finishedPlayerIndices = gamePlayers
        .map((p, idx) => ({ player: p, index: idx }))
        .filter(item => item.player.finishPosition)
        .map(item => item.index);
      
      // Move to next player
      const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        room.direction || "clockwise",
        false,
        false,
        finishedPlayerIndices
      );
      
      // Update player hand
      await storage.updatePlayer(playerId, { 
        hand: newHand,
        hasCalledUno: newHand.length > 1 ? false : player.hasCalledUno
      });
      
      // Update position hands
      if (player.position !== null) {
        const updatedPositionHands = { ...room.positionHands };
        updatedPositionHands[player.position.toString()] = newHand;
        await storage.updateRoom(roomId, { positionHands: updatedPositionHands });
      }
      
      // Update room state
      await storage.updateRoom(roomId, {
        discardPile: newDiscardPile,
        currentColor: color,
        pendingDraw: newPendingDraw,
        currentPlayerIndex: nextPlayerIndex
      });
      
      // Broadcast the guru +4 play
      broadcastToRoom(roomId, {
        type: 'guru_plus4',
        player: player.nickname,
        color: color,
        newPendingDraw: newPendingDraw,
        message: `${player.nickname} used GURU POWER to play +4! (Total penalty: ${newPendingDraw} cards)`
      });
      
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: 'Guru +4 played successfully', newPendingDraw, cardsRemaining: newHand.length });
    } catch (error) {
      console.error("Error with guru +4:", error);
      res.status(500).json({ error: 'Failed to play guru +4' });
    }
  });

  // Host assign spectator to active game endpoint
  app.post("/api/rooms/:roomId/assign-spectator-to-game", async (req, res) => {
    try {
      const { roomId } = req.params;
      const hostId = req.headers.authorization?.replace('Bearer ', '');
      const { spectatorId, position } = z.object({
        spectatorId: z.string(),
        position: z.number().min(0).max(3)
      }).parse(req.body);
      
      if (!hostId) {
        return res.status(401).json({ error: 'Host ID required' });
      }
      
      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      // Verify the requester is the host OR old host returning during election
      const isCurrentHost = room.hostId === hostId;
      const isOldHostReturningDuringElection = room.hostElectionActive && 
        (room as any).hostPreviousId === hostId && 
        spectatorId === hostId;
      
      if (!isCurrentHost && !isOldHostReturningDuringElection) {
        return res.status(403).json({ error: 'Only host can assign spectators' });
      }
      
      // Verify room is in playing state
      if (room.status !== 'playing') {
        return res.status(400).json({ error: 'Can only assign spectators during active game' });
      }
      
      const spectator = await storage.getPlayer(spectatorId);
      if (!spectator || spectator.roomId !== roomId || !spectator.isSpectator) {
        return res.status(400).json({ error: 'Invalid spectator' });
      }
      
      // CRITICAL: Handle complex player state scenarios (kick/rejoin/duplicate handling)
      const roomPlayers = await storage.getPlayersByRoom(roomId);
      
      // Clean up any duplicate spectator entries for the same nickname
      const duplicateSpectators = roomPlayers.filter(p => 
        p.nickname.toLowerCase() === spectator.nickname.toLowerCase() && 
        p.id !== spectator.id && 
        p.isSpectator
      );
      
      for (const duplicate of duplicateSpectators) {
        console.log(`Cleaning up duplicate spectator entry: ${duplicate.id} (${duplicate.nickname})`);
        await storage.deletePlayer(duplicate.id);
      }
      
      // Re-fetch players after cleanup
      const cleanedPlayers = await storage.getPlayersByRoom(roomId);
      
      // Check if position is available (exclude left players and spectators)
      const positionTaken = cleanedPlayers.some(p => 
        p.position === position && 
        !p.isSpectator && 
        !p.hasLeft
      );
      
      if (positionTaken) {
        return res.status(400).json({ error: 'Position already taken' });
      }
      
      // Additional safety check: Ensure spectator is still valid after cleanup
      const currentSpectator = await storage.getPlayer(spectatorId);
      if (!currentSpectator || currentSpectator.roomId !== roomId || !currentSpectator.isSpectator) {
        return res.status(400).json({ error: 'Spectator no longer valid after cleanup' });
      }
      
      // Get cards for this position from positionHands or deal new ones
      let newHand: Card[] = [];
      if (room.positionHands && room.positionHands[position.toString()]) {
        newHand = room.positionHands[position.toString()];
        console.log(`Host assigning position ${position} cards to spectator ${spectator.nickname}`);
      } else if (room.deck && room.deck.length > 0) {
        // Deal 7 cards for new position in active game
        const cardsNeeded = Math.min(7, room.deck.length);
        newHand = room.deck.slice(0, cardsNeeded);
        const updatedDeck = room.deck.slice(cardsNeeded);
        
        // Update room deck and save cards for this position
        const updatedPositionHands = { ...room.positionHands, [position.toString()]: newHand };
        await storage.updateRoom(roomId, { 
          deck: updatedDeck,
          positionHands: updatedPositionHands
        });
        
        console.log(`Host dealing ${cardsNeeded} new cards to spectator ${spectator.nickname} for position ${position}`);
      }
      
      // Update spectator to become an active player
      await storage.updatePlayer(spectatorId, {
        position,
        isSpectator: false,
        hasLeft: false,
        leftAt: null,
        hand: newHand,
        hasCalledUno: false,
        finishPosition: null
      });
      
      console.log(`Host successfully assigned spectator ${spectator.nickname} to position ${position} during active game`);
      
      // CRITICAL: Handle election during spectator assignment
      // If OLD HOST returns BEFORE timer finishes, they become host again automatically
      // Voting rules only apply when the 30-second timer expires
      if (room.hostElectionActive || room.hostDisconnectedAt) {
        const isOldHostReturning = (room as any).hostPreviousId === spectatorId;
        
        if (isOldHostReturning) {
          console.log(`🟢 Old host ${spectator.nickname} returned BEFORE timer - they become host again`);
          
          // Cancel the timer
          const timer = hostDisconnectTimers.get(roomId);
          if (timer) {
            clearTimeout(timer);
            hostDisconnectTimers.delete(roomId);
          }
          
          // Restore old host as host, clear election state
          await storage.updateRoom(roomId, {
            hostId: spectatorId,
            hostPreviousId: null,
            hostDisconnectedAt: null,
            hostElectionActive: false,
            hostElectionVotes: {},
            hostElectionEligibleVoters: []
          });
          
          broadcastToRoom(roomId, {
            type: 'host_reconnected',
            message: `Host ${spectator.nickname} has returned. Election cancelled.`
          });
        } else {
          // Not the old host - just a regular spectator assignment during election
          // Don't cancel timer or tally votes - let the timer handle it
          console.log(`🟢 Spectator ${spectator.nickname} assigned during election (not old host) - timer continues`);
        }
      }
      
      // Broadcast updated room state
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: 'Spectator assigned to game successfully' });
    } catch (error) {
      console.error("Error assigning spectator to game:", error);
      res.status(500).json({ error: 'Failed to assign spectator to game' });
    }
  });

  // iOS-friendly redirect endpoints for QR codes
  app.get("/join/:code", (req, res) => {
    const { code } = req.params;
    res.redirect(302, `/?room=${code}`);
  });
  
  app.get("/r/:code", (req, res) => {
    const { code } = req.params;
    res.redirect(302, `/?room=${code}`);
  });
  
  app.get("/game", (req, res) => {
    const { code } = req.query;
    if (code && typeof code === 'string') {
      res.redirect(302, `/?room=${code}`);
    } else {
      res.redirect(302, '/');
    }
  });

  // Leonardo.ai API routes
  app.get("/api/leonardo/status", async (req, res) => {
    try {
      const status = await checkApiStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ available: false, error: 'Failed to check API status' });
    }
  });

  app.post("/api/leonardo/generate", async (req, res) => {
    try {
      const { prompt, width, height } = z.object({
        prompt: z.string().min(1),
        width: z.number().optional(),
        height: z.number().optional()
      }).parse(req.body);

      const imageUrl = await generateImage(prompt, { width, height });
      
      if (!imageUrl) {
        return res.status(500).json({ error: 'Image generation failed' });
      }
      
      res.json({ success: true, imageUrl });
    } catch (error) {
      console.error('Leonardo generate error:', error);
      res.status(500).json({ error: 'Image generation failed' });
    }
  });

  app.post("/api/leonardo/generate-assets", async (req, res) => {
    try {
      const assets = await generateGameAssets();
      res.json({ success: true, assets });
    } catch (error) {
      console.error('Leonardo generate assets error:', error);
      res.status(500).json({ error: 'Asset generation failed' });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info: any) => {
      // Allow all origins in development
      console.log('WebSocket connection attempt from:', info.origin);
      return true;
    }
  });
  
  console.log('WebSocket server created on path /ws');

  // Periodic status broadcast to keep all clients synchronized
  setInterval(async () => {
    const activeRooms = new Set<string>();
    connections.forEach(conn => {
      if (conn.roomId) activeRooms.add(conn.roomId);
    });
    
    for (const roomId of Array.from(activeRooms)) {
      await broadcastRoomState(roomId);
    }
  }, 15000); // Broadcast every 15 seconds
  
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('New WebSocket connection from:', req.socket.remoteAddress);
    const connectionId = Math.random().toString(36).substring(7);
    connections.set(connectionId, { ws });
    
    // Set up heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30000); // Ping every 30 seconds
    
    ws.on('pong', () => {
      const connection = connections.get(connectionId);
      if (connection) {
        connection.lastSeen = Date.now();

      }
    });
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        const connection = connections.get(connectionId);
        
        if (!connection) return;
        
        console.log(`📨 WebSocket message received: ${message.type} from connection ${connectionId}`);
        
        switch (message.type) {
          case 'join_room':
            await handleJoinRoom(connection, message, connectionId);
            break;
          case 'start_game':
            await handleStartGame(connection, message);
            break;
          case 'play_card':
            console.log(`🎯 Routing play_card message to handlePlayCard`);
            await handlePlayCard(connection, message);
            break;
          case 'draw_card':
            await handleDrawCard(connection, message);
            break;
          case 'call_uno':
            await handleCallUno(connection, message);
            break;
          case 'choose_color':
            await handleChooseColor(connection, message);
            break;
          case 'send_message':
            await handleSendMessage(connection, message);
            break;
          case 'exit_game':
            await handleExitGame(connection, message);
            break;
          case 'kick_player':
            await handleKickPlayer(connection, message);
            break;
          case 'continue_game':
            await handleContinueGame(connection, message);
            break;
          case 'replace_player':
            await handleReplacePlayer(connection, message);
            break;
          case 'assign_spectator':
            await handleAssignSpectator(connection, message);
            break;
          case 'send_emoji':
            await handleSendEmoji(connection, message);
            break;
          case 'play_again':
            await handlePlayAgain(connection, message);
            break;
          case 'submit_host_vote':
            await handleSubmitHostVote(connection, message);
            break;
          case 'host_end_game':
            await handleHostEndGame(connection, message);
            break;
          case 'host_exit_room':
            await handleHostExitRoom(connection, message);
            break;
          case 'heartbeat':
            // Update last seen time and handle tab visibility
            connection.lastSeen = Date.now();
            connection.tabVisible = message.tabVisible !== false; // Default to true if not specified
            connection.lastActivity = message.timestamp || Date.now();
            

            
            ws.send(JSON.stringify({ 
              type: 'heartbeat_ack',
              serverTime: Date.now()
            }));
            break;
          case 'avatar_changed':
            // Broadcast avatar change to all players in the room
            if (connection.roomId && message.playerId && message.gender) {
              broadcastToRoom(connection.roomId, {
                type: 'avatar_changed',
                playerId: message.playerId,
                gender: message.gender
              });
            }
            break;
          case 'assign_host':
            await handleAssignHost(connection, message);
            break;
          case 'stream_subscribe':
            // Stream viewer subscribing to room updates (read-only, no player)
            await handleStreamSubscribe(connection, message, connectionId);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
  // Handle stream viewer subscription - they get room updates without being a player
  // IMPORTANT: Stream viewers must NOT affect existing player connections
  async function handleStreamSubscribe(connection: any, message: any, connectionId: string) {
    const { roomId, roomCode, streamViewerId } = message;
    
    let room;
    if (roomId) {
      room = await storage.getRoom(roomId);
    } else if (roomCode) {
      room = await storage.getRoomByCode(roomCode.toUpperCase());
    }
    
    if (!room) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found'
      }));
      return;
    }
    
    console.log(`📺 Stream viewer ${connectionId} (${streamViewerId || 'no-id'}) subscribing to room ${room.code}`);
    
    // If this connection already has a playerId, this is a player who navigated to stream page
    // Keep their player identity intact - just add stream viewer capability
    const hadExistingPlayerId = !!connection.playerId;
    
    // Register this connection to the room (for broadcasts) but mark as stream viewer
    connection.roomId = room.id;
    connection.isStreamViewer = true;
    connection.streamViewerId = streamViewerId; // Track unique stream viewer ID
    
    // CRITICAL: Only null out playerId if this was never a player connection
    // This prevents breaking the player's connection state when they open stream page
    if (!hadExistingPlayerId) {
      connection.playerId = null; // Pure stream viewer, no player
    } else {
      console.log(`📺 Stream viewer ${connectionId} was already player ${connection.playerId}, keeping player identity`);
    }
    
    connections.set(connectionId, connection);
    
    // Count stream viewers for this room (including the new one)
    const streamViewerCount = Array.from(connections.values()).filter(conn => 
      conn.roomId === room.id && 
      conn.isStreamViewer && 
      conn.ws.readyState === WebSocket.OPEN
    ).length;
    
    // Send current room state to stream viewer
    const players = await storage.getPlayersByRoom(room.id);
    
    connection.ws.send(JSON.stringify({
      type: 'room_state',
      data: {
        room,
        players: players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          position: p.position,
          isSpectator: p.isSpectator,
          isOnline: p.isOnline,
          hasCalledUno: p.hasCalledUno,
          cardCount: room.positionHands?.[p.position ?? -1]?.length || 0
        })),
        messages: [],
        streamViewerCount
      }
    }));
    
    // Broadcast updated room state to all clients so they see the new viewer count
    await broadcastRoomState(room.id);
  }
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed: ${connectionId} (code: ${code}, reason: ${reason?.toString()})`);
      clearInterval(heartbeat);
      const connection = connections.get(connectionId);
      const wasStreamViewer = connection?.isStreamViewer;
      const roomIdForViewer = connection?.roomId;
      
      if (connection?.playerId && connection?.roomId) {
        const playerNickname = connection.playerId; // Try to get nickname for better logging
        console.log(`Player connection ${playerNickname} (${connectionId}) closed with code ${code}`);
        
        // Wait a bit before marking as disconnected to allow for reconnection
        setTimeout(() => {
          // Check if player has reconnected with a different connection
          const hasActiveConnection = Array.from(connections.values())
            .some(conn => conn.playerId === connection.playerId && conn.ws.readyState === WebSocket.OPEN);
          
          if (!hasActiveConnection && connection.playerId && connection.roomId) {
            console.log(`Marking player ${connection.playerId} as disconnected after timeout`);
            handlePlayerDisconnect(connection.playerId, connection.roomId);
          } else if (hasActiveConnection) {
            console.log(`Player ${connection.playerId} has active connection, not marking as disconnected`);
          }
        }, 5000);
      }
      connections.delete(connectionId);
      
      // If this was a stream viewer, broadcast updated viewer count
      if (wasStreamViewer && roomIdForViewer) {
        console.log(`📺 Stream viewer ${connectionId} disconnected from room ${roomIdForViewer}`);
        broadcastRoomState(roomIdForViewer);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error);
      const connection = connections.get(connectionId);
      if (connection?.playerId) {
        console.error(`  Player: ${connection.playerId}, Room: ${connection.roomId}`);
      }
    });
  });

  async function handleJoinRoom(connection: SocketConnection, message: any, connectionId: string) {
    const { playerId, roomId, userFingerprint, sessionId } = message;
    
    console.log("handleJoinRoom called:", { playerId, roomId, connectionId, userFingerprint, sessionId });
    
    // Ensure room and player exist before proceeding
    // Try both room ID and room code lookup
    let room = await storage.getRoom(roomId);
    if (!room) {
      room = await storage.getRoomByCode(roomId);
    }
    
    const player = await storage.getPlayer(playerId);
    
    if (!room) {
      console.log(`Room ${roomId} not found by ID or code`);
      // Additional debugging for room lookup failures
      console.log(`Available rooms lookup failed - will use fallback debug method`);
      
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found. Please join via the main interface.'
      }));
      return;
    }
    
    // Use actual room ID for consistency
    const actualRoomId = room.id;
    console.log(`Room found: ${room.code} -> ${actualRoomId}`);
    
    if (!player) {
      console.log(`Player ${playerId} not found, cannot join room`);
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Player session expired. Please rejoin the room.'
      }));
      return;
    }
    
    // Check if same user (fingerprint) has other active connections for this player
    if (userFingerprint && playerId) {
      const existingConnections = Array.from(connections.entries()).filter(([id, conn]) => 
        conn.playerId === playerId && 
        conn.userFingerprint === userFingerprint &&
        id !== connectionId &&
        conn.ws.readyState === WebSocket.OPEN
      );
      
      // Close old connections from same user/device
      existingConnections.forEach(([oldConnectionId, oldConnection]) => {
        console.log(`Closing old connection ${oldConnectionId} for user ${userFingerprint}`);
        oldConnection.ws.close(1000, 'New session started');
        connections.delete(oldConnectionId);
      });
    }
    
    connection.playerId = playerId;
    connection.roomId = actualRoomId; // Use actual room ID
    connection.lastSeen = Date.now();
    connection.userFingerprint = userFingerprint;
    connection.sessionId = sessionId;
    
    // Update player's socket ID
    await storage.updatePlayer(playerId, { socketId: connectionId });
    
    // Check if this is the host reconnecting - always send host_reconnected to clear any voting state
    if (room.hostId === playerId) {
      if (room.hostDisconnectedAt || room.hostElectionActive) {
        console.log(`Host ${player.nickname} reconnected, canceling election`);
        await cancelHostElectionIfNeeded(actualRoomId);
      } else {
        // Even if no election was active, send host_reconnected to clear any stale voting window on client
        broadcastToRoom(actualRoomId, {
          type: 'host_reconnected',
          message: `Host ${player.nickname} has reconnected!`
        });
      }
    }
    
    console.log("Broadcasting room state to all players in room:", actualRoomId);
    // Broadcast room state to all players
    await broadcastRoomState(actualRoomId);
  }

  async function handleStartGame(connection: SocketConnection, message: any) {
    if (!connection.roomId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    const gamePlayers = players.filter(p => !p.isSpectator);
    
    if (!room || room.hostId !== connection.playerId || gamePlayers.length < 2) {
      return;
    }
    
    // Initialize game with verified deck
    const deck = UnoGameLogic.createDeck();
    
    // Verify deck composition in development
    if (process.env.NODE_ENV === 'development') {
      UnoGameLogic.verifyDeckComposition(deck);
    }
    
    const { hands, remainingDeck } = UnoGameLogic.dealInitialHands(deck, gamePlayers.length);
    
    // Find a number card for the first discard (never start with special cards)
    const { firstCard, remainingDeck: finalDeck } = UnoGameLogic.findFirstNumberCard(remainingDeck);
    const discardPile = [firstCard];
    
    // Update room with game state
    await storage.updateRoom(connection.roomId, {
      status: "playing",
      deck: finalDeck,
      discardPile,
      currentPlayerIndex: 0,
      currentColor: firstCard.color as "red" | "blue" | "green" | "yellow", // Number cards always have a valid color
      pendingDraw: 0
    });
    
    // Update player hands and store position-based hands
    const positionHands: {[key: string]: any[]} = {};
    const activePositions: number[] = [0, 1, 2, 3]; // Always include all 4 positions for UNO
    
    for (let i = 0; i < gamePlayers.length; i++) {
      await storage.updatePlayer(gamePlayers[i].id, { hand: hands[i] });
      // Store cards by position so anyone joining this position gets these cards
      positionHands[gamePlayers[i].position!.toString()] = hands[i];
    }
    
    // For empty positions, reserve 7 cards from the deck for future players
    const remainingPositions = [0, 1, 2, 3].filter(pos => 
      !gamePlayers.some(p => p.position === pos)
    );
    
    let currentDeck = [...finalDeck];
    for (const emptyPos of remainingPositions) {
      if (currentDeck.length >= 7) {
        const reservedCards = currentDeck.splice(0, 7);
        positionHands[emptyPos.toString()] = reservedCards;
        console.log(`🃏 Reserved 7 cards for empty position ${emptyPos}`);
      }
    }
    
    console.log(`Game started with active positions: [${activePositions.join(', ')}]`);
    console.log(`Position hands saved:`, Object.keys(positionHands));
    console.log(`Remaining deck size: ${currentDeck.length}`);
    
    // Update room with position-based hands, active positions, and updated deck
    await storage.updateRoom(connection.roomId, { 
      positionHands, 
      activePositions,
      deck: currentDeck // Use updated deck after reserving cards
    });
    
    await broadcastRoomState(connection.roomId);
    
    // Check if the first player needs to automatically draw penalty cards
    // (This handles cases where the first player after game start has pending draws)
    await checkAndApplyAutomaticPenalty(connection.roomId, 0, gamePlayers);
  }

  async function handlePlayCard(connection: SocketConnection, message: any) {
    console.log(`🎯 handlePlayCard called for connection: ${connection.playerId}`);
    
    if (!connection.roomId || !connection.playerId) {
      console.log(`❌ PLAY CARD: Missing roomId or playerId`);
      return;
    }
    
    const { cardIndex } = message;
    console.log(`🃏 PLAY CARD: ${connection.playerId} trying to play card index ${cardIndex}`);
    
    const room = await storage.getRoom(connection.roomId);
    console.log(`🏠 Room status: ${room?.status}, exists: ${!!room}`);
    console.log(`🔍 Room ID being checked: ${connection.roomId}`);
    
    // CRITICAL: Get fresh player data to ensure we have the latest hasCalledUno status
    const player = await storage.getPlayer(connection.playerId);
    if (!player) {
      console.log(`❌ PLAY CARD: Player not found`);
      return;
    }
    console.log(`👤 Player found: ${player.nickname}, hasCalledUno: ${player.hasCalledUno}`);
    
    // Double-check UNO status with additional logging for debugging
    if (player.hasCalledUno) {
      console.log(`✅ UNO STATUS CONFIRMED: ${player.nickname} has called UNO (hasCalledUno=true)`);
    } else {
      console.log(`❌ UNO STATUS: ${player.nickname} has NOT called UNO (hasCalledUno=false)`);
    }
    
    const players = await storage.getPlayersByRoom(connection.roomId);
    const gamePlayers = players.filter(p => !p.isSpectator).sort((a, b) => (a.position || 0) - (b.position || 0));
    console.log(`🎮 Game players: ${gamePlayers.map(p => p.nickname).join(', ')}`);
    
    if (!room || !player || room.status !== "playing") {
      console.log(`❌ PLAY CARD: Invalid state - room exists: ${!!room}, player exists: ${!!player}, room status: ${room?.status}`);
      return;
    }
    
    const currentPlayerIndex = room.currentPlayerIndex || 0;
    const currentPlayer = gamePlayers[currentPlayerIndex];
    
    console.log(`🔄 TURN CHECK: Current turn is index ${currentPlayerIndex} (${currentPlayer?.nickname}), player ${player.nickname} trying to play`);
    
    if (currentPlayer.id !== connection.playerId) {
      console.log(`⏳ NOT YOUR TURN: ${player.nickname} tried to play but it's ${currentPlayer?.nickname}'s turn (index ${currentPlayerIndex})`);
      return;
    }
    
    // Don't allow finished players to play cards
    if (currentPlayer.finishPosition) return;
    
    const playerHand = player.hand || [];
    const currentHandSize = playerHand.length;
    const card = playerHand[cardIndex];
    const topCard = (room.discardPile || [])[0];
    
    if (!card || !UnoGameLogic.canPlayCard(card, topCard, room.currentColor || undefined, room.pendingDraw || 0)) {
      console.log(`❌ PLAY CARD: Cannot play card - card exists: ${!!card}, canPlay: ${card ? UnoGameLogic.canPlayCard(card, topCard, room.currentColor || undefined, room.pendingDraw || 0) : false}`);
      console.log(`🔍 CARD VALIDATION DEBUG for ${player.nickname}:`);
      console.log(`  Card: ${card?.color} ${card?.value} (${card?.type})`);
      console.log(`  Top Card: ${topCard?.color} ${topCard?.value} (${topCard?.type})`);
      console.log(`  Current Color: ${room.currentColor}`);
      console.log(`  Pending Draw: ${room.pendingDraw}`);
      console.log(`  Player Hand: ${playerHand.map(c => `${c.color} ${c.value}`).join(', ')}`);
      if (card?.type === 'wild4') {
        console.log(`🃏 Wild4 card rejected - Type: ${card.type}, PendingDraw: ${room.pendingDraw}, TopCard: ${topCard?.type}`);
      }
      return;
    }
    
    console.log(`✅ PLAY CARD: Playing card ${card.color} ${card.value} for ${player.nickname}`);
    
    // Remove card from player's hand first
    let newHand = playerHand.filter((_, index) => index !== cardIndex);
    

    // Check UNO penalty - apply only if player went from 2 cards to 1 card without calling UNO
    let shouldApplyUnoPenalty = false;
    if (currentHandSize === 2 && newHand.length === 1 && !player.hasCalledUno) {
      shouldApplyUnoPenalty = true;
      console.log(`🚨 UNO PENALTY: ${player.nickname} played from 2→1 cards without calling UNO`);
      console.log(`🚨 Player hasCalledUno status: ${player.hasCalledUno}`);
    } else if (currentHandSize === 2 && newHand.length === 1 && player.hasCalledUno) {
      console.log(`✅ UNO SUCCESS: ${player.nickname} played from 2→1 cards WITH UNO called`);
    }
    
    // Apply UNO penalty if needed (2 random cards from deck)
    if (shouldApplyUnoPenalty) {
      const deck = room.deck || [];
      const penaltyCards = deck.splice(0, 2);
      newHand = [...newHand, ...penaltyCards];
      await storage.updateRoom(connection.roomId, { deck });
      
      // Send UNO penalty message
      await storage.createMessage({
        roomId: connection.roomId,
        message: `${player.nickname} didn't call UNO and drew 2 penalty cards!`,
        type: "system"
      });

      // Broadcast UNO penalty animation to all players
      broadcastToRoom(connection.roomId, {
        type: 'uno_penalty',
        playerName: player.nickname,
        message: 'forgot to call UNO before playing second-to-last card'
      });
    }
    
    // Reset UNO call status logic:
    // - If player has more than 1 card after penalties, reset UNO call
    // - If player successfully went from 2 to 1 card with UNO called, keep UNO status true
    // - If player has exactly 1 card and didn't get penalized, they successfully called UNO
    let newUnoStatus = player.hasCalledUno;
    if (newHand.length > 1) {
      newUnoStatus = false; // Reset UNO if player has more than 1 card
    } else if (newHand.length === 1 && player.hasCalledUno && !shouldApplyUnoPenalty) {
      newUnoStatus = true; // Keep UNO status if successfully down to 1 card
    }
    
    await storage.updatePlayer(connection.playerId, { 
      hand: newHand,
      hasCalledUno: newUnoStatus
    });

    // Add "1 card left" notification for all players to see
    if (newHand.length === 1 && !shouldApplyUnoPenalty) {
      await storage.createMessage({
        roomId: connection.roomId,
        message: `${player.nickname} has 1 card left!`,
        type: "system"
      });
      
      // Broadcast special notification for 1 card left
      broadcastToRoom(connection.roomId, {
        type: 'one_card_left',
        player: player.nickname,
        message: `${player.nickname} has 1 card left!`
      });
    }
    
    // Update position hands to keep them current
    if (player.position !== null) {
      const updatedPositionHands = { ...room.positionHands };
      updatedPositionHands[player.position.toString()] = newHand;
      await storage.updateRoom(connection.roomId, { positionHands: updatedPositionHands });
    }
    
    // Add card to discard pile
    const newDiscardPile = [card, ...(room.discardPile || [])];
    
    // Apply card effects
    const effect = UnoGameLogic.getCardEffect(card);
    let nextPlayerIndex = currentPlayerIndex;
    let newDirection = room.direction;
    let newPendingDraw = room.pendingDraw || 0;
    
    // Get finished player indices for turn skipping - do this once at the start
    const finishedPlayerIndices = gamePlayers
      .map((p, idx) => ({ player: p, index: idx }))
      .filter(item => item.player.finishPosition)
      .map(item => item.index);
    
    console.log(`🎯 TURN LOGIC: Current: ${currentPlayerIndex}, Finished players: [${finishedPlayerIndices.join(', ')}]`);
    console.log(`🃏 CARD EFFECT: Skip: ${effect.skip}, Reverse: ${effect.reverse}, Draw: ${effect.draw}`);
    
    // Handle stacking draw cards
    if (effect.draw > 0) {
      // Stack the draw effect - pass the penalty to next player
      newPendingDraw = (room.pendingDraw || 0) + effect.draw;
      
      // Move to next player (they can either draw or stack)
      nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        room.direction || "clockwise", 
        false, // Don't skip, next player gets a chance to stack
        false,
        finishedPlayerIndices
      );
    } else {
      // Handle direction change BEFORE calculating next player
      if (effect.reverse) {
        newDirection = room.direction === "clockwise" ? "counterclockwise" : "clockwise";
        console.log(`🔄 DIRECTION CHANGED: ${room.direction} → ${newDirection}`);
      }
      
      // Calculate next player using the NEW direction
      nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        newDirection || room.direction || "clockwise", 
        effect.skip,
        effect.reverse,
        finishedPlayerIndices
      );
      
      // Clear pending draw since this is not a draw card
      newPendingDraw = 0;
    }
    
    // Validation: Ensure next player is not finished
    if (finishedPlayerIndices.includes(nextPlayerIndex)) {
      for (let i = 0; i < gamePlayers.length; i++) {
        if (!finishedPlayerIndices.includes(i)) {
          nextPlayerIndex = i;
          break;
        }
      }
    }
    
    console.log(`➡️ NEXT PLAYER: Turn advancing from ${currentPlayerIndex} (${currentPlayer?.nickname}) to ${nextPlayerIndex} (${gamePlayers[nextPlayerIndex]?.nickname})`);
    
    // Update room state
    await storage.updateRoom(connection.roomId, {
      discardPile: newDiscardPile,
      currentPlayerIndex: nextPlayerIndex,
      direction: newDirection,
      currentColor: effect.chooseColor ? null : card.color, // Set to null if color choice needed
      pendingDraw: newPendingDraw,
      waitingForColorChoice: effect.chooseColor ? connection.playerId : null // Track who needs to choose color
    });
    
    // Check for win condition
    if (newHand.length === 0) {
      const players = await storage.getPlayersByRoom(connection.roomId);
      const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
      const finishedCount = activePlayers.filter(p => p.finishPosition).length;
      
      // Set finish position for current winner
      await storage.updatePlayer(connection.playerId, { finishPosition: finishedCount + 1 });
      
      // Get updated players after setting position
      const updatedPlayers = await storage.getPlayersByRoom(connection.roomId);
      const remainingPlayers = updatedPlayers.filter(p => !p.isSpectator && !p.hasLeft && !p.finishPosition);
      

      
      // Check if game should fully end (only 1 player left or all finished)
      if (remainingPlayers.length <= 1) {
        // Game ends, set last player's position if any
        if (remainingPlayers.length === 1) {
          await storage.updatePlayer(remainingPlayers[0].id, { finishPosition: finishedCount + 2 });
        }
        
        await storage.updateRoom(connection.roomId, { status: "finished" });
        
        // Get final rankings for complete game end
        const finalPlayers = await storage.getPlayersByRoom(connection.roomId);
        const finalRankings = finalPlayers
          .filter(p => !p.isSpectator)
          .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999));
        
        const finalGameEndMessage = {
          type: 'game_end',
          winner: player.nickname,
          rankings: finalRankings.map(p => ({
            nickname: p.nickname,
            position: p.finishPosition || (p.hasLeft ? 'Left' : 'Last'),
            hasLeft: p.hasLeft || false
          }))
        };
        
        // Clear any active penalty animations first
        broadcastToRoom(connection.roomId, {
          type: 'clear_penalty_animation'
        });
        
        // Store game end data in room for retrieval
        await storage.updateRoom(connection.roomId, { 
          winner: player.nickname,
          rankings: finalRankings.map(p => ({
            nickname: p.nickname,
            position: p.finishPosition || (p.hasLeft ? 'Left' : 'Last'),
            hasLeft: p.hasLeft || false
          }))
        });
        
        // Add delay before game end broadcast to ensure all players receive it
        setTimeout(() => {
          // Broadcast game end message to all players in the room
          console.log('🏆 Broadcasting game_end message to all players:', finalGameEndMessage);
          broadcastToRoom(connection.roomId, finalGameEndMessage);
          
          // Also broadcast delayed for disconnected players who might reconnect
          setTimeout(() => {
            console.log('🔄 Re-broadcasting game_end message for any reconnected players');
            broadcastToRoom(connection.roomId, finalGameEndMessage);
          }, 2000);
        }, 100); // Short delay to prevent race condition with disconnections
      } else {
        // Continue game with remaining players - no notification needed
        // The winner modal will show when game truly ends
        broadcastToRoom(connection.roomId, {
          type: 'player_finished',
          player: player.nickname,
          position: finishedCount + 1
        });
      }
    }
    
    // Add "player finished their turn" notification (except for game-ending moves)
    if (newHand.length > 0) {
      await storage.createMessage({
        roomId: connection.roomId,
        message: `${player.nickname} finished their turn`,
        type: "system"
      });
      
      // Broadcast turn completion notification
      broadcastToRoom(connection.roomId, {
        type: 'turn_finished',
        player: player.nickname,
        message: `${player.nickname} finished their turn`
      });
    }

    // Broadcast room state first, then send specific color choice message if needed
    await broadcastRoomState(connection.roomId);
    
    // If wild card was played, send color choice request to the player
    if (effect.chooseColor) {
      connection.ws.send(JSON.stringify({
        type: 'choose_color_request',
        message: 'Choose a color for the wild card'
      }));
    }
    
    // Check if the next player needs to automatically draw penalty cards
    await checkAndApplyAutomaticPenalty(connection.roomId, nextPlayerIndex, gamePlayers);
  }

  async function applyPenaltyWithAnimation(roomId: string, playerIndex: number, gamePlayers: any[], penaltyAmount: number) {
    console.log(`🎴 PENALTY ANIMATION START: roomId=${roomId}, playerIndex=${playerIndex}, penaltyAmount=${penaltyAmount}`);
    
    const room = await storage.getRoom(roomId);
    if (!room || penaltyAmount <= 0) {
      console.log(`❌ PENALTY ANIMATION: Invalid room or penalty amount`);
      return;
    }

    const currentPlayer = gamePlayers[playerIndex];
    if (!currentPlayer) {
      console.log(`❌ PENALTY ANIMATION: No current player at index ${playerIndex}`);
      return;
    }

    const player = await storage.getPlayer(currentPlayer.id);
    if (!player) {
      console.log(`❌ PENALTY ANIMATION: Player not found in storage`);
      return;
    }

    const deck = room.deck || [];
    if (deck.length < penaltyAmount) {
      console.log(`❌ PENALTY ANIMATION: Not enough cards in deck (${deck.length} < ${penaltyAmount})`);
      return;
    }

    console.log(`✅ PENALTY ANIMATION: Drawing ${penaltyAmount} cards for ${player.nickname}`);

    // Start penalty animation
    broadcastToRoom(roomId, {
      type: 'penalty_animation_start',
      player: player.nickname,
      totalCards: penaltyAmount
    });

    // Show initial penalty amount for 1.5 seconds before starting to draw
    await new Promise(resolve => setTimeout(resolve, 1500));

    let currentHand = [...(player.hand || [])];
    
    // Calculate timing to make total animation 6 seconds
    // 1.5s initial + (cards * delay) + 1.5s final = 6s
    // For +2: 1.5 + (2 * 1.5) + 1.5 = 6s  
    // For +4: 1.5 + (4 * 0.75) + 1.5 = 6s
    const delayPerCard = penaltyAmount === 2 ? 1500 : 750; // Adjust timing based on card count
    
    // Draw cards one by one with calculated delay
    for (let i = 0; i < penaltyAmount; i++) {
      await new Promise(resolve => setTimeout(resolve, delayPerCard));
      
      const drawnCard = deck.shift();
      if (!drawnCard) break;
      
      currentHand.push(drawnCard);
      
      // Update player hand incrementally
      await storage.updatePlayer(currentPlayer.id, { 
        hand: currentHand,
        hasCalledUno: currentHand.length > 1 ? false : player.hasCalledUno
      });
      
      // Broadcast each card being drawn
      broadcastToRoom(roomId, {
        type: 'penalty_card_drawn',
        player: player.nickname,
        cardNumber: i + 1,
        totalCards: penaltyAmount,
        drawnCard: drawnCard // Include the actual card for debugging
      });
      
      await broadcastRoomState(roomId);
    }
    
    // Update deck immediately (cards have been drawn)
    await storage.updateRoom(roomId, { deck });
    
    // Wait 1.5 seconds before ending animation to complete 6 second total
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // End penalty animation
    broadcastToRoom(roomId, {
      type: 'penalty_animation_end',
      player: player.nickname,
      totalCards: penaltyAmount
    });
    
    // Get finished player indices for turn skipping
    const finishedPlayerIndices = gamePlayers
      .map((p, idx) => ({ player: p, index: idx }))
      .filter(item => item.player.finishPosition)
      .map(item => item.index);
    
    // NOW move to next player and clear penalty - AFTER animation is complete
    // This prevents the attacker from playing during the animation
    const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
      playerIndex, 
      gamePlayers.length, 
      room.direction || "clockwise",
      false,
      false,
      finishedPlayerIndices
    );
    
    console.log(`🎯 PENALTY COMPLETE: Turn advancing from ${playerIndex} (${player.nickname}) to ${nextPlayerIndex} after drawing ${penaltyAmount} cards`);
    
    await storage.updateRoom(roomId, { 
      pendingDraw: 0,
      currentPlayerIndex: nextPlayerIndex
    });
    
    await broadcastRoomState(roomId);
  }

  async function checkAndApplyAutomaticPenalty(roomId: string, playerIndex: number, gamePlayers: any[]) {
    const room = await storage.getRoom(roomId);
    console.log(`🔍 PENALTY CHECK: roomId=${roomId}, playerIndex=${playerIndex}, pendingDraw=${room?.pendingDraw}`);
    
    if (!room || !room.pendingDraw || room.pendingDraw === 0) {
      console.log(`❌ PENALTY CHECK: No pending draw, skipping`);
      return;
    }

    const currentPlayer = gamePlayers[playerIndex];
    if (!currentPlayer) {
      console.log(`❌ PENALTY CHECK: No current player at index ${playerIndex}`);
      return;
    }

    const player = await storage.getPlayer(currentPlayer.id);
    if (!player) {
      console.log(`❌ PENALTY CHECK: Player not found in storage`);
      return;
    }

    const topCard = (room.discardPile || [])[0];
    if (!topCard) {
      console.log(`❌ PENALTY CHECK: No top card on discard pile`);
      return;
    }

    // NEW BEHAVIOR: Never auto-apply penalty - always wait for player to choose
    // Player can either: 1) Play a +4 from their hand, or 2) Press draw to accept penalty
    const canStack = UnoGameLogic.canPlayerStackDraw(player.hand || [], topCard, room.pendingDraw);
    console.log(`🎯 PENALTY CHECK: Player ${player.nickname} canStack=${canStack}, pendingDraw=${room.pendingDraw}, topCard=${topCard.type}`);
    console.log(`⏳ WAITING: ${player.nickname} must choose - play +4 or draw ${room.pendingDraw} cards`);
    // No auto-apply - player must explicitly press draw or play a +4
  }

  async function handleDrawCard(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    const gamePlayers = players.filter(p => !p.isSpectator).sort((a, b) => (a.position || 0) - (b.position || 0));
    
    if (!room || !player || room.status !== "playing") return;
    
    const currentPlayerIndex = room.currentPlayerIndex || 0;
    const currentPlayer = gamePlayers[currentPlayerIndex];
    
    console.log(`🎴 DRAW CHECK: Current turn is index ${currentPlayerIndex} (${currentPlayer?.nickname}), player ${player.nickname} trying to draw`);
    
    if (currentPlayer.id !== connection.playerId) {
      console.log(`⏳ NOT YOUR TURN TO DRAW: ${player.nickname} tried to draw but it's ${currentPlayer?.nickname}'s turn (index ${currentPlayerIndex})`);
      return;
    }
    
    // Don't allow finished players to draw cards
    if (currentPlayer.finishPosition) return;
    
    const deck = room.deck || [];
    if (deck.length === 0) return;
    
    // Handle pending draw effects with animation to maintain secrecy
    if (room.pendingDraw && room.pendingDraw > 0) {
      // Use the same animated penalty system as automatic penalties
      // This hides whether the player had a choice or not
      await applyPenaltyWithAnimation(connection.roomId, currentPlayerIndex, gamePlayers, room.pendingDraw);
      return; // applyPenaltyWithAnimation handles everything including turn advancement
    }
    
    // Normal single card draw (no penalty)
    const drawnCards = deck.splice(0, 1);
    const newHand = [...(player.hand || []), ...drawnCards];
    

    
    // Reset UNO call if player now has more than 1 card  
    await storage.updatePlayer(connection.playerId, { 
      hand: newHand,
      hasCalledUno: newHand.length > 1 ? false : player.hasCalledUno
    });
    
    // Update position hands to keep them current
    if (player.position !== null) {
      const updatedPositionHands = { ...room.positionHands };
      updatedPositionHands[player.position.toString()] = newHand;
      await storage.updateRoom(connection.roomId, { positionHands: updatedPositionHands });
    }
    
    // Get finished player indices for turn skipping
    const finishedPlayerIndices = gamePlayers
      .map((p, idx) => ({ player: p, index: idx }))
      .filter(item => item.player.finishPosition)
      .map(item => item.index);
    
    console.log(`🎯 DRAW TURN ADVANCE: Current: ${currentPlayerIndex}, Finished: [${finishedPlayerIndices.join(', ')}]`);
    
    // Always move to next player after drawing - turn is over
    let nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
      currentPlayerIndex, 
      gamePlayers.length, 
      room.direction || "clockwise",
      false,
      false,
      finishedPlayerIndices
    );
    
    console.log(`➡️ DRAW NEXT PLAYER: ${nextPlayerIndex} (${gamePlayers[nextPlayerIndex]?.nickname || 'Unknown'})`);
    
    // Validation: Ensure next player is active
    if (finishedPlayerIndices.includes(nextPlayerIndex)) {
      console.log(`⚠️ WARNING: Draw next player ${nextPlayerIndex} is finished! Finding alternative...`);
      for (let i = 0; i < gamePlayers.length; i++) {
        if (!finishedPlayerIndices.includes(i)) {
          nextPlayerIndex = i;
          console.log(`✅ DRAW FALLBACK: Using player ${nextPlayerIndex} (${gamePlayers[nextPlayerIndex]?.nickname})`);
          break;
        }
      }
    }
    
    await storage.updateRoom(connection.roomId, { 
      deck,
      currentPlayerIndex: nextPlayerIndex
    });
    await broadcastRoomState(connection.roomId);
  }

  async function handleCallUno(connection: SocketConnection, message: any) {
    if (!connection.playerId || !connection.roomId) return;
    
    const player = await storage.getPlayer(connection.playerId);
    if (!player) return;
    
    const handLength = (player.hand || []).length;
    console.log(`📢 UNO CALL: ${player.nickname} trying to call UNO with ${handLength} cards`);
    
    // False UNO call penalty: if player has more than 2 cards, draw 2 penalty cards
    if (handLength > 2) {
      console.log(`❌ FALSE UNO CALL: ${player.nickname} has ${handLength} cards, applying 2 card penalty`);
      
      const room = await storage.getRoom(connection.roomId);
      if (!room) return;
      
      let deck = [...(room.deck || [])];
      const penaltyCards: any[] = [];
      
      // Draw 2 cards using pop() to match existing draw logic (LIFO)
      for (let i = 0; i < 2; i++) {
        if (deck.length === 0) {
          // Reshuffle discard pile if deck is empty (keep top card)
          const discardPile = room.discardPile || [];
          if (discardPile.length > 1) {
            const topCard = discardPile.pop();
            deck = UnoGameLogic.shuffleDeck([...discardPile]);
            await storage.updateRoom(connection.roomId, { discardPile: topCard ? [topCard] : [] });
          }
        }
        if (deck.length > 0) {
          penaltyCards.push(deck.pop());
        }
      }
      
      const newHand = [...(player.hand || []), ...penaltyCards];
      
      await storage.updatePlayer(connection.playerId, { hand: newHand });
      await storage.updateRoom(connection.roomId, { deck });
      
      // Broadcast false UNO penalty
      broadcastToRoom(connection.roomId, {
        type: 'false_uno_penalty',
        player: player.nickname,
        cardsDrawn: penaltyCards.length
      });
      
      await broadcastRoomState(connection.roomId);
      return;
    }
    
    // Valid UNO call (1 or 2 cards)
    if (!player.hasCalledUno) {
      await storage.updatePlayer(connection.playerId, { hasCalledUno: true });
      console.log(`✅ UNO CALLED: Set hasCalledUno=true for ${player.nickname}`);
      
      // Verify the update was successful by checking the database
      const verifyPlayer = await storage.getPlayer(connection.playerId);
      console.log(`🔍 UNO CALL VERIFICATION: ${player.nickname} hasCalledUno=${verifyPlayer?.hasCalledUno}`);
      
      // Broadcast UNO call for visual feedback to all players - Enhanced
      console.log(`📢 Broadcasting UNO success to all players in room ${connection.roomId}`);
      broadcastToRoom(connection.roomId!, {
        type: 'uno_called_success',
        player: player.nickname,
        timestamp: Date.now() // Add timestamp for debugging
      });
    } else {
      console.log(`⚠️ UNO ALREADY CALLED: ${player.nickname} has already called UNO`);
    }
  }

  async function handleChooseColor(connection: SocketConnection, message: any) {
    if (!connection.roomId) return;
    
    const { color } = message;
    console.log(`🎨 COLOR CHOICE: Player choosing ${color} for wild card`);
    
    await storage.updateRoom(connection.roomId, { 
      currentColor: color,
      waitingForColorChoice: null // Clear the waiting state
    });
    
    // Broadcast immediate color change notification to ALL players before room state update
    broadcastToRoom(connection.roomId, {
      type: 'color_chosen',
      color: color,
      message: `Active color changed to ${color}`
    });
    
    console.log(`🎨 COLOR UPDATE: Broadcasting color ${color} to all players in room`);
    
    // Broadcast immediate update for color choice (especially after UNO penalties)
    await broadcastRoomState(connection.roomId);
    
    // Additional broadcast after short delay to ensure visual update
    setTimeout(async () => {
      console.log(`🎨 COLOR CHOICE REFRESH: Re-broadcasting color ${color}`);
      await broadcastRoomState(connection.roomId);
    }, 50);
  }

  async function handleSendMessage(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { text } = message;
    await storage.createMessage({
      roomId: connection.roomId,
      playerId: connection.playerId,
      message: text,
      type: "chat"
    });
    
    // Get player info for avatar message display
    const player = await storage.getPlayer(connection.playerId);
    if (player) {
      broadcastToRoom(connection.roomId, {
        type: 'avatar_message',
        content: text,
        contentType: 'chat',
        playerId: connection.playerId,
        playerNickname: player.nickname,
        playerPosition: player.position
      });
    }
    
    await broadcastRoomState(connection.roomId);
  }

  async function handleSendEmoji(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { emoji } = message;
    await storage.createMessage({
      roomId: connection.roomId,
      playerId: connection.playerId,
      emoji,
      type: "emoji"
    });
    
    // Get player info for avatar message display
    const player = await storage.getPlayer(connection.playerId);
    if (player) {
      broadcastToRoom(connection.roomId, {
        type: 'avatar_message',
        content: emoji,
        contentType: 'emoji',
        playerId: connection.playerId,
        playerNickname: player.nickname,
        playerPosition: player.position
      });
    }
    
    broadcastToRoom(connection.roomId, {
      type: 'floating_emoji',
      emoji,
      playerId: connection.playerId
    });
    
    await broadcastRoomState(connection.roomId);
  }

  // Track host disconnection timers - declared before functions that use them
  const hostDisconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  const streamingHostTimers: Map<string, NodeJS.Timeout> = new Map();

  async function handleExitGame(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    
    if (!room || !player) return;
    
    // If game is in progress, save cards to position before player leaves
    if (room.status === "playing" && player.position !== null && player.hand) {
      const updatedPositionHands = { ...room.positionHands };
      updatedPositionHands[player.position.toString()] = player.hand;
      await storage.updateRoom(connection.roomId, { positionHands: updatedPositionHands });
      console.log(`Saved ${player.hand.length} cards for position ${player.position} (player ${player.nickname} leaving)`);
    }
    
    // Count active players before this player exits
    const activePlayersBefore = players.filter(p => !p.isSpectator && !p.hasLeft && p.id !== connection.playerId);
    
    // Check if the exiting player is the host
    const isHost = room.hostId === connection.playerId;
    
    // Mark player as left/spectator
    await storage.updatePlayer(connection.playerId, { 
      hasLeft: true, 
      leftAt: new Date(),
      isSpectator: true,
      position: null,
      hand: [] // Clear hand since cards are saved to positionHands
    });
    
    // If host is leaving and there are other players, handle disconnect
    if (isHost && activePlayersBefore.length > 0) {
      // STREAMING MODE: Simple countdown, no election - redirect all if host doesn't return
      if (room.isStreamingMode) {
        console.log(`[Streaming] Host ${player.nickname} disconnected - starting 30s countdown`);
        
        const deadlineMs = Date.now() + 30000; // 30 seconds from now
        
        await storage.updateRoom(connection.roomId, { 
          hostDisconnectedAt: new Date(),
          hostElectionActive: false // No election in streaming mode
        });
        
        // Notify all players about host disconnect with deadline
        broadcastToRoom(connection.roomId, {
          type: 'streaming_host_disconnected',
          hostName: player.nickname,
          deadlineMs,
          message: `Host ${player.nickname} disconnected. Returning to main page in 30 seconds if host doesn't reconnect...`
        });
        
        // Start 30-second timer - redirect all if host doesn't return
        const roomId = connection.roomId;
        const timer = setTimeout(async () => {
          const currentRoom = await storage.getRoom(roomId);
          if (!currentRoom) return;
          
          // Check if host reconnected
          if (!currentRoom.hostDisconnectedAt) {
            console.log(`[Streaming] Host reconnected, canceling redirect`);
            streamingHostTimers.delete(roomId);
            return;
          }
          
          console.log(`[Streaming] Host timeout - redirecting all players to main page`);
          
          // Broadcast redirect to all players
          broadcastToRoom(roomId, {
            type: 'streaming_host_timeout',
            message: 'Host did not return. Returning to main page...'
          });
          
          // Clean up room - mark as finished
          await storage.updateRoom(roomId, { 
            status: 'finished',
            hostDisconnectedAt: null
          });
          
          streamingHostTimers.delete(roomId);
        }, 30000);
        
        streamingHostTimers.set(roomId, timer);
        
      } else {
        // NORMAL MODE: Start host election with voting during countdown
        console.log(`Host ${player.nickname} is leaving the game - starting host election with voting`);
        
        // Get candidates for voting
        const candidates = [
          ...activePlayersBefore.map(p => ({ id: p.id, nickname: p.nickname })),
          { id: 'NO_HOST', nickname: 'Continue without host' }
        ];
        const eligibleVoterIds = activePlayersBefore.map(p => p.id);
        
        // Record host disconnection time and enable voting during countdown
        // Keep hostId so host can return by clicking their slot or rejoining via link
        await storage.updateRoom(connection.roomId, { 
          hostDisconnectedAt: new Date(),
          hostElectionActive: true,
          hostElectionStartTime: new Date(),
          hostElectionVotes: {},
          hostElectionEligibleVoters: eligibleVoterIds,
          hostPreviousPosition: player.position
        });
        
        // Notify players with candidates - voting is available immediately
        // Host can return by clicking their slot or rejoining via link
        broadcastToRoom(connection.roomId, {
          type: 'host_disconnected_warning',
          hostName: player.nickname,
          hostId: connection.playerId,
          hostPreviousPosition: player.position,
          electionStartsIn: 30,
          candidates,
          eligibleVoterIds,
          canVoteNow: true,
          hostCanReturn: true,
          message: `Host ${player.nickname} left. Vote now or host can return within 30 seconds...`
        });
      
        // Start 30-second timer - when it ends, tally votes (NORMAL MODE ONLY)
        const roomId = connection.roomId;
        const timer = setTimeout(async () => {
        const currentRoom = await storage.getRoom(roomId);
        if (!currentRoom) return;
        
        // Check if a new host was already assigned
        if (currentRoom.hostId) {
          console.log(`Host was assigned during countdown, skipping tally - clearing election state`);
          hostDisconnectTimers.delete(roomId);
          // CRITICAL: Clear election state and notify clients to close voting window
          await storage.updateRoom(roomId, {
            hostDisconnectedAt: null,
            hostElectionActive: false,
            hostElectionVotes: {},
            hostElectionEligibleVoters: []
          });
          broadcastToRoom(roomId, {
            type: 'host_reconnected',
            message: 'Host has returned. Election cancelled.'
          });
          await broadcastRoomState(roomId);
          return;
        }
        
        // Countdown finished - tally votes
        console.log(`Countdown finished in room ${roomId} (host left), tallying votes`);
        
        const currentPlayers = (await storage.getPlayersByRoom(roomId))
          .filter(p => !p.isSpectator && !p.hasLeft);
        
        if (currentPlayers.length === 0) {
          broadcastToRoom(roomId, {
            type: 'host_left_redirect',
            message: 'No players available. Returning to main page...'
          });
          return;
        }
        
        // Tally votes with simplified logic:
        // 1. NO_HOST only wins if ALL players voted for it
        // 2. If any player vote exists and clear winner, give them host
        // 3. If tie or no votes, default to 2nd slot, then 3rd, then 4th
        const votes = currentRoom.hostElectionVotes || {};
        const eligibleVoters = currentRoom.hostElectionEligibleVoters || [];
        const totalVotes = Object.keys(votes).length;
        
        const voteCounts: { [key: string]: number } = {};
        Object.values(votes).forEach((candidateId: any) => {
          voteCounts[candidateId] = (voteCounts[candidateId] || 0) + 1;
        });
        
        console.log(`Election tally: ${totalVotes}/${eligibleVoters.length} voted, votes:`, voteCounts);
        
        // Get default host by position priority: 2nd slot (pos 1), 3rd (pos 2), 4th (pos 3), then 1st (pos 0)
        const getDefaultHost = () => {
          for (const pos of [1, 2, 3, 0]) {
            const player = currentPlayers.find(p => p.position === pos);
            if (player) return player;
          }
          return currentPlayers[0];
        };
        
        // Separate player votes from NO_HOST votes
        const playerVoteCounts: { [key: string]: number } = {};
        let noHostVotes = 0;
        for (const [candidateId, count] of Object.entries(voteCounts)) {
          if (candidateId === 'NO_HOST') {
            noHostVotes = count;
          } else {
            playerVoteCounts[candidateId] = count;
          }
        }
        
        // Check if ALL players voted for NO_HOST
        const allVotedNoHost = noHostVotes === eligibleVoters.length && eligibleVoters.length > 0;
        
        // Find highest voted player (excluding NO_HOST)
        let highestPlayerVotes = 0;
        let highestVotedPlayerId: string | null = null;
        let isTie = false;
        for (const [playerId, count] of Object.entries(playerVoteCounts)) {
          if (count > highestPlayerVotes) {
            highestPlayerVotes = count;
            highestVotedPlayerId = playerId;
            isTie = false;
          } else if (count === highestPlayerVotes && count > 0) {
            isTie = true;
          }
        }
        
        let winnerId: string | null = null;
        
        // Rule 1: NO_HOST only wins if ALL players voted for it
        if (allVotedNoHost) {
          winnerId = 'NO_HOST';
          console.log(`All players voted for NO_HOST: ${noHostVotes} votes`);
        }
        // Rule 2: If any player vote exists and clear winner, give them host
        else if (highestVotedPlayerId && !isTie) {
          winnerId = highestVotedPlayerId;
          console.log(`Highest voted player: ${winnerId} with ${highestPlayerVotes} votes`);
        }
        // Rule 3: Tie or no votes - default to position 2nd, 3rd, 4th
        else {
          const defaultHost = getDefaultHost();
          if (defaultHost) {
            winnerId = defaultHost.id;
            console.log(`Using position-based fallback: ${defaultHost.nickname} (position ${defaultHost.position})`);
          }
        }
        
        if (!winnerId) return;
        
        // Handle "Continue without host" option - only if ALL players voted for it
        if (winnerId === 'NO_HOST') {
          await storage.updateRoom(roomId, {
            hostId: null,
            noHostMode: true,
            hostElectionActive: false,
            hostElectionStartTime: null,
            hostElectionVotes: {},
            hostElectionEligibleVoters: [],
            hostDisconnectedAt: null
          });
          
          broadcastToRoom(roomId, {
            type: 'no_host_mode_enabled',
            message: 'Game will continue without a host.'
          });
          
          await broadcastRoomState(roomId);
          hostDisconnectTimers.delete(roomId);
          return;
        }
        
        // Assign winner as new host
        const winner = currentPlayers.find(p => p.id === winnerId);
        if (winner) {
          await storage.updateRoom(roomId, { 
            hostId: winner.id,
            hostElectionActive: false,
            hostElectionStartTime: null,
            hostElectionVotes: {},
            hostElectionEligibleVoters: [],
            hostDisconnectedAt: null
          });
          
          broadcastToRoom(roomId, {
            type: 'host_elected',
            newHostId: winner.id,
            newHostName: winner.nickname,
            message: `${winner.nickname} is now the host!`
          });
          
          await broadcastRoomState(roomId);
        }
        
        hostDisconnectTimers.delete(roomId);
      }, 30000); // 30 seconds
      
      hostDisconnectTimers.set(connection.roomId, timer);
      } // Close else block (normal mode)
    } // Close if (isHost && activePlayersBefore.length > 0)
    
    // If game is in progress
    if (room.status === "playing") {
      // Set exiting player's finish position as last
      const finishPosition = activePlayersBefore.length + 1;
      await storage.updatePlayer(connection.playerId, { finishPosition });
      
      // Check if only 1 player remains (2-player game scenario)
      if (activePlayersBefore.length === 1) {
        const winner = activePlayersBefore[0];
        
        // Set winner's finish position
        await storage.updatePlayer(winner.id, { finishPosition: 1 });
        
        // End the game
        await storage.updateRoom(connection.roomId, { 
          status: "finished",
          winner: winner.nickname,
          rankings: [
            { nickname: winner.nickname, position: 1, hasLeft: false },
            { nickname: player.nickname, position: 2, hasLeft: true }
          ]
        });
        
        // Broadcast game end with winner
        const gameEndMessage = {
          type: 'game_end',
          winner: winner.nickname,
          rankings: [
            { nickname: winner.nickname, position: 1, hasLeft: false },
            { nickname: player.nickname, position: 2, hasLeft: true }
          ]
        };
        
        console.log(`🏆 Player ${player.nickname} exited - ${winner.nickname} wins by default!`);
        broadcastToRoom(connection.roomId, gameEndMessage);
        
        // Delayed re-broadcast for reconnecting players
        setTimeout(() => {
          broadcastToRoom(connection.roomId, gameEndMessage);
        }, 2000);
      } else {
        // More than 1 player remains - pause game for host to continue
        await storage.updateRoom(connection.roomId, { status: "paused" });
        
        broadcastToRoom(connection.roomId, {
          type: 'player_left',
          player: player.nickname,
          needsContinue: true,
          vacantPosition: player.position
        });
      }
    }
    
    await broadcastRoomState(connection.roomId);
  }

  async function handleKickPlayer(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { targetPlayerId } = message;
    const room = await storage.getRoom(connection.roomId);
    const hostPlayer = await storage.getPlayer(connection.playerId);
    const targetPlayer = await storage.getPlayer(targetPlayerId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    
    if (!room || !hostPlayer || !targetPlayer) return;
    
    // Only host can kick players
    if (room.hostId !== connection.playerId) return;
    
    console.log(`WebSocket kick: Converting player ${targetPlayerId} (${targetPlayer.nickname}) to spectator`);
    
    // Before kicking, update position hands with current cards
    if (targetPlayer.position !== null && room.positionHands) {
      const updatedPositionHands = { ...room.positionHands };
      updatedPositionHands[targetPlayer.position.toString()] = targetPlayer.hand || [];
      await storage.updateRoom(connection.roomId, { positionHands: updatedPositionHands });
      console.log(`Saved ${(targetPlayer.hand || []).length} cards for position ${targetPlayer.position}`);
    }
    
    // Convert target player to spectator
    await storage.updatePlayer(targetPlayerId, { 
      hasLeft: false, // Keep as false so they remain visible as spectator
      leftAt: null,   // Don't set left time
      isSpectator: true,
      position: null,
      hand: [], // Clear active hand since they're spectator
      hasCalledUno: false,
      finishPosition: null
    });
    
    // Verify the update worked
    const updatedPlayer = await storage.getPlayer(targetPlayerId);
    console.log(`Player after WebSocket kick update:`, {
      id: updatedPlayer?.id,
      nickname: updatedPlayer?.nickname,
      isSpectator: updatedPlayer?.isSpectator,
      hasLeft: updatedPlayer?.hasLeft,
      position: updatedPlayer?.position
    });
    
    // If game is playing, pause it
    if (room.status === "playing") {
      await storage.updateRoom(connection.roomId, { status: "paused" });
      
      // No notification message - silent kick
      
      broadcastToRoom(connection.roomId, {
        type: 'game_paused',
        reason: 'Game paused',
        needsHostAction: true
      });
    }
    // No notification message for lobby kicks either
    
    // Don't send kick message - just let room state update handle it
    // The player will see they became a spectator through the room state broadcast
    
    await broadcastRoomState(connection.roomId);
  }

  async function handleContinueGame(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    
    if (!room || room.hostId !== connection.playerId) return;
    
    const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
    
    if (activePlayers.length >= 2) {
      // Ensure proper player positions and game state
      const sortedPlayers = activePlayers.sort((a, b) => (a.position || 0) - (b.position || 0));
      
      // Update current player index to match active players
      let currentPlayerIndex = room.currentPlayerIndex || 0;
      
      // Make sure currentPlayerIndex points to an active player
      while (currentPlayerIndex < sortedPlayers.length) {
        const currentPlayer = sortedPlayers[currentPlayerIndex];
        if (currentPlayer && !currentPlayer.hasLeft && !currentPlayer.isSpectator) {
          break;
        }
        currentPlayerIndex = (currentPlayerIndex + 1) % sortedPlayers.length;
      }
      
      await storage.updateRoom(connection.roomId, { 
        status: "playing",
        currentPlayerIndex: currentPlayerIndex
      });
      
      // Removed system message as requested by user
      
      broadcastToRoom(connection.roomId, {
        type: 'game_continued'
      });
    }
    
    await broadcastRoomState(connection.roomId);
  }

  async function handleAssignSpectator(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { spectatorId, position } = message;
    const room = await storage.getRoom(connection.roomId);
    const hostPlayer = await storage.getPlayer(connection.playerId);
    const spectator = await storage.getPlayer(spectatorId);
    
    if (!room || !hostPlayer || !spectator) return;
    
    // Only host can assign spectators
    if (room.hostId !== connection.playerId) return;
    
    console.log(`WebSocket assign spectator: ${spectator.nickname} to position ${position}`);
    
    // CRITICAL: Handle complex player state scenarios (kick/rejoin/duplicate handling)
    const roomPlayers = await storage.getPlayersByRoom(connection.roomId);
    
    // Clean up any duplicate spectator entries for the same nickname
    const duplicateSpectators = roomPlayers.filter(p => 
      p.nickname.toLowerCase() === spectator.nickname.toLowerCase() && 
      p.id !== spectator.id && 
      p.isSpectator
    );
    
    for (const duplicate of duplicateSpectators) {
      console.log(`Cleaning up duplicate spectator entry: ${duplicate.id} (${duplicate.nickname})`);
      await storage.deletePlayer(duplicate.id);
    }
    
    // Re-fetch players after cleanup
    const cleanedPlayers = await storage.getPlayersByRoom(connection.roomId);
    
    // Check if position is available (exclude left players and spectators)
    const positionTaken = cleanedPlayers.some(p => 
      p.position === position && 
      !p.isSpectator && 
      !p.hasLeft
    );
    
    if (positionTaken) {
      console.log(`Position ${position} already taken`);
      return;
    }
    
    // Convert spectator to player at specified position
    // Initialize empty hand - will be populated when game starts via startGame
    await storage.updatePlayer(spectatorId, {
      isSpectator: false,
      position: position,
      hasLeft: false,
      leftAt: null,
      finishPosition: null,
      hand: [], // Initialize empty hand for the assigned player
      hasCalledUno: false
    });
    
    // If game is already in progress, give the assigned player cards from positionHands or deal new ones
    if (room.status === "playing" || room.status === "paused") {
      let newHand: Card[] = [];
      
      // Check if there are saved cards for this position
      if (room.positionHands && room.positionHands[position.toString()]) {
        newHand = room.positionHands[position.toString()];
        console.log(`🃏 Restoring ${newHand.length} saved cards for assigned spectator at position ${position}`);
      } else if (room.deck && room.deck.length >= 7) {
        // Deal 7 new cards from the deck
        newHand = room.deck.slice(0, 7);
        const updatedDeck = room.deck.slice(7);
        
        // Update room deck and save cards for this position
        const updatedPositionHands = { ...(room.positionHands || {}), [position.toString()]: newHand };
        await storage.updateRoom(connection.roomId, {
          deck: updatedDeck,
          positionHands: updatedPositionHands
        });
        console.log(`🃏 Dealt 7 new cards for assigned spectator at position ${position}`);
      }
      
      // Update the player with their hand
      if (newHand.length > 0) {
        await storage.updatePlayer(spectatorId, { hand: newHand });
      }
      
      // Also add this position to activePositions if not already there
      const currentActivePositions = room.activePositions || [];
      if (!currentActivePositions.includes(position)) {
        const updatedActivePositions = [...currentActivePositions, position].sort((a, b) => a - b);
        await storage.updateRoom(connection.roomId, { activePositions: updatedActivePositions });
        console.log(`📍 Added position ${position} to activePositions: [${updatedActivePositions.join(', ')}]`);
      }
    }
    
    console.log(`✅ WebSocket assigned spectator ${spectator.nickname} to position ${position}`);
    await broadcastRoomState(connection.roomId);
  }

  async function handleReplacePlayer(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { position } = message;
    const room = await storage.getRoom(connection.roomId);
    const playerToReplace = await storage.getPlayer(connection.playerId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    
    if (!room || !playerToReplace) return;
    
    // Allow both spectators and kicked players (who are now spectators) to rejoin
    if (!playerToReplace.isSpectator && !playerToReplace.hasLeft) return;
    
    // Check if position is already taken by an active player
    const activePlayerAtPosition = players.find(p => p.position === position && !p.isSpectator && !p.hasLeft);
    
    if (activePlayerAtPosition) {
      console.log(`Position ${position} is already taken by active player ${activePlayerAtPosition.nickname}`);
      return; // Position is occupied by an active player
    }
    
    // During active games, only allow rejoining originally active positions
    if (room.status === "playing" || room.status === "paused") {
      const originalActivePositions = room.activePositions || [];
      if (!originalActivePositions.includes(position)) {
        console.log(`Position ${position} was not active when game started. Originally active: [${originalActivePositions.join(', ')}]`);
        return; // Position was not active when game started, cannot join
      }
    }
    
    // Get cards for this position - either from positionHands or deal new ones
    let newHand: Card[] = [];
    if (room.positionHands && room.positionHands[position.toString()]) {
      // Use cards assigned to this position when game started or when last player left
      newHand = room.positionHands[position.toString()];
      console.log(`Restoring ${newHand.length} position cards to ${playerToReplace.nickname} joining position ${position}`);
    } else if (room.status === "playing" && room.deck && room.deck.length > 0) {
      // Deal 7 cards for new position in active game
      const cardsNeeded = Math.min(7, room.deck.length);
      newHand = room.deck.slice(0, cardsNeeded);
      const updatedDeck = room.deck.slice(cardsNeeded);
      
      // Update room deck and save cards for this position
      const updatedPositionHands = { ...room.positionHands, [position.toString()]: newHand };
      await storage.updateRoom(connection.roomId, { 
        deck: updatedDeck,
        positionHands: updatedPositionHands
      });
      
      console.log(`Dealing ${cardsNeeded} new cards to ${playerToReplace.nickname} for new position ${position}`);
    }
    
    // Join position with position-specific cards
    await storage.updatePlayer(connection.playerId, {
      isSpectator: false,
      position: position,
      hand: newHand, // Use position-specific cards
      hasLeft: false,
      leftAt: null,
      hasCalledUno: false,
      finishPosition: null
    });
    
    console.log(`${playerToReplace.nickname} joined position ${position} with ${newHand.length} cards`);
    
    // Check if this player was the former host returning during countdown
    // If host election is active and no host assigned, check if we should restore host status
    if (room.hostElectionActive && !room.hostId && room.hostDisconnectedAt) {
      // This player is returning during the countdown - make them host again
      const timer = hostDisconnectTimers.get(connection.roomId);
      if (timer) {
        clearTimeout(timer);
        hostDisconnectTimers.delete(connection.roomId);
        console.log(`Former host ${playerToReplace.nickname} returned during countdown, restoring host status`);
      }
      
      // Restore host status and clear election state
      await storage.updateRoom(connection.roomId, {
        hostId: connection.playerId,
        hostElectionActive: false,
        hostElectionStartTime: null,
        hostElectionVotes: {},
        hostElectionEligibleVoters: [],
        hostDisconnectedAt: null
      });
      
      // Notify all players
      broadcastToRoom(connection.roomId, {
        type: 'host_reconnected',
        hostId: connection.playerId,
        hostName: playerToReplace.nickname,
        message: `${playerToReplace.nickname} has returned as host!`
      });
    }
    
    // Removed system message as requested by user
    
    broadcastToRoom(connection.roomId, {
      type: 'spectator_joined',
      player: playerToReplace.nickname,
      position: position
    });
    
    await broadcastRoomState(connection.roomId);

  }

  async function handleSubmitHostVote(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { candidateId } = message;
    if (!candidateId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const voter = await storage.getPlayer(connection.playerId);
    
    if (!room || !voter || !room.hostElectionActive) {
      console.log('Vote rejected: no active election');
      return;
    }
    
    // Use snapshotted eligible voters from when election started
    const eligibleVoterIds = room.hostElectionEligibleVoters || [];
    
    // Only allow votes from snapshotted eligible voters
    if (!eligibleVoterIds.includes(connection.playerId)) {
      console.log(`Vote rejected: ${voter.nickname} not in eligible voter list`);
      return;
    }
    
    // Prevent double voting
    if (room.hostElectionVotes && room.hostElectionVotes[connection.playerId]) {
      console.log(`Vote rejected: ${voter.nickname} already voted`);
      return;
    }
    
    // Record vote
    const votes = { ...room.hostElectionVotes, [connection.playerId]: candidateId };
    await storage.updateRoom(connection.roomId, { hostElectionVotes: votes });
    
    console.log(`Vote recorded: ${voter.nickname} voted for ${candidateId}`);
    
    // Count votes - only count votes from eligible voters
    const voteCounts: { [candidateId: string]: number } = {};
    Object.entries(votes).forEach(([voterId, cId]: [string, any]) => {
      if (eligibleVoterIds.includes(voterId)) {
        voteCounts[cId] = (voteCounts[cId] || 0) + 1;
      }
    });
    
    // Get players for display purposes
    const players = await storage.getPlayersByRoom(connection.roomId);
    const eligibleVoters = players.filter(p => eligibleVoterIds.includes(p.id));
    
    // Broadcast vote update
    broadcastToRoom(connection.roomId, {
      type: 'host_vote_update',
      votes: voteCounts,
      totalVoters: eligibleVoterIds.length,
      votesSubmitted: Object.keys(votes).filter(vid => eligibleVoterIds.includes(vid)).length
    });
    
    // Check if all eligible votes are in
    const validVoteCount = Object.keys(votes).filter(vid => eligibleVoterIds.includes(vid)).length;
    if (validVoteCount >= eligibleVoterIds.length) {
      await finalizeHostElection(connection.roomId, votes, eligibleVoters, eligibleVoterIds);
    }
  }
  
  async function finalizeHostElection(roomId: string, votes: { [voterId: string]: string }, eligibleVoters: any[], eligibleVoterIds: string[]) {
    // Count votes - only count from eligible voters
    const voteCounts: { [candidateId: string]: number } = {};
    Object.entries(votes).forEach(([voterId, candidateId]: [string, string]) => {
      if (eligibleVoterIds.includes(voterId)) {
        voteCounts[candidateId] = (voteCounts[candidateId] || 0) + 1;
      }
    });
    
    // Find winner (highest votes)
    let maxVotes = 0;
    let winnerId: string | null = null;
    Object.entries(voteCounts).forEach(([candidateId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        winnerId = candidateId;
      }
    });
    
    // Handle tie by picking first candidate in list (not NO_HOST)
    if (!winnerId && eligibleVoters.length > 0) {
      winnerId = eligibleVoters[0].id;
    }
    
    if (!winnerId) return;
    
    // Handle "Continue without host" option
    if (winnerId === 'NO_HOST') {
      // Clear election state and set hostId to null
      await storage.updateRoom(roomId, {
        hostId: null,
        hostElectionActive: false,
        hostElectionStartTime: null,
        hostElectionVotes: {},
        hostElectionEligibleVoters: [],
        hostDisconnectedAt: null
      });
      
      console.log(`Host election complete: Players chose to continue without host`);
      
      // Broadcast result
      broadcastToRoom(roomId, {
        type: 'host_elected',
        newHostId: null,
        newHostName: 'No host selected',
        noHost: true,
        voteCounts,
        message: 'Game continues without a host!'
      });
      
      await broadcastRoomState(roomId);
      return;
    }
    
    const newHost = await storage.getPlayer(winnerId);
    if (!newHost) return;
    
    // Update room with new host - clear all election state
    await storage.updateRoom(roomId, {
      hostId: winnerId,
      hostElectionActive: false,
      hostElectionStartTime: null,
      hostElectionVotes: {},
      hostElectionEligibleVoters: [],
      hostDisconnectedAt: null
    });
    
    console.log(`Host election complete: ${newHost.nickname} is the new host`);
    
    // Broadcast election result
    broadcastToRoom(roomId, {
      type: 'host_elected',
      newHostId: winnerId,
      newHostName: newHost.nickname,
      voteCounts,
      message: `${newHost.nickname} is now the host!`
    });
    
    await broadcastRoomState(roomId);
  }

  // Handle host manually assigning a new host by clicking on player avatar
  async function handleAssignHost(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { targetPlayerId } = message;
    const room = await storage.getRoom(connection.roomId);
    const currentHost = await storage.getPlayer(connection.playerId);
    const newHost = await storage.getPlayer(targetPlayerId);
    
    if (!room || !currentHost || !newHost) return;
    
    // Only host can assign a new host
    if (room.hostId !== connection.playerId) {
      console.log('Non-host tried to assign host');
      return;
    }
    
    // Can't assign to spectator or left player
    if (newHost.isSpectator || newHost.hasLeft) {
      console.log('Cannot assign host to spectator or left player');
      return;
    }
    
    // Can't assign to self
    if (targetPlayerId === connection.playerId) {
      console.log('Cannot assign host to self');
      return;
    }
    
    console.log(`Host ${currentHost.nickname} manually assigned ${newHost.nickname} as new host`);
    
    // Cancel any pending host election timer
    const timer = hostDisconnectTimers.get(connection.roomId);
    if (timer) {
      clearTimeout(timer);
      hostDisconnectTimers.delete(connection.roomId);
    }
    
    // Update room with new host
    await storage.updateRoom(connection.roomId, { 
      hostId: targetPlayerId,
      hostDisconnectedAt: null,
      hostElectionActive: false,
      hostElectionVotes: {},
      hostElectionEligibleVoters: []
    });
    
    // Broadcast the host change
    broadcastToRoom(connection.roomId, {
      type: 'host_assigned',
      previousHostId: connection.playerId,
      previousHostName: currentHost.nickname,
      newHostId: targetPlayerId,
      newHostName: newHost.nickname,
      message: `${currentHost.nickname} assigned ${newHost.nickname} as the new host!`
    });
    
    await broadcastRoomState(connection.roomId);
  }

  // Handle host clicking "End Game" during gameplay - shows 30-second countdown then voting
  async function handleHostEndGame(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    
    if (!room || !player) return;
    
    // Only host can trigger this
    if (room.hostId !== connection.playerId) {
      console.log('Non-host tried to use host_end_game');
      return;
    }
    
    // Only during gameplay
    if (room.status !== 'playing') return;
    
    // Save host's cards to position before they leave
    if (player.position !== null && player.hand) {
      const updatedPositionHands = { ...room.positionHands };
      updatedPositionHands[player.position.toString()] = player.hand;
      await storage.updateRoom(connection.roomId, { positionHands: updatedPositionHands });
    }
    
    // Mark host as spectator and remove host status
    await storage.updatePlayer(connection.playerId, { 
      hasLeft: true, 
      leftAt: new Date(),
      isSpectator: true,
      position: null,
      hand: []
    });
    
    // Get remaining active players
    const players = await storage.getPlayersByRoom(connection.roomId);
    const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
    
    if (activePlayers.length === 0) {
      // No players left, end game
      await storage.updateRoom(connection.roomId, { hostId: null });
      broadcastToRoom(connection.roomId, {
        type: 'host_left_redirect',
        message: 'No players remaining. Returning to main page...'
      });
      return;
    }
    
    if (activePlayers.length === 1) {
      // Auto-assign as host
      const newHost = activePlayers[0];
      await storage.updateRoom(connection.roomId, { 
        hostId: newHost.id,
        hostDisconnectedAt: null,
        hostElectionActive: false
      });
      broadcastToRoom(connection.roomId, {
        type: 'host_elected',
        newHostId: newHost.id,
        newHostName: newHost.nickname,
        message: `${newHost.nickname} is now the host!`
      });
      await broadcastRoomState(connection.roomId);
      return;
    }
    
    // Multiple players - show 30-second countdown with voting enabled immediately
    const eligibleVoterIds = activePlayers.map(p => p.id);
    
    // Add "Continue without host" option
    const candidates = [
      ...activePlayers.map(p => ({ id: p.id, nickname: p.nickname })),
      { id: 'NO_HOST', nickname: 'Continue without host' }
    ];
    
    // Record host disconnection and enable voting during countdown
    // CRITICAL: Clear hostId so timer knows no new host has been elected yet
    // Store old host ID in hostPreviousId so we can track if they return
    await storage.updateRoom(connection.roomId, { 
      hostId: null,
      hostPreviousId: connection.playerId,
      hostDisconnectedAt: new Date(),
      hostElectionActive: true,
      hostElectionStartTime: new Date(),
      hostElectionVotes: {},
      hostElectionEligibleVoters: eligibleVoterIds,
      hostPreviousPosition: player.position
    });
    
    // Notify players with candidates - voting is available immediately
    // Host can return by clicking their slot or rejoining via link
    broadcastToRoom(connection.roomId, {
      type: 'host_disconnected_warning',
      hostName: player.nickname,
      hostId: connection.playerId,
      hostPreviousPosition: player.position,
      electionStartsIn: 30,
      candidates,
      eligibleVoterIds,
      canVoteNow: true,
      hostCanReturn: true,
      message: `Host ${player.nickname} ended the game. Vote now or host can return within 30 seconds...`
    });
    
    await broadcastRoomState(connection.roomId);
    
    // Start 30-second timer - when it ends, tally votes
    const roomId = connection.roomId;
    const timer = setTimeout(async () => {
      const currentRoom = await storage.getRoom(roomId);
      if (!currentRoom) return;
      
      // Check if a new host was already assigned (manually or via unanimous vote)
      if (currentRoom.hostId) {
        console.log(`Host was assigned during countdown, skipping tally - clearing election state`);
        hostDisconnectTimers.delete(roomId);
        // CRITICAL: Clear election state and notify clients to close voting window
        await storage.updateRoom(roomId, {
          hostDisconnectedAt: null,
          hostElectionActive: false,
          hostElectionVotes: {},
          hostElectionEligibleVoters: []
        });
        broadcastToRoom(roomId, {
          type: 'host_reconnected',
          message: 'Host has returned. Election cancelled.'
        });
        await broadcastRoomState(roomId);
        return;
      }
      
      // Countdown finished - tally votes and determine winner
      console.log(`Countdown finished in room ${roomId}, tallying votes`);
      
      const currentPlayers = (await storage.getPlayersByRoom(roomId))
        .filter(p => !p.isSpectator && !p.hasLeft);
      
      if (currentPlayers.length === 0) {
        broadcastToRoom(roomId, {
          type: 'host_left_redirect',
          message: 'No players available. Returning to main page...'
        });
        return;
      }
      
      // Tally the votes with correct logic:
      // 1. NO_HOST only wins if ALL eligible voters voted for it
      // 2. If any player got votes and clear winner, they become host
      // 3. If tie or no votes, default to 2nd slot, then 3rd, then 4th
      const votes = currentRoom.hostElectionVotes || {};
      const eligibleVoters = currentRoom.hostElectionEligibleVoters || [];
      
      // Separate player votes from NO_HOST votes
      const playerVotes: { [key: string]: number } = {};
      let noHostVotes = 0;
      Object.values(votes).forEach((candidateId: any) => {
        if (candidateId === 'NO_HOST') {
          noHostVotes++;
        } else {
          playerVotes[candidateId] = (playerVotes[candidateId] || 0) + 1;
        }
      });
      
      console.log(`Vote tally: playerVotes=${JSON.stringify(playerVotes)}, noHostVotes=${noHostVotes}, eligible=${eligibleVoters.length}`);
      
      // Check if ALL players voted for NO_HOST
      const allVotedNoHost = noHostVotes === eligibleVoters.length && eligibleVoters.length > 0;
      
      // Find highest voted player
      let highestVotedPlayerId: string | null = null;
      let highestVotes = 0;
      let isTie = false;
      for (const [playerId, count] of Object.entries(playerVotes)) {
        if (count > highestVotes) {
          highestVotes = count;
          highestVotedPlayerId = playerId;
          isTie = false;
        } else if (count === highestVotes && count > 0) {
          isTie = true;
        }
      }
      
      // Position-based fallback: 2nd slot (pos 1), 3rd (pos 2), 4th (pos 3), then 1st (pos 0)
      const getDefaultHost = () => {
        for (const pos of [1, 2, 3, 0]) {
          const player = currentPlayers.find(p => p.position === pos);
          if (player) return player;
        }
        return currentPlayers[0];
      };
      
      let winnerId: string | null = null;
      
      // Rule 1: NO_HOST only wins if ALL players voted for it
      if (allVotedNoHost) {
        winnerId = 'NO_HOST';
        console.log(`All players voted for NO_HOST - enabling no host mode`);
      }
      // Rule 2: If any player got votes and clear winner, they become host
      else if (highestVotedPlayerId && !isTie) {
        winnerId = highestVotedPlayerId;
        console.log(`Highest voted player wins: ${winnerId} with ${highestVotes} votes`);
      }
      // Rule 3: Tie or no votes - default to position 2nd, 3rd, 4th
      else {
        const defaultHost = getDefaultHost();
        if (defaultHost) {
          winnerId = defaultHost.id;
          console.log(`Using position-based fallback: ${defaultHost.nickname} (position ${defaultHost.position})`);
        }
      }
      
      if (!winnerId) return;
      
      // Handle "Continue without host" option
      if (winnerId === 'NO_HOST') {
        await storage.updateRoom(roomId, {
          hostId: null,
          noHostMode: true,
          hostElectionActive: false,
          hostElectionStartTime: null,
          hostElectionVotes: {},
          hostElectionEligibleVoters: [],
          hostDisconnectedAt: null
        });
        
        broadcastToRoom(roomId, {
          type: 'no_host_mode_enabled',
          message: 'Game will continue without a host. When game ends, a new room will be created.'
        });
        
        await broadcastRoomState(roomId);
        hostDisconnectTimers.delete(roomId);
        return;
      }
      
      // Assign winner as new host
      const winner = currentPlayers.find(p => p.id === winnerId);
      if (winner) {
        await storage.updateRoom(roomId, { 
          hostId: winner.id,
          hostElectionActive: false,
          hostElectionStartTime: null,
          hostElectionVotes: {},
          hostElectionEligibleVoters: [],
          hostDisconnectedAt: null
        });
        
        broadcastToRoom(roomId, {
          type: 'host_elected',
          newHostId: winner.id,
          newHostName: winner.nickname,
          message: `${winner.nickname} is now the host!`
        });
        
        await broadcastRoomState(roomId);
      }
      
      hostDisconnectTimers.delete(roomId);
    }, 30000); // 30 seconds
    
    hostDisconnectTimers.set(connection.roomId, timer);
  }

  // Handle host clicking "Exit" in lobby/finished state - closes room for everyone
  async function handleHostExitRoom(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    
    if (!room || !player) return;
    
    // Only host can trigger this
    if (room.hostId !== connection.playerId) {
      console.log('Non-host tried to use host_exit_room');
      return;
    }
    
    console.log(`Host ${player.nickname} exiting room - closing for everyone`);
    
    // Clear host flags before broadcasting
    await storage.updateRoom(connection.roomId, { hostId: null });
    await storage.updatePlayer(connection.playerId, { isHost: false });
    
    // Notify all players to redirect
    broadcastToRoom(connection.roomId, {
      type: 'host_left_redirect',
      message: 'Host has closed the room. Returning to main page...'
    });
    
    // Clean up room after brief delay
    setTimeout(async () => {
      try {
        await storage.deleteRoom(connection.roomId!);
        console.log(`Room ${connection.roomId} cleaned up after host exit`);
      } catch (error) {
        console.error('Failed to clean up room:', error);
      }
    }, 2000);
  }

  async function handlePlayAgain(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    
    if (!room || !player) return;
    
    // Only allow play again if game is finished
    if (room.status !== "finished") return;
    
    // If noHostMode is enabled, create a new room instead of returning to lobby
    if (room.noHostMode) {
      console.log('noHostMode enabled - creating new room instead of returning to lobby');
      
      // Generate new room code
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create new room with same settings
      const newRoom = await storage.createRoom({
        code: newCode,
        hostId: player.id, // First player to click becomes host
        status: "waiting",
        maxPlayers: room.maxPlayers,
        currentPlayerIndex: 0,
        direction: "clockwise",
        currentColor: null,
        deck: [],
        discardPile: [],
        pendingDraw: 0,
        positionHands: {},
        activePositions: [],
        noHostMode: false // Reset for new room
      });
      
      // Notify all players to redirect to new room
      broadcastToRoom(connection.roomId, {
        type: 'new_room_created',
        newRoomCode: newCode,
        newRoomId: newRoom.id,
        message: `New game room created! Redirecting to room ${newCode}...`
      });
      
      return;
    }
    
    // Normal flow - reset room to waiting state (return to lobby)
    await storage.updateRoom(connection.roomId, {
      status: "waiting",
      currentPlayerIndex: 0,
      currentColor: null,
      pendingDraw: 0,
      direction: "clockwise",
      deck: [],
      discardPile: [],
      noHostMode: false // Reset noHostMode
    });
    
    // Reset all players' game state but keep them in the room
    const players = await storage.getPlayersByRoom(connection.roomId);
    for (const p of players) {
      await storage.updatePlayer(p.id, {
        hand: [],
        hasCalledUno: false,
        finishPosition: null // Clear finish positions for new game
      });
    }
    
    // Removed system message as requested by user
    
    // Broadcast updated room state
    broadcastToRoom(connection.roomId, {
      type: 'room_reset'
    });
    
    await broadcastRoomState(connection.roomId);
  }

  async function handlePlayerDisconnect(playerId: string, roomId: string) {
    const room = await storage.getRoom(roomId);
    const players = await storage.getPlayersByRoom(roomId);
    const disconnectedPlayer = await storage.getPlayer(playerId);
    
    if (!room || !disconnectedPlayer) return;
    
    // Mark player as offline
    await storage.updatePlayer(playerId, { 
      socketId: null
    });
    
    // Check if the disconnected player is the host
    const isHost = room.hostId === playerId;
    
    if (isHost) {
      console.log(`Host ${disconnectedPlayer.nickname} disconnected from room ${roomId}`);
      
      // If the room is finished (after game end, during play again flow), redirect all players
      if (room.status === "finished") {
        console.log('Host left during play again flow - redirecting all players to main page');
        broadcastToRoom(roomId, {
          type: 'host_left_redirect',
          message: 'Host has left the game. Redirecting to main page...'
        });
        
        setTimeout(async () => {
          try {
            await storage.deleteRoom(roomId);
            console.log(`Room ${roomId} cleaned up after host departure`);
          } catch (error) {
            console.error('Failed to clean up room:', error);
          }
        }, 2000);
        
        return;
      }
      
      // STREAMING MODE: Simple countdown, no election - redirect all if host doesn't return
      if (room.isStreamingMode) {
        console.log(`[Streaming] Host ${disconnectedPlayer.nickname} disconnected - starting 30s countdown`);
        
        const deadlineMs = Date.now() + 30000; // 30 seconds from now
        
        await storage.updateRoom(roomId, { 
          hostDisconnectedAt: new Date(),
          hostElectionActive: false // No election in streaming mode
        });
        
        // Notify all players about host disconnect with deadline
        broadcastToRoom(roomId, {
          type: 'streaming_host_disconnected',
          hostName: disconnectedPlayer.nickname,
          deadlineMs,
          message: `Host ${disconnectedPlayer.nickname} disconnected. Returning to main page in 30 seconds if host doesn't reconnect...`
        });
        
        // Start 30-second timer - redirect all if host doesn't return
        const timer = setTimeout(async () => {
          const currentRoom = await storage.getRoom(roomId);
          if (!currentRoom) return;
          
          // Check if host reconnected
          if (!currentRoom.hostDisconnectedAt) {
            console.log(`[Streaming] Host reconnected, canceling redirect`);
            streamingHostTimers.delete(roomId);
            return;
          }
          
          console.log(`[Streaming] Host timeout - redirecting all players to main page`);
          
          // Broadcast redirect to all players
          broadcastToRoom(roomId, {
            type: 'streaming_host_timeout',
            message: 'Host did not return. Returning to main page...'
          });
          
          // Clean up room - mark as finished
          await storage.updateRoom(roomId, { 
            status: 'finished',
            hostDisconnectedAt: null
          });
          
          streamingHostTimers.delete(roomId);
        }, 30000);
        
        streamingHostTimers.set(roomId, timer);
        await broadcastRoomState(roomId);
        return;
      }
      
      // NORMAL MODE: Get candidates for voting
      const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft && p.id !== playerId);
      const candidates = [
        ...activePlayers.map(p => ({ id: p.id, nickname: p.nickname })),
        { id: 'NO_HOST', nickname: 'Continue without host' }
      ];
      const eligibleVoterIds = activePlayers.map(p => p.id);
      
      // Record host disconnection time and enable voting during countdown
      await storage.updateRoom(roomId, { 
        hostDisconnectedAt: new Date(),
        hostElectionActive: true,
        hostElectionStartTime: new Date(),
        hostElectionVotes: {},
        hostElectionEligibleVoters: eligibleVoterIds
      });
      
      // Notify players with candidates - voting is available immediately
      // Note: For unexpected disconnects, host can return and reclaim their role
      broadcastToRoom(roomId, {
        type: 'host_disconnected_warning',
        hostName: disconnectedPlayer.nickname,
        electionStartsIn: 30,
        candidates,
        eligibleVoterIds,
        canVoteNow: true,
        hostCanReturn: true,
        message: `Host ${disconnectedPlayer.nickname} disconnected. Vote now or host can return within 30 seconds...`
      });
      
      // Start 30-second timer - when it ends, tally votes
      const timer = setTimeout(async () => {
        const currentRoom = await storage.getRoom(roomId);
        if (!currentRoom) return;
        
        // Check if host reconnected
        const hostHasActiveConnection = Array.from(connections.values())
          .some(conn => conn.playerId === playerId && conn.ws.readyState === WebSocket.OPEN);
        
        if (hostHasActiveConnection) {
          // Host reconnected, cancel election
          console.log(`Host ${disconnectedPlayer.nickname} reconnected, canceling election`);
          await storage.updateRoom(roomId, { 
            hostId: playerId,
            hostDisconnectedAt: null,
            hostElectionActive: false,
            hostElectionVotes: {},
            hostElectionEligibleVoters: []
          });
          broadcastToRoom(roomId, {
            type: 'host_reconnected',
            hostId: playerId,
            hostName: disconnectedPlayer.nickname,
            message: `Host ${disconnectedPlayer.nickname} has reconnected!`
          });
          await broadcastRoomState(roomId);
          return;
        }
        
        // Check if a new host was already assigned
        if (currentRoom.hostId) {
          console.log(`Host was assigned during countdown, skipping tally - clearing election state`);
          hostDisconnectTimers.delete(roomId);
          // CRITICAL: Clear election state and notify clients to close voting window
          await storage.updateRoom(roomId, {
            hostDisconnectedAt: null,
            hostElectionActive: false,
            hostElectionVotes: {},
            hostElectionEligibleVoters: []
          });
          broadcastToRoom(roomId, {
            type: 'host_reconnected',
            message: 'Host has returned. Election cancelled.'
          });
          await broadcastRoomState(roomId);
          return;
        }
        
        // Countdown finished - tally votes
        console.log(`Countdown finished in room ${roomId} (host disconnected), tallying votes`);
        
        const currentPlayers = (await storage.getPlayersByRoom(roomId))
          .filter(p => !p.isSpectator && !p.hasLeft);
        
        if (currentPlayers.length === 0) {
          broadcastToRoom(roomId, {
            type: 'host_left_redirect',
            message: 'No players available. Returning to main page...'
          });
          return;
        }
        
        // Tally votes with simplified logic:
        // 1. NO_HOST only wins if ALL players voted for it
        // 2. If any player vote exists and clear winner, give them host
        // 3. If tie or no votes, default to 2nd slot, then 3rd, then 4th
        const votes = currentRoom.hostElectionVotes || {};
        const eligibleVoters = currentRoom.hostElectionEligibleVoters || [];
        const totalVotes = Object.keys(votes).length;
        
        const voteCounts: { [key: string]: number } = {};
        Object.values(votes).forEach((candidateId: any) => {
          voteCounts[candidateId] = (voteCounts[candidateId] || 0) + 1;
        });
        
        console.log(`Election tally: ${totalVotes}/${eligibleVoters.length} voted, votes:`, voteCounts);
        
        // Get default host by position priority: 2nd slot (pos 1), 3rd (pos 2), 4th (pos 3), then 1st (pos 0)
        const getDefaultHost = () => {
          for (const pos of [1, 2, 3, 0]) {
            const player = currentPlayers.find(p => p.position === pos);
            if (player) return player;
          }
          return currentPlayers[0];
        };
        
        // Separate player votes from NO_HOST votes
        const playerVoteCounts: { [key: string]: number } = {};
        let noHostVotes = 0;
        for (const [candidateId, count] of Object.entries(voteCounts)) {
          if (candidateId === 'NO_HOST') {
            noHostVotes = count;
          } else {
            playerVoteCounts[candidateId] = count;
          }
        }
        
        // Check if ALL players voted for NO_HOST
        const allVotedNoHost = noHostVotes === eligibleVoters.length && eligibleVoters.length > 0;
        
        // Find highest voted player (excluding NO_HOST)
        let highestPlayerVotes = 0;
        let highestVotedPlayerId: string | null = null;
        let isTie = false;
        for (const [playerId, count] of Object.entries(playerVoteCounts)) {
          if (count > highestPlayerVotes) {
            highestPlayerVotes = count;
            highestVotedPlayerId = playerId;
            isTie = false;
          } else if (count === highestPlayerVotes && count > 0) {
            isTie = true;
          }
        }
        
        let winnerId: string | null = null;
        
        // Rule 1: NO_HOST only wins if ALL players voted for it
        if (allVotedNoHost) {
          winnerId = 'NO_HOST';
          console.log(`All players voted for NO_HOST: ${noHostVotes} votes`);
        }
        // Rule 2: If any player vote exists and clear winner, give them host
        else if (highestVotedPlayerId && !isTie) {
          winnerId = highestVotedPlayerId;
          console.log(`Highest voted player: ${winnerId} with ${highestPlayerVotes} votes`);
        }
        // Rule 3: Tie or no votes - default to position 2nd, 3rd, 4th
        else {
          const defaultHost = getDefaultHost();
          if (defaultHost) {
            winnerId = defaultHost.id;
            console.log(`Using position-based fallback: ${defaultHost.nickname} (position ${defaultHost.position})`);
          }
        }
        
        if (!winnerId) return;
        
        // Handle "Continue without host" option - only if ALL players voted for it
        if (winnerId === 'NO_HOST') {
          await storage.updateRoom(roomId, {
            hostId: null,
            noHostMode: true,
            hostElectionActive: false,
            hostElectionStartTime: null,
            hostElectionVotes: {},
            hostElectionEligibleVoters: [],
            hostDisconnectedAt: null
          });
          
          broadcastToRoom(roomId, {
            type: 'no_host_mode_enabled',
            message: 'Game will continue without a host.'
          });
          
          await broadcastRoomState(roomId);
          hostDisconnectTimers.delete(roomId);
          return;
        }
        
        // Assign winner as new host
        const winner = currentPlayers.find(p => p.id === winnerId);
        if (winner) {
          await storage.updateRoom(roomId, { 
            hostId: winner.id,
            hostElectionActive: false,
            hostElectionStartTime: null,
            hostElectionVotes: {},
            hostElectionEligibleVoters: [],
            hostDisconnectedAt: null
          });
          
          broadcastToRoom(roomId, {
            type: 'host_elected',
            newHostId: winner.id,
            newHostName: winner.nickname,
            message: `${winner.nickname} is now the host!`
          });
          
          await broadcastRoomState(roomId);
        }
        
        hostDisconnectTimers.delete(roomId);
      }, 30000); // 30 seconds
      
      hostDisconnectTimers.set(roomId, timer);
    }
    
    // If game is in progress and player is not a spectator, pause the game
    if (room.status === "playing" && !disconnectedPlayer.isSpectator) {
      await storage.updateRoom(roomId, { 
        status: "paused"
      });
      
      broadcastToRoom(roomId, {
        type: 'game_paused',
        reason: `${disconnectedPlayer.nickname} disconnected`,
        needsHostAction: true
      });
    }
    
    await broadcastRoomState(roomId);
  }
  
  // Cancel host election timer if host reconnects
  async function cancelHostElectionIfNeeded(roomId: string) {
    // Clear any pending timer (normal mode)
    const timer = hostDisconnectTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      hostDisconnectTimers.delete(roomId);
    }
    
    // Clear streaming mode timer
    const streamingTimer = streamingHostTimers.get(roomId);
    if (streamingTimer) {
      clearTimeout(streamingTimer);
      streamingHostTimers.delete(roomId);
    }
    
    // Always check and clear election state, even if timer already fired
    const room = await storage.getRoom(roomId);
    if (room && (room.hostDisconnectedAt || room.hostElectionActive)) {
      // Reset all election state first
      await storage.updateRoom(roomId, { 
        hostDisconnectedAt: null,
        hostElectionActive: false,
        hostElectionVotes: {},
        hostElectionEligibleVoters: []
      });
      
      // Notify players that host is back
      // Use appropriate message type for streaming vs normal mode
      if (room.isStreamingMode) {
        broadcastToRoom(roomId, {
          type: 'streaming_host_reconnected',
          message: 'Host has reconnected!'
        });
      } else {
        broadcastToRoom(roomId, {
          type: 'host_reconnected',
          message: 'Host has reconnected. Election cancelled.'
        });
      }
      
      // Broadcast updated room state so clients sync properly
      await broadcastRoomState(roomId);
    }
  }

  async function broadcastRoomState(roomId: string) {
    const room = await storage.getRoom(roomId);
    const players = await storage.getPlayersByRoom(roomId);
    const messages = await storage.getMessagesByRoom(roomId, 20);
    
    // Add online status to players - check for active connections (only latest per user)
    // CRITICAL FIX: Remove duplicate players with same nickname ONLY if they are ghost/left records
    // Do NOT dedupe different active players who happen to have same nickname
    const uniquePlayers = players.reduce((acc, player) => {
      const existing = acc.find(p => p.nickname.toLowerCase() === player.nickname.toLowerCase());
      if (existing) {
        // Only dedupe if one has left (ghost record) - otherwise keep both as separate players
        if (player.hasLeft && !existing.hasLeft) {
          // Current player left, existing is active - keep existing only
          return acc;
        } else if (!player.hasLeft && existing.hasLeft) {
          // Existing left, current player is active - replace with current
          return acc.map(p => p.id === existing.id ? player : p);
        }
        // Both are active or both left - keep both as they may be different people
        // This allows spectators and players to coexist with same nickname
        acc.push(player);
        return acc;
      } else {
        acc.push(player);
        return acc;
      }
    }, [] as typeof players);

    const playersWithStatus = uniquePlayers.map(player => {
      // Find the most recent connection for this player (in case of multiple devices)
      const playerConnections = Array.from(connections.values()).filter(conn => 
        conn.playerId === player.id && 
        conn.ws.readyState === WebSocket.OPEN &&
        (!conn.lastSeen || Date.now() - conn.lastSeen < 45000) // Reduced from 120s to 45s for better accuracy
      );
      
      // Sort by lastSeen to get the most recent active connection
      const mostRecentConnection = playerConnections
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))[0];
      
      const isOnline = !!mostRecentConnection;
      
      return {
        ...player,
        isOnline,
        isHost: room?.hostId === player.id
      };
    });
    
    // Count stream viewers for this room (connections with isStreamViewer: true)
    const streamViewerCount = Array.from(connections.values()).filter(conn => 
      conn.roomId === roomId && 
      conn.isStreamViewer && 
      conn.ws.readyState === WebSocket.OPEN
    ).length;
    
    const gameState = {
      room,
      players: playersWithStatus,
      messages,
      timestamp: Date.now(),
      streamViewerCount,
      // Explicitly include election state so clients sync properly when host reconnects
      hostDisconnectedWarning: room?.hostDisconnectedAt ? `Host disconnected` : null,
      hostElectionActive: room?.hostElectionActive || false
    };
    
    console.log(`Broadcasting room state to ${roomId}:`, {
      playerCount: playersWithStatus.length,
      onlineStatus: playersWithStatus.map(p => `${p.nickname}: ${p.isOnline ? 'online' : 'offline'}`).join(', ')
    });

    broadcastToRoom(roomId, {
      type: 'room_state',
      data: gameState
    });
  }

  function broadcastToRoom(roomId: string, message: any) {
    let sentCount = 0;
    let failedCount = 0;
    connections.forEach((connection) => {
      if (connection.roomId === roomId) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          try {
            connection.ws.send(JSON.stringify(message));
            sentCount++;
          } catch (error) {
            console.error(`Failed to send message to connection:`, error);
            failedCount++;
          }
        } else {
          failedCount++;
          if (message.type === 'game_end') {
            console.log(`⚠️ Connection not open for game_end broadcast (state: ${connection.ws.readyState})`);
          }
        }
      }
    });
    if (message.type === 'game_end') {
      console.log(`🏆 Sent game_end message: ${sentCount} successful, ${failedCount} failed in room ${roomId}`);
    }
  }

  // Host assigns spectator to available slot
  app.post("/api/rooms/:roomId/assign-spectator", async (req, res) => {
    try {
      const { spectatorId, position } = req.body;
      const hostId = req.headers.authorization?.replace('Bearer ', '');
      
      if (!hostId) {
        return res.status(401).json({ error: "No authentication token" });
      }
      
      const room = await storage.getRoom(req.params.roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      
      // Verify user is host
      const host = await storage.getPlayer(hostId);
      if (!host || host.roomId !== room.id || room.hostId !== hostId) {
        return res.status(403).json({ error: "Only host can assign spectators" });
      }
      
      // Verify spectator exists and is actually a spectator
      const spectator = await storage.getPlayer(spectatorId);
      if (!spectator || spectator.roomId !== room.id || !spectator.isSpectator) {
        return res.status(400).json({ error: "Invalid spectator" });
      }
      
      // CRITICAL: Handle complex player state scenarios (kick/rejoin/duplicate handling)
      const roomPlayers = await storage.getPlayersByRoom(room.id);
      
      // Clean up any duplicate spectator entries for the same nickname
      const duplicateSpectators = roomPlayers.filter(p => 
        p.nickname.toLowerCase() === spectator.nickname.toLowerCase() && 
        p.id !== spectator.id && 
        p.isSpectator
      );
      
      for (const duplicate of duplicateSpectators) {
        console.log(`Cleaning up duplicate spectator entry: ${duplicate.id} (${duplicate.nickname})`);
        await storage.deletePlayer(duplicate.id);
      }
      
      // Re-fetch players after cleanup
      const cleanedPlayers = await storage.getPlayersByRoom(room.id);
      
      // Check if position is available (exclude left players and spectators)
      const positionTaken = cleanedPlayers.some(p => 
        p.position === position && 
        !p.isSpectator && 
        !p.hasLeft
      );
      
      if (positionTaken) {
        return res.status(400).json({ error: 'Position already taken' });
      }
      
      // Additional safety check: Ensure spectator is still valid after cleanup
      const currentSpectator = await storage.getPlayer(spectatorId);
      if (!currentSpectator || currentSpectator.roomId !== room.id || !currentSpectator.isSpectator) {
        return res.status(400).json({ error: 'Spectator no longer valid after cleanup' });
      }
      
      // Get cards for this position from positionHands or deal fresh cards for new players
      let newHand: Card[] = [];
      if (room.positionHands && room.positionHands[position.toString()]) {
        // Restore existing cards for players returning to their position
        newHand = room.positionHands[position.toString()];
        console.log(`Host restoring position ${position} cards to spectator ${spectator.nickname}`);
      } else if (room.status === 'playing' && room.deck) {
        // Deal fresh 7 cards for new players joining active game
        const cardsToMove = room.deck.splice(0, 7);
        newHand = cardsToMove;
        console.log(`Host dealing 7 fresh cards to new player ${spectator.nickname} at position ${position}`);
        
        // Update room with modified deck
        await storage.updateRoom(room.id, { deck: room.deck });
      } 
      
      // Assign spectator to position with comprehensive update
      await storage.updatePlayer(spectatorId, {
        position,
        isSpectator: false,
        hasLeft: false,
        leftAt: null,
        hand: newHand,
        hasCalledUno: false,
        finishPosition: null
      });
      
      console.log(`Host assigned spectator ${spectator.nickname} to position ${position}`);
      
      // Broadcast room state update
      await broadcastRoomState(room.id);
      
      res.json({ success: true, message: `${spectator.nickname} assigned to position ${position}` });
    } catch (error) {
      console.error("Error assigning spectator:", error);
      res.status(500).json({ error: "Failed to assign spectator" });
    }
  });

  // Test endpoints for development
  app.post("/api/rooms/:roomId/test-set-hand", async (req, res) => {
    try {
      const { playerId, hand } = req.body;
      await storage.updatePlayer(playerId, { hand });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/rooms/:roomId/test-set-discard", async (req, res) => {
    try {
      const { topCard } = req.body;
      const room = await storage.getRoom(req.params.roomId);
      if (room) {
        await storage.updateRoom(req.params.roomId, { 
          discardPile: [topCard, ...(room.discardPile || [])],
          currentColor: topCard.color
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/rooms/:roomId/test-set-turn", async (req, res) => {
    try {
      const { currentPlayerIndex } = req.body;
      await storage.updateRoom(req.params.roomId, { currentPlayerIndex });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // End game reset endpoint - converts all players to spectators except host
  app.post("/api/rooms/:roomId/end-game-reset", async (req, res) => {
    try {
      const { roomId } = req.params;
      const room = await storage.getRoom(roomId);
      
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Reset room to waiting status
      await storage.updateRoom(roomId, { 
        status: "waiting",
        deck: [],
        discardPile: [],
        currentPlayerIndex: 0,
        currentColor: null,
        pendingDraw: null,
        positionHands: {},
        activePositions: []
      });

      // Get all players in the room
      const players = await storage.getPlayersByRoom(roomId);
      
      // Convert all players to spectators, except keep host at position 0
      for (const player of players) {
        if (player.id === room.hostId) {
          // Host stays at position 0 as a player
          await storage.updatePlayer(player.id, {
            isSpectator: false,
            position: 0,
            hand: [],
            hasCalledUno: false,
            finishPosition: null,
            hasLeft: false,
            leftAt: null
          });
        } else {
          // All other players become spectators
          await storage.updatePlayer(player.id, {
            isSpectator: true,
            position: null,
            hand: [],
            hasCalledUno: false,
            finishPosition: null,
            hasLeft: false,
            leftAt: null
          });
        }
      }

      // Broadcast updated room state
      await broadcastRoomState(roomId);
      
      res.json({ success: true, message: "Game reset and players converted to spectators" });
    } catch (error) {
      console.error("Error in end-game reset:", error);
      res.status(500).json({ error: "Failed to reset game" });
    }
  });

  // Start game endpoint
  app.post("/api/rooms/:roomId/start", async (req, res) => {
    try {
      const { roomId } = req.params;
      const hostId = req.headers.authorization?.replace('Bearer ', '');
      
      console.log(`🚀 GAME START REQUEST: roomId parameter = ${roomId}`);
      
      // Try both room ID and room code lookup
      let room = await storage.getRoom(roomId);
      if (!room) {
        room = await storage.getRoomByCode(roomId);
        console.log(`📍 Found room by code: ${roomId} -> ${room?.id}`);
      } else {
        console.log(`📍 Found room by ID: ${roomId}`);
      }
      
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const players = await storage.getPlayersByRoom(room.id);
      const gamePlayers = players.filter(p => !p.isSpectator);
      
      console.log(`Start game attempt: Host: ${hostId}, Room host: ${room.hostId}, Players: ${gamePlayers.length}`);

      if (gamePlayers.length < 2) {
        return res.status(400).json({ error: "Need at least 2 players to start the game" });
      }

      // Initialize game with verified deck
      const deck = UnoGameLogic.createDeck();
      
      // Verify deck composition in development
      if (process.env.NODE_ENV === 'development') {
        UnoGameLogic.verifyDeckComposition(deck);
      }

      const { hands, remainingDeck } = UnoGameLogic.dealInitialHands(deck, gamePlayers.length);
      
      // Find a number card for the first discard (never start with special cards)
      const { firstCard, remainingDeck: finalDeck } = UnoGameLogic.findFirstNumberCard(remainingDeck);
      const discardPile = [firstCard];
      
      // Update room with game state - use room.id to ensure we're updating the right room
      await storage.updateRoom(room.id, {
        status: "playing",
        deck: finalDeck,
        discardPile,
        currentPlayerIndex: 0,
        currentColor: firstCard.color as "red" | "blue" | "green" | "yellow",
        pendingDraw: 0
      });
      console.log(`✅ GAME START: Room ${room.code} (ID: ${room.id}) status updated to 'playing'`);
      
      // Verify the update worked
      const verifyRoom = await storage.getRoom(room.id);
      console.log(`🔍 VERIFICATION: Room status is now: ${verifyRoom?.status}`);

      // Update player hands and store position-based hands
      const positionHands: {[key: string]: any[]} = {};
      const activePositions: number[] = [];
      
      for (let i = 0; i < gamePlayers.length; i++) {
        await storage.updatePlayer(gamePlayers[i].id, { hand: hands[i] });
        // Store cards by position so anyone joining this position gets these cards
        positionHands[gamePlayers[i].position!.toString()] = hands[i];
        // Track which positions were active when game started
        activePositions.push(gamePlayers[i].position!);
      }
      
      console.log(`Game started with active positions: [${activePositions.join(', ')}]`);
      console.log(`Position hands saved:`, Object.keys(positionHands));
      
      // Update room with position-based hands and active positions
      await storage.updateRoom(room.id, { positionHands, activePositions });
      
      await broadcastRoomState(room.id);
      
      res.json({ success: true, message: "Game started successfully" });
    } catch (error) {
      console.error("Error starting game:", error);
      res.status(500).json({ error: "Failed to start game" });
    }
  });

  app.post("/api/rooms/:roomId/test-play-card", async (req, res) => {
    try {
      const { playerId, cardIndex } = req.body;
      const player = await storage.getPlayer(playerId);
      if (!player || !player.hand || player.hand.length === 0) {
        return res.status(400).json({ error: "No cards to play" });
      }

      const card = player.hand[cardIndex];
      if (!card) {
        return res.status(400).json({ error: "Invalid card index" });
      }

      // Remove card from hand
      const newHand = player.hand.filter((_, i) => i !== cardIndex);
      await storage.updatePlayer(playerId, { hand: newHand });

      // Check for win condition
      if (newHand.length === 0) {
        // Trigger game end logic
        const room = await storage.getRoom(req.params.roomId);
        const players = await storage.getPlayersByRoom(req.params.roomId);
        const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
        
        const finishedPlayers = activePlayers.filter(p => p.finishPosition);
        const finishedCount = finishedPlayers.length;
        
        await storage.updatePlayer(playerId, { finishPosition: finishedCount + 1 });
        
        const remainingPlayers = activePlayers.filter(p => !p.finishPosition && p.id !== playerId);
        
        if (remainingPlayers.length <= 1) {
          if (remainingPlayers.length === 1) {
            await storage.updatePlayer(remainingPlayers[0].id, { finishPosition: finishedCount + 2 });
          }
          
          await storage.updateRoom(req.params.roomId, { status: "finished" });
          
          const finalPlayers = await storage.getPlayersByRoom(req.params.roomId);
          const rankings = finalPlayers
            .filter(p => !p.isSpectator)
            .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999));
          
          const gameEndMessage = {
            type: 'game_end',
            winner: player.nickname,
            rankings: rankings.map(p => ({
              nickname: p.nickname,
              position: p.finishPosition || (p.hasLeft ? 'Left' : 'Last'),
              hasLeft: p.hasLeft || false
            }))
          };
          
          // Clear any active penalty animations first
          broadcastToRoom(req.params.roomId, {
            type: 'clear_penalty_animation'
          });
          
          console.log('🏆 Test triggered game_end message:', gameEndMessage);
          broadcastToRoom(req.params.roomId, gameEndMessage);
        }
      }

      res.json({ success: true, cardsLeft: newHand.length, gameEnded: newHand.length === 0 });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return httpServer;
}
