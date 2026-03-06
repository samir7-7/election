export default function SeatsBar({ partySeats, totalSeats, size = 'default' }) {
  if (!partySeats || partySeats.length === 0) return null;

  const sizeClass = size === 'sm' ? 'seats-bar--sm' : '';

  return (
    <div>
      <div className={`seats-bar ${sizeClass}`} role="img" aria-label="Party seat distribution">
        {partySeats.map((ps) => (
          <div
            key={ps.partyId}
            className="seats-bar__segment"
            style={{
              width: `${(ps.seats / totalSeats) * 100}%`,
              backgroundColor: ps.partyColor,
            }}
            title={`${ps.partyName || ps.partyShortName}: ${ps.seats} seat${ps.seats !== 1 ? 's' : ''}`}
          />
        ))}
      </div>

      <div className="seats-legend">
        {partySeats.slice(0, 6).map((ps) => (
          <div key={ps.partyId} className="seats-legend__item">
            <span className="seats-legend__dot" style={{ backgroundColor: ps.partyColor }} />
            <span className="seats-legend__count">{ps.seats}</span>
            <span className="seats-legend__name">{ps.partyShortName || ps.partyName}</span>
          </div>
        ))}
        {partySeats.length > 6 && (
          <div className="seats-legend__item">
            <span className="seats-legend__dot" style={{ backgroundColor: '#9ca3af' }} />
            <span className="seats-legend__count">
              {partySeats.slice(6).reduce((sum, ps) => sum + ps.seats, 0)}
            </span>
            <span className="seats-legend__name">Others</span>
          </div>
        )}
      </div>
    </div>
  );
}
