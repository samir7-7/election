/**
 * Single Province Results API
 * GET /api/provinces/[id]
 */

const store = require('../../../../lib/store');

export async function GET(request, { params }) {
  try {
    if (!store.isInitialized) {
      store.initialize(process.env.DATA_MODE || 'demo');
    }

    const provinceId = parseInt(params.id, 10);
    
    if (isNaN(provinceId) || provinceId < 1 || provinceId > 7) {
      return Response.json({ error: 'Invalid province ID' }, { status: 400 });
    }

    const summary = store.getProvinceSummary(provinceId);
    const constituencies = store.getConstituenciesByProvince(provinceId);

    if (!summary) {
      return Response.json({ error: 'Province not found' }, { status: 404 });
    }

    return Response.json({
      summary,
      constituencies: constituencies.map(c => ({
        id: c.constituency.id,
        slug: c.constituency.slug,
        name: c.constituency.name,
        districtName: c.constituency.districtName,
        status: c.meta.status,
        countedPercentage: c.meta.countedPercentage,
        leadingCandidate: c.candidates.find(ca => ca.isLeading) || null,
        totalVotes: c.meta.totalVotesCast,
        lastUpdated: c.meta.lastUpdated,
        source: c.meta.sourceLabel,
      })),
      _meta: {
        lastUpdated: store.lastUpdated,
        source: store.dataSource,
      },
    });
  } catch (err) {
    console.error('[API] /provinces/[id] error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
