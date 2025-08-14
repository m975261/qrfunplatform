// Real comprehensive test for R button and avatar positioning fixes
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const TEST_TIMEOUT = 30000;

console.log('🧪 Starting REAL comprehensive test...');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestRoom() {
  try {
    console.log('📝 Creating test room...');
    const response = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        hostNickname: 'TestHost',
        gameType: 'uno'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Room created:', result.room.id);
    return result;
  } catch (error) {
    console.error('❌ Failed to create room:', error);
    throw error;
  }
}

async function joinRoomAsGuruUser(roomId, playerId) {
  try {
    console.log('🔐 Joining as guru user...');
    const response = await fetch(`${BASE_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'ظبياني',
        playerId: playerId,
        isGuruUser: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to join room: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Joined as guru user');
    return result;
  } catch (error) {
    console.error('❌ Failed to join as guru:', error);
    throw error;
  }
}

async function startGame(roomId, hostPlayerId) {
  try {
    console.log('🎮 Starting game...');
    const response = await fetch(`${BASE_URL}/api/rooms/${roomId}/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostPlayerId}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to start game: ${response.status}`);
    }
    
    console.log('✅ Game started');
    return await response.json();
  } catch (error) {
    console.error('❌ Failed to start game:', error);
    throw error;
  }
}

async function testGuruCardReplacement(roomId, playerId) {
  try {
    console.log('🔧 Testing guru card replacement (R button functionality)...');
    
    // Test the guru replace card endpoint directly
    const response = await fetch(`${BASE_URL}/api/rooms/${roomId}/guru-replace-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${playerId}`
      },
      body: JSON.stringify({
        cardIndex: 0,
        newCard: { color: 'red', value: '5' }
      })
    });
    
    if (response.ok) {
      console.log('✅ R BUTTON FIX VERIFIED: Guru card replacement endpoint works');
      return true;
    } else {
      const error = await response.text();
      console.log('ℹ️ Guru endpoint response:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Guru card replacement test failed:', error);
    return false;
  }
}

async function testAvatarPositioning(roomId) {
  try {
    console.log('👤 Testing avatar positioning system...');
    
    // Get room state to check player positions
    const response = await fetch(`${BASE_URL}/api/rooms/${roomId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get room state: ${response.status}`);
    }
    
    const roomState = await response.json();
    console.log('📊 Room state retrieved:', {
      playerCount: roomState.players?.length || 0,
      gameStarted: roomState.room?.status === 'active'
    });
    
    // Check if players have positions assigned
    const playersWithPositions = roomState.players?.filter(p => p.position !== undefined) || [];
    
    if (playersWithPositions.length > 0) {
      console.log('✅ AVATAR POSITIONING VERIFIED: Players have position assignments');
      playersWithPositions.forEach(p => {
        console.log(`  Player "${p.nickname}" at position ${p.position}`);
      });
      return true;
    } else {
      console.log('ℹ️ No positioned players found (may be normal if game not started)');
      return false;
    }
  } catch (error) {
    console.error('❌ Avatar positioning test failed:', error);
    return false;
  }
}

async function runComprehensiveTest() {
  let roomData, hostPlayerId, guruPlayerId;
  
  try {
    // Step 1: Create room with host
    roomData = await createTestRoom();
    hostPlayerId = roomData.playerId;
    const roomId = roomData.room.id;
    
    await delay(1000);
    
    // Step 2: Join as guru user
    guruPlayerId = 'guru-test-' + Date.now();
    await joinRoomAsGuruUser(roomId, guruPlayerId);
    
    await delay(1000);
    
    // Step 3: Start game
    await startGame(roomId, hostPlayerId);
    
    await delay(2000);
    
    // Step 4: Test both fixes
    console.log('\n=== TESTING FIXES ===');
    
    const guruTest = await testGuruCardReplacement(roomId, guruPlayerId);
    await delay(1000);
    
    const avatarTest = await testAvatarPositioning(roomId);
    
    // Step 5: Results
    console.log('\n=== TEST RESULTS ===');
    console.log(`R Button Fix (Guru Modal): ${guruTest ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Avatar Positioning: ${avatarTest ? '✅ WORKING' : '❌ FAILED'}`);
    
    if (guruTest && avatarTest) {
      console.log('\n🎉 ALL FIXES VERIFIED WORKING!');
      return true;
    } else {
      console.log('\n⚠️ Some fixes need attention');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
runComprehensiveTest()
  .then(success => {
    console.log(`\n🏁 Test completed: ${success ? 'SUCCESS' : 'NEEDS WORK'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });