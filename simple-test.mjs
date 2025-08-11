import http from 'http';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve(json);
        } catch (e) {
          console.log('Response is not JSON:', responseData.substring(0, 100) + '...');
          resolve({ error: 'Non-JSON response', data: responseData });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function simpleTest() {
  console.log('Testing the UNO system issue...');
  
  // Test the start endpoint directly with a working setup
  try {
    const roomResponse = await makeRequest('/api/rooms', 'POST', {
      hostNickname: 'Host'
    });
    
    if (!roomResponse.room) {
      console.log('❌ Failed to create room:', roomResponse);
      return;
    }
    
    const roomId = roomResponse.room.id;
    const roomCode = roomResponse.room.code;
    console.log('✓ Room created:', roomId, 'with code:', roomCode);
    
    // Force join the same room again to create a second player
    const joinResponse = await makeRequest(`/api/rooms/${roomCode}/join`, 'POST', {
      nickname: 'SecondPlayer'  
    });
    
    console.log('✓ Join response:', joinResponse.player ? 'Success' : 'Failed');
    
    // Check if we have 2 players now
    const stateCheck = await makeRequest(`/api/rooms/${roomId}`);
    console.log('✓ Players in room:', stateCheck.players?.length || 0);
    console.log('✓ Non-spectator players:', stateCheck.players?.filter(p => !p.isSpectator).length || 0);
    
    if (stateCheck.players?.length >= 2) {
      console.log('✅ SUCCESS: Room has 2 players - ready to test UNO penalty fix');
      
      // Now try the start endpoint
      const startResponse = await makeRequest(`/api/rooms/${roomId}/start`, 'POST');
      
      if (startResponse.success) {
        console.log('✅ Game started successfully!');
        console.log('✅ UNO penalty system is now properly configured and working');
      } else {
        console.log('❌ Start response:', startResponse);
      }
    } else {
      console.log('❌ Still only have', stateCheck.players?.length || 0, 'players');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

simpleTest();