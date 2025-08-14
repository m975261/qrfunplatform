#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

console.log('🔧 Testing Guru Authentication');

async function testGuruAuth() {
  // Test with known guru user
  console.log('\n1. Testing with known guru user: unom975261');
  try {
    const response = await fetch(`${BASE_URL}/api/guru-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'unom975261', password: 'check' })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test with non-guru user
  console.log('\n2. Testing with non-guru user: regular_player');
  try {
    const response = await fetch(`${BASE_URL}/api/guru-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'regular_player', password: 'check' })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGuruAuth();