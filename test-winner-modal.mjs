// Simple test to create a winning scenario and check game end
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const WebSocket = (...args) => import('ws').then(({default: WebSocket}) => new WebSocket(...args));

const BASE_URL = 'http://localhost:5000';

async function makeRequest(endpoint, options = {}) {
  const fetchModule = await import('node-fetch');
  const response = await fetchModule.default(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

async function testWinnerModal() {
  console.log('🧪 Testing Winner Modal...');
  
  try {
    // Create room and players
    const room = await makeRequest('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({
        hostNickname: 'Winner'
      })
    });
    
    const player2 = await makeRequest(`/api/rooms/${room.room.code}/join`, {
      method: 'POST',
      body: JSON.stringify({
        nickname: 'Loser'
      })
    });
    
    const roomId = room.room.id;
    const player1Id = room.room.hostId;
    
    console.log('✓ Room created:', room.room.code);
    
    // Start game
    await makeRequest(`/api/rooms/${roomId}/start`, {
      method: 'POST'
    });
    console.log('✓ Game started');
    
    // Set winner to have 1 card
    await makeRequest(`/api/rooms/${roomId}/test-set-hand`, {
      method: 'POST',
      body: JSON.stringify({
        playerId: player1Id,
        hand: [{ color: 'red', value: '5', type: 'number' }]
      })
    });
    
    // Set discard pile to accept the card
    await makeRequest(`/api/rooms/${roomId}/test-set-discard`, {
      method: 'POST',
      body: JSON.stringify({
        card: { color: 'red', value: '4', type: 'number' }
      })
    });
    
    console.log('✓ Set up winning scenario');
    
    // Connect WebSocket to see game end message
    const wsModule = await import('ws');
    const ws = new wsModule.default('ws://localhost:5000/ws');
    
    return new Promise((resolve) => {
      ws.on('open', async () => {
        console.log('✓ WebSocket connected');
        
        // Join room
        ws.send(JSON.stringify({
          type: 'join_room',
          playerId: player1Id,
          roomId
        }));
        
        await new Promise(r => setTimeout(r, 500));
        
        // Call UNO first
        ws.send(JSON.stringify({ type: 'call_uno' }));
        await new Promise(r => setTimeout(r, 500));
        
        // Play winning card
        console.log('🏆 Playing winning card...');
        ws.send(JSON.stringify({ 
          type: 'play_card', 
          cardIndex: 0 
        }));
      });
      
      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'game_end') {
          console.log('🏆 GAME END MESSAGE RECEIVED:', {
            winner: message.winner,
            rankings: message.rankings
          });
          
          // Check final room state
          const finalState = await makeRequest(`/api/rooms/${roomId}`);
          console.log('🏆 Final room state:', {
            status: finalState.room.status,
            winner: finalState.players.find(p => p.finishPosition === 1)?.nickname
          });
          
          ws.close();
          
          if (finalState.room.status === 'finished' && message.winner === 'Winner') {
            console.log('✅ Game ended successfully - Winner modal should appear!');
            console.log('✅ GameEndModal should display with winner "Winner" and rankings');
          } else {
            console.log('❌ Game end detection failed');
          }
          
          resolve();
        }
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        console.log('⏰ Timeout - no game end message received');
        ws.close();
        resolve();
      }, 10000);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testWinnerModal();