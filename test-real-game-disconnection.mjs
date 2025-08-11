import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRealGameDisconnection() {
  console.log('🎮 REAL GAME UNO BUG TEST');
  console.log('='.repeat(50));
  
  let player1WS, player2WS;
  let player1Id, player2Id, roomId;
  
  try {
    // Step 1: Create room and get proper structure
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'RealTestHost' })
    });
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    roomId = roomData.room?.id || roomData.id;
    player1Id = roomData.room?.hostId || roomData.hostId;
    console.log(`✅ Room: ${roomCode} (ID: ${roomId}), Host: ${player1Id}`);
    
    // Step 2: Join second player
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'RealTestPlayer' })
    });
    const joinData = await joinResponse.json();
    player2Id = joinData.player?.id;
    console.log(`✅ Player 2: ${player2Id}`);
    
    // Step 3: Connect WebSockets using join_room (not authenticate)
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
    
    // Step 4: Join room using the correct message format
    player1WS.send(JSON.stringify({
      type: 'join_room',
      playerId: player1Id,
      roomId: roomId, 
      userFingerprint: 'test-fp1',
      sessionId: 'test-session1'
    }));
    
    player2WS.send(JSON.stringify({
      type: 'join_room',
      playerId: player2Id,
      roomId: roomId,
      userFingerprint: 'test-fp2', 
      sessionId: 'test-session2'
    }));
    
    await sleep(1000);
    console.log('🎮 Players joined via WebSocket');
    
    // Step 5: Start game
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/start`, {
      method: 'POST'
    });
    console.log('🚀 Game started');
    await sleep(1000);
    
    // Step 6: Test UNO scenario with proper connection
    console.log('\n🐛 TESTING UNO BUG WITH REAL CONNECTIONS:');
    
    // Player 1 calls UNO
    console.log('📢 Host calling UNO...');
    player1WS.send(JSON.stringify({
      type: 'call_uno'
    }));
    
    await sleep(800); // Wait for UNO call to process
    
    // Player 1 plays card
    console.log('🃏 Host playing card after UNO call...');
    player1WS.send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    await sleep(2000); // Wait for processing
    
    console.log('\n🔍 EXPECTED SERVER LOGS:');
    console.log('✅ "UNO CALLED: Set hasCalledUno=true for RealTestHost"');
    console.log('✅ "UNO CALL VERIFICATION: RealTestHost hasCalledUno=true"');
    console.log('✅ "UNO STATUS CONFIRMED: RealTestHost has called UNO"');
    console.log('✅ Should NOT see penalty if UNO system works correctly');
    
    return { success: true, roomCode, roomId };
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (player1WS) player1WS.close();
    if (player2WS) player2WS.close();
  }
}

testRealGameDisconnection().then(result => {
  console.log('\n📋 TEST RESULT:', result.success ? 'COMPLETED' : 'FAILED');
  if (result.roomCode) {
    console.log(`🏠 Room: ${result.roomCode}`);
  }
  process.exit(result.success ? 0 : 1);
});