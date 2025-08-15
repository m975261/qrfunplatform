// Comprehensive test to fix wild card color selection
import WebSocket from 'ws';
import fetch from 'node-fetch';

const WS_URL = 'ws://localhost:5000/ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class TestPlayer {
  constructor(nickname) {
    this.nickname = nickname;
    this.ws = null;
    this.playerId = null;
    this.roomId = null;
    this.hand = [];
    this.isMyTurn = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log(`✅ ${this.nickname} connected`);
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error(`❌ ${this.nickname} parse error:`, error);
        }
      };
      
      this.ws.onerror = reject;
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'room_joined':
        this.playerId = message.playerId;
        this.roomId = message.roomId;
        console.log(`🎮 ${this.nickname} joined - Player ID: ${this.playerId}`);
        break;
        
      case 'room_state':
        const room = message.room;
        const myPlayer = message.players?.find(p => p.id === this.playerId);
        
        if (myPlayer) {
          this.hand = myPlayer.hand || [];
          this.isMyTurn = room?.currentPlayerIndex === message.players?.findIndex(p => p.id === this.playerId);
          
          console.log(`🎯 ${this.nickname} - Hand: ${this.hand.length} cards, My turn: ${this.isMyTurn}`);
          
          if (room?.status === 'playing') {
            console.log(`🃏 Top card: ${room.discardPile?.[0]?.color} ${room.discardPile?.[0]?.value || room.discardPile?.[0]?.type}`);
            console.log(`🎨 Current color: ${room.currentColor || 'none'}`);
            
            // Look for wild cards in hand
            const wildCards = this.hand.filter(card => card.type === 'wild' || card.type === 'wild4');
            if (wildCards.length > 0) {
              console.log(`🔥 ${this.nickname} has ${wildCards.length} wild cards: ${wildCards.map(c => c.type).join(', ')}`);
              
              if (this.isMyTurn) {
                console.log(`🎯 ${this.nickname} can play wild card!`);
                setTimeout(() => {
                  const wildIndex = this.hand.findIndex(card => card.type === 'wild' || card.type === 'wild4');
                  if (wildIndex !== -1) {
                    console.log(`🎲 ${this.nickname} playing wild card at index ${wildIndex}`);
                    this.playCard(wildIndex);
                  }
                }, 1000);
              }
            }
          }
        }
        break;
        
      case 'choose_color_request':
        console.log(`🎨 COLOR CHOICE REQUEST RECEIVED by ${this.nickname}!`);
        console.log(`📋 Full message:`, JSON.stringify(message, null, 2));
        
        // Choose a color after a short delay
        setTimeout(() => {
          console.log(`🎨 ${this.nickname} choosing BLUE color`);
          this.chooseColor('blue');
        }, 2000);
        break;
        
      case 'game_state':
        console.log(`🎮 ${this.nickname} received game_state update`);
        break;
        
      default:
        if (message.type !== 'heartbeat') {
          console.log(`📨 ${this.nickname} received: ${message.type}`);
        }
    }
  }

  async createRoom() {
    const response = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: `host-${Date.now()}`,
        hostNickname: this.nickname
      })
    });
    
    const data = await response.json();
    console.log(`🏠 Room created: ${data.room.code}`);
    return data.room.id;
  }

  async joinRoom(roomId) {
    this.ws.send(JSON.stringify({
      type: 'join_room',
      roomId: roomId,
      playerId: `player-${this.nickname}-${Date.now()}`,
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
    console.log(`🃏 ${this.nickname} playing card at index ${cardIndex}: ${this.hand[cardIndex]?.type}`);
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

  async addWildCards() {
    // Add wild cards directly to hand using test endpoint
    try {
      const response = await fetch(`http://localhost:5000/api/rooms/${this.roomId}/test-set-hand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId,
          hand: [
            { type: "wild", color: null, value: "wild" },
            { type: "wild4", color: null, value: "wild4" },
            { type: "number", color: "red", number: 5 },
            { type: "number", color: "blue", number: 3 }
          ]
        })
      });
      
      if (response.ok) {
        console.log(`✅ ${this.nickname} hand set with wild cards`);
      } else {
        console.log(`❌ Failed to set ${this.nickname} hand`);
      }
    } catch (error) {
      console.log(`❌ Error setting hand: ${error.message}`);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function testWildCardSystem() {
  console.log('🧪 Starting Wild Card Color Selection Test');
  
  const player1 = new TestPlayer('WildTester1');
  const player2 = new TestPlayer('WildTester2');
  
  try {
    // Connect players
    await player1.connect();
    await player2.connect();
    await sleep(1000);
    
    // Create and join room
    const roomId = await player1.createRoom();
    await sleep(500);
    
    await player1.joinRoom(roomId);
    await sleep(500);
    await player2.joinRoom(roomId);
    await sleep(2000);
    
    // Start game
    console.log('🎮 Starting game...');
    await player1.startGame();
    await sleep(3000);
    
    // Add wild cards to player1's hand
    console.log('🎯 Setting up wild cards for testing...');
    await player1.addWildCards();
    await sleep(1000);
    
    // Set player1's turn
    const turnResponse = await fetch(`http://localhost:5000/api/rooms/${roomId}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: 0 })
    });
    
    if (turnResponse.ok) {
      console.log('✅ Set turn to player1');
    }
    
    await sleep(2000);
    
    console.log('🎯 Test will run for 30 seconds to observe behavior...');
    await sleep(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    player1.close();
    player2.close();
    console.log('🔚 Test completed');
  }
}

testWildCardSystem().catch(console.error);