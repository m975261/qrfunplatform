import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUnoSystemFix() {
  console.log('🧪 AUTOMATED UNO BUG TEST & FIX');
  console.log('='.repeat(50));
  
  let player1WS, player2WS;
  
  try {
    // Create room
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'TestHost' })
    });
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    console.log(`✅ Created test room: ${roomCode}`);
    
    // Join second player
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'TestPlayer' })
    });
    console.log('✅ Second player joined');
    
    // Connect WebSockets
    player1WS = new WebSocket(WS_URL);
    player2WS = new WebSocket(WS_URL);
    
    await new Promise(resolve => {
      let connectedCount = 0;
      const onConnect = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };
      player1WS.on('open', onConnect);
      player2WS.on('open', onConnect);
    });
    
    console.log('🔗 WebSocket connections established');
    
    // Join room via WebSocket
    player1WS.send(JSON.stringify({
      type: 'join_room',
      roomCode,
      nickname: 'TestHost'
    }));
    
    player2WS.send(JSON.stringify({
      type: 'join_room', 
      roomCode,
      nickname: 'TestPlayer'
    }));
    
    await sleep(500);
    console.log('🎮 Players joined room via WebSocket');
    
    // Start game
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/start`, {
      method: 'POST'
    });
    console.log('🚀 Game started');
    
    await sleep(1000);
    
    // Get game state to manipulate hands
    const gameResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}`);
    const gameData = await gameResponse.json();
    
    // Simulate player having exactly 2 cards
    console.log('🎯 Setting up UNO bug scenario...');
    
    // Send UNO call first
    console.log('📢 Player calling UNO...');
    player1WS.send(JSON.stringify({
      type: 'call_uno'
    }));
    
    await sleep(300); // Small delay to ensure UNO call is processed
    
    // Now attempt to play a card (this should NOT trigger penalty)
    console.log('🃏 Player playing card after calling UNO...');
    player1WS.send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    await sleep(1000);
    
    console.log('🔍 Test completed - check server logs for UNO penalty behavior');
    console.log('✅ If bug is fixed: No penalty should occur');
    console.log('❌ If bug exists: Penalty occurs despite calling UNO');
    
    return { success: true, roomCode };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (player1WS) player1WS.close();
    if (player2WS) player2WS.close();
  }
}

testUnoSystemFix().then(result => {
  console.log('\n📊 Test Result:', result.success ? 'COMPLETED' : 'FAILED');
  process.exit(result.success ? 0 : 1);
});