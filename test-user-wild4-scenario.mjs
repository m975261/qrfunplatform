import WebSocket from 'ws';
import fetch from 'node-fetch';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('🎯 USER WILD DRAW 4 SCENARIO TEST');
console.log('==================================================');

async function testUserScenario() {
  let messageLog = [];
  let colorChoiceReceived = false;
  
  const ws = new WebSocket('ws://localhost:5000/ws');
  
  ws.on('open', async () => {
    console.log('✅ Connected to WebSocket');
    
    try {
      // Create room with proper schema
      const roomResponse = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hostId: 'user-test-id',
          hostNickname: 'TestUser',
          maxPlayers: 4 
        })
      });
      
      if (!roomResponse.ok) {
        const error = await roomResponse.text();
        console.error('❌ Failed to create room:', error);
        return;
      }
      
      const room = await roomResponse.json();
      console.log(`🏠 Room created: ${room.room.code}, ID: ${room.room.id}`);
      
      // Add second player
      const player2Response = await fetch(`http://localhost:5000/api/rooms/${room.room.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nickname: 'Player2',
          roomId: room.room.id 
        })
      });
      
      if (!player2Response.ok) {
        console.error('❌ Failed to add second player');
        return;
      }
      
      console.log('👤 Player 2 added successfully');
      
      // Join room via WebSocket
      ws.send(JSON.stringify({
        type: 'join_room',
        playerId: 'user-test-id',
        roomId: room.room.id,
        connectionId: 'user-test-conn',
        userFingerprint: 'fp-user-test',
        sessionId: 'session-user-test'
      }));
      
      await sleep(500);
      
      // Start game
      ws.send(JSON.stringify({
        type: 'start_game',
        playerId: 'user-test-id',
        roomId: room.room.id
      }));
      
      await sleep(1000);
      
      // Set hand with Wild Draw 4 and other cards
      await fetch(`http://localhost:5000/api/rooms/${room.room.id}/test-set-hand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'user-test-id',
          hand: [
            { type: 'number', color: 'red', number: 1 },
            { type: 'number', color: 'blue', number: 2 },
            { type: 'wild4', color: 'wild' },
            { type: 'number', color: 'green', number: 3 },
            { type: 'number', color: 'yellow', number: 4 }
          ]
        })
      });
      
      // Set player turn
      await fetch(`http://localhost:5000/api/rooms/${room.room.id}/test-set-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'user-test-id',
          currentPlayerIndex: 0
        })
      });
      
      console.log('🃏 Hand set with Wild Draw 4 at index 2, playing...');
      
      // Play Wild Draw 4 card (index 2)
      ws.send(JSON.stringify({
        type: 'play_card',
        cardIndex: 2,
        playerId: 'user-test-id',
        roomId: room.room.id
      }));
      
      console.log('⏱️ Waiting for color choice request...');
      
    } catch (error) {
      console.error('❌ Test error:', error);
      console.error('❌ Error stack:', error.stack);
    }
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      messageLog.push(message);
      
      console.log(`📨 Message received: ${message.type}`);
      
      if (message.type === 'choose_color_request') {
        colorChoiceReceived = true;
        console.log('🎨 ✅ COLOR CHOICE REQUEST RECEIVED!');
        console.log('📋 Full message:', JSON.stringify(message, null, 2));
        
        // Send color choice
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'choose_color',
            color: 'red',
            playerId: 'user-test-id'
          }));
          console.log('🎨 Sent color choice: red');
        }, 100);
      }
      
      if (message.type === 'wild_card_played') {
        console.log('🃏 Wild card played notification');
        console.log('📋 Message:', JSON.stringify(message, null, 2));
      }
      
    } catch (error) {
      console.error('❌ Message parsing error:', error);
      console.error('❌ Raw data:', data.toString());
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 Disconnected: code=${code}, reason="${reason}"`);
  });

  // Wait for test completion
  setTimeout(() => {
    console.log('==================================================');
    console.log('🔍 FINAL RESULTS:');
    console.log('Color choice request received:', colorChoiceReceived ? '✅ YES' : '❌ NO');
    
    const colorChoiceRequests = messageLog.filter(m => m.type === 'choose_color_request');
    const wildCardPlayed = messageLog.filter(m => m.type === 'wild_card_played');
    
    console.log(`Total choose_color_request: ${colorChoiceRequests.length}`);
    console.log(`Total wild_card_played: ${wildCardPlayed.length}`);
    
    if (colorChoiceRequests.length > 0) {
      console.log('Latest color request:', JSON.stringify(colorChoiceRequests[0], null, 2));
    }
    
    console.log('\n📊 All message types:');
    const messageTypes = {};
    messageLog.forEach(m => {
      messageTypes[m.type] = (messageTypes[m.type] || 0) + 1;
    });
    Object.entries(messageTypes).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} times`);
    });
    
    console.log('🔚 Test completed');
    ws.close();
    process.exit(0);
  }, 5000);
}

testUserScenario();