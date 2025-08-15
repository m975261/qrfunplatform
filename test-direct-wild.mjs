// Direct test to add wild cards to player hands for testing
import fetch from 'node-fetch';

async function addWildCardsToPlayer() {
  try {
    console.log('🎯 Adding wild cards to current room for testing...');
    
    // First, get all active rooms
    const roomsResponse = await fetch('http://localhost:5000/api/debug/rooms');
    const roomsData = await roomsResponse.json();
    
    console.log('📋 Active rooms:', roomsData.rooms?.length || 0);
    
    if (roomsData.rooms && roomsData.rooms.length > 0) {
      const activeRoom = roomsData.rooms.find(room => room.status === 'playing');
      if (activeRoom) {
        console.log(`🎮 Found active room: ${activeRoom.code}`);
        
        // Get players in the room
        const playersResponse = await fetch(`http://localhost:5000/api/debug/room/${activeRoom.id}/players`);
        const playersData = await playersResponse.json();
        
        console.log('👥 Players in room:', playersData.players?.length || 0);
        
        if (playersData.players && playersData.players.length > 0) {
          const firstPlayer = playersData.players[0];
          console.log(`🎯 Adding wild cards to player: ${firstPlayer.nickname}`);
          
          // Add wild cards to player hand
          const wildCards = [
            { type: "wild", color: null, value: "wild" },
            { type: "wild4", color: null, value: "wild4" },
            { type: "wild", color: null, value: "wild" }
          ];
          
          const updateResponse = await fetch(`http://localhost:5000/api/debug/player/${firstPlayer.id}/add-cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cards: wildCards })
          });
          
          if (updateResponse.ok) {
            console.log('✅ Wild cards added successfully!');
            console.log('🎮 Now try playing a wild card from the game interface');
          } else {
            console.log('❌ Failed to add wild cards');
          }
        }
      } else {
        console.log('❌ No active playing rooms found');
      }
    } else {
      console.log('❌ No rooms found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addWildCardsToPlayer();