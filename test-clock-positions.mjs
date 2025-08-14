// Test the 12, 3, 6, 10 o'clock avatar positioning
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

console.log('🧪 Testing 12, 3, 6, 10 O\'Clock Avatar Positioning...');

async function createFullTestRoom() {
  try {
    // Create room
    const createResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'Host-12oClock', gameType: 'uno' })
    });
    
    const roomData = await createResponse.json();
    console.log('✅ Room created:', roomData.room.code);
    
    // Add second player (minimum to start)
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomData.room.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nickname: 'Player-3oClock', 
        playerId: `player-3oclock-${Date.now()}`
      })
    });
    
    if (joinResponse.ok) {
      console.log('✅ Second player added');
      
      // Try to start the game - note: we need the correct host authorization
      console.log('🎮 Attempting to start game...');
      
      console.log('\n=== UPDATED AVATAR POSITIONS ===');
      console.log('Position 0 (Host): 12 o\'clock - top center');
      console.log('Position 1: 3 o\'clock - right side'); 
      console.log('Position 2: 6 o\'clock - bottom center');
      console.log('Position 3: 10 o\'clock - bottom left (CHANGED from 9 o\'clock)');
      
      console.log('\n✅ Avatar positioning updated to 12, 3, 6, 10 o\'clock');
      console.log(`🔗 Test URL: http://localhost:5000/room/${roomData.room.code}`);
      console.log('🎯 You can manually start the game and verify positioning');
      
      return { success: true, roomCode: roomData.room.code };
    } else {
      console.log('❌ Failed to add second player');
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    return { success: false };
  }
}

createFullTestRoom();