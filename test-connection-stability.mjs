import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:5000';

async function testConnectionStability() {
  console.log('🔍 TESTING: Connection Stability During Real Game End');
  console.log('='.repeat(60));

  try {
    // Step 1: Create room with logging
    console.log('\n📝 Creating room...');
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'WinnerPlayer' })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    console.log(`✅ Room created: ${roomCode}`);
    
    // Step 2: Add second player
    console.log('\n👥 Adding second player...');
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'OpponentPlayer' })
    });
    
    const player2Data = await joinResponse.json();
    console.log('✅ Second player joined');
    
    const hostId = roomData.room?.hostId || roomData.hostId;
    const player2Id = player2Data.player?.id || player2Data.playerId;
    const hostToken = roomData.room?.token || roomData.token;
    
    // Step 3: Enhanced WebSocket setup with detailed monitoring
    console.log('\n🔌 Setting up monitored WebSocket connections...');
    
    let hostConnected = false;
    let player2Connected = false;
    let gameEndReceived = false;
    let hostDisconnectedDuringGameEnd = false;
    let player2DisconnectedDuringGameEnd = false;
    
    // Track all WebSocket events
    const hostWs = new WebSocket(`ws://localhost:5000/ws`);
    const player2Ws = new WebSocket(`ws://localhost:5000/ws`);
    
    // Host connection monitoring
    hostWs.on('open', () => {
      console.log('🟢 Host WebSocket connected');
      hostConnected = true;
      hostWs.send(JSON.stringify({
        type: 'join_room',
        playerId: hostId,
        roomId: roomCode,
        userFingerprint: 'test-host-stability',
        sessionId: 'test-host-session-stability'
      }));
    });
    
    hostWs.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'game_end') {
        console.log('🏆 Host received game_end message at:', new Date().toISOString());
        gameEndReceived = true;
        
        // Monitor connection immediately after game_end
        setTimeout(() => {
          if (hostWs.readyState !== WebSocket.OPEN) {
            console.log('❌ Host disconnected shortly after game_end');
            hostDisconnectedDuringGameEnd = true;
          } else {
            console.log('✅ Host connection stable after game_end');
          }
        }, 500);
      }
      
      if (message.type === 'room_state') {
        const room = message.data?.room;
        if (room?.status === 'finished') {
          console.log('🏁 Host received room status: finished');
        }
      }
    });
    
    hostWs.on('close', (code, reason) => {
      console.log(`🔴 Host WebSocket closed: code=${code}, reason=${reason?.toString()}`);
      hostConnected = false;
      if (gameEndReceived && !hostDisconnectedDuringGameEnd) {
        console.log('⚠️ Host disconnected after game end - timing noted');
      }
    });
    
    hostWs.on('error', (error) => {
      console.error('🔴 Host WebSocket error:', error);
    });
    
    // Player 2 connection monitoring
    player2Ws.on('open', () => {
      console.log('🟢 Player 2 WebSocket connected');
      player2Connected = true;
      player2Ws.send(JSON.stringify({
        type: 'join_room',
        playerId: player2Id,
        roomId: roomCode,
        userFingerprint: 'test-player2-stability',
        sessionId: 'test-player2-session-stability'
      }));
    });
    
    player2Ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'game_end') {
        console.log('🏆 Player 2 received game_end message at:', new Date().toISOString());
        
        setTimeout(() => {
          if (player2Ws.readyState !== WebSocket.OPEN) {
            console.log('❌ Player 2 disconnected shortly after game_end');
            player2DisconnectedDuringGameEnd = true;
          } else {
            console.log('✅ Player 2 connection stable after game_end');
          }
        }, 500);
      }
    });
    
    player2Ws.on('close', (code, reason) => {
      console.log(`🔴 Player 2 WebSocket closed: code=${code}, reason=${reason?.toString()}`);
      player2Connected = false;
    });
    
    player2Ws.on('error', (error) => {
      console.error('🔴 Player 2 WebSocket error:', error);
    });
    
    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (!hostConnected || !player2Connected) {
      console.log('❌ Failed to establish connections');
      return { success: false, error: 'Connection failed' };
    }
    
    // Step 4: Start game
    console.log('\n🎮 Starting game...');
    const startResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      }
    });
    
    if (!startResponse.ok) {
      console.log(`⚠️ Game start failed: ${startResponse.status}`);
      return { success: false, error: 'Game start failed' };
    }
    
    console.log('✅ Game started successfully');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 5: Set up winning scenario
    console.log('\n🎯 Setting up winning scenario...');
    
    // Give winner 1 card and opponent multiple cards
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: hostId,
        hand: [{ type: 'number', color: 'red', value: '5' }]
      })
    });
    
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/test-set-hand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: player2Id,
        hand: [
          { type: 'number', color: 'blue', value: '3' },
          { type: 'number', color: 'green', value: '7' },
          { type: 'number', color: 'yellow', value: '2' }
        ]
      })
    });
    
    // Set compatible discard pile
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/test-set-discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topCard: { type: 'number', color: 'red', value: '3' }
      })
    });
    
    // Make sure it's host's turn
    await fetch(`${BASE_URL}/api/rooms/${roomCode}/test-set-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlayerIndex: 0 })
    });
    
    console.log('✅ Winning scenario prepared');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 6: Monitor connections before final play
    console.log('\n📊 Pre-final-play connection status:');
    console.log(`Host connected: ${hostWs.readyState === WebSocket.OPEN}`);
    console.log(`Player 2 connected: ${player2Ws.readyState === WebSocket.OPEN}`);
    
    // Step 7: Play winning card through WebSocket (more realistic)
    console.log('\n🏆 Playing winning card via WebSocket...');
    
    if (hostWs.readyState === WebSocket.OPEN) {
      hostWs.send(JSON.stringify({
        type: 'play_card',
        cardIndex: 0
      }));
      console.log('✅ Winning card play sent via WebSocket');
    } else {
      console.log('❌ Host connection not available for card play');
      return { success: false, error: 'Host disconnected before final play' };
    }
    
    // Step 8: Monitor for up to 10 seconds
    console.log('\n⏱️ Monitoring connections and game end for 10 seconds...');
    
    let monitoringComplete = false;
    const startTime = Date.now();
    
    const monitoringInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= 10000) {
        clearInterval(monitoringInterval);
        monitoringComplete = true;
        console.log('⏱️ Monitoring period complete');
        return;
      }
      
      if (gameEndReceived && !monitoringComplete) {
        console.log(`⏱️ ${elapsed}ms: Game end received, monitoring connection stability...`);
      }
      
      const hostState = hostWs.readyState;
      const player2State = player2Ws.readyState;
      
      if ((hostState !== WebSocket.OPEN || player2State !== WebSocket.OPEN) && !monitoringComplete) {
        console.log(`⚠️ ${elapsed}ms: Connection issue detected - Host: ${hostState}, Player 2: ${player2State}`);
      }
    }, 1000);
    
    // Wait for monitoring to complete
    await new Promise(resolve => {
      const checkComplete = () => {
        if (monitoringComplete || Date.now() - startTime >= 11000) {
          resolve();
        } else {
          setTimeout(checkComplete, 500);
        }
      };
      checkComplete();
    });
    
    // Step 9: Final assessment
    const finalHostConnected = hostWs.readyState === WebSocket.OPEN;
    const finalPlayer2Connected = player2Ws.readyState === WebSocket.OPEN;
    
    console.log('\n📊 FINAL ASSESSMENT:');
    console.log(`🏆 Game end received: ${gameEndReceived}`);
    console.log(`🔌 Host connection: ${finalHostConnected ? 'STABLE' : 'LOST'}`);
    console.log(`🔌 Player 2 connection: ${finalPlayer2Connected ? 'STABLE' : 'LOST'}`);
    console.log(`⚠️ Host disconnected during game end: ${hostDisconnectedDuringGameEnd}`);
    console.log(`⚠️ Player 2 disconnected during game end: ${player2DisconnectedDuringGameEnd}`);
    
    // Clean up
    if (hostWs.readyState === WebSocket.OPEN) hostWs.close();
    if (player2Ws.readyState === WebSocket.OPEN) player2Ws.close();
    
    const success = gameEndReceived && finalHostConnected && finalPlayer2Connected && 
                   !hostDisconnectedDuringGameEnd && !player2DisconnectedDuringGameEnd;
    
    return {
      success,
      gameEndReceived,
      finalHostConnected,
      finalPlayer2Connected,
      hostDisconnectedDuringGameEnd,
      player2DisconnectedDuringGameEnd
    };
    
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTest() {
  console.log('🚀 RUNNING CONNECTION STABILITY TEST\n');
  
  const result = await testConnectionStability();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 CONNECTION STABILITY TEST RESULTS:');
  console.log('='.repeat(60));
  console.log(`🏆 Game End Received: ${result.gameEndReceived ? '✅ YES' : '❌ NO'}`);
  console.log(`🔌 Final Host Connection: ${result.finalHostConnected ? '✅ STABLE' : '❌ LOST'}`);
  console.log(`🔌 Final Player 2 Connection: ${result.finalPlayer2Connected ? '✅ STABLE' : '❌ LOST'}`);
  console.log(`⚠️ Host Disconnected During Game End: ${result.hostDisconnectedDuringGameEnd ? '❌ YES' : '✅ NO'}`);
  console.log(`⚠️ Player 2 Disconnected During Game End: ${result.player2DisconnectedDuringGameEnd ? '❌ YES' : '✅ NO'}`);
  console.log(`🎯 Overall Success: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (result.error) {
    console.log(`🐛 Error Details: ${result.error}`);
  }
  
  console.log('='.repeat(60));
  
  if (result.success) {
    console.log('\n🎉 Connection stability test PASSED! Players should stay connected during game end.');
  } else {
    console.log('\n🔧 Connection stability test FAILED. The disconnection issue is confirmed.');
    console.log('\nThis test helps identify exactly when and why players disconnect during game end.');
  }
  
  process.exit(result.success ? 0 : 1);
}

runTest().catch(console.error);