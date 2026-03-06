/**
 * Nepal Election Results Platform — Custom Server
 *
 * Wraps Next.js with a custom HTTP server that also:
 * - Initializes the data store
 * - Starts the scraping scheduler
 * - Handles graceful shutdown
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const https = require("https");
const http = require("http");
const { startScheduler, stopScheduler } = require("./lib/scraper/scheduler");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;

    console.log("");
    console.log("  ┌─────────────────────────────────────────────┐");
    console.log("  │                                             │");
    console.log("  │   निर्वाचन  Nepal Election Results          │");
    console.log("  │                                             │");
    console.log(`  │   → http://localhost:${port}                    │`);
    console.log(
      `  │   Mode: ${(process.env.DATA_MODE || "demo").toUpperCase().padEnd(36)}│`,
    );
    console.log("  │                                             │");
    console.log("  └─────────────────────────────────────────────┘");
    console.log("");

    // Start the scraping scheduler
    startScheduler();

    // Keep-alive self-ping for Render free tier (prevents spin-down after 15 min)
    const appUrl = process.env.RENDER_EXTERNAL_URL;
    if (appUrl) {
      const pingInterval = 10 * 60 * 1000; // every 10 minutes
      setInterval(() => {
        const client = appUrl.startsWith("https") ? https : http;
        client
          .get(`${appUrl}/api/status`, (res) => {
            res.resume();
          })
          .on("error", () => {});
      }, pingInterval);
      console.log("  [Keep-Alive] Self-ping enabled (every 10m)");
    }
  });

  // Graceful shutdown
  function shutdown(signal) {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    stopScheduler();
    server.close(() => {
      console.log("[Server] Closed.");
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.error("[Server] Forced shutdown.");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
});
