import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { UnoGameLogic } from "./gameLogic";
import { z } from "zod";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { Card } from "@shared/schema";

interface SocketConnection {
  ws: WebSocket;
  playerId?: string;
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
  
  // Create room
  app.post("/api/rooms", async (req, res) => {
    try {
      const { hostNickname } = z.object({
        hostNickname: z.string().min(1).max(20)
      }).parse(req.body);

      const code = UnoGameLogic.generateRoomCode();
      // Create the room first
      const room = await storage.createRoom({
        code,
        hostId: "", // Will be set when host joins
        status: "waiting"
      });

      // Create the host player immediately
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

      res.json({ room: updatedRoom, qrCode, player: hostPlayer });
    } catch (error) {
      res.status(400).json({ error: "Failed to create room" });
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
      let isSpectator = true;

      if (room.status === "waiting" && nonSpectatorPlayers.length < 4) {
        // Normal join for waiting room
        isSpectator = false;
        playerPosition = nonSpectatorPlayers.length;
      } else if (room.status === "playing" || room.status === "paused") {
        // For active games, only allow rejoining to originally active positions
        const availablePositions = [];
        const originalActivePositions = room.activePositions || [];
        
        for (const pos of originalActivePositions) {
          const positionTaken = existingPlayers.some(p => p.position === pos && !p.isSpectator && !p.hasLeft);
          if (!positionTaken && (room.positionHands || {})[pos.toString()]) {
            availablePositions.push(pos);
          }
        }
        
        if (availablePositions.length > 0) {
          // Join the first available position with existing cards
          playerPosition = availablePositions[0];
          playerHand = (room.positionHands || {})[playerPosition.toString()] || [];
          isSpectator = false;
          console.log(`New player ${nickname} joining active game at position ${playerPosition} with ${playerHand.length} cards`);
        } else {
          // No positions with cards available, join as spectator
          console.log(`New player ${nickname} joining as spectator - no available positions with cards`);
        }
      }

      const player = await storage.createPlayer({
        nickname,
        roomId: room.id,
        isSpectator,
        position: playerPosition,
        hand: playerHand
      });

      // Set this player as host if room had no host
      if (!room.hostId || room.hostId === "") {
        await storage.updateRoom(room.id, { hostId: player.id });
        const updatedRoom = await storage.getRoom(room.id);
        if (updatedRoom) room = updatedRoom;
      }

      res.json({ player, room });
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
      const positionTaken = roomPlayers.some(p => p.position === position && !p.isSpectator);
      
      if (positionTaken) {
        return res.status(400).json({ error: "Position already taken" });
      }

      // Get cards for this position - either from positionHands or deal new ones
      let newHand: Card[] = [];
      if (room.positionHands && room.positionHands[position.toString()]) {
        // Use cards assigned to this position when game started or when last player left
        newHand = room.positionHands[position.toString()];
        console.log(`Restoring ${newHand.length} position cards to player ${playerId} taking position ${position}`);
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
        
        console.log(`Dealing ${cardsNeeded} new cards to player ${playerId} for new position ${position}`);
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
          case 'send_emoji':
            await handleSendEmoji(connection, message);
            break;
          case 'play_again':
            await handlePlayAgain(connection, message);
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
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed: ${connectionId} (code: ${code}, reason: ${reason?.toString()})`);
      clearInterval(heartbeat);
      const connection = connections.get(connectionId);
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
    await storage.updateRoom(connection.roomId, { positionHands, activePositions });
    
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
    
    if (currentPlayer.id !== connection.playerId) return;
    
    // Don't allow finished players to play cards
    if (currentPlayer.finishPosition) return;
    
    const playerHand = player.hand || [];
    const currentHandSize = playerHand.length;
    const card = playerHand[cardIndex];
    const topCard = (room.discardPile || [])[0];
    
    if (!card || !UnoGameLogic.canPlayCard(card, topCard, room.currentColor || undefined, room.pendingDraw || 0)) {
      console.log(`❌ PLAY CARD: Cannot play card - card exists: ${!!card}, canPlay: ${card ? UnoGameLogic.canPlayCard(card, topCard, room.currentColor || undefined, room.pendingDraw || 0) : false}`);
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
    
    // Handle stacking draw cards
    if (effect.draw > 0) {
      // Stack the draw effect - pass the penalty to next player
      newPendingDraw = (room.pendingDraw || 0) + effect.draw;
      
      // Get finished player indices for turn skipping
      const finishedPlayerIndices = gamePlayers
        .map((p, idx) => ({ player: p, index: idx }))
        .filter(item => item.player.finishPosition)
        .map(item => item.index);
      
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
      // Handle other effects first
      if (effect.reverse) {
        newDirection = room.direction === "clockwise" ? "counterclockwise" : "clockwise";
      }
      
      // Get finished player indices for turn skipping
      const finishedPlayerIndices = gamePlayers
        .map((p, idx) => ({ player: p, index: idx }))
        .filter(item => item.player.finishPosition)
        .map(item => item.index);
      
      nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        newDirection || "clockwise", 
        effect.skip,
        effect.reverse,
        finishedPlayerIndices
      );
      
      // Clear pending draw since this is not a draw card
      newPendingDraw = 0;
    }
    
    // Update room state
    await storage.updateRoom(connection.roomId, {
      discardPile: newDiscardPile,
      currentPlayerIndex: nextPlayerIndex,
      direction: newDirection,
      currentColor: effect.chooseColor ? room.currentColor : card.color,
      pendingDraw: newPendingDraw
    });
    
    // Check for win condition
    if (newHand.length === 0) {
      const players = await storage.getPlayersByRoom(connection.roomId);
      const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
      const finishedCount = activePlayers.filter(p => p.finishPosition).length;
      
      console.log(`${player.nickname} won! Setting finish position ${finishedCount + 1}`);
      
      // Set finish position for current winner
      await storage.updatePlayer(connection.playerId, { finishPosition: finishedCount + 1 });
      
      // Check if game should end (only 1 player left or all finished)
      const remainingPlayers = activePlayers.filter(p => !p.finishPosition && p.id !== connection.playerId);
      
      console.log(`Remaining players after ${player.nickname} won: ${remainingPlayers.length}`);
      
      if (remainingPlayers.length <= 1) {
        // Game ends, set last player's position if any
        if (remainingPlayers.length === 1) {
          await storage.updatePlayer(remainingPlayers[0].id, { finishPosition: finishedCount + 2 });
          console.log(`Set last player ${remainingPlayers[0].nickname} to position ${finishedCount + 2}`);
        }
        
        await storage.updateRoom(connection.roomId, { status: "finished" });
        console.log(`Game finished in room ${connection.roomId}`);
        
        // Get final rankings
        const finalPlayers = await storage.getPlayersByRoom(connection.roomId);
        const rankings = finalPlayers
          .filter(p => !p.isSpectator)
          .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999));
        
        console.log('Final rankings:', rankings.map(p => `${p.nickname}: ${p.finishPosition}`));
        
        const gameEndMessage = {
          type: 'game_end',
          winner: player.nickname,
          rankings: rankings.map(p => ({
            nickname: p.nickname,
            position: p.finishPosition || (p.hasLeft ? 'Left' : 'Last'),
            hasLeft: p.hasLeft || false
          }))
        };
        
        console.log('🏆 Broadcasting game_end message:', gameEndMessage);
        const roomConnections = Array.from(connections.values()).filter(c => c.roomId === connection.roomId);
        console.log('🏆 Active connections for room:', roomConnections.length);
        
        // Before broadcasting, ensure all connections are stable
        roomConnections.forEach(conn => {
          if (conn.ws.readyState !== WebSocket.OPEN) {
            console.log('⚠️ Warning: Connection not open before game_end broadcast');
          }
        });
        
        // Enhanced broadcast with error handling and connection monitoring
        try {
          console.log('🏆 Broadcasting game_end message to room connections...');
          let successCount = 0;
          let failCount = 0;
          
          roomConnections.forEach((conn, index) => {
            try {
              if (conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify(gameEndMessage));
                successCount++;
                console.log(`✅ Game end message sent to connection ${index + 1}`);
              } else {
                failCount++;
                console.log(`❌ Connection ${index + 1} not open (state: ${conn.ws.readyState})`);
              }
            } catch (sendError) {
              failCount++;
              console.error(`❌ Failed to send game_end to connection ${index + 1}:`, sendError);
            }
          });
          
          console.log(`🏆 Game end broadcast complete: ${successCount} sent, ${failCount} failed`);
          
          // Monitor connection stability over time
          const checkConnectionStability = (checkNum: number) => {
            setTimeout(() => {
              const stillActiveConnections = Array.from(connections.values())
                .filter(c => c.roomId === connection.roomId && c.ws.readyState === WebSocket.OPEN);
              console.log(`🏆 Check ${checkNum}: ${stillActiveConnections.length}/${roomConnections.length} connections active`);
              
              // If connections are dropping, log detailed info
              if (stillActiveConnections.length < roomConnections.length) {
                console.log('⚠️ Connection loss detected after game_end:');
                roomConnections.forEach((conn, idx) => {
                  const isStillActive = stillActiveConnections.some(active => active === conn);
                  console.log(`  Connection ${idx + 1}: ${isStillActive ? 'ACTIVE' : 'LOST'} (state: ${conn.ws.readyState})`);
                });
              }
            }, checkNum * 1000);
          };
          
          // Check at 1s, 3s, and 5s intervals
          checkConnectionStability(1);
          checkConnectionStability(3);
          checkConnectionStability(5);
          
        } catch (broadcastError) {
          console.error('❌ Fatal error during game_end broadcast:', broadcastError);
        }
      } else {
        // Continue game with remaining players
        console.log(`${player.nickname} finished in position ${finishedCount + 1}, game continues`);
        broadcastToRoom(connection.roomId, {
          type: 'player_finished',
          player: player.nickname,
          position: finishedCount + 1
        });
      }
    }
    
    await broadcastRoomState(connection.roomId);
    
    // Check if the next player needs to automatically draw penalty cards
    await checkAndApplyAutomaticPenalty(connection.roomId, nextPlayerIndex, gamePlayers);
  }

  async function applyPenaltyWithAnimation(roomId: string, playerIndex: number, gamePlayers: any[], penaltyAmount: number) {
    const room = await storage.getRoom(roomId);
    if (!room || penaltyAmount <= 0) return;

    const currentPlayer = gamePlayers[playerIndex];
    if (!currentPlayer) return;

    const player = await storage.getPlayer(currentPlayer.id);
    if (!player) return;

    const deck = room.deck || [];
    if (deck.length < penaltyAmount) return;

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
    
    // Get finished player indices for turn skipping
    const finishedPlayerIndices = gamePlayers
      .map((p, idx) => ({ player: p, index: idx }))
      .filter(item => item.player.finishPosition)
      .map(item => item.index);
    
    // Move to next player and clear penalty
    const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
      playerIndex, 
      gamePlayers.length, 
      room.direction || "clockwise",
      false,
      false,
      finishedPlayerIndices
    );
    
    await storage.updateRoom(roomId, { 
      deck,
      pendingDraw: 0,
      currentPlayerIndex: nextPlayerIndex
    });
    
    // Wait 1.5 seconds before ending animation to complete 6 second total
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // End penalty animation
    broadcastToRoom(roomId, {
      type: 'penalty_animation_end',
      player: player.nickname,
      totalCards: penaltyAmount
    });
    
    await broadcastRoomState(roomId);
  }

  async function checkAndApplyAutomaticPenalty(roomId: string, playerIndex: number, gamePlayers: any[]) {
    const room = await storage.getRoom(roomId);
    if (!room || !room.pendingDraw || room.pendingDraw === 0) return;

    const currentPlayer = gamePlayers[playerIndex];
    if (!currentPlayer) return;

    const player = await storage.getPlayer(currentPlayer.id);
    if (!player) return;

    const topCard = (room.discardPile || [])[0];
    if (!topCard) return;

    // Check if the player can stack draw cards
    const canStack = UnoGameLogic.canPlayerStackDraw(player.hand || [], topCard, room.pendingDraw);
    
    if (!canStack) {
      // Player cannot stack, automatically apply penalty with animation
      await applyPenaltyWithAnimation(roomId, playerIndex, gamePlayers, room.pendingDraw);
    }
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
    
    if (currentPlayer.id !== connection.playerId) return;
    
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
    
    // Always move to next player after drawing - turn is over
    const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
      currentPlayerIndex, 
      gamePlayers.length, 
      room.direction || "clockwise",
      false,
      false,
      finishedPlayerIndices
    );
    
    await storage.updateRoom(connection.roomId, { 
      deck,
      currentPlayerIndex: nextPlayerIndex
    });
    await broadcastRoomState(connection.roomId);
  }

  async function handleCallUno(connection: SocketConnection, message: any) {
    if (!connection.playerId) return;
    
    const player = await storage.getPlayer(connection.playerId);
    if (!player) return;
    
    console.log(`📢 UNO CALL: ${player.nickname} trying to call UNO with ${(player.hand || []).length} cards`);
    
    // Allow UNO call anytime - validation happens when playing card
    if (!player.hasCalledUno) {
      await storage.updatePlayer(connection.playerId, { hasCalledUno: true });
      console.log(`✅ UNO CALLED: Set hasCalledUno=true for ${player.nickname}`);
      
      // Verify the update was successful by checking the database
      const verifyPlayer = await storage.getPlayer(connection.playerId);
      console.log(`🔍 UNO CALL VERIFICATION: ${player.nickname} hasCalledUno=${verifyPlayer?.hasCalledUno}`);
      
      // Broadcast UNO call for visual feedback to all players
      broadcastToRoom(connection.roomId!, {
        type: 'uno_called_success',
        player: player.nickname
      });
    } else {
      console.log(`⚠️ UNO ALREADY CALLED: ${player.nickname} has already called UNO`);
    }
  }

  async function handleChooseColor(connection: SocketConnection, message: any) {
    if (!connection.roomId) return;
    
    const { color } = message;
    await storage.updateRoom(connection.roomId, { currentColor: color });
    await broadcastRoomState(connection.roomId);
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
    
    broadcastToRoom(connection.roomId, {
      type: 'floating_emoji',
      emoji,
      playerId: connection.playerId
    });
    
    await broadcastRoomState(connection.roomId);
  }

  async function handleExitGame(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    
    if (!room || !player) return;
    
    // Mark player as left
    await storage.updatePlayer(connection.playerId, { 
      hasLeft: true, 
      leftAt: new Date(),
      isSpectator: true 
    });
    
    // If game is in progress, pause and set finish position as last
    if (room.status === "playing") {
      const gamePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
      const finishPosition = gamePlayers.length + 1; // Last position
      
      await storage.updatePlayer(connection.playerId, { finishPosition });
      await storage.updateRoom(connection.roomId, { status: "waiting" });
      
      // Removed system message as requested by user
      
      broadcastToRoom(connection.roomId, {
        type: 'player_left',
        player: player.nickname,
        needsContinue: true
      });
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

  async function handleReplacePlayer(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { targetPosition } = message;
    const room = await storage.getRoom(connection.roomId);
    const playerToReplace = await storage.getPlayer(connection.playerId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    
    if (!room || !playerToReplace) return;
    
    // Allow both spectators and kicked players (who are now spectators) to rejoin
    if (!playerToReplace.isSpectator && !playerToReplace.hasLeft) return;
    
    // Check if position is already taken by an active player
    const activePlayerAtPosition = players.find(p => p.position === targetPosition && !p.isSpectator && !p.hasLeft);
    
    if (activePlayerAtPosition) {
      console.log(`Position ${targetPosition} is already taken by active player ${activePlayerAtPosition.nickname}`);
      return; // Position is occupied by an active player
    }
    
    // During active games, only allow rejoining originally active positions
    if (room.status === "playing" || room.status === "paused") {
      const originalActivePositions = room.activePositions || [];
      if (!originalActivePositions.includes(targetPosition)) {
        console.log(`Position ${targetPosition} was not active when game started. Originally active: [${originalActivePositions.join(', ')}]`);
        return; // Position was not active when game started, cannot join
      }
    }
    
    // Get cards for this position - either from positionHands or deal new ones
    let newHand: Card[] = [];
    if (room.positionHands && room.positionHands[targetPosition.toString()]) {
      // Use cards assigned to this position when game started or when last player left
      newHand = room.positionHands[targetPosition.toString()];
      console.log(`Restoring ${newHand.length} position cards to ${playerToReplace.nickname} joining position ${targetPosition}`);
    } else if (room.status === "playing" && room.deck && room.deck.length > 0) {
      // Deal 7 cards for new position in active game
      const cardsNeeded = Math.min(7, room.deck.length);
      newHand = room.deck.slice(0, cardsNeeded);
      const updatedDeck = room.deck.slice(cardsNeeded);
      
      // Update room deck and save cards for this position
      const updatedPositionHands = { ...room.positionHands, [targetPosition.toString()]: newHand };
      await storage.updateRoom(connection.roomId, { 
        deck: updatedDeck,
        positionHands: updatedPositionHands
      });
      
      console.log(`Dealing ${cardsNeeded} new cards to ${playerToReplace.nickname} for new position ${targetPosition}`);
    }
    
    // Join position with position-specific cards
    await storage.updatePlayer(connection.playerId, {
      isSpectator: false,
      position: targetPosition,
      hand: newHand, // Use position-specific cards
      hasLeft: false,
      leftAt: null,
      hasCalledUno: false,
      finishPosition: null
    });
    
    console.log(`${playerToReplace.nickname} joined position ${targetPosition} with ${newHand.length} cards`);
    
    // Removed system message as requested by user
    
    broadcastToRoom(connection.roomId, {
      type: 'spectator_joined',
      player: playerToReplace.nickname,
      position: targetPosition
    });
    
    await broadcastRoomState(connection.roomId);

  }

  async function handlePlayAgain(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    
    if (!room || !player) return;
    
    // Only allow play again if game is finished
    if (room.status !== "finished") return;
    
    // Reset room to waiting state, keeping all existing players
    await storage.updateRoom(connection.roomId, {
      status: "waiting",
      currentPlayerIndex: 0,
      currentColor: null,
      pendingDraw: 0,
      direction: "clockwise",
      deck: [],
      discardPile: []
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
        
        // Clean up the room after a delay to allow the message to be sent
        setTimeout(async () => {
          try {
            await storage.deleteRoom(roomId);
            console.log(`Room ${roomId} cleaned up after host departure`);
          } catch (error) {
            console.error('Failed to clean up room:', error);
          }
        }, 2000);
        
        return; // Exit early, don't proceed with normal disconnect handling
      }
      
      // For other game states, transfer host to another player
      const activePlayers = players.filter(p => p.id !== playerId && !p.isSpectator);
      if (activePlayers.length > 0) {
        const newHost = activePlayers[0];
        await storage.updateRoom(roomId, { hostId: newHost.id });
        console.log(`Host transferred from ${disconnectedPlayer.nickname} to ${newHost.nickname}`);
        
        broadcastToRoom(roomId, {
          type: 'host_changed',
          newHost: newHost.nickname,
          message: `${newHost.nickname} is now the host`
        });
      }
    }
    
    // If game is in progress and player is not a spectator, pause the game
    if (room.status === "playing" && !disconnectedPlayer.isSpectator) {
      await storage.updateRoom(roomId, { 
        status: "paused"
      });
      
      // Send system message
      // Removed system message as requested by user
      
      broadcastToRoom(roomId, {
        type: 'game_paused',
        reason: `${disconnectedPlayer.nickname} disconnected`,
        needsHostAction: true
      });
    }
    
    await broadcastRoomState(roomId);
  }

  async function broadcastRoomState(roomId: string) {
    const room = await storage.getRoom(roomId);
    const players = await storage.getPlayersByRoom(roomId);
    const messages = await storage.getMessagesByRoom(roomId, 20);
    
    // Add online status to players - check for active connections (only latest per user)
    const playersWithStatus = players.map(player => {
      // Find the most recent connection for this player (in case of multiple devices)
      const playerConnections = Array.from(connections.values()).filter(conn => 
        conn.playerId === player.id && 
        conn.ws.readyState === WebSocket.OPEN &&
        (!conn.lastSeen || Date.now() - conn.lastSeen < 120000)
      );
      
      // Sort by lastSeen to get the most recent active connection
      const mostRecentConnection = playerConnections
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))[0];
      
      return {
        ...player,
        isOnline: !!mostRecentConnection
      };
    });
    
    const gameState = {
      room,
      players: playersWithStatus,
      messages,
      timestamp: Date.now()
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
