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

function connectWebSocket(playerId, roomId, playerName) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:5000/ws');
    let gameEndReceived = false;
    
    ws.on('open', () => {
      console.log(`✅ ${playerName} WebSocket connected`);
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
      if (message.type === 'game_end' && !gameEndReceived) {
        gameEndReceived = true;
        console.log(`🏆 ${playerName} RECEIVED GAME END MESSAGE:`, {
          winner: message.winner,
          rankings: message.rankings
        });
      }
      if (message.type === 'uno_called_success') {
        console.log(`🔥 ${playerName} heard UNO call from:`, message.player);
      }
    });
    
    ws.on('error', reject);
  });
}

async function testCompleteSystem() {
  console.log('🧪 Testing Complete UNO System (UNO Button + Game End Modal)...\n');
  
  // Create room and players
  const room = await makeRequest('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({
      hostNickname: 'Alice'
    })
  });
  
  const player2 = await makeRequest(`/api/rooms/${room.room.code}/join`, {
    method: 'POST',
    body: JSON.stringify({
      nickname: 'Bob'
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
  const ws1 = await connectWebSocket(player1Id, roomId, 'Alice');
  const ws2 = await connectWebSocket(player2Id, roomId, 'Bob');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Set Alice to have 2 cards, Bob to have many cards
  await makeRequest(`/api/rooms/${roomId}/test-set-hand`, {
    method: 'POST',
    body: JSON.stringify({
      playerId: player1Id,
      hand: [
        { color: 'red', value: '5', type: 'number' },
        { color: 'red', value: '6', type: 'number' }
      ]
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
  
  // Set discard pile to accept red cards
  await makeRequest(`/api/rooms/${roomId}/test-set-discard`, {
    method: 'POST',
    body: JSON.stringify({
      card: { color: 'red', value: '4', type: 'number' }
    })
  });
  
  console.log('✓ Alice has 2 cards, Bob has 5 cards');
  
  // Test 1: UNO Button (should work anytime without visual changes)
  console.log('\n📢 TEST 1: UNO Button Stealth Mode');
  console.log('Alice calls UNO with 2 cards (should work and trigger voice)...');
  ws1.send(JSON.stringify({ type: 'call_uno' }));
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let gameState = await makeRequest(`/api/rooms/${roomId}`);
  let alice = gameState.players.find(p => p.nickname === 'Alice');
  console.log('UNO call result:', {
    hasCalledUno: alice.hasCalledUno,
    handSize: alice.hand.length,
    buttonShouldLookSame: '🔥 UNO! 🔥 (red, pulsing) - no visual hint given'
  });
  
  if (alice.hasCalledUno) {
    console.log('✅ UNO call works anytime');
  } else {
    console.log('❌ UNO call failed');
  }
  
  // Test 2: Play second-to-last card (should not get penalty)
  console.log('\n🎯 TEST 2: UNO Protection System');
  console.log('Alice plays card (2→1 cards, UNO already called)...');
  ws1.send(JSON.stringify({ 
    type: 'play_card', 
    cardIndex: 0 
  }));
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  gameState = await makeRequest(`/api/rooms/${roomId}`);
  alice = gameState.players.find(p => p.nickname === 'Alice');
  console.log('After playing second-to-last card:', {
    handSize: alice.hand.length,
    hasCalledUno: alice.hasCalledUno,
    penaltyExpected: false
  });
  
  if (alice.hand.length === 1 && alice.hasCalledUno) {
    console.log('✅ No penalty - UNO protection worked');
  } else {
    console.log('❌ UNO protection failed');
  }
  
  // Test 3: Game End and Modal
  console.log('\n🏆 TEST 3: Game End Modal');
  console.log('Alice plays final card to win...');
  ws1.send(JSON.stringify({ 
    type: 'play_card', 
    cardIndex: 0 
  }));
  
  // Wait for game end messages
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check final room state
  const finalState = await makeRequest(`/api/rooms/${roomId}`);
  console.log('Final game state:', {
    roomStatus: finalState.room.status,
    winner: finalState.players.find(p => p.finishPosition === 1)?.nickname,
    rankings: finalState.players.map(p => ({ 
      nickname: p.nickname, 
      position: p.finishPosition,
      handSize: p.hand?.length || 0
    })).filter(p => p.position).sort((a, b) => a.position - b.position)
  });
  
  ws1.close();
  ws2.close();
  
  // Summary
  console.log('\n📋 SUMMARY:');
  console.log('✅ UNO button should always look the same (🔥 UNO! 🔥, red, pulsing)');
  console.log('✅ UNO call should work anytime but only protect when playing second-to-last card');
  console.log('✅ Voice should say "UNO!" when players call UNO');
  
  if (finalState.room.status === 'finished') {
    console.log('✅ Game ended successfully - Winner screen should show');
  } else {
    console.log('❌ Game did not end properly - Winner screen will not show');
  }
  
  console.log('\n🎮 Frontend should show:');
  console.log('- UNO button: Always "🔥 UNO! 🔥" (red, pulsing) - NO visual reminders');
  console.log('- Voice: Says "UNO!" when anyone calls UNO');
  console.log('- Game End Modal: Should appear with winner and rankings');
  console.log('- No penalties for players who called UNO before playing second-to-last card');
}

testCompleteSystem().catch(console.error);