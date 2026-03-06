import Link from 'next/link';

export default function ConstituencyList({ constituencies }) {
  if (!constituencies || constituencies.length === 0) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No constituencies found.</p>;
  }

  return (
    <div className="constituency-list">
      {constituencies.map((c) => (
        <Link
          key={c.id}
          href={`/constituency/${c.id}`}
          className="constituency-row"
        >
          <div>
            <div className="constituency-row__name">{c.name}</div>
            <div className="constituency-row__district">{c.districtName}</div>
          </div>

          <div className="constituency-row__leader">
            {c.leadingCandidate ? (
              <>
                <span
                  className="constituency-row__party-dot"
                  style={{ backgroundColor: c.leadingCandidate.partyColor }}
                />
                <span>{c.leadingCandidate.partyShortName}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</span>
            )}
          </div>

          <span className={`badge badge--${c.status}`}>
            {c.status === 'counting' && c.countedPercentage != null
              ? `${c.countedPercentage}%`
              : c.status}
          </span>
        </Link>
      ))}
    </div>
  );
}
