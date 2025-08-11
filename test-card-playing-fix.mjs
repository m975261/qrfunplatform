import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCardPlayingFix() {
  console.log('🔧 TESTING CARD PLAYING FIX');
  console.log('='.repeat(50));
  
  let player1WS, player2WS;
  
  try {
    // Step 1: Create room using standard flow
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'FixTestHost' })
    });
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    const roomId = roomData.room?.id || roomData.id;
    const player1Id = roomData.room?.hostId || roomData.hostId;
    
    console.log(`✅ Room created: ${roomCode} (ID: ${roomId})`);
    console.log(`✅ Host: ${player1Id}`);
    
    // Step 2: Join second player
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'FixTestPlayer' })
    });
    const joinData = await joinResponse.json();
    const player2Id = joinData.player?.id;
    console.log(`✅ Player 2: ${player2Id}`);
    
    // Step 3: Connect via WebSocket using room IDs  
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
    
    // Step 4: Join room via WebSocket using ACTUAL room ID (not code)
    player1WS.send(JSON.stringify({
      type: 'join_room',
      playerId: player1Id,
      roomId: roomId, // Use actual room ID for consistency
      userFingerprint: 'fix-fp1',
      sessionId: 'fix-session1'
    }));
    
    player2WS.send(JSON.stringify({
      type: 'join_room',
      playerId: player2Id,
      roomId: roomId, // Use actual room ID for consistency
      userFingerprint: 'fix-fp2',
      sessionId: 'fix-session2'
    }));
    
    await sleep(1000);
    console.log('🎮 WebSocket connections authenticated');
    
    // Step 5: Start game using room CODE (as the API expects)
    const startResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/start`, {
      method: 'POST'
    });
    
    if (!startResponse.ok) {
      throw new Error(`Failed to start game: ${startResponse.status}`);
    }
    
    console.log('🚀 Game started via HTTP');
    await sleep(1000);
    
    // Step 6: Verify room state before testing UNO
    const roomStateResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}`);
    const roomState = await roomStateResponse.json();
    console.log(`🎮 Room status after start: ${roomState.room?.status}`);
    
    // Step 7: Test UNO bug scenario  
    console.log('\n🔍 TESTING UNO BUG FIX:');
    
    // Call UNO first
    console.log('1. Calling UNO...');
    player1WS.send(JSON.stringify({
      type: 'call_uno'
    }));
    
    await sleep(1000);
    
    // Play card after UNO call
    console.log('2. Playing card after UNO call...');
    player1WS.send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    await sleep(2000);
    
    console.log('\n🎯 EXPECTED RESULTS:');
    console.log('• Room status should be "playing" not "waiting"');
    console.log('• UNO call should be verified as true');
    console.log('• Card play should proceed (no "Invalid state" error)');
    console.log('• If player has 2 cards and plays 1, no penalty should occur');
    
    return { success: true, roomCode, roomId };
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (player1WS) player1WS.close();
    if (player2WS) player2WS.close();
  }
}

testCardPlayingFix().then(result => {
  console.log('\n📋 RESULT:', result.success ? 'TEST COMPLETED' : 'TEST FAILED');
  process.exit(result.success ? 0 : 1);
});