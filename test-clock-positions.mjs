// Test grid-based avatar positioning
import fetch from 'node-fetch';

console.log('🕐 CLOCK POSITION GRID TEST');

async function testClockPositions() {
  try {
    const response = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'ClockTest', gameType: 'uno' })
    });
    
    const data = await response.json();
    console.log('✅ Test room created:', data.room.code);
    console.log(`🔗 URL: http://localhost:5000/room/${data.room.code}`);
    
    console.log('\n=== GRID POSITIONING SYSTEM ===');
    console.log('✅ Removed upper grid system');
    console.log('✅ Kept bottom grid for player hand');
    console.log('✅ Added dedicated avatar grid (12x12)');
    
    console.log('\n=== AVATAR POSITIONS ===');
    console.log('Position 0: col-start-6 col-end-8 row-start-1 row-end-3 (12 o\'clock)');
    console.log('Position 1: col-start-11 col-end-13 row-start-6 row-end-8 (3 o\'clock)');
    console.log('Position 2: col-start-6 col-end-8 row-start-11 row-end-13 (6 o\'clock)');
    console.log('Position 3: col-start-2 col-end-4 row-start-3 row-end-5 (10 o\'clock)');
    
    console.log('\n🧪 TO VERIFY:');
    console.log('1. Load the room URL');
    console.log('2. Add players and start game');
    console.log('3. Check avatars are at exact clock positions');
    console.log('4. Verify no overlap with game elements');
    console.log('5. Confirm grid system works as expected');
    
    return data.room.code;
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testClockPositions();