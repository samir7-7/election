/**
 * Ekantipur Election Results Scraper (2026 / BS 2082)
 *
 * Scrapes live constituency results from election.ekantipur.com
 * URL pattern: https://election.ekantipur.com/pradesh-{P}/district-{D}/constituency-{N}?lng=eng
 *
 * The scraper fetches individual constituency pages, parses candidate tables,
 * and returns structured results for the store to ingest.
 */

const cheerio = require("cheerio");
const { fetchWithRetry, RateLimiter } = require("./utils");
const { PARTIES, CONSTITUENCIES, PROVINCES } = require("../nepal-data");

const rateLimiter = new RateLimiter(
  parseInt(process.env.MAX_REQUESTS_PER_MINUTE || "60", 10),
  60000,
);

const BASE_URL = "https://election.ekantipur.com";

// Map our district IDs to ekantipur URL slugs
const DISTRICT_URL_MAP = {
  taplejung: "taplejung",
  panchthar: "panchthar",
  ilam: "ilam",
  jhapa: "jhapa",
  morang: "morang",
  sunsari: "sunsari",
  dhankuta: "dhankuta",
  terhathum: "terhathum",
  sankhuwasabha: "sankhuwasabha",
  bhojpur: "bhojpur",
  solukhumbu: "solukhumbu",
  okhaldhunga: "okhaldhunga",
  khotang: "khotang",
  udayapur: "udayapur",
  saptari: "saptari",
  siraha: "siraha",
  dhanusha: "dhanusha",
  mahottari: "mahottari",
  sarlahi: "sarlahi",
  rautahat: "rautahat",
  bara: "bara",
  parsa: "parsa",
  dolakha: "dolakha",
  sindhupalchok: "sindhupalchok",
  rasuwa: "rasuwa",
  nuwakot: "nuwakot",
  dhading: "dhading",
  kathmandu: "kathmandu",
  bhaktapur: "bhaktapur",
  lalitpur: "lalitpur",
  kavrepalanchok: "kavrepalanchok",
  ramechhap: "ramechhap",
  sindhuli: "sindhuli",
  makwanpur: "makwanpur",
  chitwan: "chitwan",
  gorkha: "gorkha",
  lamjung: "lamjung",
  tanahu: "tanahun",
  kaski: "kaski",
  syangja: "syangja",
  parbat: "parbat",
  myagdi: "myagdi",
  baglung: "baglung",
  nawalparasi_east: "nawalparasieast",
  manang: "manang",
  mustang: "mustang",
  nawalparasi_west: "nawalparasiwest",
  rupandehi: "rupandehi",
  kapilvastu: "kapilvastu",
  palpa: "palpa",
  arghakhanchi: "arghakhanchi",
  gulmi: "gulmi",
  dang: "dang",
  banke: "banke",
  bardiya: "bardiya",
  pyuthan: "pyuthan",
  rolpa: "rolpa",
  rukum_east: "rukumeast",
  rukum_west: "rukumwest",
  salyan: "salyan",
  surkhet: "surkhet",
  dailekh: "dailekh",
  jajarkot: "jajarkot",
  dolpa: "dolpa",
  jumla: "jumla",
  kalikot: "kalikot",
  mugu: "mugu",
  humla: "humla",
  bajura: "bajura",
  bajhang: "bajhang",
  darchula: "darchula",
  baitadi: "baitadi",
  dadeldhura: "dadeldhura",
  doti: "doti",
  achham: "achham",
  kailali: "kailali",
  kanchanpur: "kanchanpur",
};

/**
 * Build the ekantipur URL for a constituency
 */
function buildConstituencyUrl(constituency) {
  const districtSlug = DISTRICT_URL_MAP[constituency.districtId];
  if (!districtSlug) return null;
  return `${BASE_URL}/pradesh-${constituency.provinceId}/district-${districtSlug}/constituency-${constituency.number}?lng=eng`;
}

/**
 * Scrape all constituency results from ekantipur.
 * Fetches each constituency page individually with rate limiting.
 * Returns results for all constituencies that have data.
 */
