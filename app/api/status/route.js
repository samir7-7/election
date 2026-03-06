/**
 * System Status API
 * GET /api/status
 */

const store = require('../../../lib/store');

export async function GET() {
  try {
    const status = store.getStatus();
    return Response.json(status);
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
