import fetch from 'node-fetch';
import { WebSocket } from 'ws';

console.log('🧪 TESTING SAFARI MODAL ISSUE - Complete Game Flow');

async function testSafariModal() {
  try {
    console.log('1. Creating room...');
    const roomResponse = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'SafariHost' })
    });
    const roomData = await roomResponse.json();
    
    console.log('2. Joining second player...');
    const joinResponse = await fetch(`http://localhost:5000/api/rooms/${roomData.room.code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'SafariPlayer' })
    });
    const joinData = await joinResponse.json();
    
    console.log('3. Setting up WebSocket connections...');
    const ws1 = new WebSocket('ws://localhost:5000/ws');
    const ws2 = new WebSocket('ws://localhost:5000/ws');
    
    let gameEndReceived = { ws1: false, ws2: false };
    
    ws1.on('open', () => {
      console.log('Host WebSocket connected');
      ws1.send(JSON.stringify({
        type: 'join_room',
        playerId: roomData.room.hostId,
        roomId: roomData.room.id,
        userFingerprint: 'safari-test-host',
        sessionId: 'safari-session-host'
      }));
    });
    
    ws2.on('open', () => {
      console.log('Player WebSocket connected');
      ws2.send(JSON.stringify({
        type: 'join_room',
        playerId: joinData.player.id,
        roomId: roomData.room.id,
        userFingerprint: 'safari-test-player',
        sessionId: 'safari-session-player'
      }));
    });
    
    // Listen for game_end messages
    ws1.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'game_end') {
        gameEndReceived.ws1 = true;
        console.log('✅ HOST received game_end message:', {
          winner: msg.winner,
          rankings: msg.rankings?.length,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    ws2.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'game_end') {
        gameEndReceived.ws2 = true;
        console.log('✅ PLAYER received game_end message:', {
          winner: msg.winner,
          rankings: msg.rankings?.length,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Start game after connections are established
    setTimeout(async () => {
      console.log('4. Starting game...');
      await fetch(`http://localhost:5000/api/rooms/${roomData.room.code}/start`, {
        method: 'POST'
      });
      console.log(`Game started! Room code: ${roomData.room.code}`);
      console.log(`Frontend URL: http://localhost:5000/room/${roomData.room.code}`);
      console.log('');
      console.log('🧪 TEST INSTRUCTIONS FOR SAFARI:');
      console.log('1. Open the frontend URL in Safari');
      console.log('2. Play cards until someone wins');
      console.log('3. Check if winner modal appears');
      console.log('4. Check browser console for debugging logs');
      console.log('');
      console.log('Expected logs in Safari console:');
      console.log('- "🏆 GAME END MESSAGE RECEIVED - Safari Debug"');
      console.log('- "🏆 GameEndModal MOUNTED - Maximum Safari Debug"');
      console.log('- "🏆 Modal element found, forcing Safari visibility"');
      
      // Keep connections alive for testing
      setTimeout(() => {
        console.log('\n📊 FINAL RESULTS:');
        console.log(`Host received game_end: ${gameEndReceived.ws1}`);
        console.log(`Player received game_end: ${gameEndReceived.ws2}`);
        console.log('Test completed. WebSocket connections closing...');
        ws1.close();
        ws2.close();
      }, 30000);
    }, 2000);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSafariModal();