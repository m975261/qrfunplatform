// Simple wild card test using existing game
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:5000/ws';

class SimpleWildTester {
  constructor() {
    this.ws = null;
    this.receivedColorRequest = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to monitor wild card messages');
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Parse error:', error);
        }
      };
      
      this.ws.onerror = reject;
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'choose_color_request':
        console.log('🎨 COLOR CHOICE REQUEST DETECTED!');
        console.log('📋 Message details:', JSON.stringify(message, null, 2));
        this.receivedColorRequest = true;
        
        // Auto-respond with red color
        setTimeout(() => {
          console.log('🎨 Auto-responding with RED color');
          this.ws.send(JSON.stringify({
            type: 'choose_color',
            color: 'red'
          }));
        }, 1000);
        break;
        
      case 'room_state':
        const room = message.room;
        if (room?.discardPile?.[0]) {
          const topCard = room.discardPile[0];
          if (topCard.type === 'wild' || topCard.type === 'wild4') {
            console.log(`🃏 WILD CARD ON TOP: ${topCard.type}`);
            console.log(`🎨 Current color: ${room.currentColor || 'not set'}`);
            console.log(`⏳ Waiting for color choice: ${room.waitingForColorChoice || 'none'}`);
          }
        }
        break;
        
      default:
        if (message.type !== 'heartbeat' && message.type !== 'error') {
          console.log(`📨 Received: ${message.type}`);
        }
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function monitorWildCards() {
  console.log('🧪 Monitoring for wild card color selection...');
  console.log('👆 Go to the game and play a wild card or +4 card');
  console.log('🔍 This monitor will detect and log the color selection flow');
  
  const monitor = new SimpleWildTester();
  
  try {
    await monitor.connect();
    
    // Monitor for 2 minutes
    console.log('⏰ Monitoring for 2 minutes...');
    await new Promise(resolve => setTimeout(resolve, 120000));
    
    if (monitor.receivedColorRequest) {
      console.log('✅ Color choice request was detected and processed!');
    } else {
      console.log('❌ No color choice request detected during monitoring period');
    }
    
  } catch (error) {
    console.error('❌ Monitor error:', error);
  } finally {
    monitor.close();
    console.log('🔚 Monitoring ended');
  }
}

monitorWildCards().catch(console.error);