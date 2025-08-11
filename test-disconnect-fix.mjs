import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:5000';

async function testDisconnectionFix() {
  console.log('🔧 TESTING: Player Disconnection Fix During Game End');
  console.log('='.repeat(60));

  try {
    // Step 1: Create room and test setup
    console.log('\n📝 Step 1: Setting up test room...');
    const roomResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'TestHost' })
    });
    
    const roomData = await roomResponse.json();
    const roomCode = roomData.room?.code || roomData.code;
    
    if (!roomCode) {
      throw new Error('Room creation failed');
    }
    
    console.log(`✅ Room created: ${roomCode}`);
    
    // Step 2: Add second player
    console.log('\n👥 Step 2: Adding second player...');
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'TestPlayer2' })
    });
    
    const player2Data = await joinResponse.json();
    console.log('✅ Second player joined');
    
    const hostId = roomData.room?.hostId || roomData.hostId;
    const player2Id = player2Data.player?.id || player2Data.playerId;
    
    // Step 3: Connect WebSockets with enhanced monitoring
    console.log('\n🔌 Step 3: Establishing WebSocket connections...');
    
    let hostConnected = false;
    let player2Connected = false;
    let gameEndReceived = false;
    let connectionStableAfterGameEnd = false;
    
    // Host WebSocket
    const hostWs = new WebSocket(`ws://localhost:5000/ws`);
    hostWs.on('open', () => {
      console.log('Host WebSocket connected');
      hostConnected = true;
      hostWs.send(JSON.stringify({
        type: 'join_room',
        playerId: hostId,
        roomId: roomCode,
        userFingerprint: 'test-host-disconnect',
        sessionId: 'test-host-session-disconnect'
      }));
    });
    
    hostWs.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'game_end') {
        console.log('🏆 Host received game_end message');
        gameEndReceived = true;
        
        // Check if connection is still stable after 2 seconds
        setTimeout(() => {
          if (hostWs.readyState === WebSocket.OPEN) {
            console.log('✅ Host connection stable after game_end');
            connectionStableAfterGameEnd = true;
          } else {
            console.log('❌ Host connection lost after game_end');
          }
        }, 2000);
      }
    });
    
    hostWs.on('close', (code, reason) => {
      console.log(`🔌 Host WebSocket closed: code=${code}, reason=${reason?.toString()}`);
      hostConnected = false;
    });
    
    hostWs.on('error', (error) => {
      console.error('🔌 Host WebSocket error:', error);
    });
    
    // Player 2 WebSocket  
    const player2Ws = new WebSocket(`ws://localhost:5000/ws`);
    player2Ws.on('open', () => {
      console.log('Player 2 WebSocket connected');
      player2Connected = true;
      player2Ws.send(JSON.stringify({
        type: 'join_room',
        playerId: player2Id,
        roomId: roomCode,
        userFingerprint: 'test-player2-disconnect',
        sessionId: 'test-player2-session-disconnect'
      }));
    });
    
    player2Ws.on('close', (code, reason) => {
      console.log(`🔌 Player 2 WebSocket closed: code=${code}, reason=${reason?.toString()}`);
      player2Connected = false;
    });
    
    player2Ws.on('error', (error) => {
      console.error('🔌 Player 2 WebSocket error:', error);
    });
    
    // Wait for connections to establish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!hostConnected || !player2Connected) {
      throw new Error('WebSocket connections failed to establish');
    }
    
    console.log('✅ Both WebSocket connections established');
    
    // Step 4: Start game
    console.log('\n🎮 Step 4: Starting game...');
    const hostToken = roomData.room?.token || roomData.token;
    
    try {
      const startResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hostToken}`
        }
      });
      
      if (startResponse.ok) {
        console.log('✅ Game started successfully');
      } else {
        console.log(`⚠️ Game start returned: ${startResponse.status}`);
      }
    } catch (error) {
      console.log('⚠️ Game start failed, continuing with connection test...');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 5: Simulate game end by playing winning card
    console.log('\n🏆 Step 5: Simulating winning game end...');
    
    // Use the test endpoint to simulate a winning card play
    try {
      const playCardResponse = await fetch(`${BASE_URL}/api/rooms/${roomCode}/test-play-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: hostId,
          cardIndex: 0
        })
      });
      
      const playResult = await playCardResponse.json();
      console.log('Card play result:', playResult);
      
      if (playResult.gameEnded) {
        console.log('✅ Game ended successfully via card play');
      }
    } catch (error) {
      console.log('⚠️ Test card play failed, sending direct game_end message...');
      
      // Fallback: Send game_end message directly
      const mockGameEnd = {
        type: 'game_end',
        winner: 'TestHost',
        rankings: [
          { nickname: 'TestHost', position: 1, hasLeft: false },
          { nickname: 'TestPlayer2', position: 2, hasLeft: false }
        ]
      };
      
      if (hostWs.readyState === WebSocket.OPEN) {
        hostWs.send(JSON.stringify(mockGameEnd));
      }
      if (player2Ws.readyState === WebSocket.OPEN) {
        player2Ws.send(JSON.stringify(mockGameEnd));
      }
      
      console.log('✅ Mock game_end message sent');
    }
    
    // Step 6: Monitor connection stability
    console.log('\n📊 Step 6: Monitoring connection stability...');
    
    // Wait for game end processing
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Check final connection status
    const hostStillConnected = hostWs.readyState === WebSocket.OPEN;
    const player2StillConnected = player2Ws.readyState === WebSocket.OPEN;
    
    console.log('\n📊 FINAL STATUS:');
    console.log(`🔌 Host connection: ${hostStillConnected ? 'STABLE' : 'DISCONNECTED'}`);
    console.log(`🔌 Player 2 connection: ${player2StillConnected ? 'STABLE' : 'DISCONNECTED'}`);
    console.log(`🏆 Game end received: ${gameEndReceived ? 'YES' : 'NO'}`);
    
    // Clean up
    if (hostWs.readyState === WebSocket.OPEN) hostWs.close();
    if (player2Ws.readyState === WebSocket.OPEN) player2Ws.close();
    
    // Return results
    return {
      success: hostStillConnected && player2StillConnected && gameEndReceived,
      hostStable: hostStillConnected,
      player2Stable: player2StillConnected,
      gameEndReceived: gameEndReceived
    };
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTest() {
  console.log('🚀 RUNNING DISCONNECT FIX TEST\n');
  
  const result = await testDisconnectionFix();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS:');
  console.log(`🔧 Disconnection Fix: ${result.success ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (result.success) {
    console.log('✅ Host connection remained stable during game end');
    console.log('✅ Player connection remained stable during game end'); 
    console.log('✅ Game end message received successfully');
    console.log('\n🎉 Players should now stay connected when playing final winning card!');
  } else {
    console.log('❌ Connection stability issues detected:');
    if (!result.hostStable) console.log('  • Host connection dropped');
    if (!result.player2Stable) console.log('  • Player 2 connection dropped');
    if (!result.gameEndReceived) console.log('  • Game end message not received');
    if (result.error) console.log(`  • Error: ${result.error}`);
  }
  
  console.log('='.repeat(60));
  
  process.exit(result.success ? 0 : 1);
}

runTest().catch(console.error);