import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:5000';

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
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

function connectWebSocket(playerId, roomId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      // Join the room
      ws.send(JSON.stringify({
        type: 'join_room',
        playerId,
        roomId
      }));
      resolve(ws);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'game_end') {
        console.log('🏆 GAME END MESSAGE RECEIVED IN TEST:', {
          winner: message.winner,
          rankings: message.rankings,
          fullMessage: message
        });
      }
    });
    
    ws.on('error', reject);
  });
}

async function testGameEndModal() {
  console.log('🧪 Testing game end modal...');
  
  // Create room and players
  const room = await makeRequest('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({
      hostNickname: 'TestPlayer'
    })
  });
  
  const player2 = await makeRequest(`/api/rooms/${room.room.code}/join`, {
    method: 'POST',
    body: JSON.stringify({
      nickname: 'Player2'
    })
  });
  
  const roomId = room.room.id;
  const player1Id = room.room.hostId;
  const player2Id = player2.player.id;
  
  console.log('✓ Room created:', room.room.code);
  
  // Start game
  await makeRequest(`/api/rooms/${roomId}/start`, {
    method: 'POST'
  });
  
  console.log('✓ Game started');
  
  // Connect WebSockets
  const ws1 = await connectWebSocket(player1Id, roomId);
  const ws2 = await connectWebSocket(player2Id, roomId);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Set player 1 to have 1 card and player 2 to have many cards
  await makeRequest(`/api/rooms/${roomId}/test-set-hand`, {
    method: 'POST',
    body: JSON.stringify({
      playerId: player1Id,
      hand: [{ color: 'red', value: '5', type: 'number' }] // Only 1 card
    })
  });
  
  await makeRequest(`/api/rooms/${roomId}/test-set-hand`, {
    method: 'POST',
    body: JSON.stringify({
      playerId: player2Id,
      hand: [
        { color: 'blue', value: '1', type: 'number' },
        { color: 'blue', value: '2', type: 'number' },
        { color: 'blue', value: '3', type: 'number' },
        { color: 'blue', value: '4', type: 'number' },
        { color: 'blue', value: '5', type: 'number' }
      ]
    })
  });
  
  // Set discard pile to accept red 5
  await makeRequest(`/api/rooms/${roomId}/test-set-discard`, {
    method: 'POST',
    body: JSON.stringify({
      card: { color: 'red', value: '4', type: 'number' }
    })
  });
  
  console.log('✓ Set up winning scenario - Player 1 has 1 card');
  
  // Player 1 calls UNO first
  console.log('📢 Player 1 calling UNO before playing winning card...');
  ws1.send(JSON.stringify({ type: 'call_uno' }));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Player 1 plays their last card to win
  console.log('🏆 Player 1 playing winning card...');
  ws1.send(JSON.stringify({ 
    type: 'play_card', 
    cardIndex: 0 
  }));
  
  // Wait for game end message
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check final room state
  const finalState = await makeRequest(`/api/rooms/${roomId}`);
  console.log('🏆 Final room state:', {
    status: finalState.room.status,
    players: finalState.players.map(p => ({ 
      nickname: p.nickname, 
      handSize: p.hand?.length || 0,
      finishPosition: p.finishPosition 
    }))
  });
  
  ws1.close();
  ws2.close();
  
  if (finalState.room.status === 'finished') {
    console.log('✅ Game ended successfully!');
    console.log('✅ Winner should be TestPlayer');
    console.log('✅ Game end modal should show with rankings');
  } else {
    console.log('❌ Game did not end properly');
  }
}

testGameEndModal().catch(console.error);