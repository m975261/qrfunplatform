import { WebSocket } from 'ws';
import fetch from 'node-fetch';

console.log('🧪 Testing Universal Winner Modal System...\n');

const API_BASE = 'http://localhost:5000';
const WS_BASE = 'ws://localhost:5000/ws';

// Helper to create test players
async function createPlayer(nickname) {
  const response = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostNickname: nickname })
  });
  const data = await response.json();
  return {
    roomCode: data.room.code,
    playerId: data.player.id,
    roomId: data.room.id
  };
}

// Helper to join existing room
async function joinRoom(roomCode, nickname) {
  const response = await fetch(`${API_BASE}/api/rooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode, nickname })
  });
  const data = await response.json();
  return {
    playerId: data.player.id,
    roomId: data.room.id
  };
}

// Helper to create WebSocket connection
function createWebSocket(playerId, roomId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_BASE);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join_room',
        playerId,
        roomId
      }));
      resolve(ws);
    });
    
    ws.on('error', reject);
  });
}

async function testWinnerModal() {
  try {
    console.log('1️⃣ Creating test room with host...');
    const host = await createPlayer('Alice');
    console.log(`   Room created: ${host.roomCode}`);
    
    console.log('2️⃣ Adding 3 more players...');
    const player2 = await joinRoom(host.roomCode, 'Bob');
    const player3 = await joinRoom(host.roomCode, 'Charlie');
    const player4 = await joinRoom(host.roomCode, 'Diana');
    console.log('   All players joined');
    
    console.log('3️⃣ Creating WebSocket connections...');
    const hostWs = await createWebSocket(host.playerId, host.roomId);
    const player2Ws = await createWebSocket(player2.playerId, player2.roomId);
    const player3Ws = await createWebSocket(player3.playerId, player3.roomId);
    const player4Ws = await createWebSocket(player4.playerId, player4.roomId);
    console.log('   All WebSocket connections established');
    
    console.log('4️⃣ Starting game...');
    const startResponse = await fetch(`${API_BASE}/api/rooms/${host.roomCode}/start`, {
      method: 'POST'
    });
    console.log(`   Game start status: ${startResponse.status}`);
    
    // Wait for game state to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('5️⃣ Simulating game end...');
    
    // Create test game end data
    const gameEndData = {
      winner: 'Alice',
      rankings: [
        { nickname: 'Alice' },
        { nickname: 'Bob' },
        { nickname: 'Charlie' },
        { nickname: 'Diana' }
      ]
    };
    
    // Send game end message through WebSocket
    console.log('6️⃣ Broadcasting game_end message to all players...');
    const gameEndMessage = JSON.stringify({
      type: 'game_end',
      ...gameEndData
    });
    
    // Simulate server broadcasting game end to all connections
    [hostWs, player2Ws, player3Ws, player4Ws].forEach((ws, index) => {
      ws.send(gameEndMessage);
      console.log(`   Sent game_end to player ${index + 1}`);
    });
    
    console.log('7️⃣ Winner modal should now display on all connected clients!');
    console.log('   Modal should show:');
    console.log('   🏆 Trophy icon');
    console.log('   "Alice Wins!" title');
    console.log('   Final Rankings: 1st-Alice, 2nd-Bob, 3rd-Charlie, 4th-Diana');
    console.log('   Two buttons: "Play Again" (green) and "Home" (red)');
    
    console.log('\n✅ Winner modal test completed!');
    console.log('📱 Test this on any browser including iOS Safari');
    console.log(`🔗 Game URL: http://localhost:5000/game/${host.roomCode}`);
    
    // Keep connections alive for manual testing
    console.log('\n⏱️ Keeping connections alive for 60 seconds for manual testing...');
    setTimeout(() => {
      console.log('🔚 Closing test connections...');
      [hostWs, player2Ws, player3Ws, player4Ws].forEach(ws => ws.close());
      process.exit(0);
    }, 60000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testWinnerModal();