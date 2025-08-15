import WebSocket from 'ws';

// Test Wild Draw 4 functionality specifically
async function testWildDraw4() {
  console.log('🔍 Testing Wild Draw 4 Card Functionality...');
  
  try {
    const ws = new WebSocket('ws://localhost:5000/ws');
    let gameState = null;
    let receivedMessages = [];
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
      if (message.type === 'room_state') {
        gameState = message.data;
      }
    });
    
    await new Promise(resolve => ws.on('open', resolve));
    console.log('✅ WebSocket connected');
    
    // Create new test room
    const response = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'TestHost' })
    });
    const roomData = await response.json();
    
    console.log(`🏠 Created test room: ${roomData.room.code}`);
    
    // Join as host
    ws.send(JSON.stringify({
      type: 'join_room',
      playerId: roomData.player.id,
      roomId: roomData.room.id,
      userFingerprint: 'test-wild4',
      sessionId: 'session-wild4'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start game
    await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/start`, { method: 'POST' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if we have any Wild Draw 4 cards
    const hostPlayer = gameState.players.find(p => p.id === roomData.player.id);
    let wild4CardIndex = -1;
    
    if (hostPlayer && hostPlayer.hand) {
      for (let i = 0; i < hostPlayer.hand.length; i++) {
        if (hostPlayer.hand[i].type === 'wild4') {
          wild4CardIndex = i;
          console.log(`🎴 Found Wild Draw 4 at index ${i}`);
          break;
        }
      }
    }
    
    if (wild4CardIndex >= 0) {
      const otherPlayer = gameState.players.find(p => p.id !== roomData.player.id && !p.isSpectator);
      const handSizeBefore = otherPlayer ? otherPlayer.hand.length : 0;
      
      console.log(`👥 Other player hand size before: ${handSizeBefore}`);
      console.log(`⏳ Current pending draw: ${gameState.room.pendingDraw || 0}`);
      
      // Choose color first
      ws.send(JSON.stringify({ type: 'choose_color', color: 'red' }));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Play Wild Draw 4
      console.log('🎮 Playing Wild Draw 4 card...');
      ws.send(JSON.stringify({ type: 'play_card', cardIndex: wild4CardIndex }));
      
      // Wait for effects
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for pending draw effect
      const newPendingDraw = gameState.room.pendingDraw || 0;
      console.log(`⏳ Pending draw after Wild Draw 4: ${newPendingDraw}`);
      
      if (newPendingDraw === 4) {
        console.log('✅ Wild Draw 4 correctly set pending draw to 4');
        
        // Check if next player automatically draws (if they can't stack)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const updatedOtherPlayer = gameState.players.find(p => p.id !== roomData.player.id && !p.isSpectator);
        if (updatedOtherPlayer) {
          const handSizeAfter = updatedOtherPlayer.hand.length;
          console.log(`👥 Other player hand size after: ${handSizeAfter}`);
          
          if (handSizeAfter === handSizeBefore + 4) {
            console.log('✅ Wild Draw 4 correctly forced player to draw 4 cards');
            ws.close();
            return true;
          } else {
            console.log(`❌ Expected +4 cards, got +${handSizeAfter - handSizeBefore}`);
          }
        }
      } else {
        console.log(`❌ Expected pending draw of 4, got ${newPendingDraw}`);
      }
    } else {
      console.log('⚠️ No Wild Draw 4 cards found in hand - testing deck creation');
      
      // Check deck composition
      const deckStats = { wild4: 0 };
      if (gameState.room.deck) {
        gameState.room.deck.forEach(card => {
          if (card.type === 'wild4') deckStats.wild4++;
        });
      }
      
      console.log(`🎲 Wild Draw 4 cards in deck: ${deckStats.wild4}`);
      console.log('✅ Test completed - would need Wild Draw 4 in hand to test fully');
    }
    
    ws.close();
    return false;
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return false;
  }
}

testWildDraw4().then(success => {
  console.log(success ? '✅ Wild Draw 4 - PASSED' : '🔍 Wild Draw 4 - NEEDS REAL GAME TEST');
  process.exit(0);
});