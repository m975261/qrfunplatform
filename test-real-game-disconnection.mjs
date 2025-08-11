import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:5000';

// Real game simulation to test disconnection issue
async function simulateRealGame() {
  console.log('🎮 SIMULATING REAL GAME TO REPRODUCE DISCONNECTION');
  console.log('='.repeat(60));
  
  let roomCode, hostId, player2Id, hostToken;
  let hostWs, player2Ws;
  let testResults = {
    roomCreated: false,
    playersJoined: false,
    connectionsEstablished: false,
    gameStarted: false,
    gameEndReceived: false,
    connectionsStableAfterGameEnd: false,
    hostDisconnected: false,
    player2Disconnected: false,
    timing: {}
  };

  try {
    // Create room
    console.log('\n1️⃣ Creating room...');
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'TestHost' })
    });
    
    const roomData = await roomResponse.json();
    roomCode = roomData.room?.code || roomData.code;
    hostId = roomData.room?.hostId || roomData.hostId;  
    hostToken = roomData.room?.token || roomData.token;
    
    if (!roomCode) throw new Error('Room creation failed');
    testResults.roomCreated = true;
    console.log(`✅ Room created: ${roomCode}`);

    // Add second player
    console.log('\n2️⃣ Adding second player...');
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'TestPlayer2' })
    });
    
    const player2Data = await joinResponse.json();
    player2Id = player2Data.player?.id || player2Data.playerId;
    testResults.playersJoined = true;
    console.log('✅ Second player joined');

    // Setup WebSocket connections with detailed monitoring
    console.log('\n3️⃣ Setting up WebSocket connections...');
    
    let gameEndTimestamp = null;
    
    // Host WebSocket with comprehensive monitoring
    hostWs = new WebSocket(`ws://localhost:5000/ws`);
    
    hostWs.on('open', () => {
      console.log('🔌 Host WebSocket opened');
      // Join room via WebSocket using room code as ID
      hostWs.send(JSON.stringify({
        type: 'join_room',
        playerId: hostId,
        roomId: roomCode, // Use room code instead of room ID
        userFingerprint: 'test-host-real',
        sessionId: 'test-host-session-real'
      }));
    });
    
    hostWs.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'room_state') {
        console.log('🏠 Host received room state');
      }
      if (message.type === 'game_end') {
        gameEndTimestamp = Date.now();
        testResults.gameEndReceived = true;
        console.log('🏆 Host received game_end at:', new Date(gameEndTimestamp).toISOString());
        
        // Check connection stability after short delay
        setTimeout(() => {
          const isStillConnected = hostWs.readyState === WebSocket.OPEN;
          console.log(`🔍 Host connection after game_end: ${isStillConnected ? 'STABLE' : 'LOST'}`);
          if (!isStillConnected) {
            testResults.hostDisconnected = true;
          }
        }, 1000);
      }
    });
    
    hostWs.on('close', (code, reason) => {
      console.log(`🔴 Host WebSocket closed: ${code} - ${reason?.toString()}`);
      if (gameEndTimestamp && Date.now() - gameEndTimestamp < 5000) {
        console.log('⚠️ Host disconnected shortly after game_end!');
        testResults.hostDisconnected = true;
      }
    });
    
    hostWs.on('error', (error) => {
      console.error('🔴 Host WebSocket error:', error.message);
    });
    
    // Player 2 WebSocket
    player2Ws = new WebSocket(`ws://localhost:5000/ws`);
    
    player2Ws.on('open', () => {
      console.log('🔌 Player 2 WebSocket opened');
      // Join room via WebSocket using room code as ID
      player2Ws.send(JSON.stringify({
        type: 'join_room',
        playerId: player2Id,
        roomId: roomCode, // Use room code instead of room ID
        userFingerprint: 'test-player2-real',
        sessionId: 'test-player2-session-real'
      }));
    });
    
    player2Ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'room_state') {
        console.log('🏠 Player 2 received room state');
      }
      if (message.type === 'game_end') {
        console.log('🏆 Player 2 received game_end');
      }
    });
    
    player2Ws.on('close', (code, reason) => {
      console.log(`🔴 Player 2 WebSocket closed: ${code} - ${reason?.toString()}`);
      if (gameEndTimestamp && Date.now() - gameEndTimestamp < 5000) {
        console.log('⚠️ Player 2 disconnected shortly after game_end!');
        testResults.player2Disconnected = true;
      }
    });
    
    player2Ws.on('error', (error) => {
      console.error('🔴 Player 2 WebSocket error:', error.message);
    });

    // Wait for connections to establish
    console.log('⏳ Waiting for WebSocket connections...');
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    const hostConnected = hostWs.readyState === WebSocket.OPEN;
    const player2Connected = player2Ws.readyState === WebSocket.OPEN;
    
    if (!hostConnected || !player2Connected) {
      console.log(`❌ Connection failed - Host: ${hostConnected}, Player 2: ${player2Connected}`);
      return testResults;
    }
    
    testResults.connectionsEstablished = true;
    console.log('✅ Both WebSocket connections established');

    // Start game 
    console.log('\n4️⃣ Starting game...');
    const startResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`
      }
    });
    
    if (!startResponse.ok) {
      console.log(`⚠️ Game start failed: ${startResponse.status}`);
      const error = await startResponse.text();
      console.log('Start error:', error);
      
      // Try WebSocket start as alternative
      console.log('Trying WebSocket game start...');
      hostWs.send(JSON.stringify({ type: 'start_game' }));
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('✅ Game started successfully via API');
    }
    
    testResults.gameStarted = true;

    // Play multiple cards to simulate real game flow
    console.log('\n5️⃣ Playing cards to simulate game...');
    
    // Play a few normal cards first
    for (let i = 0; i < 2; i++) {
      console.log(`🎯 Playing card ${i + 1}...`);
      hostWs.send(JSON.stringify({
        type: 'play_card',
        cardIndex: 0
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Player 2's turn 
      player2Ws.send(JSON.stringify({
        type: 'play_card',
        cardIndex: 0
      }));
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Now simulate a winning scenario
    console.log('\n6️⃣ Setting up winning scenario...');
    
    // Reduce host to 1 card and play final card
    console.log('🏆 Playing final winning card...');
    hostWs.send(JSON.stringify({
      type: 'play_card',
      cardIndex: 0
    }));
    
    // Monitor for game end and disconnections
    console.log('\n7️⃣ Monitoring game end and connections...');
    
    // Wait up to 10 seconds for game end
    let monitoringTime = 0;
    const monitorInterval = setInterval(() => {
      monitoringTime += 500;
      
      if (testResults.gameEndReceived) {
        console.log(`✅ Game end detected at ${monitoringTime}ms`);
        clearInterval(monitorInterval);
      }
      
      if (monitoringTime >= 10000) {
        console.log('⏰ Monitoring timeout reached');
        clearInterval(monitorInterval);
      }
      
      // Check if connections are still alive
      const hostAlive = hostWs.readyState === WebSocket.OPEN;
      const player2Alive = player2Ws.readyState === WebSocket.OPEN;
      
      if (!hostAlive && !testResults.hostDisconnected) {
        console.log(`⚠️ Host disconnected at ${monitoringTime}ms`);
        testResults.hostDisconnected = true;
      }
      
      if (!player2Alive && !testResults.player2Disconnected) {
        console.log(`⚠️ Player 2 disconnected at ${monitoringTime}ms`);
        testResults.player2Disconnected = true;
      }
      
    }, 500);

    // Wait for monitoring to complete
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    // Final connection check
    const finalHostConnected = hostWs.readyState === WebSocket.OPEN;
    const finalPlayer2Connected = player2Ws.readyState === WebSocket.OPEN;
    
    testResults.connectionsStableAfterGameEnd = finalHostConnected && finalPlayer2Connected;
    
    console.log('\n📊 FINAL TEST STATUS:');
    console.log(`🏠 Room Created: ${testResults.roomCreated}`);
    console.log(`👥 Players Joined: ${testResults.playersJoined}`);
    console.log(`🔌 Connections Established: ${testResults.connectionsEstablished}`);
    console.log(`🎮 Game Started: ${testResults.gameStarted}`);
    console.log(`🏆 Game End Received: ${testResults.gameEndReceived}`);
    console.log(`📡 Final Host Connection: ${finalHostConnected}`);
    console.log(`📡 Final Player 2 Connection: ${finalPlayer2Connected}`);
    console.log(`✅ Connections Stable After Game End: ${testResults.connectionsStableAfterGameEnd}`);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    testResults.error = error.message;
  } finally {
    // Clean up connections
    if (hostWs && hostWs.readyState === WebSocket.OPEN) {
      hostWs.close();
    }
    if (player2Ws && player2Ws.readyState === WebSocket.OPEN) {
      player2Ws.close();
    }
  }
  
  return testResults;
}

async function runRealGameTest() {
  const results = await simulateRealGame();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔬 REAL GAME DISCONNECTION TEST RESULTS');
  console.log('='.repeat(60));
  
  const success = results.connectionsStableAfterGameEnd && 
                 !results.hostDisconnected && 
                 !results.player2Disconnected &&
                 results.gameEndReceived;
  
  console.log(`🎯 OVERALL RESULT: ${success ? '✅ CONNECTIONS STABLE' : '❌ DISCONNECTION CONFIRMED'}`);
  
  if (!success) {
    console.log('\n🐛 ISSUES IDENTIFIED:');
    if (results.hostDisconnected) console.log('  • Host disconnected during/after game end');
    if (results.player2Disconnected) console.log('  • Player 2 disconnected during/after game end');  
    if (!results.gameEndReceived) console.log('  • Game end message not received');
    if (!results.connectionsStableAfterGameEnd) console.log('  • Connections not stable after game end');
  }
  
  console.log('='.repeat(60));
  
  process.exit(success ? 0 : 1);
}

runRealGameTest().catch(console.error);