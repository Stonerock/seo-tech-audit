// Quick test to add PSI endpoint to existing server
const express = require('express');
const { PageSpeedInsights } = require('./services/pagespeed-insights');

// Test PSI integration endpoint
module.exports = (app) => {
  app.post('/api/test/psi', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }
    
    try {
      const psi = new PageSpeedInsights();
      const insights = await psi.getInsights(url, {
        categories: 'performance,seo,accessibility'
      });
      
      res.json({
        success: true,
        url,
        insights,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        url
      });
    }
  });
};