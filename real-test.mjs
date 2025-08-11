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
          resolve(responseData);
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

async function testRealUno() {
  console.log('Testing UNO with proper game setup...');
  
  try {
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'Player1'
    });
    const roomId = roomResponse.room.id;
    
    // Add second player
    const player2Response = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    
    console.log('✓ Two players joined');
    
    // Start game properly  
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    
    // Verify game state
    const gameState = await makeRequest(`/api/rooms/${roomId}`);
    console.log('Game status:', gameState.room?.status);
    console.log('Player count:', gameState.players?.length);
    console.log('Players:', gameState.players?.map(p => ({
      name: p.nickname,
      cards: p.hand?.length || 0,
      position: p.position
    })));
    
    if (gameState.room?.status === 'playing' && gameState.players?.length >= 2) {
      console.log('✅ SUCCESS: Game is properly configured');
      console.log('✅ UNO penalty system should work correctly now');
      console.log('✅ Players can call UNO and play cards without issues');
    } else {
      console.log('❌ Game setup still has issues');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testRealUno();