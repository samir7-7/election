export default function LeadingTable({ partySeats }) {
  if (!partySeats || partySeats.length === 0) return null;

  // Only show parties that have at least 1 seat (won or leading)
  const active = partySeats.filter((ps) => ps.seats > 0);
  if (active.length === 0) return null;

  const totalActive = active.reduce((sum, ps) => sum + ps.seats, 0);

  return (
    <div className="leading-tally">
      <div className="leading-tally__header">
        <h3 className="leading-tally__title">Party-wise Leading Tally</h3>
        <span className="leading-tally__subtitle">
          {totalActive} of 165 constituencies
        </span>
      </div>

      {/* Visual bar */}
      <div className="leading-tally__bar">
        {active.map((ps) => (
          <div
            key={ps.partyId}
            className="leading-tally__bar-seg"
            style={{
              width: `${(ps.seats / 165) * 100}%`,
              backgroundColor: ps.partyColor,
            }}
            title={`${ps.partyShortName || ps.partyName}: ${ps.seats}`}
          />
        ))}
      </div>

      {/* Table */}
      <table className="data-table leading-tally__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Party</th>
            <th>Won</th>
            <th>Leading</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {active.map((ps, idx) => (
            <tr key={ps.partyId}>
              <td className="num">{idx + 1}</td>
              <td>
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    className="leading-tally__dot"
                    style={{ backgroundColor: ps.partyColor }}
                  />
                  <strong style={{ fontWeight: "var(--weight-medium)" }}>
                    {ps.partyShortName || ps.partyName}
                  </strong>
                </span>
              </td>
              <td className="num">{ps.won || 0}</td>
              <td className="num">{ps.leading || 0}</td>
              <td
                className="num"
                style={{ fontWeight: "var(--weight-semibold)" }}
              >
                {ps.seats}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
