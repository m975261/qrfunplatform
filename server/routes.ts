import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { UnoGameLogic } from "./gameLogic";
import { z } from "zod";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";

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
      
      // iOS Camera app URL recognition workaround
      // Some iOS versions don't recognize certain domain patterns as URLs
      if (process.env.REPL_SLUG && process.env.REPLIT_DEPLOYMENT_ID) {
        domain = `${process.env.REPL_SLUG}.replit.app`;
      } else if (process.env.REPLIT_DOMAINS) {
        domain = process.env.REPLIT_DOMAINS.split(',')[0];
      } else {
        domain = req.get('host') || 'localhost:5000';
      }
      
      // Create URL with explicit formatting for iOS recognition
      roomLink = `https://${domain}/game?code=${code}`;
      
      // Add URL scheme prefix that iOS definitely recognizes
      if (!roomLink.startsWith('https://')) {
        roomLink = 'https://' + roomLink.replace(/^https?:\/\//, '');
      }
      
      // Double-check HTTPS prefix is present and add explicit URL formatting for iOS
      if (!roomLink.startsWith('https://')) {
        roomLink = 'https://' + roomLink.replace(/^https?:\/\//, '');
      }
      
      // Ensure URL is properly formatted for iOS Safari recognition
      roomLink = roomLink.replace(/([^:]\/)\/+/g, "$1");
      
      // Add explicit web scheme for maximum iOS compatibility  
      if (!roomLink.includes('://')) {
        roomLink = 'https://' + roomLink;
      }
      
      // iOS Camera app fix: ensure standard URL format
      roomLink = roomLink.replace(/([^:])(\/\/+)/g, '$1//');
      
      // Alternative approach: Create a more iOS-friendly URL format
      if (roomLink.includes('replit.app')) {
        // Ensure the URL follows a pattern iOS Camera recognizes as a web link
        roomLink = roomLink.replace(/\?\s*/, '?').replace(/\s+/g, '');
      }
      
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

      const player = await storage.createPlayer({
        nickname,
        roomId: room.id,
        isSpectator: room.status === "playing" || nonSpectatorPlayers.length >= 4,
        position: room.status === "waiting" && nonSpectatorPlayers.length < 4 
          ? nonSpectatorPlayers.length 
          : null
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
      const room = await storage.getRoom(req.params.roomId);
      if (!room) {
        console.log(`Room ${req.params.roomId} not found via HTTP GET`);
        return res.status(404).json({ error: "Room not found" });
      }

      const players = await storage.getPlayersByRoom(room.id);
      const messages = await storage.getMessagesByRoom(room.id, 20);

      // Generate QR code for sharing
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || `${req.protocol}://${req.get('host')}`;
      const roomLink = `${baseUrl}?room=${room.code}`;
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

  // Kick player from room (host only)
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

      // Remove the player
      await storage.deletePlayer(playerId);
      
      // Close WebSocket connection if player is online
      // Find and close connections for this player
      connections.forEach((connection, connId) => {
        if (connection.playerId === playerId && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(JSON.stringify({
            type: 'kicked',
            message: 'You have been removed from the room'
          }));
          connection.ws.close();
          connections.delete(connId);
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

      // Check if player is already in a position
      if (player.position !== null) {
        return res.status(400).json({ error: "Player already has a position" });
      }

      // Check if the position is available
      const roomPlayers = await storage.getPlayersByRoom(roomId);
      const positionTaken = roomPlayers.some(p => p.position === position && !p.isSpectator);
      
      if (positionTaken) {
        return res.status(400).json({ error: "Position already taken" });
      }

      // Update player to take the position
      await storage.updatePlayer(playerId, {
        position,
        isSpectator: false
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
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
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
        
        switch (message.type) {
          case 'join_room':
            await handleJoinRoom(connection, message, connectionId);
            break;
          case 'start_game':
            await handleStartGame(connection, message);
            break;
          case 'play_card':
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
    
    ws.on('close', () => {
      console.log('WebSocket connection closed:', connectionId);
      clearInterval(heartbeat);
      const connection = connections.get(connectionId);
      if (connection?.playerId && connection?.roomId) {
        // Wait a bit before marking as disconnected to allow for reconnection
        setTimeout(() => {
          // Check if player has reconnected with a different connection
          const hasActiveConnection = Array.from(connections.values())
            .some(conn => conn.playerId === connection.playerId && conn.ws.readyState === WebSocket.OPEN);
          
          if (!hasActiveConnection && connection.playerId && connection.roomId) {
            handlePlayerDisconnect(connection.playerId, connection.roomId);
          }
        }, 5000);
      }
      connections.delete(connectionId);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  async function handleJoinRoom(connection: SocketConnection, message: any, connectionId: string) {
    const { playerId, roomId, userFingerprint, sessionId } = message;
    
    console.log("handleJoinRoom called:", { playerId, roomId, connectionId, userFingerprint, sessionId });
    
    // Ensure room and player exist before proceeding
    const room = await storage.getRoom(roomId);
    const player = await storage.getPlayer(playerId);
    
    if (!room) {
      console.log(`Room ${roomId} not found, cannot join via WebSocket`);
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found. Please join via the main interface.'
      }));
      return;
    }
    
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
    connection.roomId = roomId;
    connection.lastSeen = Date.now();
    connection.userFingerprint = userFingerprint;
    connection.sessionId = sessionId;
    
    // Update player's socket ID
    await storage.updatePlayer(playerId, { socketId: connectionId });
    
    console.log("Broadcasting room state to all players in room:", roomId);
    // Broadcast room state to all players
    await broadcastRoomState(roomId);
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
    
    // Update player hands
    for (let i = 0; i < gamePlayers.length; i++) {
      await storage.updatePlayer(gamePlayers[i].id, { hand: hands[i] });
    }
    
    await broadcastRoomState(connection.roomId);
  }

  async function handlePlayCard(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { cardIndex } = message;
    const room = await storage.getRoom(connection.roomId);
    const player = await storage.getPlayer(connection.playerId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    const gamePlayers = players.filter(p => !p.isSpectator).sort((a, b) => (a.position || 0) - (b.position || 0));
    
    if (!room || !player || room.status !== "playing") return;
    
    const currentPlayerIndex = room.currentPlayerIndex || 0;
    const currentPlayer = gamePlayers[currentPlayerIndex];
    
    if (currentPlayer.id !== connection.playerId) return;
    
    const playerHand = player.hand || [];
    const currentHandSize = playerHand.length;
    const card = playerHand[cardIndex];
    const topCard = (room.discardPile || [])[0];
    
    if (!card || !UnoGameLogic.canPlayCard(card, topCard, room.currentColor || undefined, room.pendingDraw || 0)) {
      return;
    }
    
    // Remove card from player's hand first
    let newHand = playerHand.filter((_, index) => index !== cardIndex);
    
    // Check UNO penalty - apply only if player went from 2 cards to 1 card without calling UNO
    let shouldApplyUnoPenalty = false;
    if (currentHandSize === 2 && newHand.length === 1 && !player.hasCalledUno) {
      shouldApplyUnoPenalty = true;
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
    
    // Reset UNO call status if player now has more than 1 card (penalty applied or drew cards)
    const shouldResetUno = newHand.length > 1;
    
    await storage.updatePlayer(connection.playerId, { 
      hand: newHand,
      hasCalledUno: shouldResetUno ? false : player.hasCalledUno
    });
    
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
      
      // Move to next player (they can either draw or stack)
      nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        room.direction || "clockwise", 
        false, // Don't skip, next player gets a chance to stack
        false
      );
    } else {
      // Handle other effects first
      if (effect.reverse) {
        newDirection = room.direction === "clockwise" ? "counterclockwise" : "clockwise";
      }
      
      nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        newDirection || "clockwise", 
        effect.skip,
        effect.reverse
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
      
      // Set finish position for current winner
      await storage.updatePlayer(connection.playerId, { finishPosition: finishedCount + 1 });
      
      // Check if game should end (only 1 player left or all finished)
      const remainingPlayers = activePlayers.filter(p => !p.finishPosition && p.id !== connection.playerId);
      
      if (remainingPlayers.length <= 1) {
        // Game ends, set last player's position if any
        if (remainingPlayers.length === 1) {
          await storage.updatePlayer(remainingPlayers[0].id, { finishPosition: finishedCount + 2 });
        }
        
        await storage.updateRoom(connection.roomId, { status: "finished" });
        
        // Get final rankings
        const finalPlayers = await storage.getPlayersByRoom(connection.roomId);
        const rankings = finalPlayers
          .filter(p => !p.isSpectator)
          .sort((a, b) => (a.finishPosition || 999) - (b.finishPosition || 999));
        
        broadcastToRoom(connection.roomId, {
          type: 'game_end',
          winner: player.nickname,
          rankings: rankings.map(p => ({
            nickname: p.nickname,
            position: p.finishPosition || (p.hasLeft ? 'Left' : 'Last'),
            hasLeft: p.hasLeft
          }))
        });
      } else {
        // Continue game with remaining players
        broadcastToRoom(connection.roomId, {
          type: 'player_finished',
          player: player.nickname,
          position: finishedCount + 1
        });
      }
    }
    
    await broadcastRoomState(connection.roomId);
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
    
    const deck = room.deck || [];
    if (deck.length === 0) return;
    
    // Handle pending draw effects first
    let drawAmount = 1;
    let clearPendingDraw = false;
    const currentHandSize = (player.hand || []).length;
    
    if (room.pendingDraw && room.pendingDraw > 0) {
      drawAmount = room.pendingDraw;
      clearPendingDraw = true;
    }
    
    // No UNO penalty when drawing cards - penalty only applies when playing cards
    
    const drawnCards = deck.splice(0, drawAmount);
    const newHand = [...(player.hand || []), ...drawnCards];
    
    // Reset UNO call if player now has more than 1 card  
    await storage.updatePlayer(connection.playerId, { 
      hand: newHand,
      hasCalledUno: newHand.length > 1 ? false : player.hasCalledUno
    });
    // Always move to next player after drawing - turn is over
    const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
      currentPlayerIndex, 
      gamePlayers.length, 
      room.direction || "clockwise",
      false,
      false
    );
    
    await storage.updateRoom(connection.roomId, { 
      deck,
      pendingDraw: clearPendingDraw ? 0 : room.pendingDraw,
      currentPlayerIndex: nextPlayerIndex
    });
    await broadcastRoomState(connection.roomId);
  }

  async function handleCallUno(connection: SocketConnection, message: any) {
    if (!connection.playerId) return;
    
    const player = await storage.getPlayer(connection.playerId);
    if (!player) return;
    
    // Allow UNO call when player has 2 cards (before playing second-to-last card)
    if ((player.hand || []).length === 2) {
      await storage.updatePlayer(connection.playerId, { hasCalledUno: true });
      
      // Remove the broadcast notification - just update the status silently
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
    
    // Mark target player as left
    await storage.updatePlayer(targetPlayerId, { 
      hasLeft: true, 
      leftAt: new Date(),
      isSpectator: true 
    });
    
    // If game is playing, pause it
    if (room.status === "playing") {
      await storage.updateRoom(connection.roomId, { status: "paused" });
      
      // Removed system message as requested by user
      
      broadcastToRoom(connection.roomId, {
        type: 'game_paused',
        reason: `${targetPlayer.nickname} was kicked`,
        needsHostAction: true
      });
    } else {
      // Removed system message as requested by user
      
      broadcastToRoom(connection.roomId, {
        type: 'player_kicked',
        player: targetPlayer.nickname
      });
    }
    
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
    
    if (!room || !playerToReplace || !playerToReplace.isSpectator) return;
    
    // Find if there's a left player at the target position
    const leftPlayer = players.find(p => p.position === targetPosition && p.hasLeft);
    
    if (leftPlayer) {
      // Replace the left player - spectator takes their position, hand, and game state
      await storage.updatePlayer(connection.playerId, {
        isSpectator: false,
        position: targetPosition,
        hand: leftPlayer.hand || [],
        hasLeft: false,
        hasCalledUno: leftPlayer.hasCalledUno || false,
        finishPosition: null // Clear any finish position since they're back in game
      });
      
      // Remove the left player completely
      await storage.deletePlayer(leftPlayer.id);
      
      // Removed system message as requested by user
      
      broadcastToRoom(connection.roomId, {
        type: 'player_replaced',
        newPlayer: playerToReplace.nickname,
        position: targetPosition
      });
    } else {
      // Regular join to empty position - initialize game state
      await storage.updatePlayer(connection.playerId, {
        isSpectator: false,
        position: targetPosition,
        hand: [], // Empty hand for new player
        hasCalledUno: false,
        finishPosition: null
      });
      
      // Removed system message as requested by user
      
      broadcastToRoom(connection.roomId, {
        type: 'spectator_joined',
        player: playerToReplace.nickname,
        position: targetPosition
      });
    }
    
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
    connections.forEach(connection => {
      if (connection.roomId === roomId && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    });
  }

  return httpServer;
}
