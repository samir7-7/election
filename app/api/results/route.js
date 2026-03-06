/**
 * National Results Summary API
 * GET /api/results
 */

const store = require("../../../lib/store");

export async function GET(request) {
  try {
    if (!store.isInitialized) {
      store.initialize(process.env.DATA_MODE || "demo");
    }

    const summary = store.getNationalSummary();

    if (!summary) {
      return Response.json(
        { error: "Results not yet available" },
        { status: 503 },
      );
    }

    return Response.json({
      ...summary,
      _meta: {
        source: store.dataSource,
        lastUpdated: store.lastUpdated,
        disclaimer:
          "Provisional data. Refer to Election Commission of Nepal for official results.",
      },
    });
  } catch (err) {
    console.error("[API] /results error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
