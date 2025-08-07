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

      // Generate QR code with room link
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || `${req.protocol}://${req.get('host')}`;
      const roomLink = `https://${baseUrl}?room=${code}`;
      console.log('Generated QR code URL:', roomLink);
      const qrCode = await QRCode.toDataURL(roomLink);

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
    
    // Initialize game
    const deck = UnoGameLogic.createDeck();
    const { hands, remainingDeck } = UnoGameLogic.dealInitialHands(deck, gamePlayers.length);
    
    // Update room with game state
    const discardPile = [remainingDeck.pop()!];
    await storage.updateRoom(connection.roomId, {
      status: "playing",
      deck: remainingDeck,
      discardPile,
      currentPlayerIndex: 0,
      currentColor: discardPile[0].color === "wild" ? "red" : discardPile[0].color
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
    
    if (!card || !UnoGameLogic.canPlayCard(card, topCard, room.currentColor || undefined)) {
      return;
    }
    
    // Remove card from player's hand
    const newHand = playerHand.filter((_, index) => index !== cardIndex);
    await storage.updatePlayer(connection.playerId, { 
      hand: newHand,
      hasCalledUno: newHand.length === 1 ? player.hasCalledUno : false
    });
    
    // Add card to discard pile
    const newDiscardPile = [card, ...(room.discardPile || [])];
    
    // Apply card effects
    const effect = UnoGameLogic.getCardEffect(card);
    let nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
      currentPlayerIndex, 
      gamePlayers.length, 
      room.direction || "clockwise", 
      effect.skip
    );
    
    let newDirection = room.direction;
    if (effect.reverse) {
      newDirection = room.direction === "clockwise" ? "counterclockwise" : "clockwise";
    }
    
    // Update room state
    await storage.updateRoom(connection.roomId, {
      discardPile: newDiscardPile,
      currentPlayerIndex: nextPlayerIndex,
      direction: newDirection,
      currentColor: effect.chooseColor ? room.currentColor : card.color
    });
    
    // Handle draw effects
    if (effect.draw > 0) {
      const nextPlayer = gamePlayers[nextPlayerIndex];
      const roomData = await storage.getRoom(connection.roomId);
      const deck = roomData?.deck || [];
      const drawnCards = deck.splice(0, effect.draw);
      const nextPlayerHand = [...(nextPlayer.hand || []), ...drawnCards];
      
      await storage.updatePlayer(nextPlayer.id, { hand: nextPlayerHand });
      await storage.updateRoom(connection.roomId, { deck });
    }
    
    // Check for win condition
    if (newHand.length === 0) {
      await storage.updateRoom(connection.roomId, { status: "finished" });
      broadcastToRoom(connection.roomId, {
        type: 'game_end',
        winner: player.nickname
      });
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
    
    const drawnCard = deck.pop()!;
    const newHand = [...(player.hand || []), drawnCard];
    
    await storage.updatePlayer(connection.playerId, { hand: newHand });
    await storage.updateRoom(connection.roomId, { deck });
    
    // Move to next player
    const nextPlayerIndex = UnoGameLogic.getNextPlayerIndex(
      currentPlayerIndex, 
      gamePlayers.length, 
      room.direction || "clockwise"
    );
    
    await storage.updateRoom(connection.roomId, { currentPlayerIndex: nextPlayerIndex });
    await broadcastRoomState(connection.roomId);
  }

  async function handleCallUno(connection: SocketConnection, message: any) {
    if (!connection.playerId) return;
    
    const player = await storage.getPlayer(connection.playerId);
    if (!player || (player.hand || []).length !== 1) return;
    
    await storage.updatePlayer(connection.playerId, { hasCalledUno: true });
    
    if (connection.roomId) {
      broadcastToRoom(connection.roomId, {
        type: 'uno_called',
        player: player.nickname
      });
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
