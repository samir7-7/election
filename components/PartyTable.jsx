export default function PartyTable({ partySeats, partyVotes, totalVotes }) {
  if (!partySeats || partySeats.length === 0) return null;

  // Merge seats and votes data
  const voteMap = {};
  if (partyVotes) {
    for (const pv of partyVotes) {
      voteMap[pv.partyId] = pv.votes;
    }
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Party</th>
          <th>Seats</th>
          {partyVotes && <th>Votes</th>}
          {partyVotes && totalVotes > 0 && <th>Vote %</th>}
        </tr>
      </thead>
      <tbody>
        {partySeats.map((ps) => {
          const votes = voteMap[ps.partyId] || 0;
          const pct = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : '—';

          return (
            <tr key={ps.partyId}>
              <td>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      backgroundColor: ps.partyColor,
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    <strong style={{ fontWeight: 'var(--weight-medium)' }}>
                      {ps.partyShortName || ps.partyName}
                    </strong>
                    {ps.partyName && ps.partyShortName && ps.partyName !== ps.partyShortName && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-tertiary)',
                        marginLeft: '6px',
                      }}>
                        {ps.partyName}
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td style={{ fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
                {ps.seats}
              </td>
              {partyVotes && (
                <td className="num">{votes > 0 ? votes.toLocaleString() : '—'}</td>
              )}
              {partyVotes && totalVotes > 0 && (
                <td className="num">{pct}%</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
