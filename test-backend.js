#!/usr/bin/env node

/**
 * Simple backend test script
 * This script tests the basic functionality of the SEO audit backend
 */

import http from 'http';

// Test the health endpoint
const healthCheck = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Health check passed');
          resolve(true);
        } else {
          console.log(`❌ Health check failed with status ${res.statusCode}`);
          reject(new Error(`Status: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Health check failed with error:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.log('❌ Health check timed out');
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
};

// Run the test
console.log('🧪 Testing backend health...');
healthCheck()
  .then(() => {
    console.log('🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('💥 Tests failed:', error.message);
    process.exit(1);
  });