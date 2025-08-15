import WebSocket from 'ws';
import fetch from 'node-fetch';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('🎯 WILD CARD UI DEBUG TEST');
console.log('==================================================');

const ws = new WebSocket('ws://localhost:5000/ws');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  if (message.type === 'choose_color_request') {
    console.log('🎨 CHOOSE COLOR REQUEST RECEIVED - should trigger UI modal!');
    console.log('📋 Full message structure:', JSON.stringify(message, null, 2));
  }
});

async function testWildCardUI() {
  await sleep(1000);

  try {
    // Create room and get host ID
    const roomResponse = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: 'ui-test-wild',
        hostNickname: 'UITester'
      })
    });
    const roomData = await roomResponse.json();
    const roomCode = roomData.room.code;
    const hostId = roomData.room.hostId;
    console.log(`🏠 Room created: ${roomCode}, Host: ${hostId}`);

    // Add second player
    const player2Response = await fetch(`http://localhost:5000/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'Player2',
        userFingerprint: 'fp-ui-test',
        sessionId: 'session-ui-test'
      })
    });
    console.log('👤 Player 2 added');

    // Join as host via WebSocket
    ws.send(JSON.stringify({
      type: 'join_room',
      playerId: hostId,
      roomId: roomData.room.id,
      connectionId: 'ui-test-conn',
      userFingerprint: 'fp-host',
      sessionId: 'session-host'
    }));

    await sleep(500);

    // Start game
    ws.send(JSON.stringify({ type: 'start_game' }));
    console.log('🎮 Game started');

    await sleep(1000);

    // Give player a wild card plus other cards so game doesn't end immediately
    await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: hostId,
        hand: [
          { type: 'wild', color: null, value: null },
          { type: 'number', color: 'red', value: 5 },
          { type: 'number', color: 'blue', value: 3 },
          { type: 'number', color: 'green', value: 7 }
        ]
      })
    });
    console.log('🃏 Wild card added to hand (plus other cards to prevent game end)');

    // Set as player's turn
    await fetch(`http://localhost:5000/api/rooms/${roomData.room.id}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: hostId,
        currentPlayerIndex: 0
      })
    });
    console.log('🎯 Set as player turn');

    // Play wild card
    ws.send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    console.log('🃏 Wild card played - expecting color choice request...');

    // Wait for color choice request
    await sleep(2000);
    console.log('⏱️ Test completed - check if choose_color_request was received');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testWildCardUI();

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 5000);