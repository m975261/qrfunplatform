// Simple test using existing working system - no external dependencies
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:5000';

async function testWinnerMessage() {
  console.log('🧪 Testing Winner Message Format...');
  
  try {
    // Create room and players
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'Winner' })
    });
    const roomData = await roomResponse.json();
    
    const player2Response = await fetch(`${BASE_URL}/api/rooms/${roomData.room.code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Loser' })
    });
    
    const roomId = roomData.room.id;
    const player1Id = roomData.room.hostId;
    
    console.log('✓ Room created:', roomData.room.code);
    
    // Start game
    await fetch(`${BASE_URL}/api/rooms/${roomId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✓ Game started');
    
    // Set winner to have 1 card
    await fetch(`${BASE_URL}/api/rooms/${roomId}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: player1Id,
        hand: [{ color: 'red', value: '5', type: 'number' }]
      })
    });
    
    // Set discard pile
    await fetch(`${BASE_URL}/api/rooms/${roomId}/test-set-discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card: { color: 'red', value: '4', type: 'number' }
      })
    });
    
    console.log('✓ Set up winning scenario');
    
    // Connect WebSocket
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    return new Promise((resolve) => {
      ws.on('open', async () => {
        console.log('✓ WebSocket connected');
        
        // Join room
        ws.send(JSON.stringify({
          type: 'join_room',
          playerId: player1Id,
          roomId
        }));
        
        // Wait for join
        await new Promise(r => setTimeout(r, 500));
        
        // Call UNO first
        ws.send(JSON.stringify({ type: 'call_uno' }));
        await new Promise(r => setTimeout(r, 500));
        
        // Play winning card
        console.log('🏆 Playing winning card...');
        ws.send(JSON.stringify({ 
          type: 'play_card', 
          cardIndex: 0 
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'game_end') {
          console.log('🏆 GAME END MESSAGE RECEIVED:');
          console.log('   Format:', {
            hasWinnerField: !!message.winner,
            hasRankingsField: !!message.rankings,
            hasDataField: !!message.data,
            winner: message.winner,
            rankings: message.rankings
          });
          
          if (message.winner && message.rankings) {
            console.log('✅ Winner modal should now display correctly!');
            console.log(`✅ Winner: "${message.winner}"`);
            console.log(`✅ Rankings: ${message.rankings.length} players`);
          } else {
            console.log('❌ Message format still incorrect');
          }
          
          ws.close();
          resolve();
        }
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        console.log('⏰ Timeout - no game end message');
        ws.close();
        resolve();
      }, 10000);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testWinnerMessage();