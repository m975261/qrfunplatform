import WebSocket from 'ws';
import fetch from 'node-fetch';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('🎯 WILD DRAW 4 COLOR CHOICE TEST');
console.log('==================================================');

async function testWildDraw4Color() {
  let colorChoiceReceived = false;
  let messageLog = [];
  
  const ws = new WebSocket('ws://localhost:5000/ws');
  
  ws.on('open', async () => {
    console.log('✅ Connected to WebSocket');
    
    try {
      // Create room
      const roomResponse = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hostId: 'test-host-wild4',
          maxPlayers: 4 
        })
      });
      const room = await roomResponse.json();
      console.log(`🏠 Room created: ${room.room.code}`);
      
      // Add second player
      const player2Response = await fetch(`http://localhost:5000/api/rooms/${room.room.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nickname: 'Player2',
          roomId: room.room.id 
        })
      });
      console.log('👤 Player 2 added');
      
      // Join room via WebSocket
      ws.send(JSON.stringify({
        type: 'join_room',
        playerId: 'test-host-wild4',
        roomId: room.room.id,
        connectionId: 'test-conn-wild4',
        userFingerprint: 'fp-test-wild4',
        sessionId: 'session-test-wild4'
      }));
      
      await sleep(500);
      
      // Start game
      ws.send(JSON.stringify({
        type: 'start_game',
        playerId: 'test-host-wild4',
        roomId: room.room.id
      }));
      
      await sleep(1000);
      
      // Set hand with Wild Draw 4 card
      await fetch(`http://localhost:5000/api/rooms/${room.room.id}/test-set-hand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'test-host-wild4',
          hand: [
            { type: 'wild4', color: 'wild' },
            { type: 'number', color: 'red', number: 5 },
            { type: 'number', color: 'blue', number: 3 }
          ]
        })
      });
      
      // Set player turn
      await fetch(`http://localhost:5000/api/rooms/${room.room.id}/test-set-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'test-host-wild4',
          currentPlayerIndex: 0
        })
      });
      
      console.log('🃏 Wild Draw 4 card set in hand, playing card...');
      
      // Play Wild Draw 4 card
      ws.send(JSON.stringify({
        type: 'play_card',
        cardIndex: 0,
        playerId: 'test-host-wild4',
        roomId: room.room.id
      }));
      
      console.log('⏱️ Waiting for color choice request...');
      
    } catch (error) {
      console.error('❌ Test error:', error);
    }
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    messageLog.push(message);
    
    if (message.type === 'choose_color_request') {
      colorChoiceReceived = true;
      console.log('🎨 COLOR CHOICE REQUEST RECEIVED for Wild Draw 4!');
      console.log('📋 Full message:', JSON.stringify(message, null, 2));
      
      // Send color choice
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'choose_color',
          color: 'red',
          playerId: 'test-host-wild4'
        }));
        console.log('🎨 Sent color choice: red');
      }, 500);
    }
    
    if (message.type === 'wild_card_played') {
      console.log('🃏 WILD CARD PLAYED notification received');
      console.log('📋 Full message:', JSON.stringify(message, null, 2));
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  // Wait for test completion
  setTimeout(() => {
    console.log('==================================================');
    console.log('🔍 RESULTS:');
    console.log('Color choice request received:', colorChoiceReceived ? '✅ YES' : '❌ NO');
    console.log('Total choose_color_request messages:', messageLog.filter(m => m.type === 'choose_color_request').length);
    console.log('Total wild_card_played messages:', messageLog.filter(m => m.type === 'wild_card_played').length);
    
    if (colorChoiceReceived) {
      const latestColorRequest = messageLog.filter(m => m.type === 'choose_color_request').pop();
      console.log('Latest color request:', JSON.stringify(latestColorRequest, null, 2));
    }
    
    console.log('\nAll message types received:');
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
  }, 4000);
}

testWildDraw4Color();