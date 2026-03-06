/**
 * Scraping Utilities
 * 
 * Provides rate limiting, retry with exponential backoff,
 * response logging, and error handling for web scraping.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');

/**
 * Make an HTTP request with retry and exponential backoff
 */
async function fetchWithRetry(url, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    timeout = 15000,
    logRaw = false,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': 'Nepal-Election-Results-Platform/1.0 (Public Interest Data Aggregation)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Accept-Language': 'en-US,en;q=0.5,ne;q=0.3',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        maxRedirects: 3,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 429) {
        // Rate limited — wait longer
        const delay = Math.min(baseDelay * Math.pow(2, attempt + 2), maxDelay * 2);
        console.warn(`[Scraper] Rate limited (429). Waiting ${delay}ms before retry...`);
        await sleep(delay);
        continue;
      }

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Log raw response if enabled
      if (logRaw) {
        logRawResponse(url, response.data);
      }

      return {
        data: response.data,
        status: response.status,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.warn(`[Scraper] Attempt ${attempt + 1} failed for ${url}: ${err.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error(`[Scraper] All ${maxRetries + 1} attempts failed for ${url}:`, lastError?.message);
  return null;
}

/**
 * Simple rate limiter / throttle
 */
class RateLimiter {
  constructor(maxRequests = 30, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamps = [];
  }

  async waitForSlot() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldest) + 100;
      console.log(`[RateLimiter] Throttling. Waiting ${waitTime}ms...`);
      await sleep(waitTime);
    }

    this.timestamps.push(Date.now());
  }
}

/**
 * Log raw HTML responses for audit/debugging
 */
function logRawResponse(url, html) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `raw_${timestamp}.html`;
    const logPath = path.join(LOG_DIR, filename);

    const header = `<!-- URL: ${url}\n     Fetched: ${new Date().toISOString()}\n-->\n`;
    fs.writeFileSync(logPath, header + html, 'utf-8');

    // Clean up old logs (keep last 50)
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('raw_'))
      .sort()
      .reverse();

    for (const file of files.slice(50)) {
      fs.unlinkSync(path.join(LOG_DIR, file));
    }
  } catch (err) {
    console.error('[Logger] Failed to write raw log:', err.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  fetchWithRetry,
  RateLimiter,
  logRawResponse,
  sleep,
};
