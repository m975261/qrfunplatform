import http from 'http';
import WebSocket from 'ws';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve(json);
        } catch (e) {
          resolve({ error: 'Non-JSON response', data: responseData });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

function connectWebSocket(playerId, roomId) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    ws.on('open', () => {
      // Send join room message to associate this connection
      ws.send(JSON.stringify({
        type: 'join_room',
        playerId,
        roomId
      }));
      resolve(ws);
    });
  });
}

async function testUnoCall() {
  console.log('🧪 Testing UNO call WebSocket functionality...');
  
  try {
    // Create room and players
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'TestPlayer'
    });
    const roomId = roomResponse.room.id;
    const roomCode = roomResponse.room.code;
    const player1Id = roomResponse.player.id;
    
    // Add second player
    const player2Response = await makeRequest(`/api/rooms/${roomCode}/join`, 'POST', {
      nickname: 'Player2'
    });
    
    // Start game
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    
    // Set TestPlayer to have 2 cards
    await makeRequest(`/api/rooms/${roomId}/test-set-hand`, 'POST', {
      playerId: player1Id,
      hand: [
        { color: 'red', value: '5' },
        { color: 'red', value: '7' }
      ]
    });
    
    // Set a valid discard pile
    await makeRequest(`/api/rooms/${roomId}/test-set-discard`, 'POST', {
      topCard: { color: 'red', value: '3' }
    });
    
    console.log('✓ Game setup complete');
    
    // Connect WebSocket
    const ws = await connectWebSocket(player1Id, roomId);
    console.log('✓ WebSocket connected');
    
    // Wait a bit for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test UNO call
    console.log('📢 Calling UNO...');
    ws.send(JSON.stringify({
      type: 'call_uno'
    }));
    
    // Wait for server to process
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if UNO call was registered
    const gameState = await makeRequest(`/api/rooms/${roomId}`);
    const testPlayer = gameState.players.find(p => p.id === player1Id);
    
    console.log('UNO call result:');
    console.log('  hasCalledUno:', testPlayer?.hasCalledUno);
    console.log('  Hand size:', testPlayer?.hand?.length);
    
    if (testPlayer?.hasCalledUno) {
      console.log('✅ UNO call working correctly!');
    } else {
      console.log('❌ UNO call failed - WebSocket message not processed');
    }
    
    ws.close();
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testUnoCall();