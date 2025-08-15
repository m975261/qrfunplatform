// Complete wild card test with full debugging
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
    this.colorChoiceReceived = false;
    this.messages = [];
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
          this.messages.push(message);
          this.handleMessage(message);
        } catch (error) {
          console.error(`❌ ${this.nickname} parse error:`, error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error(`❌ ${this.nickname} WebSocket error:`, error);
        reject(error);
      };
      
      this.ws.onclose = (event) => {
        console.log(`🔌 ${this.nickname} disconnected: code=${event.code}, reason="${event.reason}"`);
        if (event.code === 1006) {
          console.log(`⚠️ ${this.nickname} disconnected abnormally (1006) - possible server error or network issue`);
        }
      };
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'room_joined':
        this.playerId = message.playerId;
        this.roomId = message.roomId;
        console.log(`🎮 ${this.nickname} joined room - Player ID: ${this.playerId}`);
        break;
        
      case 'room_state':
        const room = message.room;
        const myPlayer = message.players?.find(p => p.id === this.playerId);
        
        if (myPlayer) {
          this.hand = myPlayer.hand || [];
          const playerIndex = message.players?.findIndex(p => p.id === this.playerId);
          const myTurn = room?.currentPlayerIndex === playerIndex;
          
          console.log(`🎯 ${this.nickname} - Hand: ${this.hand.length} cards, Turn: ${myTurn}`);
          
          if (room?.status === 'playing' && myTurn) {
            const wildCard = this.hand.find(card => card.type === 'wild' || card.type === 'wild4');
            if (wildCard) {
              const wildIndex = this.hand.findIndex(card => card.type === 'wild' || card.type === 'wild4');
              console.log(`🃏 ${this.nickname} has wild card - playing it in 1 second`);
              setTimeout(() => {
                this.playCard(wildIndex);
              }, 1000);
            }
          }
        }
        break;
        
      case 'choose_color_request':
        console.log(`🎨 COLOR CHOICE REQUEST RECEIVED by ${this.nickname}!`);
        console.log(`📋 Full message:`, JSON.stringify(message, null, 2));
        this.colorChoiceReceived = true;
        
        setTimeout(() => {
          console.log(`🎨 ${this.nickname} choosing BLUE color`);
          this.chooseColor('blue');
        }, 2000);
        break;
        
      case 'wild_card_played':
        console.log(`🃏 WILD CARD PLAYED notification for ${this.nickname}`);
        if (message.requiresColorChoice && message.playerId === this.playerId) {
          console.log(`🎨 ${this.nickname} should choose color`);
          this.colorChoiceReceived = true;
        }
        break;
        
      default:
        if (message.type !== 'heartbeat' && message.type !== 'room_state') {
          console.log(`📨 ${this.nickname} received: ${message.type}`);
        }
    }
  }

  async createPlayer(roomCode) {
    const response = await fetch(`http://localhost:5000/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: this.nickname,
        userFingerprint: `fp-${this.nickname}-${Date.now()}`,
        sessionId: `session-${this.nickname}-${Date.now()}`
      })
    });
    
    const data = await response.json();
    console.log(`👤 ${this.nickname} API response:`, data);
    const playerId = data.player?.id;
    console.log(`👤 ${this.nickname} created as player:`, playerId);
    return playerId;
  }

  async joinRoom(roomCode, playerId) {
    this.ws.send(JSON.stringify({
      type: 'join_room',
      roomId: roomCode,
      playerId: playerId,
      nickname: this.nickname,
      userFingerprint: `fp-${this.nickname}-${Date.now()}`,
      sessionId: `session-${this.nickname}-${Date.now()}`
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

async function testWildCardFlow() {
  console.log('🧪 TESTING WILD CARD COLOR SELECTION FLOW');
  console.log('=' .repeat(60));
  
  const host = new TestPlayer('TestHost');
  const player2 = new TestPlayer('TestPlayer2');
  
  try {
    // Step 1: Connect both players
    console.log('🔌 Connecting players...');
    await host.connect();
    await player2.connect();
    await sleep(1000);
    
    // Step 2: Create room
    console.log('🏠 Creating room...');
    const roomResponse = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: 'test-host-wild-debug',
        hostNickname: host.nickname
      })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room.code;
    console.log(`🏠 Room created with code: ${roomCode}`);
    
    // Step 3: Create players in room
    console.log('👥 Adding players to room...');
    const hostId = await host.createPlayer(roomCode);
    const player2Id = await player2.createPlayer(roomCode);
    
    await sleep(500);
    
    // Step 4: Join via WebSocket
    console.log('🎮 Joining room via WebSocket...');
    await host.joinRoom(roomCode, hostId);
    await sleep(500);
    await player2.joinRoom(roomCode, player2Id);
    await sleep(2000);
    
    // Step 5: Start game  
    console.log('🎯 Starting game...');
    await host.startGame();
    await sleep(5000); // Give more time for game to start
    
    // Step 6: Give wild cards to host
    console.log('🃏 Adding wild cards to host...');
    const handResponse = await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: hostId,
        hand: [
          { type: "wild", color: null },
          { type: "number", color: "red", number: 5 },
          { type: "number", color: "blue", number: 3 }
        ]
      })
    });
    
    if (handResponse.ok) {
      console.log('✅ Wild cards added to host');
    } else {
      console.log('❌ Failed to add wild cards');
    }
    
    // Step 7: Set host's turn
    console.log('🎯 Setting host turn...');
    await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: 0 })
    });
    
    console.log('⏱️ Waiting for wild card play and color selection...');
    console.log('Looking for these key events:');
    console.log('  1. Wild card play');
    console.log('  2. Server sends choose_color_request');
    console.log('  3. Client receives and handles message');
    console.log('  4. Color selection completes');
    console.log('-'.repeat(60));
    
    // Step 8: Wait and monitor
    await sleep(15000);
    
    // Step 9: Analyze results
    console.log('=' .repeat(60));
    console.log('🔍 TEST RESULTS ANALYSIS');
    console.log('=' .repeat(60));
    
    console.log(`Host received color choice request: ${host.colorChoiceReceived ? '✅ YES' : '❌ NO'}`);
    console.log(`Player2 received color choice request: ${player2.colorChoiceReceived ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n📋 Host message types received:');
    const hostMessageTypes = [...new Set(host.messages.map(m => m.type))];
    hostMessageTypes.forEach(type => {
      const count = host.messages.filter(m => m.type === type).length;
      console.log(`  - ${type}: ${count} times`);
    });
    
    console.log('\n📋 Player2 message types received:');
    const player2MessageTypes = [...new Set(player2.messages.map(m => m.type))];
    player2MessageTypes.forEach(type => {
      const count = player2.messages.filter(m => m.type === type).length;
      console.log(`  - ${type}: ${count} times`);
    });
    
    // Check for specific messages
    const hostColorRequests = host.messages.filter(m => m.type === 'choose_color_request');
    const hostWildPlayed = host.messages.filter(m => m.type === 'wild_card_played');
    
    console.log(`\n🎨 Color choice requests to host: ${hostColorRequests.length}`);
    if (hostColorRequests.length > 0) {
      console.log('   Latest request:', JSON.stringify(hostColorRequests[hostColorRequests.length - 1], null, 2));
    }
    
    console.log(`🃏 Wild card played messages to host: ${hostWildPlayed.length}`);
    if (hostWildPlayed.length > 0) {
      console.log('   Latest message:', JSON.stringify(hostWildPlayed[hostWildPlayed.length - 1], null, 2));
    }
    
    if (host.colorChoiceReceived) {
      console.log('\n✅ SUCCESS: Color choice request was received and handled!');
    } else {
      console.log('\n❌ FAILURE: Color choice request was NOT received by the player.');
      console.log('   This indicates a problem in the WebSocket message flow.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    console.log('\n🧹 Cleaning up...');
    await sleep(1000);
    host.close();
    player2.close();
    console.log('🔚 Test completed');
  }
}

testWildCardFlow().catch(console.error);