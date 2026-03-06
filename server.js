/**
 * Nepal Election Results Platform — Custom Server
 * 
 * Wraps Next.js with a custom HTTP server that also:
 * - Initializes the data store
 * - Starts the scraping scheduler
 * - Handles graceful shutdown
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { startScheduler, stopScheduler } = require('./lib/scraper/scheduler');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;

    console.log('');
    console.log('  ┌─────────────────────────────────────────────┐');
    console.log('  │                                             │');
    console.log('  │   निर्वाचन  Nepal Election Results          │');
    console.log('  │                                             │');
    console.log(`  │   → http://localhost:${port}                    │`);
    console.log(`  │   Mode: ${(process.env.DATA_MODE || 'demo').toUpperCase().padEnd(36)}│`);
    console.log('  │                                             │');
    console.log('  └─────────────────────────────────────────────┘');
    console.log('');

    // Start the scraping scheduler
    startScheduler();
  });

  // Graceful shutdown
  function shutdown(signal) {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    stopScheduler();
    server.close(() => {
      console.log('[Server] Closed.');
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.error('[Server] Forced shutdown.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
});
