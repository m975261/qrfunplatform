import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testUnoBugFix() {
  console.log('🔍 Testing UNO Penalty Bug Fix');
  console.log('='.repeat(50));
  
  try {
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'UnoBugHost' })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'UnoBugPlayer' })
    });
    
    if (roomResponse.ok && joinResponse.ok) {
      console.log(`✅ Test room ready: ${roomCode}`);
      console.log('\n🐛 UNO BUG INVESTIGATION:');
      console.log('• Enhanced logging added to track UNO call verification');
      console.log('• Added database verification after UNO call');
      console.log('• Enhanced play card logging to track hasCalledUno status');
      console.log('\n🔧 POTENTIAL FIXES:');
      console.log('• Check for race conditions between UNO call and card play');
      console.log('• Verify storage persistence of hasCalledUno status');
      console.log('• Check if draw card logic is incorrectly resetting UNO status');
      
      console.log('\n📝 REPRODUCE THE BUG:');
      console.log(`1. Join room ${roomCode} with 2 players`);
      console.log('2. Play until you have exactly 2 cards');
      console.log('3. Call UNO (should show ✅ UNO CALLED in server logs)');
      console.log('4. Immediately play your second-to-last card');
      console.log('5. Check server logs for UNO penalty');
      console.log('\n🔍 WHAT TO LOOK FOR IN LOGS:');
      console.log('• UNO CALL VERIFICATION should show hasCalledUno=true');
      console.log('• PLAY CARD should show hasCalledUno=true');
      console.log('• If bug exists: penalty applied despite calling UNO');
      
      return { success: true, roomCode };
    } else {
      throw new Error('Room setup failed');
    }
  } catch (error) {
    console.log(`❌ Test setup failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

testUnoBugFix().then(result => {
  process.exit(result.success ? 0 : 1);
});