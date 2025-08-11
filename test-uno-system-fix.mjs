import WebSocket from 'ws';

async function testUNOSystemFix() {
  console.log('🔍 Testing UNO System Fix...');
  
  try {
    const ws = new WebSocket('ws://localhost:5000/ws');
    let gameState = null;
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'room_state') {
        gameState = message.data;
      } else if (message.type === 'uno_called_success') {
        console.log(`🎉 UNO called by: ${message.player}`);
      }
    });
    
    await new Promise(resolve => ws.on('open', resolve));
    console.log('✅ WebSocket connected');
    
    // Use test room and player
    const testRoomId = 'a8c1a98b-0da6-49fe-bc54-ee765d231ecf';
    const testPlayerId = '83fb194c-5863-4beb-ae63-69361481dc84';
    
    ws.send(JSON.stringify({
      type: 'join_room',
      playerId: testPlayerId,
      roomId: testRoomId,
      userFingerprint: 'test-uno-fix',
      sessionId: 'session-uno-fix'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!gameState) {
      console.log('❌ No game state received');
      return false;
    }
    
    const testPlayer = gameState.players.find(p => p.id === testPlayerId);
    if (!testPlayer) {
      console.log('❌ Test player not found in game state');
      return false;
    }
    
    console.log(`👤 Player: ${testPlayer.nickname}`);
    console.log(`🎯 HasCalledUno BEFORE: ${testPlayer.hasCalledUno}`);
    console.log(`🤚 Hand size: ${testPlayer.hand?.length || 0}`);
    
    // Call UNO
    console.log('📢 Calling UNO...');
    ws.send(JSON.stringify({ type: 'call_uno' }));
    
    // Wait for response and updated state
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check updated state
    const updatedPlayer = gameState.players.find(p => p.id === testPlayerId);
    if (updatedPlayer) {
      console.log(`🎯 HasCalledUno AFTER: ${updatedPlayer.hasCalledUno}`);
      
      if (updatedPlayer.hasCalledUno) {
        console.log('✅ UNO call properly reflected in player state');
        ws.close();
        return true;
      } else {
        console.log('❌ UNO call NOT reflected in player state');
      }
    } else {
      console.log('❌ Could not find updated player state');
    }
    
    ws.close();
    return false;
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return false;
  }
}

testUNOSystemFix().then(success => {
  console.log(success ? '✅ UNO System Fix - PASSED' : '❌ UNO System Fix - FAILED');
  process.exit(0);
});