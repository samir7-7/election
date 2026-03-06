export default function VoteBars({ candidates, totalVotes }) {
  if (!candidates || candidates.length === 0) return null;

  const maxVotes = candidates[0]?.votes || 1;

  return (
    <div className="vote-bar-container">
      {candidates.slice(0, 8).map((candidate, idx) => {
        const pct = totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(1) : 0;
        const barWidth = maxVotes > 0 ? (candidate.votes / maxVotes) * 100 : 0;

        return (
          <div
            key={`${candidate.name}-${idx}`}
            className={`vote-bar-row ${candidate.isLeading ? 'vote-bar-row--leading' : ''}`}
          >
            <div className="vote-bar-name">
              <span
                className="constituency-row__party-dot"
                style={{ backgroundColor: candidate.partyColor }}
              />
              <span className="vote-bar-name__text">{candidate.name}</span>
              <span className="vote-bar-party">{candidate.partyShortName}</span>
            </div>

            <div className="vote-bar-track">
              <div
                className="vote-bar-fill"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: candidate.partyColor,
                  opacity: candidate.isLeading ? 1 : 0.6,
                }}
              />
            </div>

            <div className="vote-bar-count num">
              {candidate.votes > 0 ? candidate.votes.toLocaleString() : '—'}
              {totalVotes > 0 && candidate.votes > 0 && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                  {pct}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
