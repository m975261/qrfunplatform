import http from 'http';

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

async function directTest() {
  console.log('🧪 Testing player creation bug...');
  
  try {
    // 1. Create room
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'Player1'
    });
    const roomId = roomResponse.room.id;
    const player1Id = roomResponse.player.id;
    console.log('✓ Room created:', roomId);
    console.log('✓ Player1 ID:', player1Id);
    
    // 2. Add second player
    const player2Response = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    const player2Id = player2Response.player.id;
    console.log('✓ Player2 ID:', player2Id);
    
    // 3. Check room state BEFORE starting game
    const beforeStart = await makeRequest(`/api/rooms/${roomId}`);
    console.log('📊 Before game start:');
    console.log('   Players returned:', beforeStart.players?.length);
    console.log('   Players:', beforeStart.players?.map(p => ({
      id: p.id,
      name: p.nickname,
      spectator: p.isSpectator,
      position: p.position
    })));
    
    // 4. Try to start game
    const startResponse = await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    console.log('✓ Start game response:', startResponse);
    
    // 5. Check room state AFTER starting game
    const afterStart = await makeRequest(`/api/rooms/${roomId}`);
    console.log('📊 After game start:');
    console.log('   Room status:', afterStart.room?.status);
    console.log('   Players returned:', afterStart.players?.length);
    console.log('   Players:', afterStart.players?.map(p => ({
      id: p.id,
      name: p.nickname,
      spectator: p.isSpectator,
      position: p.position,
      cards: p.hand?.length || 0
    })));
    
    if (afterStart.room?.status === 'playing') {
      console.log('✅ SUCCESS: Game started properly! UNO penalty bug should be fixed.');
    } else {
      console.log('❌ Game failed to start - only', afterStart.players?.filter(p => !p.isSpectator).length, 'non-spectator players found');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

directTest();