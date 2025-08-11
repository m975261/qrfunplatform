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

async function testUnoBug() {
  console.log('🧪 Testing UNO penalty bug...');
  
  try {
    // 1. Create room
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'TestPlayer'
    });
    const roomId = roomResponse.room.id;
    console.log('✓ Created room:', roomId);
    
    // 2. Join second player
    const player2 = await makeRequest(`/api/rooms/${roomId}/join`, 'POST', {
      nickname: 'Player2'
    });
    console.log('✓ Added Player2');
    
    // 2.5. Set Player2 as current turn holder initially
    await makeRequest(`/api/rooms/${roomId}/test-set-turn`, 'POST', {
      currentPlayerIndex: 0  // TestPlayer is first
    });
    
    // 3. Start game
    await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
    console.log('✓ Game started');
    
    // 4. Get initial state
    const gameState = await makeRequest(`/api/rooms/${roomId}`);
    const testPlayer = gameState.players.find(p => p.nickname === 'TestPlayer');
    const player2Data = gameState.players.find(p => p.nickname === 'Player2');
    
    console.log('Players found:', gameState.players.map(p => ({
      name: p.nickname,
      cards: p.hand?.length || 0,
      hasHand: !!p.hand
    })));
    
    // 5. Set up test scenario - give testPlayer exactly 2 cards
    await makeRequest(`/api/rooms/${roomId}/test-set-hand`, 'POST', {
      playerId: testPlayer.id,
      hand: [
        {color: 'red', value: '5', type: 'number', number: 5},
        {color: 'red', value: '7', type: 'number', number: 7}
      ]
    });
    
    console.log('✓ Set TestPlayer to 2 cards');
    
    // 6. Set discard pile to allow playing red 5
    await makeRequest(`/api/rooms/${roomId}/test-set-discard`, 'POST', {
      topCard: {color: 'red', value: '3', type: 'number', number: 3}
    });
    
    // 7. Connect WebSocket to simulate player
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    let testComplete = false;
    let penaltyReceived = false;
    let unoCallSuccess = false;
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'uno_called_success') {
        console.log('📢 UNO call received by WebSocket');
        unoCallSuccess = true;
      }
      
      if (message.type === 'room_state') {
        const currentTestPlayer = message.data?.players?.find(p => p.nickname === 'TestPlayer');
        if (currentTestPlayer && currentTestPlayer.hand?.length > 1) {
          console.log(`Current TestPlayer hand size: ${currentTestPlayer.hand.length}`);
          if (currentTestPlayer.hand.length > 2) {
            penaltyReceived = true;
            console.log('❌ PENALTY DETECTED: Player has more than 2 cards');
          }
        }
      }
    });
    
    ws.on('open', async () => {
      console.log('🔌 WebSocket connected');
      
      // Join room
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId: roomId,
        playerId: testPlayer.id,
        nickname: 'TestPlayer'
      }));
      
      // Wait a moment for connection
      setTimeout(async () => {
        console.log('📢 Calling UNO...');
        
        // Call UNO
        ws.send(JSON.stringify({
          type: 'call_uno'
        }));
        
        // Wait a moment then play card
        setTimeout(() => {
          console.log('🃏 Playing card...');
          
          ws.send(JSON.stringify({
            type: 'play_card',
            cardIndex: 0  // Play the red 5
          }));
          
          // Check results after a delay
          setTimeout(async () => {
            const finalState = await makeRequest(`/api/rooms/${roomId}`);
            const finalTestPlayer = finalState.players.find(p => p.nickname === 'TestPlayer');
            
            console.log('\n🏁 TEST RESULTS:');
            console.log('UNO call success:', unoCallSuccess);
            console.log('Final hand size:', finalTestPlayer.hand?.length || 0);
            console.log('Penalty received:', penaltyReceived);
            console.log('hasCalledUno status:', finalTestPlayer.hasCalledUno);
            
            if (finalTestPlayer.hand?.length === 1 && unoCallSuccess && !penaltyReceived) {
              console.log('✅ TEST PASSED: UNO system working correctly');
            } else {
              console.log('❌ TEST FAILED: UNO penalty bug confirmed');
              console.log('Expected: 1 card, got:', finalTestPlayer.hand?.length);
            }
            
            testComplete = true;
            ws.close();
            process.exit(0);
          }, 2000);
          
        }, 500);
        
      }, 500);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      process.exit(1);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!testComplete) {
        console.log('❌ TEST TIMEOUT');
        ws.close();
        process.exit(1);
      }
    }, 10000);
    
  } catch (error) {
    console.error('Test error:', error.message);
    process.exit(1);
  }
}

testUnoBug();