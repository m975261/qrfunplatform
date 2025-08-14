#!/usr/bin/env node

/**
 * Complete test of the guru authentication flow
 * to understand why the password dialog didn't appear
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

console.log('🔧 COMPLETE GURU AUTHENTICATION FLOW TEST');
console.log('=' .repeat(60));

async function testCompleteFlow() {
  console.log('Testing the exact scenario:');
  console.log('1. User enters "unom975261" as nickname');
  console.log('2. System should detect guru user');
  console.log('3. System should show password dialog');
  console.log('4. But user went directly to room creation');
  
  console.log('\n🔍 STEP 1: Test guru user detection');
  try {
    const response = await fetch(`${BASE_URL}/api/guru-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'unom975261', password: 'check' })
    });
    
    console.log(`Response status: ${response.status}`);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.status === 200 && data.requiresPassword) {
      console.log('✅ Guru detection works - should trigger password dialog');
    } else {
      console.log('❌ Guru detection failed - explains why no dialog appeared');
    }
    
    console.log('\n🔍 STEP 2: Test what client checkGuruUser should return');
    const isGuruUser = (response.status === 200) && (data.requiresPassword || data.userExists);
    console.log(`checkGuruUser should return: ${isGuruUser}`);
    
    if (isGuruUser) {
      console.log('✅ This should have triggered the guru login dialog');
      console.log('📋 The dialog should appear with:');
      console.log('   - setShowHostPopup(false)');
      console.log('   - setShowGuruLogin(true)');
      console.log('   - setPendingAction("create")');
    } else {
      console.log('❌ This would have bypassed guru authentication');
      console.log('📋 Instead it would call:');
      console.log('   - createRoomMutation.mutate(popupNickname)');
    }
    
    console.log('\n🔍 STEP 3: Analyze what likely happened');
    console.log('From the user logs, we only see:');
    console.log('   "🔧 Checking if user is guru: unom975261"');
    console.log('But we don\'t see:');
    console.log('   "🔧 Guru check response: 200"');
    console.log('   "🔧 Guru check data: {...}"');
    console.log('   "🔧 Guru user found, needs password: {...}"');
    
    console.log('\n💡 LIKELY CAUSE:');
    console.log('The fetch request in the browser may have failed silently,');
    console.log('causing checkGuruUser to return false and skip guru auth.');
    
  } catch (error) {
    console.error('Error during test:', error.message);
    console.log('\n❌ NETWORK ERROR - This could be the issue!');
    console.log('If the client can\'t reach /api/guru-login, it would fail silently');
    console.log('and proceed with normal room creation.');
  }
}

testCompleteFlow();