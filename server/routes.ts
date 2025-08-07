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

      const room = await storage.getRoomByCode(code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
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

      res.json({ player, room });
    } catch (error) {
      res.status(400).json({ error: "Failed to join room" });
    }
  });

  // Get room state
  app.get("/api/rooms/:roomId", async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.roomId);
      if (!room) {
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
  
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('New WebSocket connection from:', req.socket.remoteAddress);
    const connectionId = Math.random().toString(36).substring(7);
    connections.set(connectionId, { ws });
    
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
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed:', connectionId);
      connections.delete(connectionId);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  async function handleJoinRoom(connection: SocketConnection, message: any, connectionId: string) {
    const { playerId, roomId } = message;
    
    console.log("handleJoinRoom called:", { playerId, roomId, connectionId });
    
    connection.playerId = playerId;
    connection.roomId = roomId;
    
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
    
    // Update room with game state
    const discardPile = [remainingDeck.pop()!];
    await storage.updateRoom(connection.roomId, {
      status: "playing",
      deck: remainingDeck,
      discardPile,
      currentPlayerIndex: 0,
      currentColor: discardPile[0].color === "wild" ? "red" : discardPile[0].color,
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
    const card = playerHand[cardIndex];
    const topCard = (room.discardPile || [])[0];
    
    if (!card || !UnoGameLogic.canPlayCard(card, topCard, room.currentColor || undefined, room.pendingDraw)) {
      return;
    }
    
    // Check UNO penalty - if player has 2 cards and doesn't have UNO called, and they're not calling UNO this turn
    let shouldApplyUnoPenalty = false;
    if (playerHand.length === 2 && !player.hasCalledUno) {
      shouldApplyUnoPenalty = true;
    }
    
    // Remove card from player's hand
    let newHand = playerHand.filter((_, index) => index !== cardIndex);
    
    // Apply UNO penalty if needed
    if (shouldApplyUnoPenalty) {
      const deck = room.deck || [];
      const penaltyCards = deck.splice(0, 2);
      newHand = [...newHand, ...penaltyCards];
      await storage.updateRoom(connection.roomId, { deck });
    }
    
    await storage.updatePlayer(connection.playerId, { 
      hand: newHand,
      hasCalledUno: newHand.length === 1 ? player.hasCalledUno : false
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
        false // Don't skip, next player gets a chance to stack
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
        effect.skip
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
    
    if (room.pendingDraw && room.pendingDraw > 0) {
      drawAmount = room.pendingDraw;
      clearPendingDraw = true;
    }
    
    const drawnCards = deck.splice(0, drawAmount);
    const newHand = [...(player.hand || []), ...drawnCards];
    
    await storage.updatePlayer(connection.playerId, { hand: newHand });
    await storage.updateRoom(connection.roomId, { 
      deck,
      pendingDraw: clearPendingDraw ? 0 : room.pendingDraw,
      currentPlayerIndex: clearPendingDraw ? UnoGameLogic.getNextPlayerIndex(
        currentPlayerIndex, 
        gamePlayers.length, 
        room.direction || "clockwise"
      ) : currentPlayerIndex // Only move to next player if drew pending cards
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
      
      if (connection.roomId) {
        broadcastToRoom(connection.roomId, {
          type: 'uno_called',
          player: player.nickname
        });
      }
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
      
      // Send system message
      await storage.createMessage({
        roomId: connection.roomId,
        message: `${player.nickname} left the game`,
        type: "system"
      });
      
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
    
    if (!room || !hostPlayer || !targetPlayer) return;
    
    // Only host can kick players
    if (room.hostId !== connection.playerId) return;
    
    // Mark target player as left
    await storage.updatePlayer(targetPlayerId, { 
      hasLeft: true, 
      leftAt: new Date(),
      isSpectator: true 
    });
    
    // Send system message
    await storage.createMessage({
      roomId: connection.roomId,
      message: `${targetPlayer.nickname} was removed from the game`,
      type: "system"
    });
    
    broadcastToRoom(connection.roomId, {
      type: 'player_kicked',
      player: targetPlayer.nickname
    });
    
    await broadcastRoomState(connection.roomId);
  }

  async function handleContinueGame(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const room = await storage.getRoom(connection.roomId);
    const players = await storage.getPlayersByRoom(connection.roomId);
    
    if (!room || room.hostId !== connection.playerId) return;
    
    const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
    
    if (activePlayers.length >= 2) {
      await storage.updateRoom(connection.roomId, { status: "playing" });
      
      // Send system message
      await storage.createMessage({
        roomId: connection.roomId,
        message: "Game continues with remaining players",
        type: "system"
      });
      
      broadcastToRoom(connection.roomId, {
        type: 'game_continued'
      });
    }
    
    await broadcastRoomState(connection.roomId);
  }

  async function handleReplacePlayer(connection: SocketConnection, message: any) {
    if (!connection.roomId || !connection.playerId) return;
    
    const { spectatorId, leftPlayerPosition } = message;
    const room = await storage.getRoom(connection.roomId);
    
    if (!room || room.hostId !== connection.playerId) return;
    
    const spectator = await storage.getPlayer(spectatorId);
    if (!spectator || !spectator.isSpectator) return;
    
    // Move spectator to game position
    await storage.updatePlayer(spectatorId, { 
      isSpectator: false,
      position: leftPlayerPosition,
      hasLeft: false
    });
    
    // Send system message
    await storage.createMessage({
      roomId: connection.roomId,
      message: `${spectator.nickname} joined the game`,
      type: "system"
    });
    
    broadcastToRoom(connection.roomId, {
      type: 'player_replaced',
      player: spectator.nickname
    });
    
    await broadcastRoomState(connection.roomId);
  }

  async function broadcastRoomState(roomId: string) {
    const room = await storage.getRoom(roomId);
    const players = await storage.getPlayersByRoom(roomId);
    const messages = await storage.getMessagesByRoom(roomId, 20);
    
    const gameState = {
      room,
      players,
      messages,
      timestamp: Date.now()
    };
    
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
