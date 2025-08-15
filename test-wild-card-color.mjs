// Test script to verify wild card color selection system
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:5000/ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class GameTester {
  constructor(nickname) {
    this.nickname = nickname;
    this.ws = null;
    this.playerId = null;
    this.roomId = null;
    this.connectionId = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log(`✅ ${this.nickname} connected to WebSocket`);
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error(`❌ ${this.nickname} message parse error:`, error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error(`❌ ${this.nickname} WebSocket error:`, error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log(`🔌 ${this.nickname} WebSocket closed`);
      };
    });
  }

  handleMessage(message) {
    console.log(`📨 ${this.nickname} received:`, message.type);
    
    switch (message.type) {
      case 'room_joined':
        this.playerId = message.playerId;
        this.roomId = message.roomId;
        this.connectionId = message.connectionId;
        console.log(`🎮 ${this.nickname} joined room: ${this.roomId}, player: ${this.playerId}`);
        break;
        
      case 'room_state':
        const room = message.room;
        if (room?.status === 'playing') {
          console.log(`🎲 Game is playing - current player: ${room.currentPlayerIndex}`);
          console.log(`🃏 Top card: ${room.discardPile?.[0]?.color} ${room.discardPile?.[0]?.value || room.discardPile?.[0]?.type}`);
          console.log(`🎨 Current color: ${room.currentColor || 'none'}`);
        }
        break;
        
      case 'choose_color_request':
        console.log(`🎨 COLOR CHOICE REQUEST RECEIVED by ${this.nickname}!`);
        console.log(`📋 Message details:`, message);
        // Automatically choose red for testing
        setTimeout(() => {
          console.log(`🎨 ${this.nickname} choosing RED color`);
          this.chooseColor('red');
        }, 1000);
        break;
        
      case 'game_state':
        console.log(`🎮 Game state updated for ${this.nickname}`);
        break;
    }
  }

  async createRoom() {
    const response = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: `test-${this.nickname}-${Date.now()}`,
        hostNickname: this.nickname
      })
    });
    
    const data = await response.json();
    console.log(`🏠 ${this.nickname} created room:`, data.room.code);
    return data.room.id;
  }

  async joinRoom(roomId) {
    this.ws.send(JSON.stringify({
      type: 'join_room',
      roomId: roomId,
      playerId: `test-${this.nickname}-${Date.now()}`,
      nickname: this.nickname,
      userFingerprint: `fp-${this.nickname}`,
      sessionId: `session-${this.nickname}`
    }));
  }

  async startGame() {
    this.ws.send(JSON.stringify({
      type: 'start_game'
    }));
  }

  async playCard(cardIndex) {
    console.log(`🃏 ${this.nickname} playing card at index ${cardIndex}`);
    this.ws.send(JSON.stringify({
      type: 'play_card',
      cardIndex: cardIndex
    }));
  }

  async chooseColor(color) {
    console.log(`🎨 ${this.nickname} sending color choice: ${color}`);
    this.ws.send(JSON.stringify({
      type: 'choose_color',
      color: color
    }));
  }

  async drawCard() {
    this.ws.send(JSON.stringify({
      type: 'draw_card'
    }));
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function testWildCardColorSelection() {
  console.log('🧪 Testing Wild Card Color Selection System');
  
  const player1 = new GameTester('TestPlayer1');
  const player2 = new GameTester('TestPlayer2');
  
  try {
    // Connect both players
    await player1.connect();
    await player2.connect();
    await sleep(1000);
    
    // Create room and join
    const roomId = await player1.createRoom();
    await sleep(500);
    
    await player1.joinRoom(roomId);
    await sleep(500);
    await player2.joinRoom(roomId);
    await sleep(1000);
    
    // Start the game
    console.log('🎮 Starting game...');
    await player1.startGame();
    await sleep(2000);
    
    console.log('🃏 Testing wild card play...');
    
    // Try to find and play a wild card
    // First try drawing cards to get different options
    for (let i = 0; i < 5; i++) {
      console.log(`🎯 Player1 attempting to play card ${i}`);
      await player1.playCard(i);
      await sleep(500);
    }
    
    // Player2 tries to play wild cards
    for (let i = 0; i < 5; i++) {
      console.log(`🎯 Player2 attempting to play card ${i}`);
      await player2.playCard(i);
      await sleep(500);
    }
    
    console.log('✅ Test completed - check logs for color selection behavior');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sleep(2000);
    player1.close();
    player2.close();
  }
}

// Run the test
testWildCardColorSelection().catch(console.error);