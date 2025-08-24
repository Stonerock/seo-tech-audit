// tests/teardown.js
// Global Jest teardown for final cleanup

module.exports = async () => {
  console.log('🧹 Running global test teardown...');
  
  try {
    // Try to shutdown the global audit queue if it exists
    const { shutdownGlobalQueue } = require('../services/audit-queue');
    await shutdownGlobalQueue();
    console.log('✅ Global audit queue shut down');
  } catch (error) {
    // Queue might be mocked or not initialized, ignore error
    console.log('ℹ️ No global audit queue to shut down (likely mocked)');
  }
  
  // Clear any remaining timers or intervals
  // This is a safety net for any timers that might still be running
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  
  // Force clear any remaining intervals (last resort)
  for (let i = 1; i < 10000; i++) {
    try {
      clearInterval(i);
      clearTimeout(i);
    } catch (e) {
      // Ignore errors for non-existent timers
    }
  }
  
  console.log('✅ Global teardown completed');
};