import WebSocket from 'ws';

// Simple test focused on card playing issue
async function testCardPlaying() {
  console.log('🔍 Testing Card Playing Fix...');
  
  try {
    // Create WebSocket connection
    const ws = new WebSocket('ws://localhost:5000/ws');
    let gameState = null;
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'room_state') {
        gameState = message.data;
        console.log('📥 Received game state update');
      }
    });
    
    await new Promise(resolve => ws.on('open', resolve));
    console.log('✅ WebSocket connected');
    
    // Use existing room from test
    const testRoomId = 'a8c1a98b-0da6-49fe-bc54-ee765d231ecf';
    const testPlayerId = '83fb194c-5863-4beb-ae63-69361481dc84';
    
    // Join room
    ws.send(JSON.stringify({
      type: 'join_room',
      playerId: testPlayerId,
      roomId: testRoomId,
      userFingerprint: 'test-fix',
      sessionId: 'session-fix'
    }));
    
    // Wait for game state
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!gameState || !gameState.room) {
      console.log('❌ No game state received');
      return false;
    }
    
    console.log(`🎮 Room Status: ${gameState.room.status}`);
    console.log(`👥 Players: ${gameState.players.length}`);
    
    const currentPlayerIndex = gameState.room.currentPlayerIndex || 0;
    const gamePlayers = gameState.players.filter(p => !p.isSpectator);
    const currentPlayer = gamePlayers[currentPlayerIndex];
    const topCard = gameState.room.discardPile[0];
    
    console.log(`🎯 Current player: ${currentPlayer?.nickname} (Index: ${currentPlayerIndex})`);
    console.log(`🃏 Top card: ${topCard?.color} ${topCard?.type} ${topCard?.number || ''}`);
    console.log(`🤚 Current player hand size: ${currentPlayer?.hand?.length || 0}`);
    
    if (currentPlayer && currentPlayer.hand && currentPlayer.hand.length > 0) {
      console.log('🎲 Player hand:');
      currentPlayer.hand.forEach((card, i) => {
        console.log(`   ${i}: ${card.color} ${card.type} ${card.number !== undefined ? card.number : ''}`);
      });
      
      // Test card playability logic
      let foundPlayableCard = false;
      for (let i = 0; i < currentPlayer.hand.length; i++) {
        const card = currentPlayer.hand[i];
        const isPlayable = 
          card.color === topCard.color ||
          (card.type === 'number' && topCard.type === 'number' && card.number === topCard.number) ||
          card.type === topCard.type ||
          card.type === 'wild' ||
          card.type === 'wild4';
          
        if (isPlayable) {
          console.log(`✅ Found playable card at index ${i}: ${card.color} ${card.type} ${card.number || ''}`);
          foundPlayableCard = true;
          
          // Try to play it if it's our turn
          if (currentPlayer.id === testPlayerId) {
            console.log('🎮 Attempting to play card...');
            
            if (card.type === 'wild' || card.type === 'wild4') {
              ws.send(JSON.stringify({ type: 'choose_color', color: 'red' }));
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            ws.send(JSON.stringify({ type: 'play_card', cardIndex: i }));
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('✅ Card play attempted');
          }
          break;
        }
      }
      
      if (!foundPlayableCard) {
        console.log('⚠️ No playable cards found, testing draw card...');
        if (currentPlayer.id === testPlayerId) {
          ws.send(JSON.stringify({ type: 'draw_card' }));
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('🎲 Draw card attempted');
        }
      }
    }
    
    ws.close();
    return true;
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return false;
  }
}

testCardPlaying().then(success => {
  console.log(success ? '✅ Test completed' : '❌ Test failed');
  process.exit(0);
});