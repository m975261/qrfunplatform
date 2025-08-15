// End-to-end test of wild card color selection using real room join
import WebSocket from 'ws';
import fetch from 'node-fetch';

const WS_URL = 'ws://localhost:5000/ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class GamePlayer {
  constructor(nickname) {
    this.nickname = nickname;
    this.ws = null;
    this.playerId = null;
    this.roomId = null;
    this.hand = [];
    this.colorChoiceReceived = false;
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
          const myTurn = room?.currentPlayerIndex === message.players?.findIndex(p => p.id === this.playerId);
          
          if (room?.status === 'playing') {
            const topCard = room.discardPile?.[0];
            console.log(`🎯 ${this.nickname} - Hand: ${this.hand.length} cards, Turn: ${myTurn}`);
            console.log(`🃏 Top card: ${topCard?.color} ${topCard?.type}, Current color: ${room.currentColor}`);
            
            // Check for wild cards in hand
            const wildCards = this.hand.filter(card => card.type === 'wild' || card.type === 'wild4');
            if (wildCards.length > 0 && myTurn) {
              console.log(`🔥 ${this.nickname} has wild cards and it's their turn - will play one`);
              setTimeout(() => {
                const wildIndex = this.hand.findIndex(card => card.type === 'wild' || card.type === 'wild4');
                if (wildIndex !== -1) {
                  console.log(`🎲 ${this.nickname} playing wild card: ${this.hand[wildIndex].type}`);
                  this.playCard(wildIndex);
                }
              }, 2000);
            }
          }
        }
        break;
        
      case 'choose_color_request':
        console.log(`🎨 COLOR CHOICE REQUEST RECEIVED by ${this.nickname}!`);
        console.log(`📋 Message:`, message);
        this.colorChoiceReceived = true;
        
        // Choose a color after a delay
        setTimeout(() => {
          console.log(`🎨 ${this.nickname} choosing GREEN color`);
          this.chooseColor('green');
        }, 2000);
        break;
        
      case 'wild_card_played':
        console.log(`🃏 WILD CARD PLAYED notification received by ${this.nickname}`);
        if (message.requiresColorChoice && message.playerId === this.playerId) {
          console.log(`🎨 ${this.nickname} needs to choose color`);
          this.colorChoiceReceived = true;
        }
        break;
        
      default:
        if (message.type !== 'heartbeat') {
          console.log(`📨 ${this.nickname} received: ${message.type}`);
        }
    }
  }

  async createPlayerInRoom(roomCode) {
    // Create player via API
    const response = await fetch(`http://localhost:5000/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: this.nickname,
        userFingerprint: `fp-${this.nickname}`,
        sessionId: `session-${this.nickname}`
      })
    });
    
    const data = await response.json();
    console.log(`👤 ${this.nickname} created as player:`, data.playerId);
    return data.playerId;
  }

  async joinRoomViaWebSocket(roomCode, playerId) {
    this.ws.send(JSON.stringify({
      type: 'join_room',
      roomId: roomCode,
      playerId: playerId,
      nickname: this.nickname,
      userFingerprint: `fp-${this.nickname}`,
      sessionId: `session-${this.nickname}`
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

  async startGame() {
    this.ws.send(JSON.stringify({
      type: 'start_game'
    }));
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function testCompleteWildCardFlow() {
  console.log('🧪 Testing Complete Wild Card Flow (E2E)');
  
  const player1 = new GamePlayer('WildTestHost');
  const player2 = new GamePlayer('WildTestPlayer');
  
  try {
    // Connect both players
    await player1.connect();
    await player2.connect();
    await sleep(1000);
    
    // Create room via API
    const roomResponse = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: 'test-host-123',
        hostNickname: player1.nickname
      })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room.code;
    console.log(`🏠 Room created: ${roomCode}`);
    
    // Create players in room
    const player1Id = await player1.createPlayerInRoom(roomCode);
    const player2Id = await player2.createPlayerInRoom(roomCode);
    
    await sleep(500);
    
    // Join via WebSocket
    await player1.joinRoomViaWebSocket(roomCode, player1Id);
    await sleep(500);
    await player2.joinRoomViaWebSocket(roomCode, player2Id);
    await sleep(2000);
    
    // Start the game
    console.log('🎮 Starting game...');
    await player1.startGame();
    await sleep(3000);
    
    // Give wild cards to player1 for testing
    const wildResponse = await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: player1Id,
        hand: [
          { type: "wild", color: null },
          { type: "wild4", color: null },
          { type: "number", color: "red", number: 5 }
        ]
      })
    });
    
    if (wildResponse.ok) {
      console.log('✅ Wild cards added to player1');
    }
    
    // Set player1's turn
    await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: 0 })
    });
    
    console.log('🎯 Waiting for wild card play and color selection...');
    await sleep(15000);
    
    // Check results
    if (player1.colorChoiceReceived) {
      console.log('✅ Color choice request was received successfully!');
    } else {
      console.log('❌ Color choice request was NOT received');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sleep(2000);
    player1.close();
    player2.close();
    console.log('🔚 Test completed');
  }
}

testCompleteWildCardFlow().catch(console.error);