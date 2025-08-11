const http = require('http');
const WebSocket = require('ws');

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

async function testGameEnd() {
  console.log('🎮 Testing game end functionality...');
  
  try {
    // 1. Create room
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'TestHost'
    });
    const roomId = roomResponse.room.id;
    console.log('✓ Created room:', roomId);
    
    // 2. Join players
    const player1 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player1'
    });
    
    const player2 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    
    console.log('✓ Players joined:', player1.player.nickname, player2.player.nickname);
    
    // 3. Start game
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    console.log('✓ Game started');
    
    // 4. Connect WebSocket to monitor messages
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    let gameEndReceived = false;
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 WS Message:', message.type);
      
      if (message.type === 'game_end') {
        console.log('🏆 GAME END MESSAGE RECEIVED!');
        console.log('Winner:', message.data.winner);
        console.log('Final positions:', message.data.finalPositions.map(p => 
          `${p.nickname}: ${p.cardCount} cards`
        ));
        gameEndReceived = true;
      }
    });
    
    ws.on('open', async () => {
      console.log('🔌 WebSocket connected');
      
      // Send join room message
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId: roomId,
        playerId: player1.player.id,
        nickname: 'Player1'
      }));
      
      // Wait a bit then simulate game end by setting player to 0 cards
      setTimeout(async () => {
        console.log('🎯 Simulating game win...');
        
        // Manually trigger game end by manipulating player hand to empty
        const simulateWin = await makeRequest(`/api/rooms/${roomId}/simulate-win`, 'POST', {
          playerId: player1.player.id
        });
        
        console.log('Simulate win response:', simulateWin);
        
        // Check if game end message was received within 2 seconds
        setTimeout(() => {
          if (gameEndReceived) {
            console.log('✅ TEST PASSED: Game end message received successfully!');
          } else {
            console.log('❌ TEST FAILED: Game end message not received');
          }
          ws.close();
          process.exit(gameEndReceived ? 0 : 1);
        }, 2000);
        
      }, 1000);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testGameEnd();
