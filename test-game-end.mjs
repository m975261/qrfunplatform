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
  console.log('🧪 Testing complete UNO call system...');
  
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
    
    console.log('✓ Game setup complete');
    
    // Test 1: UNO call with 5 cards (should work now - always available)
    await makeRequest(`/api/rooms/${roomId}/test-set-hand`, 'POST', {
      playerId: player1Id,
      hand: [
        { color: 'red', value: '1' },
        { color: 'red', value: '2' },
        { color: 'red', value: '3' },
        { color: 'red', value: '4' },
        { color: 'red', value: '5' }
      ]
    });
    
    const ws = await connectWebSocket(player1Id, roomId);
    console.log('✓ WebSocket connected');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('📢 Test 1: Calling UNO with 5 cards (should trigger voice + animation)...');
    ws.send(JSON.stringify({ type: 'call_uno' }));
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait longer for voice processing
    
    let gameState = await makeRequest(`/api/rooms/${roomId}`);
    let testPlayer = gameState.players.find(p => p.id === player1Id);
    
    console.log('UNO call with 5 cards:');
    console.log('  hasCalledUno:', testPlayer?.hasCalledUno);
    console.log('  Hand size:', testPlayer?.hand?.length);
    
    if (testPlayer?.hasCalledUno) {
      console.log('✅ UNO call works with any number of cards!');
      
      // Test 2: Now reduce to 2 cards and play one (should not get penalty)
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
      
      console.log('📢 Test 2: Playing card with UNO already called...');
      ws.send(JSON.stringify({
        type: 'play_card',
        cardIndex: 0
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      gameState = await makeRequest(`/api/rooms/${roomId}`);
      testPlayer = gameState.players.find(p => p.id === player1Id);
      
      console.log('After playing card:');
      console.log('  Hand size:', testPlayer?.hand?.length);
      console.log('  hasCalledUno:', testPlayer?.hasCalledUno);
      
      if (testPlayer?.hand?.length === 1) {
        console.log('✅ Complete UNO system working correctly!');
        console.log('✅ No penalty when UNO was called before playing second-to-last card');
      } else {
        console.log('❌ Card play failed or penalty applied incorrectly');
      }
      
    } else {
      console.log('❌ UNO call failed - should work with any hand size');
    }
    
    ws.close();
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testUnoCall();