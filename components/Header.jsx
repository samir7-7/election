"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = useCallback(async (q) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <header className="site-header" role="banner">
        <div className="container site-header__inner">
          <Link
            href="/"
            className="site-header__brand"
            style={{ textDecoration: "none" }}
          >
            <span
              className="site-header__flag"
              role="img"
              aria-label="Nepal flag"
            >
              🇳🇵
            </span>
            <span className="site-header__title">निर्वाचन</span>
            <span className="site-header__subtitle">Election 2026</span>
          </Link>

          <nav className="site-header__nav" aria-label="Main navigation">
            <Link
              href="/"
              className="site-header__link site-header__link--active"
            >
              Overview
            </Link>
            <Link href="/province/3" className="site-header__link">
              Provinces
            </Link>
            <button
              className="search-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Search constituencies"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Search
              <kbd>⌘K</kbd>
            </button>
          </nav>
        </div>
      </header>

      {searchOpen && (
        <div
          className="search-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div
            className="search-panel"
            role="dialog"
            aria-label="Search constituencies"
          >
            <div className="search-panel__input-wrap">
              <svg
                className="search-panel__icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="search-panel__input"
                type="text"
                placeholder="Search by constituency, district, or province..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="search-results">
              {results.length > 0 ? (
                results.map((r) => (
                  <Link
                    key={r.id}
                    href={`/constituency/${r.id}`}
                    className="search-result-item"
                    onClick={() => setSearchOpen(false)}
                  >
                    <div>
                      <div className="search-result-item__name">{r.name}</div>
                      <div className="search-result-item__sub">
                        {r.districtName} · {r.provinceName}
                      </div>
                    </div>
                    <span className={`badge badge--${r.status}`}>
                      {r.status}
                    </span>
                  </Link>
                ))
              ) : query.length >= 2 ? (
                <div className="search-empty">
                  No constituencies found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <div className="search-empty">
                  Type to search constituencies, districts, or provinces
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
