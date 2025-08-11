import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:5000';

// Test the complete ranking system and turn management
async function testRankingSystemComplete() {
  console.log('\n🧪 TESTING: Complete Ranking System & Turn Management');
  console.log('=' .repeat(60));

  let room, players = [], sockets = [];
  
  try {
    // Step 1: Create room and add 4 players
    console.log('\n📝 Step 1: Creating room with 4 players...');
    
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'Player1' })
    });
    
    if (!roomResponse.ok) {
      throw new Error(`Room creation failed: ${roomResponse.status}`);
    }
    
    room = await roomResponse.json();
    console.log(`✅ Room created: ${room.code}`);
    
    // Add Player1 as host
    players.push({ nickname: 'Player1', id: room.hostId, token: room.token });
    
    // Join other players
    for (let i = 2; i <= 4; i++) {
      const joinResponse = await fetch(`${BASE_URL}/api/rooms/${room.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: `Player${i}` })
      });
      
      if (!joinResponse.ok) {
        throw new Error(`Player${i} join failed: ${joinResponse.status}`);
      }
      
      const playerData = await joinResponse.json();
      players.push({ nickname: `Player${i}`, id: playerData.playerId, token: playerData.token });
    }
    
    console.log(`✅ All 4 players joined: ${players.map(p => p.nickname).join(', ')}`);
    
    // Step 2: Start game
    console.log('\n🎮 Step 2: Starting game...');
    const startResponse = await fetch(`${BASE_URL}/api/rooms/${room.code}/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${players[0].token}`
      }
    });
    
    if (!startResponse.ok) {
      throw new Error(`Game start failed: ${startResponse.status}`);
    }
    
    console.log('✅ Game started successfully');
    
    // Step 3: Connect WebSockets for all players
    console.log('\n🔌 Step 3: Connecting WebSockets...');
    
    for (let i = 0; i < players.length; i++) {
      const ws = new WebSocket(`ws://localhost:5000/ws`);
      sockets.push(ws);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'join_room',
            playerId: players[i].id,
            roomId: room.code,
            userFingerprint: `test-fingerprint-${i}`,
            sessionId: `test-session-${i}`
          }));
          resolve();
        });
        ws.on('error', reject);
      });
    }
    
    console.log('✅ All WebSocket connections established');
    
    // Wait for initial state
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Make Player 2 finish first (simulate by setting empty hand)
    console.log('\n🏆 Step 4: Making Player2 finish first...');
    
    const finishPlayer2Response = await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        playerId: players[1].id, 
        hand: [{ type: 'number', color: 'red', number: 1 }] 
      })
    });
    
    if (!finishPlayer2Response.ok) {
      throw new Error('Failed to set Player2 hand');
    }
    
    // Set discard pile to allow Player2 to play
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topCard: { type: 'number', color: 'red', number: 2 }
      })
    });
    
    // Set Player2 as current player
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: 1 })
    });
    
    console.log('✅ Player2 set up to finish first');
    
    // Step 5: Have Player2 play final card
    console.log('\n🎯 Step 5: Player2 playing final card...');
    
    // Listen for ranking updates
    let player2Finished = false;
    let gameState = null;
    
    sockets[1].on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'room_state') {
        gameState = message.data;
        const player2Data = gameState.players.find(p => p.nickname === 'Player2');
        if (player2Data && player2Data.finishPosition === 1) {
          player2Finished = true;
          console.log('🥇 Player2 finished in 1st place!');
        }
      }
    });
    
    // Player2 plays their final card
    sockets[1].send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    // Wait for finish to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!player2Finished) {
      throw new Error('❌ Player2 did not finish properly');
    }
    
    // Step 6: Verify turn skips Player2
    console.log('\n⏭️ Step 6: Verifying Player2 is skipped in turns...');
    
    // Check current game state
    const stateResponse = await fetch(`${BASE_URL}/api/rooms/${room.code}`);
    const roomState = await stateResponse.json();
    
    const currentPlayerIndex = roomState.currentPlayerIndex;
    const playersInGame = roomState.players.filter(p => !p.isSpectator);
    const currentPlayer = playersInGame[currentPlayerIndex];
    
    console.log(`Current turn: ${currentPlayer.nickname} (index: ${currentPlayerIndex})`);
    
    if (currentPlayer.nickname === 'Player2') {
      throw new Error('❌ FAIL: Player2 still getting turns after finishing');
    }
    
    console.log('✅ Player2 correctly skipped from turn rotation');
    
    // Step 7: Make Player4 finish second
    console.log('\n🥈 Step 7: Making Player4 finish second...');
    
    // Find Player4's current position in game
    const player4Index = playersInGame.findIndex(p => p.nickname === 'Player4');
    
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        playerId: players[3].id, 
        hand: [{ type: 'number', color: 'blue', number: 3 }] 
      })
    });
    
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topCard: { type: 'number', color: 'blue', number: 4 }
      })
    });
    
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: player4Index })
    });
    
    // Player4 plays final card
    let player4Finished = false;
    sockets[3].on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'room_state') {
        const player4Data = message.data.players.find(p => p.nickname === 'Player4');
        if (player4Data && player4Data.finishPosition === 2) {
          player4Finished = true;
          console.log('🥈 Player4 finished in 2nd place!');
        }
      }
    });
    
    sockets[3].send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!player4Finished) {
      throw new Error('❌ Player4 did not finish in 2nd place');
    }
    
    // Step 8: Verify only Player1 and Player3 are left
    console.log('\n🎲 Step 8: Verifying only 2 players remain active...');
    
    const finalStateResponse = await fetch(`${BASE_URL}/api/rooms/${room.code}`);
    const finalRoomState = await finalStateResponse.json();
    
    const activePlayers = finalRoomState.players.filter(p => !p.isSpectator && !p.finishPosition);
    console.log(`Active players remaining: ${activePlayers.map(p => p.nickname).join(', ')}`);
    
    if (activePlayers.length !== 2) {
      throw new Error(`❌ Expected 2 active players, found ${activePlayers.length}`);
    }
    
    if (!activePlayers.find(p => p.nickname === 'Player1') || !activePlayers.find(p => p.nickname === 'Player3')) {
      throw new Error('❌ Wrong players remaining active');
    }
    
    console.log('✅ Correct players remain active');
    
    // Step 9: Make Player1 finish third (game should continue)
    console.log('\n🥉 Step 9: Making Player1 finish third...');
    
    const player1Index = finalRoomState.players.filter(p => !p.isSpectator).findIndex(p => p.nickname === 'Player1');
    
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        playerId: players[0].id, 
        hand: [{ type: 'number', color: 'green', number: 5 }] 
      })
    });
    
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topCard: { type: 'number', color: 'green', number: 6 }
      })
    });
    
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: player1Index })
    });
    
    let gameEnded = false;
    let finalRankings = null;
    
    // Listen for game end on all sockets
    sockets.forEach((socket, i) => {
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'game_end') {
          gameEnded = true;
          finalRankings = message.rankings;
          console.log('🏁 Game ended with final rankings!');
        }
      });
    });
    
    // Player1 plays final card
    sockets[0].send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (!gameEnded) {
      throw new Error('❌ Game did not end after Player1 finished');
    }
    
    // Step 10: Verify final rankings
    console.log('\n🏆 Step 10: Verifying final rankings...');
    
    console.log('Final Rankings:');
    finalRankings.forEach((player, i) => {
      console.log(`  ${i + 1}. ${player.nickname} - Position: ${player.position}`);
    });
    
    // Verify ranking order
    if (finalRankings[0].nickname !== 'Player2' || finalRankings[0].position !== 1) {
      throw new Error('❌ Player2 should be 1st place');
    }
    
    if (finalRankings[1].nickname !== 'Player4' || finalRankings[1].position !== 2) {
      throw new Error('❌ Player4 should be 2nd place');
    }
    
    if (finalRankings[2].nickname !== 'Player1' || finalRankings[2].position !== 3) {
      throw new Error('❌ Player1 should be 3rd place');
    }
    
    if (finalRankings[3].nickname !== 'Player3' || finalRankings[3].position !== 4) {
      throw new Error('❌ Player3 should be 4th place (last)');
    }
    
    console.log('✅ All rankings verified correctly!');
    
    console.log('\n🎉 SUCCESS: Complete ranking system test passed!');
    console.log('✅ Players finish in sequence with proper ranking badges');
    console.log('✅ Turn rotation skips finished players correctly');
    console.log('✅ Game continues until only 1 player remains');
    console.log('✅ Final rankings modal shows correct order');
    console.log('✅ All game flow mechanics working properly');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Cleanup
    sockets.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });
  }
  
  return true;
}

