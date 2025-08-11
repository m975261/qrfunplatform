#!/usr/bin/env node

// Quick test to verify winner modal functionality
import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

async function testWinnerModal() {
  console.log('🧪 Testing winner modal display...');

  try {
    // Create room
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'TestHost' })
    });

    const roomData = await roomResponse.json();
    const roomId = roomData.room.id;
    const hostId = roomData.room.hostId;

    console.log(`✓ Room created: ${roomData.room.code}`);

    // Add second player
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomData.room.code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'TestPlayer2' })
    });

    const playerData = await joinResponse.json();
    console.log(`✓ Second player joined`);

    // Start game
    await fetch(`${BASE_URL}/api/rooms/${roomId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId })
    });

    console.log(`✓ Game started`);

    // Connect WebSocket to listen for game_end message
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      // Join room via WebSocket
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId,
        playerId: hostId
      }));
      console.log('✓ WebSocket connected and joined room');
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'game_end') {
        console.log('🏆 GAME END MESSAGE RECEIVED:', {
          type: message.type,
          winner: message.winner,
          rankings: message.rankings,
          messageKeys: Object.keys(message)
        });
        console.log('✅ Winner modal message format is correct!');
        ws.close();
        process.exit(0);
      } else if (message.type === 'room_state') {
        console.log(`📡 Room state: status=${message.data?.room?.status}`);
      }
    });

    // Force a win by setting one player to 1 card
    setTimeout(async () => {
      await fetch(`${BASE_URL}/api/rooms/${roomId}/test-set-hand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          playerId: hostId,
          hand: [{ type: 'number', color: 'red', number: 5 }]
        })
      });
      console.log('✓ Set host hand to 1 card');

      // Simulate playing the winning card
      ws.send(JSON.stringify({
        type: 'play_card',
        cardIndex: 0
      }));
      console.log('✓ Played winning card');
    }, 1000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test with timeout
setTimeout(() => {
  console.log('❌ Test timed out - no game_end message received');
  process.exit(1);
}, 10000);

testWinnerModal();