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

async function testGameEnd() {
  console.log('Testing game end functionality...');
  
  try {
    // Create room and join players
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'TestHost'
    });
    const roomId = roomResponse.room.id;
    console.log('Created room:', roomId);
    
    const player1 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player1'
    });
    
    const player2 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    
    console.log('Players joined');
    
    // Start game
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    console.log('Game started');
    
    // Connect WebSocket
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    let gameEndReceived = false;
    let testComplete = false;
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'game_end') {
        console.log('SUCCESS: Game end message received!');
        console.log('Winner:', message.data?.winner);
        gameEndReceived = true;
        
        if (!testComplete) {
          testComplete = true;
          ws.close();
          console.log('TEST PASSED: Game end flow works correctly');
          process.exit(0);
        }
      }
    });
    
    ws.on('open', () => {
      console.log('WebSocket connected');
      
      // Join room
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId: roomId,
        playerId: player1.player.id,
        nickname: 'Player1'
      }));
      
      // Simulate a win by sending a play_card that would empty the hand
      setTimeout(() => {
        console.log('Simulating game win...');
        
        ws.send(JSON.stringify({
          type: 'play_card',
          cardIndex: 0  // This should trigger win detection if player has 1 card
        }));
        
        // Give it 3 seconds to respond
        setTimeout(() => {
          if (!gameEndReceived && !testComplete) {
            testComplete = true;
            console.log('TEST FAILED: No game end message received within timeout');
            ws.close();
            process.exit(1);
          }
        }, 3000);
        
      }, 1000);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testGameEnd();