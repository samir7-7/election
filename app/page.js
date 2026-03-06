"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import LiveBar from "../components/LiveBar";
import StatBanner from "../components/StatBanner";
import SeatsBar from "../components/SeatsBar";
import PartyTable from "../components/PartyTable";
import LeadingTable from "../components/LeadingTable";
import NepalMap from "../components/NepalMap";
import ConstituencyList from "../components/ConstituencyList";

const POLL_INTERVAL = 12000; // 12 seconds

export default function HomePage() {
  const [national, setNational] = useState(null);
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [natRes, provRes] = await Promise.all([
        fetch("/api/results"),
        fetch("/api/provinces"),
      ]);
      const natData = await natRes.json();
      const provData = await provRes.json();
      setNational(natData);
      setProvinces(provData.provinces || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <>
        <Header />
        <main>
          <div
            className="container"
            style={{ padding: "4rem 0", textAlign: "center" }}
          >
            <p style={{ color: "var(--text-tertiary)" }}>
              Loading election results...
            </p>
          </div>
        </main>
      </>
    );
  }

  // Get recent completed results for the "Latest Results" section
  const recentResults = provinces.flatMap((p) => {
    // We'll need constituency data; for now use province-level
    return [];
  });

  return (
    <>
      <Header />
      <LiveBar
        lastUpdated={national?._meta?.lastUpdated}
        source={national?._meta?.source}
        scrapeInProgress={national?._meta?.scrapeInProgress}
        lastScraped={national?._meta?.lastScraped}
      />
      <StatBanner summary={national} />

      <main>
        {/* ---- LEADING TALLY ---- */}
        <section className="section">
          <div className="container">
            <LeadingTable partySeats={national?.partySeats} />
          </div>
        </section>

        {/* ---- SEATS OVERVIEW ---- */}
        <section className="section">
          <div className="container">
            <div className="section__header">
              <h2 className="section__title">
                House of Representatives — Seat Count
              </h2>
              <span className="section__subtitle">
                165 first-past-the-post constituencies
              </span>
            </div>

            <SeatsBar partySeats={national?.partySeats} totalSeats={165} />

            <div style={{ marginTop: "var(--space-xl)" }}>
              <PartyTable
                partySeats={national?.partySeats}
                partyVotes={national?.partyVotes}
                totalVotes={national?.totalVotes}
              />
            </div>
          </div>
        </section>

        {/* ---- MAP ---- */}
        <section
          className="section"
          style={{
            background: "#e8f0fe",
          }}
        >
          <div className="container">
            <div className="section__header">
              <h2 className="section__title">Results by Province</h2>
              <span className="section__subtitle">
                Click a province to explore
              </span>
            </div>

            <NepalMap provinceSummaries={provinces} />
          </div>
        </section>

        {/* ---- PROVINCE SUMMARIES ---- */}
        <section className="section">
          <div className="container">
            <div className="section__header">
              <h2 className="section__title">Province Breakdown</h2>
            </div>

            <div className="province-grid">
              {provinces
                .sort((a, b) => a.province.id - b.province.id)
                .map((prov) => (
                  <ProvinceSummaryCard key={prov.province.id} province={prov} />
                ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function ProvinceSummaryCard({ province }) {
  const topParties = province.partySeats?.slice(0, 4) || [];

  return (
    <a href={`/province/${province.province.id}`} className="province-summary">
      <div>
        <div className="province-summary__name">{province.province.name}</div>
        <div className="province-summary__meta">
          {province.totalConstituencies} constituencies · {province.completed}{" "}
          declared · {province.counting} counting
        </div>

        {/* Mini seats bar */}
        {topParties.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <div
              className="seats-bar seats-bar--sm"
              style={{ maxWidth: "200px" }}
            >
              {topParties.map((ps) => (
                <div
                  key={ps.partyId}
                  className="seats-bar__segment"
                  style={{
                    width: `${(ps.seats / province.totalConstituencies) * 100}%`,
                    backgroundColor: ps.partyColor,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="province-summary__seats">
        {topParties.slice(0, 3).map((ps) => (
          <div key={ps.partyId} className="province-summary__seat-group">
            <span
              className="province-summary__seat-dot"
              style={{ backgroundColor: ps.partyColor }}
            />
            <span>{ps.seats}</span>
          </div>
        ))}
      </div>
    </a>
  );
}
