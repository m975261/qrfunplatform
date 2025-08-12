// Direct test of game end functionality
import { WebSocket } from 'ws';

console.log('🧪 Testing game end modal simulation...');

const WS_BASE = 'ws://localhost:5000/ws';

// Create a mock WebSocket client to test the game end flow
const testGameEnd = () => {
  console.log('🔌 Connecting to WebSocket...');
  
  const ws = new WebSocket(WS_BASE);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Simulate a game end message that would trigger the winner modal
    const gameEndMessage = {
      type: 'game_end',
      winner: 'Alice',
      rankings: [
        { nickname: 'Alice' },
        { nickname: 'Bob' },
        { nickname: 'Charlie' },
        { nickname: 'Diana' }
      ]
    };
    
    console.log('📤 Sending game_end message:', gameEndMessage);
    ws.send(JSON.stringify(gameEndMessage));
    
    setTimeout(() => {
      console.log('🏁 Test complete - check browser for winner modal');
      ws.close();
      process.exit(0);
    }, 2000);
  });
  
  ws.on('message', (data) => {
    console.log('📥 Received:', data.toString());
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    process.exit(1);
  });
};

testGameEnd();