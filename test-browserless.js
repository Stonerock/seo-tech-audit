#!/usr/bin/env node
// test-browserless.js
// Direct Browserless.io validation script for debugging

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function testBrowserless() {
    const token = process.env.BROWSERLESS_TOKEN;
    const baseUrl = process.env.BROWSERLESS_URL || 'https://production-sfo.browserless.io';
    
    console.log('🔍 Browserless.io Direct Validation Test');
    console.log('==========================================');
    console.log('Base URL:', baseUrl);
    console.log('Token present:', !!token);
    console.log('Token length:', token ? token.length : 0);
    console.log('Token preview:', token ? `${token.slice(0, 8)}...${token.slice(-4)}` : 'none');
    console.log('');

    if (!token) {
        console.error('❌ No BROWSERLESS_TOKEN found in environment');
        console.log('Set it with: export BROWSERLESS_TOKEN=your_token_here');
        process.exit(1);
    }

    // Test 1: Function endpoint (what our app uses)
    console.log('📋 Test 1: Function Endpoint');
    console.log('----------------------------');
    
    const functionScript = `
        async ({ page }) => {
            await page.goto('data:text/html,<h1>Test</h1>');
            return {
                success: true,
                url: page.url(),
                title: await page.title(),
                userAgent: await page.evaluate(() => navigator.userAgent)
            };
        }
    `;

    try {
        const functionResponse = await fetch(`${baseUrl}/function?token=${token}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: functionScript }),
            timeout: 30000
        });

        console.log('Status:', functionResponse.status, functionResponse.statusText);
        console.log('Headers:', Object.fromEntries(functionResponse.headers.entries()));

        if (functionResponse.ok) {
            const result = await functionResponse.json();
            console.log('✅ Function test successful!');
            console.log('Result:', JSON.stringify(result, null, 2));
        } else {
            const errorText = await functionResponse.text();
            console.log('❌ Function test failed');
            console.log('Error response:', errorText);
        }
    } catch (error) {
        console.log('❌ Function test error:', error.message);
    }

    console.log('');

    // Test 2: Stats endpoint (simpler check)
    console.log('📋 Test 2: Stats Endpoint');
    console.log('-------------------------');
    
    try {
        const statsResponse = await fetch(`${baseUrl}/stats?token=${token}`, {
            timeout: 10000
        });

        console.log('Status:', statsResponse.status, statsResponse.statusText);
        
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            console.log('✅ Stats test successful!');
            console.log('Stats:', JSON.stringify(stats, null, 2));
        } else {
            const errorText = await statsResponse.text();
            console.log('❌ Stats test failed');
            console.log('Error response:', errorText);
        }
    } catch (error) {
        console.log('❌ Stats test error:', error.message);
    }

    console.log('');

    // Test 3: Performance endpoint (Lighthouse test)
    console.log('📋 Test 3: Performance Endpoint');
    console.log('-------------------------------');
    
    try {
        const performanceResponse = await fetch(`${baseUrl}/performance?token=${token}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: 'data:text/html,<h1>Performance Test</h1>',
                options: {
                    onlyCategories: ['performance'],
                    formFactor: 'desktop'
                }
            }),
            timeout: 60000
        });

        console.log('Status:', performanceResponse.status, performanceResponse.statusText);
        
        if (performanceResponse.ok) {
            const lighthouse = await performanceResponse.json();
            console.log('✅ Performance test successful!');
            console.log('Lighthouse score:', lighthouse.lhr?.categories?.performance?.score * 100);
        } else {
            const errorText = await performanceResponse.text();
            console.log('❌ Performance test failed');
            console.log('Error response:', errorText);
        }
    } catch (error) {
        console.log('❌ Performance test error:', error.message);
    }

    console.log('');

    // Test 4: Via our JavaScript renderer
    console.log('📋 Test 4: Via JavaScript Renderer');
    console.log('----------------------------------');
    
    try {
        const { default: JavaScriptRenderer } = await import('./services/js-renderer.js');
        const renderer = new JavaScriptRenderer();
        
        const health = await renderer.healthCheck();
        console.log('Renderer health:', JSON.stringify(health, null, 2));
        
        if (health.status === 'healthy') {
            console.log('✅ JavaScript renderer integration working!');
        } else {
            console.log('❌ JavaScript renderer integration issues');
        }
        
        await renderer.close();
    } catch (error) {
        console.log('❌ JavaScript renderer test error:', error.message);
    }

    console.log('');
    console.log('🏁 Testing complete!');
    console.log('');
    console.log('💡 Troubleshooting Tips:');
    console.log('- 401: Invalid token - check your Browserless dashboard');
    console.log('- 403: Valid token but quota exceeded or plan limitations');
    console.log('- 429: Rate limited - wait a few minutes and try again');
    console.log('- Timeout: Network issues or Browserless service overload');
    console.log('- Check your plan usage at: https://cloud.browserless.io/');
}

// Check if running as script
if (import.meta.url === `file://${process.argv[1]}`) {
    testBrowserless().catch(console.error);
}

export { testBrowserless };