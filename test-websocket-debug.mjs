#!/usr/bin/env node

/**
 * Debug both issues:
 * 1. Guru authentication not working for unom975261
 * 2. WebSocket localhost:undefined error
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

console.log('🔧 DEBUGGING BOTH ISSUES');
console.log('=' .repeat(50));

async function debugIssues() {
  // Test guru authentication with different variations
  console.log('1. Testing Guru Authentication Variations:');
  
  const testUsers = ['unom975261', 'unom975261 ', ' unom975261', ' unom975261 '];
  
  for (const user of testUsers) {
    try {
      const response = await fetch(`${BASE_URL}/api/guru-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: user, password: 'check' })
      });
      
      const data = await response.json();
      console.log(`  "${user}" (length: ${user.length}) -> ${response.status}:`, data.error);
      
      if (response.status === 200) {
        console.log('  ✅ FOUND! This variation works for guru auth');
        break;
      }
    } catch (error) {
      console.log(`  "${user}" -> ERROR:`, error.message);
    }
  }
  
  console.log('\n2. WebSocket URL Construction Debug:');
  console.log('The WebSocket error shows localhost:undefined is being constructed.');
  console.log('This suggests the WebSocket is being created in a context where:');
  console.log('- window.location.host is undefined');
  console.log('- Or there\'s another WebSocket creation point we haven\'t fixed');
  console.log('- The error occurs at client:536 which might be compiled JavaScript');
  
  console.log('\n3. Recommended Actions:');
  console.log('✅ Fixed guru auth trimming');
  console.log('✅ Enhanced WebSocket host validation');
  console.log('📋 Need to test both fixes in browser');
}

debugIssues();