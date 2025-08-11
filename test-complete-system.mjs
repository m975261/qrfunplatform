import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCompleteSystem() {
  console.log('🔧 COMPLETE UNO BUG FIX TEST');
  console.log('='.repeat(50));
  
  let player1WS, player2WS;
  let player1Id, player2Id;
  
  try {
    // Step 1: Create room and get players
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'BugTestHost' })
    });
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    player1Id = roomData.room?.hostId || roomData.hostId;
    console.log(`✅ Room created: ${roomCode}, Host ID: ${player1Id}`);
    
    // Join second player
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'BugTestPlayer' })
    });
    const joinData = await joinResponse.json();
    player2Id = joinData.player?.id;
    console.log(`✅ Player 2 joined: ${player2Id}`);
    
    // Step 2: Connect WebSockets with proper authentication
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
    
    // Step 3: Authenticate WebSocket connections
    player1WS.send(JSON.stringify({
      type: 'authenticate',
      playerId: player1Id,
      roomCode
    }));
    
    player2WS.send(JSON.stringify({
      type: 'authenticate', 
      playerId: player2Id,
      roomCode
    }));
    
    await sleep(500);
    console.log('🔐 WebSocket authentication sent');
    
    // Step 4: Start game
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/start`, {
      method: 'POST'
    });
    console.log('🚀 Game started');
    await sleep(1000);
    
    // Step 5: Get current game state
    const gameResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}`);
    const gameState = await gameResponse.json();
    console.log(`🎮 Current player: ${gameState.room?.currentPlayerIndex || 0}`);
    
    // Step 6: Test UNO bug scenario
    console.log('\n🐛 TESTING UNO BUG SCENARIO:');
    console.log('1. Current player calls UNO');
    console.log('2. Same player immediately plays card');
    console.log('3. Should NOT get penalty if UNO was called');
    
    // Call UNO first
    console.log('📢 Calling UNO...');
    player1WS.send(JSON.stringify({
      type: 'call_uno'
    }));
    
    await sleep(500); // Wait for UNO call to process
    
    // Play a card
    console.log('🃏 Playing card...');
    player1WS.send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    await sleep(2000); // Wait for card play to process
    
    console.log('\n🔍 CHECK SERVER LOGS FOR:');
    console.log('✅ "UNO CALL VERIFICATION: ... hasCalledUno=true"');
    console.log('✅ "UNO STATUS CONFIRMED: ... has called UNO"');
    console.log('✅ "UNO SUCCESS: ... played from 2→1 cards WITH UNO called"');
    console.log('❌ Should NOT see: "UNO PENALTY: ... without calling UNO"');
    
    return { success: true, roomCode };
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (player1WS) player1WS.close();
    if (player2WS) player2WS.close();
  }
}

testCompleteSystem().then(result => {
  console.log('\n📋 SUMMARY:', result.success ? 'TEST COMPLETED' : 'TEST FAILED');
  if (result.roomCode) {
    console.log(`🏠 Room Code: ${result.roomCode}`);
  }
  process.exit(result.success ? 0 : 1);
});