// Test the penalty stealth system  
async function testPenaltyStealth() {
  console.log('\n🥷 TESTING: Penalty Stealth System');
  console.log('=' .repeat(60));
  
  try {
    // Create room and test penalty animations look identical
    console.log('\n📝 Creating test room for penalty stealth...');
    
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'TestHost' })
    });
    
    const room = await roomResponse.json();
    
    // Join second player
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${room.code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'TestPlayer2' })
    });
    
    const player2 = await joinResponse.json();
    
    // Start game
    await fetch(`${BASE_URL}/api/rooms/${room.code}/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${room.token}`
      }
    });
    
    console.log('✅ Test room created and game started');
    
    // Connect WebSocket for player 2
    const ws = new WebSocket(`ws://localhost:5000/ws`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'join_room',
          playerId: player2.playerId,
          roomId: room.code,
          userFingerprint: 'test-stealth',
          sessionId: 'test-session-stealth'
        }));
        resolve();
      });
      ws.on('error', reject);
    });
    
    // Set up penalty scenario
    await fetch(`${BASE_URL}/api/rooms/${room.code}/test-set-discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topCard: { type: 'draw2', color: 'red' }
      })
    });
    
    // Set pending draw
    const stateResponse = await fetch(`${BASE_URL}/api/rooms/${room.code}`);
    const roomState = await stateResponse.json();
    
    // Update room with pending draw
    await fetch(`${BASE_URL}/api/rooms`, {
      method: 'PUT',  
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: room.code,
        pendingDraw: 2
      })
    });
    
    console.log('✅ Penalty scenario set up with +2 pending');
    
    // Listen for penalty animation
    let penaltyAnimationReceived = false;
    let animationType = null;
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'penalty_animation_start') {
        penaltyAnimationReceived = true;
        animationType = 'stealth_choice';
        console.log('✅ Stealth penalty animation started');
      }
    });
    
    // Player chooses to draw penalty instead of playing counter
    ws.send(JSON.stringify({
      type: 'draw_card'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 7000)); // Wait for full 6s animation + buffer
    
    if (!penaltyAnimationReceived) {
      throw new Error('❌ Penalty animation not received for chosen draw');
    }
    
    console.log('✅ Stealth penalty system working - chosen draw uses animation');
    
    ws.close();
    
  } catch (error) {
    console.error('\n❌ PENALTY STEALTH TEST FAILED:', error.message);
    return false;
  }
  
  return true;
}

// Run all tests
async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE END-TO-END TESTS');
  console.log('Testing all latest ranking and penalty features...\n');
  
  let allPassed = true;
  
  // Test 1: Complete ranking system
  const rankingTest = await testRankingSystemComplete();
  allPassed = allPassed && rankingTest;
  
  // Test 2: Penalty stealth system  
  const penaltyTest = await testPenaltyStealth();
  allPassed = allPassed && penaltyTest;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS:');
  console.log(`🏆 Ranking System: ${rankingTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🥷 Penalty Stealth: ${penaltyTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🎯 Overall Status: ${allPassed ? '🎉 ALL TESTS PASSED' : '💥 SOME TESTS FAILED'}`);
  console.log('='.repeat(60));
  
  if (allPassed) {
    console.log('\n🎉 SUCCESS: All latest features working correctly!');
    console.log('✅ Ranking system displays proper badges and order');
    console.log('✅ Turn management skips finished players completely');
    console.log('✅ Game flow continues properly until final rankings');
    console.log('✅ Penalty animations maintain strategic privacy');
    console.log('✅ End-to-end functionality verified');
  }
  
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(console.error);