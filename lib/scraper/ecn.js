/**
 * Election Commission Nepal (ECN) Results Scraper
 * 
 * Scrapes official results from result.election.gov.np
 * This is the authoritative source for Nepal election results.
 * 
 * Targets:
 * - https://result.election.gov.np/ElectionResultCentral2079.aspx (2022)
 * - URL pattern may change for 2026 election
 * 
 * The ECN site typically publishes results in Nepali and English
 * with constituency-wise breakdowns as counting progresses.
 */

const cheerio = require('cheerio');
const { fetchWithRetry, RateLimiter } = require('./utils');
const { matchConstituency, matchParty } = require('./ekantipur');

const rateLimiter = new RateLimiter(
  parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '20', 10),
  60000
);

// ECN result page selectors (will need updating for 2026 layout)
const ECN_SELECTORS = {
  // Results page selectors
  constituencyBlock: '.result-constituency, .constituency-result, [data-constituency]',
  constituencyTitle: '.constituency-title, h3, h4, .title, caption',
  candidateRow: 'tr, .candidate-row, li',
  candidateName: 'td:nth-child(1), .candidate-name, .name',
  partyName: 'td:nth-child(2), .party-name, .party',
  voteCount: 'td:nth-child(3), .vote-count, .votes',
  
  // District-wise navigation
  districtLink: 'a[href*="district"], .district-link, select option',
  
  // Status indicators
  countingStatus: '.counting-status, .status, .result-status',
};

/**
 * Scrape ECN results page
 */
async function scrapeECN() {
  const baseUrl = process.env.EC_NEPAL_URL || 'https://result.election.gov.np';
  const logRaw = process.env.LOG_RAW_RESPONSES === 'true';

  console.log(`[ECN] Starting scrape from ${baseUrl}`);

  await rateLimiter.waitForSlot();

  try {
    const response = await fetchWithRetry(baseUrl, {
      maxRetries: 3,
      baseDelay: 3000,
      logRaw,
    });

    if (!response) {
      return { success: false, results: [], error: 'Failed to fetch ECN page' };
    }

    const results = parseECNPage(response.data);
    console.log(`[ECN] Parsed ${results.length} constituency results`);

    return {
      success: true,
      results,
      timestamp: response.timestamp,
      source: 'ec-nepal',
    };
  } catch (err) {
    console.error('[ECN] Scrape error:', err.message);
    return { success: false, results: [], error: err.message };
  }
}

/**
 * Parse the ECN results HTML page
 */
function parseECNPage(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Strategy 1: Constituency blocks
  const blocks = $(ECN_SELECTORS.constituencyBlock);
  if (blocks.length > 0) {
    blocks.each((_, block) => {
      const result = parseECNBlock($, $(block));
      if (result) results.push(result);
    });
  }

  // Strategy 2: Table-based results
  if (results.length === 0) {
    $('table').each((_, table) => {
      const tableResults = parseECNTable($, $(table));
      results.push(...tableResults);
    });
  }

  // Strategy 3: JSON embedded data (some ECN pages embed JSON)
  if (results.length === 0) {
    $('script').each((_, script) => {
      const text = $(script).html();
      if (text && text.includes('constituency') && text.includes('votes')) {
        try {
          const jsonMatch = text.match(/var\s+\w+\s*=\s*(\[[\s\S]*?\]);/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            for (const item of data) {
              if (item.constituency && item.candidates) {
                results.push({
                  constituencyId: matchConstituency(item.constituency)?.id || null,
                  constituencyName: item.constituency,
                  candidates: item.candidates.map(c => ({
                    name: c.name || c.candidateName,
                    partyId: matchParty(c.party || c.partyName)?.id || 'IND',
                    partyName: c.party || c.partyName || 'Independent',
                    partyShortName: matchParty(c.party)?.shortName || 'Ind',
                    partyColor: matchParty(c.party)?.color || '#757575',
                    votes: parseInt(c.votes || c.voteCount || 0, 10),
                    isLeading: false,
                  })).sort((a, b) => b.votes - a.votes),
                  meta: {
                    source: 'ec-nepal',
                    sourceLabel: 'Official (EC Nepal)',
                    status: item.status || 'counting',
                    countedPercentage: item.countedPct || 0,
                  },
                });
              }
            }
          }
        } catch (e) {
          // JSON parse failed, skip
        }
      }
    });
  }

  return results;
}

