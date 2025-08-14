import puppeteer from 'puppeteer';

console.log('🧪 Testing Avatar Positioning and R Button Fix...');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    // Go to the main page
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle0' });
    console.log('📱 Navigated to homepage');
    
    // Create a room
    await page.click('button:has-text("Create Room")');
    await page.waitForSelector('input[placeholder*="nickname"]', { timeout: 5000 });
    await page.fill('input[placeholder*="nickname"]', 'TestPlayer');
    await page.click('button:has-text("Create")');
    
    // Wait for room creation
    await page.waitForURL('**/room/**', { timeout: 10000 });
    console.log('🏠 Room created successfully');
    
    // Add guru user credentials to localStorage for testing R button
    await page.evaluate(() => {
      localStorage.setItem('isGuruUser', 'true');
      localStorage.setItem('guruUsername', 'unom975261');
    });
    
    // Start game
    await page.click('button:has-text("Start Game")');
    await page.waitForURL('**/game/**', { timeout: 10000 });
    console.log('🎮 Game started');
    
    // Test 1: Check avatar positioning
    console.log('🎯 Testing avatar positioning...');
    
    const avatars = await page.$$('[style*="translateX(-50%)"], [style*="translateY(-50%)"]');
    console.log(`Found ${avatars.length} positioned avatars`);
    
    if (avatars.length > 0) {
      // Check if avatars are positioned around the circle (not stacked)
      const avatarPositions = await page.evaluate(() => {
        const avatarElements = document.querySelectorAll('[style*="translateX(-50%)"], [style*="translateY(-50%)"]');
        return Array.from(avatarElements).map(el => {
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });
      });
      
      // Check if avatars are spread around (different Y positions)
      const uniqueYPositions = [...new Set(avatarPositions.map(pos => Math.round(pos.y / 10) * 10))];
      
      if (uniqueYPositions.length > 1) {
        console.log('✅ AVATAR POSITIONING: FIXED - Avatars are positioned around circle');
      } else {
        console.log('❌ AVATAR POSITIONING: STILL BROKEN - Avatars are stacked vertically');
      }
    } else {
      console.log('⚠️ No positioned avatars found');
    }
    
    // Test 2: Check R button functionality
    console.log('🔧 Testing R button...');
    
    const rButtons = await page.$$('button:has-text("R")');
    console.log(`Found ${rButtons.length} R buttons`);
    
    if (rButtons.length > 0) {
      // Test clicking R button
      const initialUrl = page.url();
      
      // Click the first R button
      await rButtons[0].click();
      
      // Wait a moment to see if URL changes (indicating page navigation)
      await page.waitForTimeout(1000);
      
      const currentUrl = page.url();
      
      if (currentUrl === initialUrl) {
        // Check if guru modal opened
        const modal = await page.$('[role="dialog"]');
        if (modal) {
          console.log('✅ R BUTTON: FIXED - Opens modal without page navigation');
        } else {
          console.log('⚠️ R BUTTON: Partial fix - No page navigation but modal not visible');
        }
      } else {
        console.log('❌ R BUTTON: STILL BROKEN - Still causes page navigation');
      }
    } else {
      console.log('⚠️ No R buttons found (may need guru authentication)');
    }
    
    console.log('🏁 Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();