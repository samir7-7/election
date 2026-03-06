/**
 * All Province Summaries API
 * GET /api/provinces
 */

const store = require('../../../lib/store');

export async function GET() {
  try {
    if (!store.isInitialized) {
      store.initialize(process.env.DATA_MODE || 'demo');
    }

    const summaries = store.getAllProvinceSummaries();

    return Response.json({
      provinces: summaries,
      _meta: {
        lastUpdated: store.lastUpdated,
        source: store.dataSource,
      },
    });
  } catch (err) {
    console.error('[API] /provinces error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
