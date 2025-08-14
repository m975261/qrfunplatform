import WebSocket from 'ws';

// Test UNO penalty animation functionality
console.log('🎯 Testing UNO penalty animation system...');

const wsUrl = 'wss://254e1ff4-13d7-4966-af8a-0361d0c50c25-00-3gg1lgj12ixdv.janeway.replit.dev/ws';

// First create a room and join as guru user
async function createTestRoom() {
  try {
    const createResponse = await fetch('https://254e1ff4-13d7-4966-af8a-0361d0c50c25-00-3gg1lgj12ixdv.janeway.replit.dev/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nickname: 'TestPlayer',
        guruUserId: '25aa38e6-65d0-4b17-8a8a-ae29bec2d44e' // Use the guru user ID
      })
    });
    
    const createData = await createResponse.json();
    console.log('✅ Room created:', createData.room.code);
    
    return createData;
  } catch (error) {
    console.error('❌ Failed to create room:', error);
    return null;
  }
}

async function testUnoPenalty() {
  const roomData = await createTestRoom();
  if (!roomData) return;
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('🔌 WebSocket connected for UNO penalty test');
    
    // Join the room
    ws.send(JSON.stringify({
      type: 'join_room',
      playerId: roomData.player.id,
      roomId: roomData.room.id,
      userFingerprint: 'test-uno-penalty',
      sessionId: 'uno-test'
    }));
    
    // Start game after a short delay
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'start_game'
      }));
    }, 1000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'room_state') {
        console.log('📊 Room status:', message.room?.status);
        
        // If game is active, simulate UNO penalty by manually triggering it
        if (message.room?.status === 'active') {
          console.log('🎮 Game is active, triggering UNO penalty test...');
          
          // Simulate penalty directly through WebSocket broadcast
          ws.send(JSON.stringify({
            type: 'test_uno_penalty',
            playerName: 'TestPlayer',
            message: 'Manual test penalty trigger'
          }));
        }
      }
      
      if (message.type === 'uno_penalty') {
        console.log('🚨 UNO PENALTY RECEIVED!');
        console.log('   Player:', message.playerName);
        console.log('   Message:', message.message);
        console.log('✅ UNO penalty animation system is working!');
        
        // Close connection after successful test
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Parse error:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
}

// Run the test
testUnoPenalty();