async function scrapeEkantipur() {
  const logRaw = process.env.LOG_RAW_RESPONSES === "true";
  console.log(
    `[Ekantipur] Starting scrape of ${CONSTITUENCIES.length} constituencies`,
  );

  const results = [];
  let fetched = 0;
  let errors = 0;

  for (const constituency of CONSTITUENCIES) {
    const url = buildConstituencyUrl(constituency);
    if (!url) {
      console.warn(
        `[Ekantipur] No URL mapping for district: ${constituency.districtId}`,
      );
      continue;
    }

    await rateLimiter.waitForSlot();

    try {
      const response = await fetchWithRetry(url, {
        maxRetries: 2,
        baseDelay: 1500,
        logRaw,
      });

      if (response && response.data) {
        const result = parseConstituencyPage(response.data, constituency);
        if (result) {
          results.push(result);
        }
        fetched++;
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.warn(
          `[Ekantipur] Error fetching ${constituency.slug}: ${err.message}`,
        );
      }
    }

    // Progress logging every 25 pages
    const total = fetched + errors;
    if (total > 0 && total % 25 === 0) {
      console.log(
        `[Ekantipur] Progress: ${total}/${CONSTITUENCIES.length} pages (${results.length} with data, ${errors} errors)`,
      );
    }
  }

  console.log(
    `[Ekantipur] Scraped ${fetched} pages, got ${results.length} results, ${errors} errors`,
  );

  return {
    success: results.length > 0,
    results,
    timestamp: new Date().toISOString(),
    source: "ekantipur",
  };
}

/**
 * Scrape a single constituency by slug (for targeted updates)
 */
async function scrapeSingleConstituency(slug) {
  const constituency = CONSTITUENCIES.find((c) => c.slug === slug);
  if (!constituency) return null;

  const url = buildConstituencyUrl(constituency);
  if (!url) return null;

  await rateLimiter.waitForSlot();

  const response = await fetchWithRetry(url, {
    maxRetries: 2,
    baseDelay: 1500,
  });
  if (!response || !response.data) return null;

  return parseConstituencyPage(response.data, constituency);
}

/**
 * Parse a single constituency page from election.ekantipur.com
 * The page has a table of candidates with name, party, and votes.
 */
function parseConstituencyPage(html, constituency) {
  const $ = cheerio.load(html);
  const candidates = [];

  // The ekantipur constituency page shows candidates in a table
  // Each row: Candidate Name | Party | Votes + Margin (e.g., "2,960 1,114")
  // We take only the first number as the vote count
  $("table").each((_, table) => {
    $(table)
      .find("tr")
      .each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 3) {
          const name = cleanText($(cells[0]).text());
          const party = cleanText($(cells[1]).text());
          const rawVotesText = cleanText($(cells[2]).text());
          const voteNumbers = rawVotesText.match(/[\d,]+/g);
          const votes =
            voteNumbers && voteNumbers[0]
              ? parseInt(voteNumbers[0].replace(/,/g, ""), 10)
              : 0;

          // Skip header-like rows
          if (!name || name === "Election Candidate" || name === "Candidate")
            return;

          const matchedParty = matchParty(party);
          if (name.length > 1) {
            candidates.push({
              name,
              partyId: matchedParty?.id || "IND",
              partyName: matchedParty?.name || party || "Independent",
              partyShortName: matchedParty?.shortName || "Ind",
              partyColor: matchedParty?.color || "#757575",
              votes,
              isLeading: false,
            });
          }
        }
      });
  });

  // Also try list-based layout (some constituency pages use lists)
  if (candidates.length === 0) {
    $("li, .candidate-row, .candidate").each((_, el) => {
      const text = $(el).text().trim();
      const nameEl = $(el).find("a").first();
      const name = nameEl.length ? cleanText(nameEl.text()) : "";
      if (!name) return;

      // Look for party name in a sub-element or nearby
      const partyEl = $(el).find(".party-name, [class*='party']").first();
      const party = partyEl.length ? cleanText(partyEl.text()) : "";

      // Look for vote count
      const voteMatch = text.match(/([\d,]+)\s*$/);
      const votes = voteMatch
        ? parseInt(voteMatch[1].replace(/,/g, ""), 10)
        : 0;

      if (name.length > 1) {
        const matchedParty = matchParty(party);
        candidates.push({
          name,
          partyId: matchedParty?.id || "IND",
          partyName: matchedParty?.name || party || "Independent",
          partyShortName: matchedParty?.shortName || "Ind",
          partyColor: matchedParty?.color || "#757575",
          votes,
          isLeading: false,
        });
      }
    });
  }

  if (candidates.length === 0) return null;

  // Sort by votes and mark leader
  candidates.sort((a, b) => b.votes - a.votes);
  if (candidates[0] && candidates[0].votes > 0) {
    candidates[0].isLeading = true;
  }

  const hasVotes = candidates.some((c) => c.votes > 0);

  return {
    constituencyId: constituency.id,
    constituencySlug: constituency.slug,
    constituencyName: constituency.name,
    candidates,
    meta: {
      source: "ekantipur",
      sourceLabel: "Provisional (Ekantipur)",
      status: hasVotes ? "counting" : "pending",
    },
  };
}

