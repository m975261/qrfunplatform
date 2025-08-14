// Test avatar positioning calculations
import fetch from 'node-fetch';

console.log('📍 AVATAR POSITIONING TEST');

// Calculate the exact positions
const circleRadius = 140;
const avatarRadius = 32;
const totalDistance = circleRadius + avatarRadius;

console.log('=== POSITIONING CALCULATIONS ===');
console.log(`Circle radius: ${circleRadius}px`);
console.log(`Avatar radius: ${avatarRadius}px`);
console.log(`Total distance from center: ${totalDistance}px`);

console.log('\n=== CLOCK POSITIONS ===');

// 12 o'clock
console.log('Position 0 (12 o\'clock):');
console.log(`  top: calc(50% - ${totalDistance}px)`);
console.log(`  left: 50%`);

// 3 o'clock  
console.log('Position 1 (3 o\'clock):');
console.log(`  top: 50%`);
console.log(`  left: calc(50% + ${totalDistance}px)`);

// 6 o'clock
console.log('Position 2 (6 o\'clock):');
console.log(`  top: calc(50% + ${totalDistance}px)`);
console.log(`  left: 50%`);

// 10 o'clock (240 degrees)
const angle240 = 240 * Math.PI / 180;
const x10 = Math.round(totalDistance * Math.cos(angle240));
const y10 = Math.round(totalDistance * Math.sin(angle240));

console.log('Position 3 (10 o\'clock):');
console.log(`  top: calc(50% + ${y10}px)`);
console.log(`  left: calc(50% + ${x10}px)`);
console.log(`  (x: ${x10}, y: ${y10})`);

// Create test room
async function testAvatarPositioning() {
  try {
    const response = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'AvatarTest', gameType: 'uno' })
    });
    
    const data = await response.json();
    console.log('\n✅ Test room created:', data.room.code);
    console.log(`🔗 URL: http://localhost:5000/room/${data.room.code}`);
    
    console.log('\n🧪 TO VERIFY:');
    console.log('1. Load the room URL');
    console.log('2. Add players and start game');
    console.log('3. Check that avatars are attached to circle edge');
    console.log('4. Verify no overlapping with game elements');
    console.log('5. Confirm exact clock positions');
    
    return data.room.code;
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAvatarPositioning();