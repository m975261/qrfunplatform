// Direct wild card play test - simulates exactly what happens in the browser
import WebSocket from 'ws';
import fetch from 'node-fetch';

const WS_URL = 'ws://localhost:5000/ws';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDirectWildCardPlay() {
  console.log('🎯 DIRECT WILD CARD PLAY TEST');
  console.log('=' .repeat(50));

  const ws = new WebSocket(WS_URL);
  let messages = [];
  let colorChoiceReceived = false;

  ws.onopen = () => {
    console.log('✅ Connected to WebSocket');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      messages.push(message);
      
      if (message.type === 'choose_color_request') {
        console.log('🎨 COLOR CHOICE REQUEST RECEIVED!');
        console.log('📋 Full message:', JSON.stringify(message, null, 2));
        colorChoiceReceived = true;
        
        // Send color choice response
        setTimeout(() => {
          console.log('🎨 Sending color choice: red');
          ws.send(JSON.stringify({
            type: 'choose_color',
            color: 'red'
          }));
        }, 1000);
      }
      
      if (message.type === 'wild_card_played') {
        console.log('🃏 WILD CARD PLAYED notification received');
        console.log('📋 Full message:', JSON.stringify(message, null, 2));
        if (message.requiresColorChoice) {
          colorChoiceReceived = true;
        }
      }
      
      if (message.type === 'room_state') {
        const room = message.room;
        if (room?.status === 'playing') {
          console.log(`🎮 Game active - Top card: ${room.discardPile?.[0]?.color} ${room.discardPile?.[0]?.type}, Current color: ${room.currentColor}`);
        }
      }
      
      if (message.type !== 'heartbeat') {
        console.log(`📨 Received: ${message.type}`);
      }
    } catch (error) {
      console.error('Parse error:', error);
    }
  };

  ws.onclose = (event) => {
    console.log(`🔌 Disconnected: code=${event.code}, reason="${event.reason}"`);
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };

  // Wait for connection
  await sleep(1000);

  try {
    // Step 1: Create room
    console.log('🏠 Creating room...');
    const roomResponse = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: 'test-wild-direct',
        hostNickname: 'WildTester'
      })
    });
    const roomData = await roomResponse.json();
    const roomCode = roomData.room.code;
    const hostId = roomData.room.hostId;
    console.log(`🏠 Room created: ${roomCode}`);
    console.log(`🏠 Room host ID: ${hostId}`);

    // Step 2: Use the host ID as our player ID
    const playerId = hostId;
    console.log(`👤 Using host as player: ${playerId}`);

    // Step 3: Create second player
    const player2Response = await fetch(`http://localhost:5000/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'Player2',
        userFingerprint: 'fp-player2',
        sessionId: 'session-player2'
      })
    });
    const player2Data = await player2Response.json();
    console.log(`👤 Player 2 created: ${player2Data.player.id}`);

    // Step 4: Join room via WebSocket
    console.log('🎮 Joining room via WebSocket...');
    ws.send(JSON.stringify({
      type: 'join_room',
      roomId: roomCode,
      playerId: playerId,
      nickname: 'WildTester',
      userFingerprint: 'fp-wild-test',
      sessionId: 'session-wild-test'
    }));
    await sleep(2000);

    // Step 5: Start game
    console.log('🎯 Starting game...');
    ws.send(JSON.stringify({
      type: 'start_game'
    }));
    await sleep(3000);

    // Step 6: Give wild card to player
    console.log('🃏 Adding wild card to player...');
    await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: playerId,
        hand: [
          { type: "wild", color: null },
          { type: "number", color: "blue", number: 5 }
        ]
      })
    });

    // Step 7: Set player's turn
    await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: 0 })
    });
    await sleep(1000);

    // Step 8: Play the wild card
    console.log('🎲 Playing wild card...');
    ws.send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));

    // Step 9: Wait for color choice request
    console.log('⏱️ Waiting for color choice request...');
    await sleep(10000);

    // Step 10: Analyze results
    console.log('=' .repeat(50));
    console.log('🔍 RESULTS:');
    console.log(`Color choice request received: ${colorChoiceReceived ? '✅ YES' : '❌ NO'}`);
    
    const colorRequests = messages.filter(m => m.type === 'choose_color_request');
    const wildPlayed = messages.filter(m => m.type === 'wild_card_played');
    
    console.log(`Total choose_color_request messages: ${colorRequests.length}`);
    console.log(`Total wild_card_played messages: ${wildPlayed.length}`);
    
    if (colorRequests.length > 0) {
      console.log('Latest color request:', JSON.stringify(colorRequests[colorRequests.length - 1], null, 2));
    }
    
    console.log('\nAll message types received:');
    const messageTypes = [...new Set(messages.map(m => m.type))];
    messageTypes.forEach(type => {
      const count = messages.filter(m => m.type === type).length;
      console.log(`  - ${type}: ${count} times`);
    });

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await sleep(1000);
    ws.close();
    console.log('🔚 Test completed');
  }
}

testDirectWildCardPlay().catch(console.error);