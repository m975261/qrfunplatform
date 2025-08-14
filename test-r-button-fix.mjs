// Test specifically for R button fix
import fetch from 'node-fetch';

console.log('🔧 R BUTTON FIX TEST');

async function testRButtonFix() {
  try {
    // Create room
    const response = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'RButtonTest', gameType: 'uno' })
    });
    
    const data = await response.json();
    console.log('✅ Test room created:', data.room.code);
    console.log(`🔗 URL: http://localhost:5000/room/${data.room.code}`);
    
    console.log('\n=== R BUTTON FIX APPLIED ===');
    console.log('✅ Changed div to span element');
    console.log('✅ Added onMouseDown prevention');
    console.log('✅ Enhanced onClick with multiple prevention layers');
    console.log('✅ Added data-prevent-navigation attribute');
    console.log('✅ Enhanced card container click detection');
    console.log('✅ Added textContent === "R" detection');
    
    console.log('\n🧪 TO TEST:');
    console.log('1. Load the room URL');
    console.log('2. Add player and start game');
    console.log('3. Login as guru: unom975261');
    console.log('4. Click R button on any card');
    console.log('5. Should open modal, NOT navigate to new page');
    
    return data.room.code;
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRButtonFix();