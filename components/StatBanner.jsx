export default function StatBanner({ summary }) {
  if (!summary) return null;

  const items = [
    {
      value: summary.totalConstituencies,
      label: "Total Seats",
      icon: "🏛",
      color: "#0f172a",
      bg: "#f1f5f9",
    },
    {
      value: summary.completed,
      label: "Declared",
      icon: "✅",
      color: "#059669",
      bg: "#ecfdf5",
    },
    {
      value: summary.counting,
      label: "Counting",
      icon: "🔢",
      color: "#2563eb",
      bg: "#eff6ff",
    },
    {
      value: summary.pending,
      label: "Pending",
      icon: "⏳",
      color: "#d97706",
      bg: "#fffbeb",
    },
    {
      value: formatVotes(summary.totalVotes),
      label: "Total Votes",
      icon: "🗳",
      color: "#7c3aed",
      bg: "#f5f3ff",
    },
  ];

  return (
    <div className="stat-banner">
      <div className="container">
        <div className="stat-banner__grid">
          {items.map((item) => (
            <div key={item.label} className="stat-banner__item">
              <div
                className="stat-banner__icon"
                style={{ background: item.bg }}
              >
                {item.icon}
              </div>
              <div className="stat-banner__value" style={{ color: item.color }}>
                {item.value}
              </div>
              <div className="stat-banner__label">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatVotes(num) {
  if (num == null) return "—";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(0) + "K";
  return num.toLocaleString();
}
