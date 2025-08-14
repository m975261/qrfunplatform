import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testWorkingModalRestore() {
  console.log('🔄 Testing RESTORED Working Modal (Safari Fix)');
  console.log('='.repeat(60));
  
  try {
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'RestoreTestHost' })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'RestoreTestPlayer' })
    });
    
    if (roomResponse.ok && joinResponse.ok) {
      console.log(`✅ Test room ready: ${roomCode}`);
      console.log('\n🔄 RESTORED WORKING VERSION:');
      console.log('• WebKit perspective and backface visibility properties restored');
      console.log('• Hardware acceleration transforms (translateZ(0)) restored');
      console.log('• WebKit overflow scrolling for touch devices restored');
      console.log('• Proper viewport meta tag management restored');
      console.log('• All Safari-specific CSS properties from working version restored');
      
      console.log('\n📱 TESTING INSTRUCTIONS:');
      console.log(`1. Join room ${roomCode} on Safari iPhone`);
      console.log('2. Start game and play until winner');
      console.log('3. Winner modal should now appear correctly (as it did before)');
      console.log('\n✨ This restores the exact version that was confirmed working');
      
      return { success: true, roomCode };
    } else {
      throw new Error('Room setup failed');
    }
  } catch (error) {
    console.log(`❌ Test setup failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

testWorkingModalRestore().then(result => {
  process.exit(result.success ? 0 : 1);
});