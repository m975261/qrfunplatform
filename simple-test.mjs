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

async function simpleTest() {
  console.log('Simple game end test...');
  
  try {
    // Create room
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'Host'
    });
    const roomId = roomResponse.room.id;
    console.log('Room created:', roomId);
    
    // Join 2 players  
    const p1 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player1'
    });
    const p2 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    
    // Start game
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    console.log('Game started');
    
    // Get state after start
    const state = await makeRequest(`/api/rooms/${roomId}`);
    console.log('Game status:', state.room?.status);
    console.log('Players with hands:', state.players?.map(p => ({
      name: p.nickname,
      cards: p.hand?.length || 0,
      spectator: p.isSpectator
    })));
    
    // Set player1 to have just 1 card
    await makeRequest(`/api/rooms/${roomId}/test-set-hand`, 'POST', {
      playerId: p1.player.id,
      hand: [{color: 'red', value: '1'}]
    });
    
    console.log('Set Player1 to 1 card');
    
    // Play the card to win
    const playResult = await makeRequest(`/api/rooms/${roomId}/test-play-card`, 'POST', {
      playerId: p1.player.id,
      cardIndex: 0
    });
    
    console.log('Play result:', playResult);
    
    // Check final state
    const finalState = await makeRequest(`/api/rooms/${roomId}`);
    console.log('Final status:', finalState.room?.status);
    
    if (finalState.room?.status === 'finished') {
      console.log('✅ SUCCESS: Game ended correctly!');
    } else {
      console.log('❌ FAILED: Game did not end');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

simpleTest();