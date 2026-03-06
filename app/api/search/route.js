/**
 * Search API
 * GET /api/search?q=kathmandu
 */

const store = require('../../../lib/store');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    if (!store.isInitialized) {
      store.initialize(process.env.DATA_MODE || 'demo');
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return Response.json({ results: [], message: 'Query must be at least 2 characters' });
    }

    const results = store.searchConstituencies(query);

    return Response.json({ results, query });
  } catch (err) {
    console.error('[API] /search error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
