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

async function quickTest() {
  console.log('Testing current UNO system...');
  
  try {
    // Create room with 2 players and start game normally
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'Player1'
    });
    const roomId = roomResponse.room.id;
    
    const player2 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    
    // Check if game is properly started
    const state = await makeRequest(`/api/rooms/${roomId}`);
    console.log('Game status:', state.room?.status);
    console.log('Players:', state.players?.map(p => ({
      name: p.nickname,
      cards: p.hand?.length || 0,
      position: p.position,
      isSpectator: p.isSpectator
    })));
    
    if (state.room?.status === 'playing') {
      console.log('✅ Game is properly running - UNO penalty system should work correctly');
    } else {
      console.log('❌ Game not in playing state - this explains the UNO penalty issue');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

quickTest();