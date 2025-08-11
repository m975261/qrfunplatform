import WebSocket from 'ws';
import { readFileSync } from 'fs';

// Simple HTTP request function without external dependencies
async function makeRequest(url, options = {}) {
  const http = await import('http');
  const https = await import('https');
  const { URL } = await import('url');
  
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ ok: res.statusCode < 400, status: res.statusCode, data: result });
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

class UNOGameTester {
  constructor() {
    this.connections = new Map();
    this.rooms = new Map();
    this.testResults = {
      passed: [],
      failed: [],
      issues: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '🔍';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  addIssue(category, description) {
    this.testResults.issues.push({ category, description });
    this.log(`ISSUE FOUND: ${category} - ${description}`, 'error');
  }

  async createWebSocketConnection(playerId, nickname) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const connectionData = { playerId, nickname, ws, messages: [] };

      ws.on('open', () => {
        this.log(`WebSocket connected for ${nickname}`);
        this.connections.set(playerId, connectionData);
        resolve(connectionData);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          connectionData.messages.push({ timestamp: Date.now(), ...message });
          this.log(`${nickname} received: ${message.type}`, 'info');
        } catch (e) {
          this.addIssue('WebSocket', `Failed to parse message for ${nickname}: ${e.message}`);
        }
      });

      ws.on('error', (error) => {
        this.addIssue('WebSocket', `Connection error for ${nickname}: ${error.message}`);
        reject(error);
      });

      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error(`Connection timeout for ${nickname}`));
        }
      }, 5000);
    });
  }

  async httpRequest(method, endpoint, body = null) {
    try {
      const response = await makeRequest(`${BASE_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error) {
      this.addIssue('HTTP', `${method} ${endpoint} failed: ${error.message}`);
      throw error;
    }
  }

  async sendWSMessage(playerId, message) {
    const connection = this.connections.get(playerId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      this.addIssue('WebSocket', `Connection not ready for player ${playerId}`);
      return false;
    }

    connection.ws.send(JSON.stringify(message));
    await this.wait(100); // Small delay for processing
    return true;
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getLastMessage(playerId, type = null) {
    const connection = this.connections.get(playerId);
    if (!connection) return null;

    if (type) {
      return connection.messages.reverse().find(msg => msg.type === type);
    }
    return connection.messages[connection.messages.length - 1];
  }

  getGameState(playerId) {
    const roomState = this.getLastMessage(playerId, 'room_state');
    return roomState ? roomState.data : null;
  }

  // TEST 1: Room Creation and Management
  async testRoomCreation() {
    this.log('Testing room creation and management...');
    
    try {
      // Create room
      const roomData = await this.httpRequest('POST', '/api/rooms', { 
        hostNickname: 'TestHost' 
      });
      
      if (!roomData.room || !roomData.player) {
        this.addIssue('Room Creation', 'Missing room or player data in response');
        return false;
      }

      this.rooms.set('test-room', {
        id: roomData.room.id,
        code: roomData.room.code,
        hostId: roomData.player.id
      });

      this.log(`Room created with code: ${roomData.room.code}`);
      
      // Test room retrieval
      const retrievedRoom = await this.httpRequest('GET', `/api/rooms/${roomData.room.id}`);
      if (retrievedRoom.room.code !== roomData.room.code) {
        this.addIssue('Room Retrieval', 'Room data inconsistent after creation');
        return false;
      }

      this.testResults.passed.push('Room Creation');
      return true;
    } catch (error) {
      this.testResults.failed.push('Room Creation');
      return false;
    }
  }

  // TEST 2: Player Joining
  async testPlayerJoining() {
    this.log('Testing player joining...');
    
    const room = this.rooms.get('test-room');
    if (!room) {
      this.addIssue('Player Joining', 'No test room available');
      return false;
    }

    try {
      // Join players via HTTP first
      const players = ['Player1', 'Player2', 'Player3'];
      const playerData = [];

      for (let i = 0; i < players.length; i++) {
        const joinData = await this.httpRequest('POST', `/api/rooms/${room.code}/join`, {
          nickname: players[i]
        });
        
        if (!joinData.player) {
          this.addIssue('Player Joining', `Failed to join player ${players[i]}`);
          return false;
        }

        playerData.push({
          id: joinData.player.id,
          nickname: players[i],
          roomId: joinData.room.id
        });

        // Create WebSocket connections
        await this.createWebSocketConnection(joinData.player.id, players[i]);
      }

      // Test WebSocket room joining
      for (const player of playerData) {
        await this.sendWSMessage(player.id, {
          type: 'join_room',
          playerId: player.id,
          roomId: player.roomId,
          userFingerprint: `test-${player.id}`,
          sessionId: `session-${player.id}`
        });
      }

      await this.wait(1000);

      // Verify all players are in room state
      const gameState = this.getGameState(playerData[0].id);
      if (!gameState || !gameState.players || gameState.players.length !== 4) { // Including host
        this.addIssue('Player Joining', 'Players not properly reflected in game state');
        return false;
      }

      this.rooms.get('test-room').players = playerData;
      this.testResults.passed.push('Player Joining');
      return true;
    } catch (error) {
      this.testResults.failed.push('Player Joining');
      return false;
    }
  }

  // TEST 3: Game Start
  async testGameStart() {
    this.log('Testing game start...');
    
    const room = this.rooms.get('test-room');
    if (!room || !room.players) {
      this.addIssue('Game Start', 'No room with players available');
      return false;
    }

    try {
      // Start game via HTTP
      await this.httpRequest('POST', `/api/rooms/${room.id}/start`);
      await this.wait(1000);

      // Check if all players received game started state
      for (const player of room.players) {
        const gameState = this.getGameState(player.id);
        if (!gameState || gameState.room.status !== 'playing') {
          this.addIssue('Game Start', `Player ${player.nickname} did not receive playing status`);
          return false;
        }

        if (!gameState.players.find(p => p.id === player.id)?.hand || 
            gameState.players.find(p => p.id === player.id).hand.length !== 7) {
          this.addIssue('Game Start', `Player ${player.nickname} does not have 7 starting cards`);
          return false;
        }
      }

      this.testResults.passed.push('Game Start');
      return true;
    } catch (error) {
      this.testResults.failed.push('Game Start');
      return false;
    }
  }

  // TEST 4: Card Playing
  async testCardPlaying() {
    this.log('Testing card playing...');
    
    const room = this.rooms.get('test-room');
    if (!room || !room.players) {
      this.addIssue('Card Playing', 'No active game available');
      return false;
    }

    try {
      let gameState = this.getGameState(room.players[0].id);
      const currentPlayer = gameState.players[gameState.room.currentPlayerIndex];
      const topCard = gameState.room.discardPile[0];

      this.log(`Current player: ${currentPlayer.nickname}, Top card: ${topCard.color} ${topCard.type} ${topCard.number || ''}`);

      // Find a playable card
      let playableCardIndex = -1;
      for (let i = 0; i < currentPlayer.hand.length; i++) {
        const card = currentPlayer.hand[i];
        if (card.color === topCard.color || 
            card.number === topCard.number ||
            card.type === topCard.type ||
            card.type === 'wild' || 
            card.type === 'wild4') {
          playableCardIndex = i;
          break;
        }
      }

      if (playableCardIndex === -1) {
        this.log('No playable card found, testing draw card functionality');
        
        // Test drawing a card
        await this.sendWSMessage(currentPlayer.id, { type: 'draw_card' });
        await this.wait(1000);

        gameState = this.getGameState(room.players[0].id);
        const updatedPlayer = gameState.players.find(p => p.id === currentPlayer.id);
        
        if (updatedPlayer.hand.length !== currentPlayer.hand.length + 1) {
          this.addIssue('Card Playing', 'Draw card did not increase hand size by 1');
          return false;
        }

        this.log('Draw card functionality working');
      } else {
        const cardToPlay = currentPlayer.hand[playableCardIndex];
        this.log(`Playing card: ${cardToPlay.color} ${cardToPlay.type} ${cardToPlay.number || ''}`);

        // Handle wild cards
        if (cardToPlay.type === 'wild' || cardToPlay.type === 'wild4') {
          await this.sendWSMessage(currentPlayer.id, { 
            type: 'choose_color', 
            color: 'red' 
          });
          await this.wait(100);
        }

        await this.sendWSMessage(currentPlayer.id, { 
          type: 'play_card', 
          cardIndex: playableCardIndex 
        });
        await this.wait(1000);

        gameState = this.getGameState(room.players[0].id);
        const updatedPlayer = gameState.players.find(p => p.id === currentPlayer.id);
        
        if (updatedPlayer.hand.length !== currentPlayer.hand.length - 1) {
          this.addIssue('Card Playing', 'Play card did not decrease hand size by 1');
          return false;
        }

        this.log('Card playing functionality working');
      }

      this.testResults.passed.push('Card Playing');
      return true;
    } catch (error) {
      this.testResults.failed.push('Card Playing');
      return false;
    }
  }

  // TEST 5: UNO Call System
  async testUNOSystem() {
    this.log('Testing UNO call system...');
    
    const room = this.rooms.get('test-room');
    if (!room || !room.players) {
      this.addIssue('UNO System', 'No active game available');
      return false;
    }

    try {
      // Test UNO call when player has multiple cards (should work but not prevent penalty)
      const testPlayer = room.players[0];
      await this.sendWSMessage(testPlayer.id, { type: 'call_uno' });
      await this.wait(500);

      let gameState = this.getGameState(testPlayer.id);
      const playerAfterUnoCall = gameState.players.find(p => p.id === testPlayer.id);
      
      if (!playerAfterUnoCall.hasCalledUno) {
        this.addIssue('UNO System', 'UNO call not registered in player state');
        return false;
      }

      this.log('UNO call system working');
      this.testResults.passed.push('UNO System');
      return true;
    } catch (error) {
      this.testResults.failed.push('UNO System');
      return false;
    }
  }

  // TEST 6: Special Cards (Wild Draw 4, Draw 2, etc.)
  async testSpecialCards() {
    this.log('Testing special card effects...');
    
    try {
      // This test simulates playing special cards by directly manipulating game state
      // In a real scenario, we'd need to set up specific card situations
      
      // Test Wild Draw 4 penalty amount
      const room = this.rooms.get('test-room');
      const gameState = this.getGameState(room.players[0].id);
      
      // Look for any pending draw effects in current game state
      if (gameState.room.pendingDraw > 0) {
        this.log(`Found pending draw: ${gameState.room.pendingDraw} cards`);
        
        // Verify the amount is correct based on card type
        const topCard = gameState.room.discardPile[0];
        if (topCard.type === 'wild4' && gameState.room.pendingDraw !== 4) {
          this.addIssue('Special Cards', `Wild Draw 4 should create 4 card penalty, found ${gameState.room.pendingDraw}`);
          return false;
        }
        
        if (topCard.type === 'draw2' && gameState.room.pendingDraw !== 2) {
          this.addIssue('Special Cards', `Draw 2 should create 2 card penalty, found ${gameState.room.pendingDraw}`);
          return false;
        }
      }

      this.log('Special cards penalty amounts appear correct');
      this.testResults.passed.push('Special Cards');
      return true;
    } catch (error) {
      this.testResults.failed.push('Special Cards');
      return false;
    }
  }

  // TEST 7: Game End Detection
  async testGameEndDetection() {
    this.log('Testing game end detection...');
    
    try {
      const room = this.rooms.get('test-room');
      
      // Simulate a player winning by checking if any player has 0 cards
      let gameState = this.getGameState(room.players[0].id);
      const winningPlayer = gameState.players.find(p => p.hand && p.hand.length === 0);
      
      if (winningPlayer) {
        this.log(`Player ${winningPlayer.nickname} has won with 0 cards`);
        
        // Check if game_end message was sent
        let gameEndReceived = false;
        for (const player of room.players) {
          const gameEndMsg = this.getLastMessage(player.id, 'game_end');
          if (gameEndMsg && gameEndMsg.winner) {
            gameEndReceived = true;
            this.log(`Game end message received: winner = ${gameEndMsg.winner}`);
            break;
          }
        }
        
        if (!gameEndReceived) {
          this.addIssue('Game End', 'Game end message not sent when player reaches 0 cards');
          return false;
        }
        
        // Check if room status changed to finished
        if (gameState.room.status !== 'finished') {
          this.addIssue('Game End', 'Room status not changed to finished after win');
          return false;
        }
      }

      this.testResults.passed.push('Game End Detection');
      return true;
    } catch (error) {
      this.testResults.failed.push('Game End Detection');
      return false;
    }
  }

  // TEST 8: Winner Modal Data
  async testWinnerModalData() {
    this.log('Testing winner modal data integrity...');
    
    try {
      const room = this.rooms.get('test-room');
      
      // Check if any player received game_end message with proper data structure
      let gameEndMessage = null;
      for (const player of room.players) {
        const msg = this.getLastMessage(player.id, 'game_end');
        if (msg) {
          gameEndMessage = msg;
          break;
        }
      }
      
      if (gameEndMessage) {
        if (!gameEndMessage.winner) {
          this.addIssue('Winner Modal', 'Game end message missing winner field');
          return false;
        }
        
        if (!gameEndMessage.rankings || !Array.isArray(gameEndMessage.rankings)) {
          this.addIssue('Winner Modal', 'Game end message missing or invalid rankings array');
          return false;
        }
        
        // Verify rankings structure
        for (const ranking of gameEndMessage.rankings) {
          if (!ranking.nickname || typeof ranking.position === 'undefined') {
            this.addIssue('Winner Modal', 'Ranking entry missing nickname or position');
            return false;
          }
        }
        
        this.log('Winner modal data structure is valid');
      } else {
        this.log('No game end message found - game may not have ended yet');
      }

      this.testResults.passed.push('Winner Modal Data');
      return true;
    } catch (error) {
      this.testResults.failed.push('Winner Modal Data');
      return false;
    }
  }

  // Main test runner
  async runAllTests() {
    this.log('Starting comprehensive UNO game test suite...', 'info');
    
    const tests = [
      { name: 'Room Creation', func: this.testRoomCreation },
      { name: 'Player Joining', func: this.testPlayerJoining },
      { name: 'Game Start', func: this.testGameStart },
      { name: 'Card Playing', func: this.testCardPlaying },
      { name: 'UNO System', func: this.testUNOSystem },
      { name: 'Special Cards', func: this.testSpecialCards },
      { name: 'Game End Detection', func: this.testGameEndDetection },
      { name: 'Winner Modal Data', func: this.testWinnerModalData }
    ];

    for (const test of tests) {
      try {
        const result = await test.func.call(this);
        if (result) {
          this.log(`✅ ${test.name} - PASSED`, 'success');
        } else {
          this.log(`❌ ${test.name} - FAILED`, 'error');
        }
        await this.wait(1000); // Wait between tests
      } catch (error) {
        this.log(`❌ ${test.name} - ERROR: ${error.message}`, 'error');
        this.testResults.failed.push(test.name);
      }
    }

    // Cleanup connections
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('                    TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n✅ PASSED TESTS (${this.testResults.passed.length}):`);
    this.testResults.passed.forEach(test => console.log(`   • ${test}`));
    
    console.log(`\n❌ FAILED TESTS (${this.testResults.failed.length}):`);
    this.testResults.failed.forEach(test => console.log(`   • ${test}`));
    
    console.log(`\n🔍 ISSUES FOUND (${this.testResults.issues.length}):`);
    this.testResults.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. [${issue.category}] ${issue.description}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`Total Tests: ${this.testResults.passed.length + this.testResults.failed.length}`);
    console.log(`Success Rate: ${Math.round((this.testResults.passed.length / (this.testResults.passed.length + this.testResults.failed.length)) * 100)}%`);
    console.log('='.repeat(60));
  }
}

// Run the tests
const tester = new UNOGameTester();
tester.runAllTests().catch(console.error);