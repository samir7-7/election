/**
 * In-Memory Election Data Store
 *
 * Centralized data store for election results with:
 * - Fast in-memory access
 * - Periodic file persistence for crash recovery
 * - Source tracking and timestamp management
 * - Thread-safe update patterns
 */

const fs = require("fs");
const path = require("path");
const {
  CONSTITUENCIES,
  PROVINCES,
  PARTIES,
  FIRST_NAMES,
  LAST_NAMES,
  MAJOR_PARTIES,
} = require("./nepal-data");
const {
  RESULTS_2022,
  PROVINCE_PROFILES,
  getProvinceForSlug,
} = require("./election-data-2022");

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "results.json");

class ElectionStore {
  constructor() {
    this.results = new Map(); // constituencyId -> { candidates, meta }
    this.provinceSummary = new Map(); // provinceId -> summary
    this.nationalSummary = null;
    this.lastUpdated = null;
    this.lastScraped = null; // timestamp of last successful scrape
    this.scrapeInProgress = false;
    this.dataSource = "none";
    this.scrapeLog = [];
    this.discrepancies = [];
    this.isInitialized = false;
  }

  /**
   * Initialize the store — load from cache or generate data
   * Modes: 'live' (scraping from ekantipur), '2022' (real results), 'demo' (random data)
   */
  initialize(mode = "live") {
    if (this.isInitialized) return;

    // In live mode, skip cache to always start fresh for latest data
    if (mode !== "live" && this._loadFromCache()) {
      console.log("[Store] Loaded results from cache file");
      this.isInitialized = true;
      return;
    }

    if (mode === "2022") {
      this._load2022Data();
      console.log(
        `[Store] Loaded real 2022 election data for ${this.results.size} constituencies`,
      );
    } else if (mode === "live") {
      this._initializeLiveMode();
      console.log(
        `[Store] Initialized live mode with ${this.results.size} pending constituencies`,
      );
    } else {
      this._generateDemoData();
      console.log(
        `[Store] Generated demo data for ${this.results.size} constituencies`,
      );
    }

    this.isInitialized = true;
    this._persistToCache();
  }

  /**
   * Generate realistic demo election data
   */
  _generateDemoData() {
    const usedNames = new Set();

    for (const constituency of CONSTITUENCIES) {
      const numCandidates = 4 + Math.floor(Math.random() * 5); // 4-8 candidates
      const candidates = [];
      const partiesUsed = new Set();

      // First, assign major parties
      const shuffledMajor = [...MAJOR_PARTIES].sort(() => Math.random() - 0.5);
      const majorCount = Math.min(
        3 + Math.floor(Math.random() * 2),
        numCandidates,
      );

      for (let i = 0; i < majorCount; i++) {
        const partyId = shuffledMajor[i];
        partiesUsed.add(partyId);
        candidates.push(this._generateCandidate(partyId, usedNames));
      }

      // Fill remaining with minor parties or independents
      for (let i = majorCount; i < numCandidates; i++) {
        const partyId =
          Math.random() > 0.5
            ? "IND"
            : ["RPP", "JSP", "LOSP", "JMMP", "NKP"].find(
                (p) => !partiesUsed.has(p),
              ) || "IND";
        partiesUsed.add(partyId);
        candidates.push(this._generateCandidate(partyId, usedNames));
      }

      // Generate vote counts with realistic distribution
      const totalEligible = 40000 + Math.floor(Math.random() * 60000);
      const turnoutPct = 0.55 + Math.random() * 0.25;
      const totalVotes = Math.floor(totalEligible * turnoutPct);

      // Distribute votes (Zipf-like distribution)
      let remaining = totalVotes;
      const sorted = candidates.sort(() => Math.random() - 0.5);

      for (let i = 0; i < sorted.length; i++) {
        if (i === sorted.length - 1) {
          sorted[i].votes = Math.max(remaining, 0);
        } else {
          const share =
            (sorted.length - i) / ((sorted.length * (sorted.length + 1)) / 2);
          const jitter = 0.7 + Math.random() * 0.6;
          const votes = Math.floor(remaining * share * jitter);
          sorted[i].votes = Math.max(votes, Math.floor(Math.random() * 200));
          remaining -= sorted[i].votes;
        }
      }

      // Sort by votes descending
      sorted.sort((a, b) => b.votes - a.votes);
      sorted[0].isLeading = true;

      // Determine reporting status
      const reportingPct = Math.random();
      let status;
      if (reportingPct > 0.85) {
        status = "completed";
      } else if (reportingPct > 0.15) {
        status = "counting";
      } else {
        status = "pending";
      }

      // If pending, zero out votes
      if (status === "pending") {
        sorted.forEach((c) => {
          c.votes = 0;
          c.isLeading = false;
        });
      }

      const countedPct =
        status === "completed"
          ? 100
          : status === "pending"
            ? 0
            : Math.floor(30 + Math.random() * 65);

      this.results.set(constituency.id, {
        constituency: {
          id: constituency.id,
          slug: constituency.slug,
          name: constituency.name,
          districtId: constituency.districtId,
          districtName: constituency.districtName,
          provinceId: constituency.provinceId,
          provinceName: constituency.provinceName,
        },
        candidates: sorted,
        meta: {
          totalEligibleVoters: totalEligible,
          totalVotesCast: status === "pending" ? 0 : totalVotes,
          turnoutPercentage:
            status === "pending" ? 0 : Math.round(turnoutPct * 100),
          countedPercentage: countedPct,
          status, // 'pending' | 'counting' | 'completed'
          source: "demo",
          sourceLabel: "Demo Data",
          lastUpdated: new Date().toISOString(),
          isReconciled: false,
        },
      });
    }

    this.dataSource = "demo";
    this.lastUpdated = new Date().toISOString();
    this._computeSummaries();
  }

