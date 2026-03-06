/**
 * Constituency Detail API
 * GET /api/constituency/[id]
 */

const store = require('../../../../lib/store');

export async function GET(request, { params }) {
  try {
    if (!store.isInitialized) {
      store.initialize(process.env.DATA_MODE || 'demo');
    }

    const id = parseInt(params.id, 10);
    let result = null;

    if (!isNaN(id)) {
      result = store.getConstituencyResult(id);
    }

    // Try slug match as fallback
    if (!result) {
      result = store.getConstituencyBySlug(params.id);
    }

    if (!result) {
      return Response.json({ error: 'Constituency not found' }, { status: 404 });
    }

    return Response.json({
      ...result,
      _meta: {
        lastUpdated: store.lastUpdated,
        source: result.meta.sourceLabel || store.dataSource,
        disclaimer: 'Provisional data. Refer to Election Commission of Nepal for official results.',
      },
    });
  } catch (err) {
    console.error('[API] /constituency/[id] error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
