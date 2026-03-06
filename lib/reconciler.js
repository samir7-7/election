/**
 * Data Reconciler
 * 
 * Compares data from multiple sources (Ekantipur, EC Nepal)
 * and determines the most trusted values. Flags discrepancies
 * for review.
 */

const store = require('./store');

/**
 * Reconcile Ekantipur data against Election Commission data
 * EC data is always treated as authoritative when available.
 */
function reconcile(ekantipurResults, ecResults) {
  if (!ecResults || ecResults.length === 0) {
    // No EC data to reconcile against — mark all as provisional
    return {
      reconciled: false,
      reason: 'No EC data available',
      discrepancies: [],
    };
  }

  const ecMap = new Map();
  for (const r of ecResults) {
    if (r.constituencyId) {
      ecMap.set(r.constituencyId, r);
    }
  }

  const discrepancies = [];

  for (const ekResult of ekantipurResults) {
    if (!ekResult.constituencyId) continue;

    const ecResult = ecMap.get(ekResult.constituencyId);
    if (!ecResult) continue;

    // Compare leading candidates
    const ekLeader = ekResult.candidates.find(c => c.isLeading);
    const ecLeader = ecResult.candidates.find(c => c.isLeading);

    if (ekLeader && ecLeader && ekLeader.name !== ecLeader.name) {
      discrepancies.push({
        constituencyId: ekResult.constituencyId,
        field: 'leadingCandidate',
        ekantipurValue: ekLeader.name,
        ecValue: ecLeader.name,
        severity: 'high',
      });
    }

    // Compare vote counts (allow 5% tolerance for timing differences)
    for (const ekCand of ekResult.candidates) {
      const ecCand = ecResult.candidates.find(c => 
        c.name === ekCand.name || 
        (c.partyId === ekCand.partyId && c.partyId !== 'IND')
      );

      if (ecCand) {
        const diff = Math.abs(ekCand.votes - ecCand.votes);
        const maxVotes = Math.max(ekCand.votes, ecCand.votes, 1);
        const pctDiff = (diff / maxVotes) * 100;

        if (pctDiff > 5 && diff > 100) {
          discrepancies.push({
            constituencyId: ekResult.constituencyId,
            field: 'voteCount',
            candidate: ekCand.name,
            ekantipurValue: ekCand.votes,
            ecValue: ecCand.votes,
            percentageDiff: pctDiff.toFixed(1),
            severity: pctDiff > 20 ? 'high' : 'medium',
          });
        }
      }
    }
  }

  // Log discrepancies
  for (const d of discrepancies) {
    store.addDiscrepancy(d.constituencyId, d.field, d.ekantipurValue, d.ecValue);
  }

  return {
    reconciled: true,
    discrepancies,
    totalCompared: ekantipurResults.filter(r => ecMap.has(r.constituencyId)).length,
    totalDiscrepancies: discrepancies.length,
    highSeverity: discrepancies.filter(d => d.severity === 'high').length,
  };
}

module.exports = { reconcile };
