// Quick PSI test to verify integration
const fetch = require('node-fetch');

async function testPSI(url) {
  const apiKey = 'AIzaSyAV-We_Yo6MQceYPsiGDNMSJaXJv3UTAHg';
  const params = new URLSearchParams({
    url,
    strategy: 'mobile'
  });
  
  // Add multiple categories properly  
  const categories = 'performance,seo,accessibility'.split(',');
  categories.forEach(category => {
    params.append('category', category.trim());
  });
  params.append('key', apiKey);
  
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`PSI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      url: data.id,
      performance: {
        score: Math.round((data.lighthouseResult.categories?.performance?.score || 0) * 100),
        coreWebVitals: {
          lcp: {
            value: data.lighthouseResult.audits?.['largest-contentful-paint']?.displayValue || 'N/A'
          },
          cls: {
            value: data.lighthouseResult.audits?.['cumulative-layout-shift']?.displayValue || 'N/A'
          },
          fcp: {
            value: data.lighthouseResult.audits?.['first-contentful-paint']?.displayValue || 'N/A'
          }
        }
      },
      seo: {
        score: Math.round((data.lighthouseResult.categories?.seo?.score || 0) * 100)
      }
    };
    
  } catch (error) {
    console.error('PSI Test Error:', error.message);
    return { error: error.message };
  }
}

// Test with example.com
testPSI('https://example.com').then(result => {
  console.log('🎯 PSI Integration Test Results:');
  console.log(JSON.stringify(result, null, 2));
});

module.exports = testPSI;