import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testSafariModalFix() {
  console.log('🍎 TESTING: Safari iOS Winner Modal Fix');
  console.log('='.repeat(60));
  
  try {
    // Create a test room
    console.log('\n1. Creating test room for Safari modal testing...');
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'SafariTestHost' })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    console.log(`✅ Test room created: ${roomCode}`);
    
    // Add a second player
    console.log('\n2. Adding second player...');
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'SafariTestPlayer' })
    });
    
    if (!joinResponse.ok) {
      throw new Error('Failed to add second player');
    }
    
    console.log('✅ Second player added');
    
    // Check room status
    console.log('\n3. Verifying room setup...');
    const statusResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}`);
    const status = await statusResponse.json();
    
    if (status.room && status.players && status.players.length === 2) {
      console.log(`✅ Room properly configured with ${status.players.length} players`);
      console.log(`Players: ${status.players.map(p => p.nickname).join(', ')}`);
      console.log(`Room status: ${status.room.status}`);
    } else {
      throw new Error('Room configuration invalid');
    }
    
    return {
      success: true,
      roomCode: roomCode,
      message: `Safari modal test room ready: ${roomCode}`
    };
    
  } catch (error) {
    console.error('❌ Safari modal test setup failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runSafariModalTest() {
  const result = await testSafariModalFix();
  
  console.log('\n' + '='.repeat(60));
  console.log('🍎 SAFARI MODAL TEST RESULTS');
  console.log('='.repeat(60));
  
  if (result.success) {
    console.log(`✅ ${result.message}`);
    console.log('\n🧪 SAFARI TESTING INSTRUCTIONS:');
    console.log(`1. On Safari iPhone, go to the app URL`);
    console.log(`2. Join room: ${result.roomCode}`);
    console.log('3. Start a game with 2 players');
    console.log('4. Play until someone wins');
    console.log('5. Verify the winner modal appears correctly');
    console.log('\n🔍 ENHANCED SAFARI FIXES APPLIED:');
    console.log('• Safari iOS detection and multiple modal render attempts');
    console.log('• Enhanced viewport meta tag management');
    console.log('• Improved body scroll locking for iOS');
    console.log('• Emergency alert fallback for modal visibility');
    console.log('• WebKit-specific CSS properties and transforms');
    console.log('• Touch event prevention and handling');
    console.log('\n📱 If modal still doesn\'t appear:');
    console.log('• Check browser console for Safari-specific logs');
    console.log('• Look for emergency alert popup with winner info');
    console.log('• Verify touchmove and scroll behaviors');
  } else {
    console.log(`❌ Test setup failed: ${result.error}`);
  }
  
  console.log('='.repeat(60));
  
  process.exit(result.success ? 0 : 1);
}

runSafariModalTest().catch(console.error);