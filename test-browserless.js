#!/usr/bin/env node

/**
 * Simple test script to verify Browserless.io integration
 */

import dotenv from 'dotenv';
dotenv.config();

import JavaScriptRenderer from './services/js-renderer.js';

async function testBrowserless() {
    console.log('Testing Browserless.io integration...');
    
    const renderer = new JavaScriptRenderer();
    
    // Test health check
    try {
        const health = await renderer.healthCheck();
        console.log('Health check result:', health);
        
        if (health.mode === 'browserless' && health.hasToken) {
            console.log('✅ Browserless.io is properly configured');
            
            // Test rendering a simple page
            try {
                console.log('Testing page rendering...');
                const result = await renderer.renderPage('https://example.com');
                console.log('✅ Page rendering successful');
                console.log('Rendered URL:', result.url);
                console.log('Status:', result.status);
                console.log('JS Metrics available:', !!result.jsMetrics);
            } catch (renderError) {
                console.log('❌ Page rendering failed:', renderError.message);
            }
        } else if (health.mode === 'playwright') {
            console.log('ℹ️  Using local Playwright (Browserless not configured)');
        } else {
            console.log('❌ Browserless integration not working properly');
        }
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
    }
    
    // Cleanup
    if (renderer.close) {
        await renderer.close();
    }
}

// Run the test
testBrowserless().catch(console.error);