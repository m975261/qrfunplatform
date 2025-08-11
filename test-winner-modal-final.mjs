// Final targeted test for winner modal and connection stability
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testWinnerModal() {
  console.log('🏆 TESTING: Winner Modal Display and Connection Stability');
  console.log('='.repeat(60));
  
  try {
    // Create a room
    console.log('\n1. Creating test room...');
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'WinnerTester' })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    console.log(`✅ Room created: ${roomCode}`);
    
    // Add second player
    console.log('\n2. Adding second player...');
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'OpponentTester' })
    });
    
    if (!joinResponse.ok) {
      throw new Error('Failed to add second player');
    }
    
    console.log('✅ Second player added');
    
    // Check room status
    console.log('\n3. Checking room status...');
    const statusResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}`);
    const status = await statusResponse.json();
    
    if (status.room && status.players) {
      console.log(`✅ Room has ${status.players.length} players, status: ${status.room.status}`);
      console.log(`Players: ${status.players.map(p => p.nickname).join(', ')}`);
    } else {
      throw new Error('Invalid room status response');
    }
    
    return {
      success: true,
      roomCode: roomCode,
      playerCount: status.players?.length || 0
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runTest() {
  const result = await testWinnerModal();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 WINNER MODAL TEST RESULTS:');
  console.log('='.repeat(60));
  
  if (result.success) {
    console.log(`✅ Room setup successful: ${result.roomCode}`);
    console.log(`✅ Players in room: ${result.playerCount}`);
    console.log('\n🎉 Basic room setup works - ready for manual testing!');
    console.log('You can now manually test the winner modal by:');
    console.log(`1. Go to the app and join room ${result.roomCode}`);
    console.log('2. Start a game');
    console.log('3. Play until someone wins');
    console.log('4. Check if the winner modal displays properly');
  } else {
    console.log(`❌ Room setup failed: ${result.error}`);
  }
  
  console.log('='.repeat(60));
  
  process.exit(result.success ? 0 : 1);
}

runTest().catch(console.error);