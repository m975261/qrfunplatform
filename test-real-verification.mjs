// Real verification test - actually load the page and check functionality
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:5000';

console.log('🔍 REAL VERIFICATION TEST - Actually loading and testing the page');

async function realVerificationTest() {
  let browser;
  
  try {
    // First create a test room with proper setup
    const createResponse = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname: 'TestHost', gameType: 'uno' })
    });
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create room: ${createResponse.status}`);
    }
    
    const roomData = await createResponse.json();
    console.log('✅ Test room created:', roomData.room.code);
    
    // Add second player
    const joinResponse = await fetch(`${BASE_URL}/api/rooms/${roomData.room.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nickname: 'Player2', 
        playerId: `player2-${Date.now()}`
      })
    });
    
    if (!joinResponse.ok) {
      throw new Error(`Failed to add second player: ${joinResponse.status}`);
    }
    
    console.log('✅ Second player added');
    
    // Start the game
    const startResponse = await fetch(`${BASE_URL}/api/rooms/${roomData.room.id}/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${roomData.playerId}`
      }
    });
    
    if (!startResponse.ok) {
      throw new Error(`Failed to start game: ${startResponse.status}`);
    }
    
    console.log('✅ Game started');
    
    // Now load the actual page with Puppeteer
    console.log('\n🌐 Loading actual game page...');
    
    browser = await puppeteer.launch({ 
      headless: false,  // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log(`PAGE LOG: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`PAGE ERROR: ${error.message}`);
    });
    
    // Navigate to the game page
    const gameUrl = `${BASE_URL}/game/${roomData.room.id}`;
    console.log(`🔗 Loading: ${gameUrl}`);
    
    await page.goto(gameUrl, { waitUntil: 'networkidle2' });
    
    // Wait for page to load completely
    await page.waitForTimeout(3000);
    
    console.log('\n🔍 TESTING AVATAR POSITIONING...');
    
    // Check if avatars are positioned correctly
    const avatarPositions = await page.evaluate(() => {
      const avatars = document.querySelectorAll('[class*="col-start"]');
      const positions = [];
      
      avatars.forEach((avatar, index) => {
        const classes = avatar.className;
        if (classes.includes('col-start')) {
          positions.push({
            index,
            classes: classes,
            position: avatar.getBoundingClientRect()
          });
        }
      });
      
      return positions;
    });
    
    console.log('Avatar positions found:', avatarPositions.length);
    avatarPositions.forEach((pos, i) => {
      console.log(`Position ${i}: ${pos.classes}`);
    });
    
    console.log('\n🔍 TESTING R BUTTON FUNCTIONALITY...');
    
    // Try to find and test R button
    const rButtonTest = await page.evaluate(() => {
      const rButtons = document.querySelectorAll('.guru-replace-button');
      return {
        found: rButtons.length,
        classes: rButtons.length > 0 ? rButtons[0].className : 'none',
        clickable: rButtons.length > 0 ? rButtons[0].onclick !== null : false
      };
    });
    
    console.log('R Button analysis:', rButtonTest);
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'game-verification.png', fullPage: true });
    console.log('📸 Screenshot saved as game-verification.png');
    
    return {
      success: true,
      roomCode: roomData.room.code,
      gameUrl,
      avatarPositions,
      rButtonTest
    };
    
  } catch (error) {
    console.error('❌ Real verification failed:', error);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

realVerificationTest();