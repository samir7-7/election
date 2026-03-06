'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import LiveBar from '../../../components/LiveBar';
import SeatsBar from '../../../components/SeatsBar';
import PartyTable from '../../../components/PartyTable';
import ConstituencyList from '../../../components/ConstituencyList';

const POLL_INTERVAL = 12000;

export default function ProvincePage() {
  const params = useParams();
  const provinceId = params.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/provinces/${provinceId}`);
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch province data:', err);
    } finally {
      setLoading(false);
    }
  }, [provinceId]);

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
          <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>Loading province results...</p>
          </div>
        </main>
      </>
    );
  }

  if (!data || !data.summary) {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>Province not found.</p>
            <Link href="/" style={{ marginTop: '1rem', display: 'inline-block' }}>← Back to overview</Link>
          </div>
        </main>
      </>
    );
  }

  const { summary, constituencies } = data;
  const prov = summary.province;

  // Filter constituencies
  const filteredConstituencies = filterStatus === 'all'
    ? constituencies
    : constituencies.filter(c => c.status === filterStatus);

  // Group by district
  const byDistrict = {};
  for (const c of filteredConstituencies) {
    if (!byDistrict[c.districtName]) {
      byDistrict[c.districtName] = [];
    }
    byDistrict[c.districtName].push(c);
  }

  return (
    <>
      <Header />
      <LiveBar lastUpdated={data._meta?.lastUpdated} source={data._meta?.source} />

      <main>
        {/* Breadcrumb */}
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Overview</Link>
            <span className="breadcrumb__sep">/</span>
            <span>{prov.name}</span>
          </nav>
        </div>

        {/* Province header */}
        <section className="section" style={{ paddingBottom: 'var(--space-lg)' }}>
          <div className="container">
            <h1 className="section__title" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-xs)' }}>
              {prov.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              {prov.nameNp} · Capital: {prov.capital} · {summary.totalConstituencies} constituencies
            </p>

            {/* Stats row */}
            <div style={{
              display: 'flex',
              gap: 'var(--space-xl)',
              marginTop: 'var(--space-lg)',
              flexWrap: 'wrap',
            }}>
              <StatItem value={summary.totalConstituencies} label="Total Seats" />
              <StatItem value={summary.completed} label="Declared" />
              <StatItem value={summary.counting} label="Counting" />
              <StatItem value={summary.pending} label="Pending" />
              <StatItem value={summary.totalVotes?.toLocaleString()} label="Total Votes" />
            </div>
          </div>
        </section>

        {/* Seats bar */}
        <section className="section" style={{ background: 'var(--bg-surface)', paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-lg)' }}>
          <div className="container">
            <SeatsBar partySeats={summary.partySeats} totalSeats={summary.totalConstituencies} />
          </div>
        </section>

        {/* Two-column: Party table + Constituency list */}
        <section className="section">
          <div className="container">
            <div className="two-col">
              {/* Left column: Party breakdown */}
              <div>
                <h3 className="section__title" style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-md)' }}>
                  Party Standings
                </h3>
                <PartyTable
                  partySeats={summary.partySeats}
                  partyVotes={summary.partyVotes}
                  totalVotes={summary.totalVotes}
                />
              </div>

              {/* Right column: Constituencies */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-md)',
                  gap: 'var(--space-sm)',
                  flexWrap: 'wrap',
                }}>
                  <h3 className="section__title" style={{ fontSize: 'var(--text-md)' }}>
                    Constituencies ({filteredConstituencies.length})
                  </h3>

                  {/* Filter buttons */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['all', 'completed', 'counting', 'pending'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        style={{
                          padding: '3px 10px',
                          fontSize: 'var(--text-xs)',
                          fontWeight: filterStatus === status ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                          color: filterStatus === status ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          background: filterStatus === status ? 'var(--bg-inset)' : 'transparent',
                          border: '1px solid',
                          borderColor: filterStatus === status ? 'var(--border-medium)' : 'transparent',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grouped by district */}
                {Object.entries(byDistrict)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([district, constits]) => (
                    <div key={district} style={{ marginBottom: 'var(--space-lg)' }}>
                      <h4 style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 'var(--space-xs)',
                        paddingBottom: '4px',
                        borderBottom: '1px solid var(--border-light)',
                      }}>
                        {district}
                      </h4>
                      <ConstituencyList constituencies={constits} />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function StatItem({ value, label }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--weight-bold)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 'var(--leading-tight)',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </div>
    </div>
  );
}
