'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import LiveBar from '../../../components/LiveBar';
import VoteBars from '../../../components/VoteBars';

const POLL_INTERVAL = 10000;

export default function ConstituencyPage() {
  const params = useParams();
  const constituencyId = params.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/constituency/${constituencyId}`);
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch constituency data:', err);
    } finally {
      setLoading(false);
    }
  }, [constituencyId]);

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
            <p style={{ color: 'var(--text-tertiary)' }}>Loading constituency results...</p>
          </div>
        </main>
      </>
    );
  }

  if (!data || !data.constituency) {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>Constituency not found.</p>
            <Link href="/" style={{ marginTop: '1rem', display: 'inline-block' }}>← Back to overview</Link>
          </div>
        </main>
      </>
    );
  }

  const { constituency, candidates, meta } = data;
  const totalVotes = meta.totalVotesCast || candidates.reduce((sum, c) => sum + c.votes, 0);
  const leader = candidates.find(c => c.isLeading);

  return (
    <>
      <Header />
      <LiveBar lastUpdated={meta.lastUpdated} source={meta.source} />

      <main>
        {/* Breadcrumb */}
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Overview</Link>
            <span className="breadcrumb__sep">/</span>
            <Link href={`/province/${constituency.provinceId}`}>{constituency.provinceName}</Link>
            <span className="breadcrumb__sep">/</span>
            <span>{constituency.name}</span>
          </nav>
        </div>

        {/* Constituency header */}
        <section className="section" style={{ paddingBottom: 'var(--space-md)' }}>
          <div className="container container--narrow">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 'var(--weight-bold)',
                  lineHeight: 'var(--leading-tight)',
                  marginBottom: '4px',
                }}>
                  {constituency.name}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  {constituency.districtName} District · {constituency.provinceName}
                </p>
              </div>

              <span className={`badge badge--${meta.status}`} style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}>
                {meta.status === 'counting' ? `Counting (${meta.countedPercentage}%)` : meta.status}
              </span>
            </div>

            {/* Data source notice */}
            <div className="source-badge" style={{ marginTop: 'var(--space-md)' }}>
              <svg className="source-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{meta.sourceLabel || 'Provisional data'}</span>
              <span style={{ marginLeft: '4px', opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.6 }}>Last updated: {new Date(meta.lastUpdated).toLocaleTimeString()}</span>
            </div>
          </div>
        </section>

        {/* Summary stats */}
        <section style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: 'var(--space-lg) 0' }}>
          <div className="container container--narrow">
            <div style={{ display: 'flex', gap: 'var(--space-2xl)', flexWrap: 'wrap' }}>
              <MetricItem label="Total Votes Cast" value={totalVotes > 0 ? totalVotes.toLocaleString() : '—'} />
              <MetricItem label="Eligible Voters" value={meta.totalEligibleVoters?.toLocaleString() || '—'} />
              <MetricItem label="Turnout" value={meta.turnoutPercentage > 0 ? `${meta.turnoutPercentage}%` : '—'} />
              <MetricItem label="Counted" value={`${meta.countedPercentage || 0}%`} />
            </div>

            {/* Counted progress bar */}
            {meta.status !== 'pending' && (
              <div style={{ marginTop: 'var(--space-md)' }}>
                <div style={{
                  height: '6px',
                  background: 'var(--bg-inset)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${meta.countedPercentage || 0}%`,
                    background: meta.status === 'completed' ? 'var(--status-completed)' : 'var(--status-counting)',
                    borderRadius: '3px',
                    transition: 'width 600ms ease',
                  }} />
                </div>
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                  marginTop: '4px',
                }}>
                  {meta.countedPercentage || 0}% of votes counted
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Candidates */}
        <section className="section">
          <div className="container container--narrow">
            <h2 className="section__title" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-lg)' }}>
              Candidates
            </h2>

            {/* Vote bars visualization */}
            {meta.status !== 'pending' && (
              <div style={{ marginBottom: 'var(--space-2xl)' }}>
                <VoteBars candidates={candidates} totalVotes={totalVotes} />
              </div>
            )}

            {/* Detailed candidate cards */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              {candidates.map((candidate, idx) => {
                const pct = totalVotes > 0
                  ? ((candidate.votes / totalVotes) * 100).toFixed(1)
                  : 0;

                return (
                  <div
                    key={`${candidate.name}-${idx}`}
                    className={`candidate-detail ${candidate.isLeading ? 'candidate-detail--leading' : ''}`}
                  >
                    <div
                      className="candidate-rank"
                      style={{ backgroundColor: candidate.partyColor }}
                    >
                      {idx + 1}
                    </div>

                    <div>
                      <div className="candidate-info__name">
                        {candidate.name}
                        {candidate.isLeading && (
                          <span style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--status-live)',
                            fontWeight: 'var(--weight-semibold)',
                            marginLeft: '8px',
                          }}>
                            LEADING
                          </span>
                        )}
                      </div>
                      <div className="candidate-info__party">
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '2px',
                            backgroundColor: candidate.partyColor,
                            display: 'inline-block',
                          }}
                        />
                        {candidate.partyName}
                      </div>
                    </div>

                    <div className="candidate-votes">
                      <div className="candidate-votes__count num">
                        {candidate.votes > 0 ? candidate.votes.toLocaleString() : '—'}
                      </div>
                      {totalVotes > 0 && candidate.votes > 0 && (
                        <div className="candidate-votes__pct num">{pct}%</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Navigation to adjacent constituencies */}
        <section style={{ padding: 'var(--space-lg) 0' }}>
          <div className="container container--narrow">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--text-sm)',
            }}>
              {constituency.id > 1 && (
                <Link href={`/constituency/${constituency.id - 1}`}>
                  ← Previous constituency
                </Link>
              )}
              <span />
              {constituency.id < 165 && (
                <Link href={`/constituency/${constituency.id + 1}`}>
                  Next constituency →
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function MetricItem({ label, value }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-lg)',
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
        marginTop: '2px',
      }}>
        {label}
      </div>
    </div>
  );
}
