"use client";

import { useState, useEffect } from "react";

export default function LiveBar({
  lastUpdated,
  source,
  scrapeInProgress,
  lastScraped,
}) {
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    function updateTime() {
      if (!lastScraped && !lastUpdated) {
        setTimeAgo("");
        return;
      }
      const ts = lastScraped || lastUpdated;
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (diff < 10) setTimeAgo("Just now");
      else if (diff < 60) setTimeAgo(`${diff}s ago`);
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`);
      else setTimeAgo(`${Math.floor(diff / 3600)}h ago`);
    }

    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, [lastUpdated, lastScraped]);

  const statusText =
    scrapeInProgress && !lastScraped
      ? "First scrape in progress — please wait..."
      : scrapeInProgress
        ? "Updating results..."
        : "Results updating live";

  return (
    <div className="live-bar">
      <div className="container live-bar__inner">
        <span className="live-dot" aria-hidden="true" />
        <span>{statusText}</span>
        {source && (
          <span
            className="badge badge--provisional"
            style={{ marginLeft: "8px" }}
          >
            {source === "demo" ? "Demo Data" : "Provisional"}
          </span>
        )}
        {timeAgo && <span className="live-bar__time">Updated {timeAgo}</span>}
      </div>
    </div>
  );
}
