import WebSocket from 'ws';
import fetch from 'node-fetch';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('🎯 REAL UI WILD CARD TEST');
console.log('==================================================');

async function testRealUIWild() {
  // Use the actual room from the logs: 0d0a8c79-76ac-4f64-8fde-9c428f2abddc
  // And the actual player ID: 10c9b012-ee65-4850-afcc-30313a22dc07
  
  const ws = new WebSocket('ws://localhost:5000/ws');
  
  ws.on('open', () => {
    console.log('✅ Connected to WebSocket');
    
    // Send the exact same message the server would send to the UI
    const colorChoiceMessage = {
      type: 'choose_color_request',
      message: 'Choose a color for the wild card',
      cardType: 'wild4',
      playerId: '10c9b012-ee65-4850-afcc-30313a22dc07'
    };
    
    console.log('🎨 Sending color choice request message...');
    console.log('📋 Message:', JSON.stringify(colorChoiceMessage, null, 2));
    
    // This simulates what the server sends to the browser
    ws.send(JSON.stringify(colorChoiceMessage));
    
    setTimeout(() => {
      ws.close();
      console.log('🔚 Test completed');
      process.exit(0);
    }, 2000);
  });

  ws.on('message', (data) => {
    console.log('📨 Received message:', data.toString());
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
}

testRealUIWild();