/**
 * Scraping Scheduler
 *
 * Manages periodic scraping of election results from election.ekantipur.com.
 * In live mode, scrapes all 165 constituency pages periodically.
 */

const cron = require("node-cron");
const { scrapeEkantipur } = require("./ekantipur");
const { reconcile } = require("../reconciler");
const store = require("../store");

let cronJob = null;
let isRunning = false;

/**
 * Run a full scrape cycle
 */
async function runScrape() {
  if (isRunning) {
    console.log("[Scheduler] Previous scrape still running, skipping...");
    return;
  }

  isRunning = true;
  store.scrapeInProgress = true;

  try {
    const ekResult = await scrapeEkantipur();

    if (ekResult.success && ekResult.results.length > 0) {
      const updated = store.bulkUpdate(ekResult.results, "ekantipur");
      store.lastScraped = new Date().toISOString();
      console.log(
        `[Scheduler] Updated ${updated}/${ekResult.results.length} constituencies from Ekantipur`,
      );
    } else if (!ekResult.success) {
      console.error(`[Scheduler] Scrape failed — no results returned`);
    } else {
      console.log(
        `[Scheduler] Scrape completed but returned 0 results (election may not have started)`,
      );
      store.lastScraped = new Date().toISOString();
    }
  } catch (err) {
    console.error("[Scheduler] Unexpected error:", err.message);
  } finally {
    isRunning = false;
    store.scrapeInProgress = false;
  }
}

/**
 * Start the scraping scheduler
 */
function startScheduler() {
  const mode = process.env.DATA_MODE || "live";
  const intervalSeconds = parseInt(
    process.env.SCRAPE_INTERVAL_SECONDS || "120",
    10,
  );

  // Initialize store
  store.initialize(mode);

  if (mode === "2022") {
    console.log(
      `[Scheduler] Running in 2022 RESULTS mode — displaying real election data`,
    );
    console.log(
      `[Scheduler] To enable live scraping, set DATA_MODE=live in .env`,
    );
    return;
  }

  if (mode === "demo") {
    console.log(
      `[Scheduler] Running in DEMO mode — simulating updates every ${intervalSeconds}s`,
    );

    cronJob = setInterval(() => {
      if (isRunning) return;
      isRunning = true;

      try {
        const updated = store.simulateUpdate();
        if (updated > 0) {
          console.log(
            `[Scheduler] Demo update: ${updated} constituencies updated`,
          );
        }
      } catch (err) {
        console.error("[Scheduler] Demo update error:", err.message);
      } finally {
        isRunning = false;
      }
    }, intervalSeconds * 1000);

    return;
  }

  // Live mode: scrape election.ekantipur.com
  console.log(
    `[Scheduler] Running in LIVE mode — scraping election.ekantipur.com every ${intervalSeconds}s`,
  );

  // Schedule periodic scrapes
  cronJob = setInterval(() => runScrape(), intervalSeconds * 1000);

  // Run first scrape after a short delay (let server finish starting)
  setTimeout(() => runScrape(), 3000);
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (cronJob) {
    clearInterval(cronJob);
    cronJob = null;
  }
  console.log("[Scheduler] Stopped");
}

module.exports = { startScheduler, stopScheduler };
