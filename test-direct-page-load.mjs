// Direct page load test - check what's actually happening
import puppeteer from 'puppeteer';

console.log('🔍 DIRECT PAGE INSPECTION - Loading game page to verify issues');

async function directPageTest() {
  let browser;
  
  try {
    browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      devtools: true
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`PAGE: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.log(`ERROR: ${error.message}`);
    });
    
    // Navigate to a room (we'll use an existing one or create one)
    console.log('🌐 Loading game lobby first...');
    await page.goto('http://localhost:5000/', { waitUntil: 'networkidle2' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    console.log('\n🔍 ANALYZING CURRENT PAGE STRUCTURE...');
    
    // Check if we can find avatar positioning elements
    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        avatarElements: [],
        gridElements: [],
        rButtons: [],
        pageTitle: document.title,
        url: window.location.href
      };
      
      // Look for avatar-related elements
      const avatars = document.querySelectorAll('[class*="col-start"]');
      avatars.forEach((el, i) => {
        analysis.avatarElements.push({
          index: i,
          className: el.className,
          tagName: el.tagName,
          boundingRect: el.getBoundingClientRect()
        });
      });
      
      // Look for grid elements
      const gridEls = document.querySelectorAll('[class*="grid"]');
      gridEls.forEach((el, i) => {
        analysis.gridElements.push({
          index: i,
          className: el.className,
          tagName: el.tagName
        });
      });
      
      // Look for R buttons
      const rButtons = document.querySelectorAll('.guru-replace-button, [title*="Replace"], [title*="Guru"]');
      rButtons.forEach((el, i) => {
        analysis.rButtons.push({
          index: i,
          className: el.className,
          tagName: el.tagName,
          onclick: el.onclick ? 'has-onclick' : 'no-onclick'
        });
      });
      
      return analysis;
    });
    
    console.log('PAGE ANALYSIS:', JSON.stringify(pageAnalysis, null, 2));
    
    // Try to create a room and navigate to it
    console.log('\n🎮 Creating test room via browser...');
    
    // Look for create room functionality
    const roomCreation = await page.evaluate(() => {
      // Try to find create room button or input
      const createButton = document.querySelector('button[type="submit"], button:contains("Create"), input[type="submit"]');
      const roomInput = document.querySelector('input[placeholder*="nickname"], input[placeholder*="name"]');
      
      return {
        hasCreateButton: !!createButton,
        hasRoomInput: !!roomInput,
        buttonText: createButton ? createButton.textContent : 'none',
        inputPlaceholder: roomInput ? roomInput.placeholder : 'none'
      };
    });
    
    console.log('Room creation elements:', roomCreation);
    
    // Take screenshot for visual inspection
    await page.screenshot({ path: 'current-page-state.png', fullPage: true });
    console.log('📸 Screenshot saved as current-page-state.png');
    
    return {
      success: true,
      analysis: pageAnalysis,
      roomCreation
    };
    
  } catch (error) {
    console.error('❌ Direct page test failed:', error);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      // Keep browser open for manual inspection
      console.log('🔍 Browser left open for manual inspection...');
      // await browser.close();
    }
  }
}

directPageTest();