function parseECNBlock($, block) {
  try {
    let title = '';
    for (const sel of ECN_SELECTORS.constituencyTitle.split(', ')) {
      const el = block.find(sel).first();
      if (el.length) {
        title = el.text().replace(/\s+/g, ' ').trim();
        break;
      }
    }
    if (!title) return null;

    const candidates = [];
    block.find(ECN_SELECTORS.candidateRow).each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      if (cells.length >= 3) {
        const name = $(cells[0]).text().trim();
        const party = $(cells[1]).text().trim();
        const votes = parseInt($(cells[2]).text().replace(/[,\s]/g, ''), 10) || 0;
        const matched = matchParty(party);
        if (name) {
          candidates.push({
            name,
            partyId: matched?.id || 'IND',
            partyName: matched?.name || party || 'Independent',
            partyShortName: matched?.shortName || 'Ind',
            partyColor: matched?.color || '#757575',
            votes,
            isLeading: false,
          });
        }
      }
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.votes - a.votes);
    if (candidates[0]) candidates[0].isLeading = true;

    return {
      constituencyId: matchConstituency(title)?.id || null,
      constituencyName: title,
      candidates,
      meta: {
        source: 'ec-nepal',
        sourceLabel: 'Official (EC Nepal)',
        status: candidates.some(c => c.votes > 0) ? 'counting' : 'pending',
      },
    };
  } catch (err) {
    return null;
  }
}

function parseECNTable($, table) {
  const results = [];
  let currentConstituency = null;
  let currentCandidates = [];

  table.find('tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    const headerCell = $row.find('th');

    // Header row = new constituency
    if (headerCell.length > 0 && headerCell.attr('colspan')) {
      if (currentConstituency && currentCandidates.length > 0) {
        currentCandidates.sort((a, b) => b.votes - a.votes);
        if (currentCandidates[0]) currentCandidates[0].isLeading = true;
        results.push({
          constituencyId: matchConstituency(currentConstituency)?.id || null,
          constituencyName: currentConstituency,
          candidates: currentCandidates,
          meta: { source: 'ec-nepal', sourceLabel: 'Official (EC Nepal)', status: 'counting' },
        });
      }
      currentConstituency = headerCell.text().trim();
      currentCandidates = [];
    } else if (cells.length >= 3) {
      const name = $(cells[0]).text().trim();
      const party = $(cells[1]).text().trim();
      const votes = parseInt($(cells[2]).text().replace(/[,\s]/g, ''), 10) || 0;
      const matched = matchParty(party);
      if (name && name !== 'Candidate' && name !== 'उम्मेदवार') {
        currentCandidates.push({
          name,
          partyId: matched?.id || 'IND',
          partyName: matched?.name || party || 'Independent',
          partyShortName: matched?.shortName || 'Ind',
          partyColor: matched?.color || '#757575',
          votes,
          isLeading: false,
        });
      }
    }
  });

  // Last constituency
  if (currentConstituency && currentCandidates.length > 0) {
    currentCandidates.sort((a, b) => b.votes - a.votes);
    if (currentCandidates[0]) currentCandidates[0].isLeading = true;
    results.push({
      constituencyId: matchConstituency(currentConstituency)?.id || null,
      constituencyName: currentConstituency,
      candidates: currentCandidates,
      meta: { source: 'ec-nepal', sourceLabel: 'Official (EC Nepal)', status: 'counting' },
    });
  }

  return results;
}

module.exports = { scrapeECN };
