// server.js - SEO Audit Backend Server
// Enterprise-grade modular architecture

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import enterprise services and utilities
const { logger, requestLogger, errorLogger } = require('./utils/logger');
const { getGlobalMonitor, initializeDefaultCleanupTasks } = require('./services/memory-monitor');
const { getGlobalQueue } = require('./services/audit-queue');

// Import modular routes
const auditRoutes = require('./routes/audit');
const sitemapRoutes = require('./routes/sitemap');
const llmsRoutes = require('./routes/llms');

// Initialize Express app
const app = express();
// Use Cloud Run's PORT environment variable or default based on environment
const PORT = process.env.PORT ? Number(process.env.PORT) : (process.env.NODE_ENV === 'production' ? 8080 : 3001);

// Initialize enterprise services
const memoryMonitor = getGlobalMonitor({
  monitorInterval: 30000,
  cleanupInterval: 300000
});
const auditQueue = getGlobalQueue({
  maxConcurrent: 3,
  jobTimeout: 60000
});

// Set up memory monitoring with cleanup tasks
initializeDefaultCleanupTasks(memoryMonitor);
memoryMonitor.startMonitoring();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger({ skipPaths: ['/health', '/api/health'] }));

// Serve static frontend
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.use('/api', auditRoutes);
app.use('/api', sitemapRoutes);
app.use('/api', llmsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const memoryStats = memoryMonitor.getMemoryStats();
  const queueStatus = auditQueue.getStatus();
  
  res.json({
    status: 'ok',
    service: 'SEO Audit Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    memory: {
      usage: memoryStats.current.usagePercent,
      heap: `${memoryStats.current.heapUsed}MB / ${memoryStats.current.maxHeap}MB`,
      monitoring: memoryStats.monitoring.isActive
    },
    queue: {
      pending: queueStatus.queue.pending,
      processing: queueStatus.queue.processing,
      available: queueStatus.capacity.availableSlots
    },
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use(errorLogger);
app.use((err, req, res, next) => {
  logger.error('Unhandled application error', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Shutdown services
      await auditQueue.shutdown();
      await memoryMonitor.shutdown();
      
      logger.info('All services shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Start server
const server = app.listen(PORT, () => {
  // ASCII art banner
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       SEO Audit Backend Server         ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Status: ✅ Running                    ║`);
  console.log(`║  Port: ${PORT}                            ║`);
  console.log(`║  URL: http://localhost:${PORT}            ║`);
  console.log('╠════════════════════════════════════════╣');
  console.log('║  Endpoints:                            ║');
  console.log('║  POST /api/audit     - Run audit       ║');
  console.log('║  GET  /api/health    - Health check    ║');
  console.log('║  POST /api/cache/clear - Clear cache   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n👉 Next: Open index.html in your browser\n  ');
  
  logger.logStartup();
});

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error', error);
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
  }
});
