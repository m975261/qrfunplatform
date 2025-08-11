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

async function directTestGameEnd() {
  console.log('Direct API test for game end...');
  
  try {
    // 1. Create room
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'Host'
    });
    const roomId = roomResponse.room.id;
    console.log('✓ Room created:', roomId);
    
    // 2. Join two players
    const p1 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player1'
    });
    const p2 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    console.log('✓ Players joined');
    
    // 3. Start game
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    console.log('✓ Game started');
    
    // 4. Get game state to see player hands
    const gameState = await makeRequest(`/api/rooms/${roomId}`);
    const players = gameState.players.filter(p => !p.isSpectator);
    
    console.log('Player hands:');
    players.forEach(p => {
      console.log(`- ${p.nickname}: ${p.hand?.length || 0} cards`);
    });
    
    // 5. Manually set player to 1 card and test win
    const testPlayer = players[0];
    
    // Update player to have only 1 card
    const updateResponse = await makeRequest(`/api/rooms/${roomId}/test-set-hand`, 'POST', {
      playerId: testPlayer.id,
      hand: [gameState.discardPile[0]] // Give them the top card so they can play it
    });
    
    console.log('Hand set result:', updateResponse.success ? 'Success' : 'Failed');
    
    // 6. Play that card to win
    const playResponse = await makeRequest(`/api/rooms/${roomId}/test-play-card`, 'POST', {
      playerId: testPlayer.id,
      cardIndex: 0
    });
    
    console.log('Play card result:', playResponse);
    
    // 7. Check final game state
    const finalState = await makeRequest(`/api/rooms/${roomId}`);
    console.log('Final room status:', finalState.room?.status);
    
    if (finalState.room?.status === 'finished') {
      console.log('✅ SUCCESS: Game properly ended!');
      process.exit(0);
    } else {
      console.log('❌ FAILED: Game did not end');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
    process.exit(1);
  }
}

directTestGameEnd();