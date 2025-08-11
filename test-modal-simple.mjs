import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testSimpleModal() {
  console.log('🏆 Testing Simplified Winner Modal');
  console.log('='.repeat(50));
  
  try {
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'ModalTestHost' })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'ModalTestPlayer' })
    });
    
    if (roomResponse.ok && joinResponse.ok) {
      console.log(`✅ Test room ready: ${roomCode}`);
      console.log('\n📱 SIMPLIFIED MODAL TESTING:');
      console.log(`1. Join room ${roomCode} in Safari iPhone`);
      console.log('2. Start game and play until someone wins');
      console.log('3. Winner modal should now display correctly');
      console.log('\n🔧 CHANGES MADE:');
      console.log('• Removed complex Safari detection logic');
      console.log('• Simplified modal styling and positioning');
      console.log('• Fixed potential race conditions in state updates');
      console.log('• Restored basic modal functionality that was working before');
      
      return { success: true, roomCode };
    } else {
      throw new Error('Room setup failed');
    }
  } catch (error) {
    console.log(`❌ Test setup failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

testSimpleModal().then(result => {
  process.exit(result.success ? 0 : 1);
});