  _generateCandidate(partyId, usedNames) {
    let name;
    let attempts = 0;
    do {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      name = `${first} ${last}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 50);
    usedNames.add(name);

    return {
      name,
      partyId,
      partyName: PARTIES[partyId]?.name || "Independent",
      partyShortName: PARTIES[partyId]?.shortName || "Ind",
      partyColor: PARTIES[partyId]?.color || "#757575",
      votes: 0,
      isLeading: false,
    };
  }

  /**
   * Load real 2022 Nepal General Election FPTP results
   */
  _load2022Data() {
    // Build a lookup from slug to constituency info
    const slugMap = new Map();
    for (const c of CONSTITUENCIES) {
      slugMap.set(c.slug, c);
    }

    for (const entry of RESULTS_2022) {
      const constituency = slugMap.get(entry.s);
      if (!constituency) {
        console.warn(`[Store] No matching constituency for slug: ${entry.s}`);
        continue;
      }

      // Build candidates list: winner + runner-up + 2-3 additional minor candidates
      const candidates = [];
      const usedParties = new Set();

      // Winner
      candidates.push(this._makeCandidate(entry.w, entry.wp, entry.wv, true));
      usedParties.add(entry.wp);

      // Runner-up
      candidates.push(this._makeCandidate(entry.r, entry.rp, entry.rv, false));
      usedParties.add(entry.rp);

      // Generate 2-3 additional minor candidates based on province profile
      const provinceId = getProvinceForSlug(entry.s);
      const profile = PROVINCE_PROFILES[provinceId] || PROVINCE_PROFILES[1];
      const allParties = [...profile.mainParties, ...profile.contestParties];
      const availableParties = allParties.filter((p) => !usedParties.has(p));

      const extraCount = 2 + Math.floor(Math.random() * 2); // 2-3 more
      const totalVotesCast = Math.floor((entry.reg * entry.tp) / 100);
      const winnerRunnerVotes = entry.wv + entry.rv;
      let remainingVotes = Math.max(totalVotesCast - winnerRunnerVotes, 0);

      for (let i = 0; i < extraCount && availableParties.length > 0; i++) {
        const partyId = availableParties.splice(
          Math.floor(Math.random() * availableParties.length),
          1,
        )[0];

        // Distribute remaining votes with decreasing shares
        const share = remainingVotes * (0.3 + Math.random() * 0.3);
        const votes = Math.floor(share);
        remainingVotes -= votes;

        const first =
          FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        candidates.push(
          this._makeCandidate(`${first} ${last}`, partyId, votes, false),
        );
      }

      // Sort by votes descending
      candidates.sort((a, b) => b.votes - a.votes);
      candidates[0].isLeading = true;
      for (let i = 1; i < candidates.length; i++)
        candidates[i].isLeading = false;

      this.results.set(constituency.id, {
        constituency: {
          id: constituency.id,
          slug: constituency.slug,
          name: constituency.name,
          districtId: constituency.districtId,
          districtName: constituency.districtName,
          provinceId: constituency.provinceId,
          provinceName: constituency.provinceName,
        },
        candidates,
        meta: {
          totalEligibleVoters: entry.reg,
          totalVotesCast: totalVotesCast,
          turnoutPercentage: entry.tp,
          countedPercentage: 100,
          status: "completed",
          source: "ecn-2022",
          sourceLabel: "2022 Election (ECN)",
          lastUpdated: "2022-11-23T18:00:00.000Z",
          isReconciled: true,
        },
      });
    }

    this.dataSource = "ecn-2022";
    this.lastUpdated = "2022-11-23T18:00:00.000Z";
    this._computeSummaries();
  }

  /**
   * Initialize empty constituencies for live scraping mode
   */
  _initializeLiveMode() {
    for (const constituency of CONSTITUENCIES) {
      this.results.set(constituency.id, {
        constituency: {
          id: constituency.id,
          slug: constituency.slug,
          name: constituency.name,
          districtId: constituency.districtId,
          districtName: constituency.districtName,
          provinceId: constituency.provinceId,
          provinceName: constituency.provinceName,
        },
        candidates: [],
        meta: {
          totalEligibleVoters: 0,
          totalVotesCast: 0,
          turnoutPercentage: 0,
          countedPercentage: 0,
          status: "pending",
          source: "live",
          sourceLabel: "Awaiting Results",
          lastUpdated: new Date().toISOString(),
          isReconciled: false,
        },
      });
    }

    this.dataSource = "live";
    this.lastUpdated = null; // no data scraped yet
    this._computeSummaries();
  }

  /**
   * Helper to create a candidate object
   */
  _makeCandidate(name, partyId, votes, isLeading) {
    return {
      name,
      partyId,
      partyName: PARTIES[partyId]?.name || "Independent",
      partyShortName: PARTIES[partyId]?.shortName || "Ind",
      partyColor: PARTIES[partyId]?.color || "#757575",
      votes,
      isLeading,
    };
  }

  /**
   * Compute province and national summaries from constituency results
   */
  _computeSummaries() {
    // Province summaries
    for (const province of PROVINCES) {
      const provResults = [];
      for (const [, result] of this.results) {
        if (result.constituency.provinceId === province.id) {
          provResults.push(result);
        }
      }

      const partySeats = {};
      const partyWon = {};
      const partyLeading = {};
      const partyVotes = {};
      let totalVotes = 0;
      let completed = 0;
      let counting = 0;
      let pending = 0;

      for (const r of provResults) {
        // Compute votes from actual candidates (more reliable than meta)
        const constituencyVotes = r.candidates.reduce(
          (sum, c) => sum + c.votes,
          0,
        );
        totalVotes += constituencyVotes;
        if (r.meta.status === "completed") {
          completed++;
          const winner = r.candidates[0];
          if (winner) {
            partySeats[winner.partyId] = (partySeats[winner.partyId] || 0) + 1;
            partyWon[winner.partyId] = (partyWon[winner.partyId] || 0) + 1;
          }
        } else if (r.meta.status === "counting") {
          counting++;
          const leader = r.candidates.find((c) => c.isLeading);
          if (leader) {
            partySeats[leader.partyId] = (partySeats[leader.partyId] || 0) + 1;
            partyLeading[leader.partyId] =
              (partyLeading[leader.partyId] || 0) + 1;
          }
        } else {
          pending++;
        }

        for (const c of r.candidates) {
          partyVotes[c.partyId] = (partyVotes[c.partyId] || 0) + c.votes;
        }
      }

      this.provinceSummary.set(province.id, {
        province: {
          id: province.id,
          name: province.name,
          nameNp: province.nameNp,
          capital: province.capital,
        },
        totalConstituencies: provResults.length,
        completed,
        counting,
        pending,
        totalVotes,
        partySeats: Object.entries(partySeats)
          .map(([partyId, seats]) => ({
            partyId,
            partyName: PARTIES[partyId]?.shortName || partyId,
            partyColor: PARTIES[partyId]?.color || "#757575",
            seats,
            won: partyWon[partyId] || 0,
            leading: partyLeading[partyId] || 0,
          }))
          .sort((a, b) => b.seats - a.seats),
        partyVotes: Object.entries(partyVotes)
          .map(([partyId, votes]) => ({
            partyId,
            partyName: PARTIES[partyId]?.shortName || partyId,
            partyColor: PARTIES[partyId]?.color || "#757575",
            votes,
          }))
          .sort((a, b) => b.votes - a.votes),
        leadingPartyId:
          Object.entries(partySeats).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          null,
      });
    }

    // National summary
    let totalSeats = {};
    let totalWon = {};
    let totalLeading = {};
    let totalVotes = {};
    let totalCompleted = 0;
    let totalCounting = 0;
    let totalPending = 0;
    let grandTotalVotes = 0;

    for (const [, summary] of this.provinceSummary) {
      totalCompleted += summary.completed;
      totalCounting += summary.counting;
      totalPending += summary.pending;
      grandTotalVotes += summary.totalVotes;

      for (const ps of summary.partySeats) {
        totalSeats[ps.partyId] = (totalSeats[ps.partyId] || 0) + ps.seats;
        totalWon[ps.partyId] = (totalWon[ps.partyId] || 0) + (ps.won || 0);
        totalLeading[ps.partyId] =
          (totalLeading[ps.partyId] || 0) + (ps.leading || 0);
      }
      for (const pv of summary.partyVotes) {
        totalVotes[pv.partyId] = (totalVotes[pv.partyId] || 0) + pv.votes;
      }
    }

    this.nationalSummary = {
      totalConstituencies: 165,
      completed: totalCompleted,
      counting: totalCounting,
      pending: totalPending,
      totalVotes: grandTotalVotes,
      partySeats: Object.entries(totalSeats)
        .map(([partyId, seats]) => ({
          partyId,
          partyName: PARTIES[partyId]?.name || partyId,
          partyShortName: PARTIES[partyId]?.shortName || partyId,
          partyColor: PARTIES[partyId]?.color || "#757575",
          seats,
          won: totalWon[partyId] || 0,
          leading: totalLeading[partyId] || 0,
        }))
        .sort((a, b) => b.seats - a.seats),
      partyVotes: Object.entries(totalVotes)
        .map(([partyId, votes]) => ({
          partyId,
          partyName: PARTIES[partyId]?.name || partyId,
          partyShortName: PARTIES[partyId]?.shortName || partyId,
          partyColor: PARTIES[partyId]?.color || "#757575",
          votes,
        }))
        .sort((a, b) => b.votes - a.votes),
      lastUpdated: this.lastUpdated,
      dataSource: this.dataSource,
    };
  }

  /**
   * Update results for a constituency (from scraper)
   */
  updateConstituency(constituencyId, candidates, meta) {
    const existing = this.results.get(constituencyId);
    if (!existing) return false;

    const sortedCandidates = candidates
      .sort((a, b) => b.votes - a.votes)
      .map((c, i) => ({
        ...c,
        isLeading: i === 0 && c.votes > 0,
      }));

    // Compute totalVotesCast from actual candidate votes
    const totalVotesCast = sortedCandidates.reduce(
      (sum, c) => sum + c.votes,
      0,
    );

    this.results.set(constituencyId, {
      constituency: existing.constituency,
      candidates: sortedCandidates,
      meta: {
        ...existing.meta,
        ...meta,
        totalVotesCast,
        lastUpdated: new Date().toISOString(),
      },
    });

    this.lastUpdated = new Date().toISOString();
    this._computeSummaries();
    return true;
  }

  /**
   * Bulk update from scraper results
   */
  bulkUpdate(scrapedResults, source) {
    let updatedCount = 0;

    for (const result of scrapedResults) {
      const existing = this.results.get(result.constituencyId);
      if (!existing) continue;

      // Only update if scraped data has more votes (progress forward)
      const existingTotal = existing.candidates.reduce(
        (sum, c) => sum + c.votes,
        0,
      );
      const newTotal = result.candidates.reduce((sum, c) => sum + c.votes, 0);

      if (newTotal >= existingTotal) {
        this.updateConstituency(result.constituencyId, result.candidates, {
          ...result.meta,
          source,
          sourceLabel:
            source === "ekantipur"
              ? "Provisional (Ekantipur)"
              : source === "ec-nepal"
                ? "Official (EC Nepal)"
                : "Demo Data",
        });
        updatedCount++;
      }
    }

    this.scrapeLog.push({
      timestamp: new Date().toISOString(),
      source,
      totalResults: scrapedResults.length,
      updated: updatedCount,
    });

    // Keep log manageable
    if (this.scrapeLog.length > 100) {
      this.scrapeLog = this.scrapeLog.slice(-50);
    }

    this._persistToCache();
    return updatedCount;
  }

  /**
   * Record a discrepancy between data sources
   */
  addDiscrepancy(constituencyId, field, ekantipurValue, ecValue) {
    this.discrepancies.push({
      constituencyId,
      field,
      ekantipurValue,
      ecValue,
      timestamp: new Date().toISOString(),
      resolved: false,
    });

    if (this.discrepancies.length > 500) {
      this.discrepancies = this.discrepancies.slice(-250);
    }
  }

  // ---- Query Methods ----

  getNationalSummary() {
    return this.nationalSummary;
  }

  getProvinceSummary(provinceId) {
    return this.provinceSummary.get(provinceId);
  }

  getAllProvinceSummaries() {
    return Array.from(this.provinceSummary.values());
  }

  getConstituencyResult(constituencyId) {
    return this.results.get(constituencyId);
  }

  getConstituencyBySlug(slug) {
    for (const [, result] of this.results) {
      if (result.constituency.slug === slug) return result;
    }
    return null;
  }

  getConstituenciesByProvince(provinceId) {
    const results = [];
    for (const [, result] of this.results) {
      if (result.constituency.provinceId === provinceId) {
        results.push(result);
      }
    }
    return results.sort((a, b) => a.constituency.id - b.constituency.id);
  }

  getConstituenciesByDistrict(districtId) {
    const results = [];
    for (const [, result] of this.results) {
      if (result.constituency.districtId === districtId) {
        results.push(result);
      }
    }
    return results.sort((a, b) => a.constituency.id - b.constituency.id);
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      totalConstituencies: this.results.size,
      lastUpdated: this.lastUpdated,
      lastScraped: this.lastScraped,
      scrapeInProgress: this.scrapeInProgress,
      dataSource: this.dataSource,
      recentScrapes: this.scrapeLog.slice(-5),
      discrepancyCount: this.discrepancies.filter((d) => !d.resolved).length,
    };
  }

  searchConstituencies(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results = [];
    for (const [, result] of this.results) {
      const c = result.constituency;
      if (
        c.name.toLowerCase().includes(q) ||
        c.districtName.toLowerCase().includes(q) ||
        c.provinceName.toLowerCase().includes(q)
      ) {
        results.push({
          id: c.id,
          slug: c.slug,
          name: c.name,
          districtName: c.districtName,
          provinceName: c.provinceName,
          leadingParty:
            result.candidates.find((ca) => ca.isLeading)?.partyShortName || "—",
          status: result.meta.status,
        });
      }
    }
    return results.slice(0, 20);
  }

  // ---- Simulate live updates (demo mode) ----

  simulateUpdate() {
    let updated = 0;
    for (const [id, result] of this.results) {
      if (result.meta.status === "completed") continue;

      // Randomly advance some constituencies
      if (Math.random() > 0.7) continue;

      if (result.meta.status === "pending" && Math.random() > 0.6) {
        // Start counting
        const totalEligible = result.meta.totalEligibleVoters;
        const turnout = 0.55 + Math.random() * 0.25;
        const totalVotes = Math.floor(totalEligible * turnout * 0.1);
        let remaining = totalVotes;

        result.candidates.forEach((c, i) => {
          if (i === result.candidates.length - 1) {
            c.votes = Math.max(remaining, 0);
          } else {
            const share = Math.random() * 0.4;
            c.votes = Math.floor(remaining * share);
            remaining -= c.votes;
          }
        });

        result.candidates.sort((a, b) => b.votes - a.votes);
        if (result.candidates[0]) result.candidates[0].isLeading = true;
        result.meta.status = "counting";
        result.meta.countedPercentage = Math.floor(5 + Math.random() * 15);
        result.meta.totalVotesCast = totalVotes;
        updated++;
      } else if (result.meta.status === "counting") {
        // Add more votes
        const increment = Math.floor(Math.random() * 8) + 2;
        const newPct = Math.min(result.meta.countedPercentage + increment, 100);
        const pctGain = (newPct - result.meta.countedPercentage) / 100;

        result.candidates.forEach((c) => {
          const gain = Math.floor(
            result.meta.totalEligibleVoters *
              0.7 *
              pctGain *
              (Math.random() * 0.3),
          );
          c.votes += Math.max(gain, 0);
        });

        result.candidates.sort((a, b) => b.votes - a.votes);
        result.candidates.forEach((c, i) => {
          c.isLeading = i === 0;
        });

        result.meta.countedPercentage = newPct;
        result.meta.totalVotesCast = result.candidates.reduce(
          (sum, c) => sum + c.votes,
          0,
        );

        if (newPct >= 100) {
          result.meta.status = "completed";
        }

        result.meta.lastUpdated = new Date().toISOString();
        updated++;
      }
    }

    if (updated > 0) {
      this.lastUpdated = new Date().toISOString();
      this._computeSummaries();
      this._persistToCache();
    }

    return updated;
  }

  // ---- Persistence ----

  _persistToCache() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const data = {
        results: Array.from(this.results.entries()),
        lastUpdated: this.lastUpdated,
        dataSource: this.dataSource,
        scrapeLog: this.scrapeLog,
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf-8");
    } catch (err) {
      console.error("[Store] Failed to persist cache:", err.message);
    }
  }

  _loadFromCache() {
    try {
      if (!fs.existsSync(CACHE_FILE)) return false;
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const data = JSON.parse(raw);

      this.results = new Map(data.results);
      this.lastUpdated = data.lastUpdated;
      this.dataSource = data.dataSource;
      this.scrapeLog = data.scrapeLog || [];
      this._computeSummaries();
      return true;
    } catch (err) {
      console.error("[Store] Failed to load cache:", err.message);
      return false;
    }
  }

  /**
   * Clear cache and regenerate (useful for fresh demo)
   */
  reset(mode = "demo") {
    this.results.clear();
    this.provinceSummary.clear();
    this.nationalSummary = null;
    this.lastUpdated = null;
    this.scrapeLog = [];
    this.discrepancies = [];
    this.isInitialized = false;

    try {
      if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    } catch (e) {
      /* ignore */
    }

    this.initialize(mode);
  }
}

// Singleton — use globalThis to survive Next.js dev-mode module reloads
if (!globalThis.__electionStore) {
  globalThis.__electionStore = new ElectionStore();
}
const store = globalThis.__electionStore;
module.exports = store;