// ---- Helper functions ----

function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

/**
 * Match a scraped constituency name to our known list
 * Uses fuzzy matching to handle variations
 */
function matchConstituency(scrapedName) {
  if (!scrapedName) return null;
  const normalized = scrapedName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Exact slug match
  for (const c of CONSTITUENCIES) {
    const cNorm = c.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cNorm === normalized) return c;
  }

  // Partial match
  for (const c of CONSTITUENCIES) {
    const cNorm = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized.includes(cNorm) || cNorm.includes(normalized)) return c;
  }

  // District + number match
  const numMatch = scrapedName.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    const nameWithoutNum = scrapedName.replace(/\d+/g, "").trim().toLowerCase();
    for (const c of CONSTITUENCIES) {
      if (
        c.number === num &&
        c.districtName.toLowerCase().includes(nameWithoutNum.split(/[^a-z]/)[0])
      ) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Match a party name string to a known party
 * Handles ekantipur English names and Nepali variations
 */
function matchParty(partyName) {
  if (!partyName) return null;
  const lower = partyName.toLowerCase();

  const aliases = {
    NC: ["nepali congress", "congress", "nc", "n.c."],
    UML: ["cpn-uml", "cpn (uml)", "uml", "unified marxist", "एमाले"],
    NCP: ["nepali communist party", "ncp", "नेपाली कम्युनिष्ट"],
    RSP: [
      "rastriya swatantra",
      "rastirya swatantra",
      "rsp",
      "swatantra",
      "स्वतन्त्र",
    ],
    RPP: ["rastriya prajatantra", "rpp", "prajatantra", "राप्रपा"],
    JSP: ["janata samajbadi", "janata samjbadi", "jsp", "samajbadi", "जसपा"],
    LOSP: ["loktantrik", "lopa", "losp", "lsp"],
    JMMP: ["janamat party", "janamat", "jamapa", "jmmp"],
    NUP: ["nagarik unmukti", "nagrik unmukti", "nup"],
    UNP: ["ujaylo nepal", "ujyalo nepal", "unp"],
    MAOIST: [
      "communist party (maoist",
      "maoist",
      "cpn-mc",
      "cpn (maoist",
      "माओवादी",
    ],
    SSP: ["shram sanskriti", "ssp"],
    RMP: ["rastriya mukti", "rmp", "mukti party"],
    NWPP: ["workers peasants", "nwpp", "majdoor kisan"],
    IND: ["independent", "ind", "स्वतन्त्र उम्मेदवार"],
  };

  for (const [id, names] of Object.entries(aliases)) {
    if (names.some((alias) => lower.includes(alias))) {
      return PARTIES[id];
    }
  }

  return null;
}

module.exports = {
  scrapeEkantipur,
  scrapeSingleConstituency,
  parseConstituencyPage,
  buildConstituencyUrl,
  matchConstituency,
  matchParty,
  DISTRICT_URL_MAP,
};
