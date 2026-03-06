/**
 * Cron-triggered Scrape API (for Vercel Cron Jobs)
 * GET /api/cron/scrape
 *
 * On Vercel, there's no persistent server, so this endpoint
 * is called every 2 minutes by Vercel Cron to fetch fresh data.
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

const store = require("../../../../lib/store");
const { scrapeEkantipur } = require("../../../../lib/scraper/ekantipur");

export const maxDuration = 60; // Allow up to 60s on Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(request) {
  // Verify cron secret if set (Vercel sets this automatically)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Initialize store if needed
    if (!store.isInitialized) {
      store.initialize(process.env.DATA_MODE || "live");
    }

    const ekResult = await scrapeEkantipur();

    if (ekResult.success && ekResult.results.length > 0) {
      const updated = store.bulkUpdate(ekResult.results, "ekantipur");
      return Response.json({
        ok: true,
        updated,
        total: ekResult.results.length,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json({
      ok: false,
      message: "Scrape returned no results",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron] Scrape error:", err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
