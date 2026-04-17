/**
 * RaceCor iRacing Sync — Content Script
 *
 * Runs on members-ng.iracing.com. Listens for messages from the popup
 * and scrapes the current page for:
 *   1. iRating history (from the SVG chart on the profile/stats page)
 *   2. Career stats (from DOM tables on the profile/stats page)
 *   3. License/SR/iRating (from sidebar badges on the profile page)
 *   4. Full race results (from the results-stats/results page via S3 JSON intercept)
 *
 * The profile stats page is fully SSR — switching category tabs does NOT
 * fire network requests. The results-stats page DOES make a fetch to an
 * S3 pre-signed URL that returns all results as JSON. We intercept that.
 */

// ─── S3 fetch interceptor (for results-stats page) ─────────────────────────
// The results page fetches a pre-signed S3 JSON with all race results.
// We monkey-patch fetch to capture this data before the page processes it.

let capturedResultsData = null;

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

  if (url.includes('scorpio-assets.s3.amazonaws.com') && url.includes('series_search')) {
    try {
      const clone = response.clone();
      const data = await clone.json();
      capturedResultsData = data;
      console.log('[RaceCor] Captured results data:', Array.isArray(data) ? data.length : 'non-array');
    } catch { /* ignore parse errors */ }
  }

  return response;
};

// ─── Message handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SCRAPE_STATS') {
    scrapeCurrentPage()
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (msg.type === 'PING') {
    const pageType = detectPageType();
    sendResponse({ ok: true, page: location.href, pageType, hasResultsData: !!capturedResultsData });
    return;
  }

});

// ─── Main scraper ───────────────────────────────────────────────────────────

function detectPageType() {
  const url = location.href;
  if (url.includes('results-stats/results')) return 'results';
  if (url.includes('profile') && (url.includes('tab=stats') || url.includes('tab/stats'))) return 'profile-stats';
  if (url.includes('profile')) return 'profile';
  return 'unknown';
}

async function scrapeCurrentPage() {
  const pageType = detectPageType();

  const result = {
    scrapedAt: new Date().toISOString(),
    url: location.href,
    pageType,
    category: 'road',
    ratingHistory: [],
    careerStats: [],
    recentRaces: [],
    licenseData: [],
    fullResults: null, // from S3 JSON intercept on results page
  };

  if (pageType === 'results') {
    // ── Results & Stats page ──
    // If we captured S3 data, use it. Otherwise scrape the visible DOM table.
    if (capturedResultsData) {
      result.fullResults = capturedResultsData;
    }
    // Also scrape visible table rows as fallback
    result.recentRaces = scrapeRaceResults();
    // Still grab license sidebar if visible
    result.licenseData = scrapeLicenseSidebar();
  } else {
    // ── Profile stats page ──
    result.category = detectActiveCategory();
    result.ratingHistory = scrapeRatingChart();
    result.careerStats = scrapeCareerStats();
    result.recentRaces = scrapeRaceResults();
    result.licenseData = scrapeLicenseSidebar();
  }

  return result;
}

/**
 * Detect which category tab is currently active on the iRacing stats page.
 * The member site uses Bootstrap-style tabs: grandparent elements are
 * <div class="btn btn-secondary ... active"> containing a <p> with the
 * category name.
 */
function detectActiveCategory() {
  // Primary: look for the .btn.active element containing a category name
  const activeBtn = document.querySelector('.btn.btn-secondary.active');
  if (activeBtn) {
    const text = activeBtn.textContent.trim().toLowerCase();
    return resolveCategoryName(text);
  }

  // Fallback: aria-selected tabs (in case markup changes)
  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
  if (activeTab) {
    return resolveCategoryName(activeTab.textContent.trim().toLowerCase());
  }

  // Last resort: parse URL
  const url = new URL(location.href);
  const tab = url.searchParams.get('category') || url.searchParams.get('tab') || '';
  if (tab) return resolveCategoryName(tab);

  return 'road'; // default
}

function resolveCategoryName(name) {
  const n = name.toLowerCase().trim();
  if (n.includes('formula')) return 'formula';
  if (n.includes('sports car') || n.includes('sports_car')) return 'road';
  if (n.includes('dirt oval') || n.includes('dirt_oval')) return 'dirt_oval';
  if (n.includes('dirt road') || n.includes('dirt_road')) return 'dirt_road';
  if (n.includes('oval')) return 'oval';
  if (n.includes('road')) return 'road';
  return 'road';
}

// ─── SVG chart scraper ──────────────────────────────────────────────────────

/**
 * The iRating chart is a custom SVG (886×320). Data points are <circle r="2.5">
 * elements. Y-axis tick groups contain iRating labels (400, 500, ... 1400 etc).
 * X-axis tick groups contain date labels ("Jan 1, 2025", etc) rotated 45°.
 *
 * We use the axis labels to build a linear pixel→value mapping, then convert
 * each circle's position into an { date, iRating } data point.
 */
function scrapeRatingChart() {
  const chart = findLargeSvg();
  if (!chart) return [];

  const svgRect = chart.getBoundingClientRect();

  // ── Y-axis: iRating labels ──
  const yTicks = extractYAxisTicks(chart, svgRect);
  if (yTicks.length < 2) return [];

  // Linear regression on the Y axis
  const yMapping = buildLinearMapping(
    yTicks.map(t => ({ pixel: t.pixelY, value: t.value }))
  );

  // ── X-axis: date labels ──
  const xTicks = extractXAxisTicks(chart, svgRect);
  let xMapping = null;
  if (xTicks.length >= 2) {
    // Convert date strings to timestamps for interpolation
    const xTicksNumeric = xTicks.map(t => ({
      pixel: t.pixelX,
      value: new Date(t.date).getTime(),
    }));
    xMapping = buildLinearMapping(xTicksNumeric);
  }

  // ── Data points: circles with r=2.5 ──
  const circles = chart.querySelectorAll('circle');
  const points = [];

  for (const c of circles) {
    const r = parseFloat(c.getAttribute('r'));
    if (r !== 2.5) continue;

    const rect = c.getBoundingClientRect();
    const relX = rect.left - svgRect.left + rect.width / 2;
    const relY = rect.top - svgRect.top + rect.height / 2;

    const iRating = Math.round(yMapping.pixelToValue(relY));

    let date = null;
    if (xMapping) {
      const ts = xMapping.pixelToValue(relX);
      date = new Date(ts).toISOString().split('T')[0]; // YYYY-MM-DD
    }

    points.push({ date, iRating });
  }

  return points;
}

function findLargeSvg() {
  const svgs = document.querySelectorAll('svg');
  for (const s of svgs) {
    if (s.getBoundingClientRect().width > 500) return s;
  }
  return null;
}

function extractYAxisTicks(chart, svgRect) {
  const ticks = [];
  const texts = chart.querySelectorAll('text');
  for (const t of texts) {
    const x = parseFloat(t.getAttribute('x') || '0');
    const txt = t.textContent.trim();
    // Left-side Y axis labels have negative x offset
    if (x < 0 && txt && /^\d+$/.test(txt)) {
      const rect = t.getBoundingClientRect();
      const pixelY = rect.top - svgRect.top + rect.height / 2;
      ticks.push({ value: parseInt(txt, 10), pixelY });
    }
  }
  return ticks;
}

function extractXAxisTicks(chart, svgRect) {
  const ticks = [];
  const seen = new Set();
  const texts = chart.querySelectorAll('text');

  for (const t of texts) {
    const transform = t.getAttribute('transform') || '';
    if (!transform.includes('rotate(45)')) continue;
    const txt = t.textContent.trim();
    if (!txt) continue;

    const rect = t.getBoundingClientRect();
    const pixelX = rect.left - svgRect.left;

    // Deduplicate — there may be two identical date label sets
    // (one for iRating chart, one for safety rating chart).
    // Take the first set (lower pixelX values for the same date).
    const key = `${txt}`;
    if (seen.has(key)) continue;
    seen.add(key);

    ticks.push({ date: txt, pixelX });
  }

  return ticks;
}

/**
 * Given an array of { pixel, value } pairs, returns a mapper
 * that interpolates pixel → value using a least-squares linear fit.
 */
function buildLinearMapping(points) {
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    sumX += p.pixel;
    sumY += p.value;
    sumXY += p.pixel * p.value;
    sumXX += p.pixel * p.pixel;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return {
    pixelToValue: px => slope * px + intercept,
  };
}

// ─── Career stats scraper ───────────────────────────────────────────────────

function scrapeCareerStats() {
  // Career stats are in a table with columns like:
  // Category | Starts | Top 5 | Wins | Avg Start | Avg Finish | ...
  const tables = document.querySelectorAll('table');
  const stats = [];

  for (const table of tables) {
    const headers = Array.from(table.querySelectorAll('th')).map(th =>
      th.textContent.trim().toLowerCase()
    );
    // Look for the career stats table (has "category" or "starts" header)
    if (!headers.some(h => h.includes('start') || h.includes('win'))) continue;

    const rows = table.querySelectorAll('tbody tr');
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td')).map(td =>
        td.textContent.trim()
      );
      if (cells.length < 2) continue;

      const entry = {};
      headers.forEach((h, i) => {
        if (i < cells.length) entry[h] = cells[i];
      });
      stats.push(entry);
    }
  }

  return stats;
}

// ─── License sidebar scraper ────────────────────────────────────────────────

/**
 * Scrape the "Licenses" sidebar on the right of the profile page.
 * The sidebar lists each category in tab order:
 *   Oval, Sports Car, Formula, Dirt Oval, Dirt Road
 * Each widget shows: license+SR (e.g. "B 1.76"), iRating (e.g. "iR 459"),
 * or "----" if no iRating exists.
 */
function scrapeLicenseSidebar() {
  const CATEGORY_ORDER = ['oval', 'road', 'formula', 'dirt_oval', 'dirt_road'];

  // Find the leaf element whose text is exactly "Licenses", then take its parent
  const allEls = document.querySelectorAll('*');
  let licensesSection = null;
  for (const el of allEls) {
    if (el.children.length === 0 && el.textContent.trim() === 'Licenses') {
      licensesSection = el.parentElement;
      break;
    }
  }

  if (!licensesSection) {
    console.log('[RaceCor] License sidebar not found in DOM');
    return [];
  }

  // Extract all leaf text nodes in the Licenses section
  const texts = Array.from(licensesSection.querySelectorAll('*'))
    .filter(el => el.children.length === 0 && el.textContent.trim())
    .map(el => el.textContent.trim())
    .filter(t => t !== 'Licenses');

  console.log('[RaceCor] License sidebar texts:', texts);

  // Parse in pairs/triples: each category has "X N.NN" (license+SR)
  // and optionally "iR NNN" (iRating). "----" means no iRating.
  const licenses = [];
  let catIdx = 0;

  for (let i = 0; i < texts.length && catIdx < CATEGORY_ORDER.length; i++) {
    const t = texts[i];
    const licenseMatch = t.match(/^([ABCDPR])\s+(\d+\.\d+)$/);
    if (licenseMatch) {
      const entry = {
        category: CATEGORY_ORDER[catIdx],
        license: licenseMatch[1],
        safetyRating: parseFloat(licenseMatch[2]),
        iRating: 0,
      };

      // Next text might be "iR NNN" or "----"
      const next = texts[i + 1] || '';
      const irMatch = next.match(/^iR\s+(\d+)$/);
      if (irMatch) {
        entry.iRating = parseInt(irMatch[1], 10);
        i++; // consume the iR line
      } else if (next === '----') {
        i++; // consume the ---- line
      }

      licenses.push(entry);
      catIdx++;
    }
  }

  return licenses;
}

// ─── Race results scraper ───────────────────────────────────────────────────

function scrapeRaceResults() {
  // Race results table typically has: Date, Series, Track, Start, Finish,
  // Incidents, iRating change, etc.
  const tables = document.querySelectorAll('table');
  const results = [];

  for (const table of tables) {
    const headers = Array.from(table.querySelectorAll('th')).map(th =>
      th.textContent.trim().toLowerCase()
    );
    // Look for results table (has "finish" or "track" column)
    if (!headers.some(h => h.includes('finish') || h.includes('track'))) continue;

    const rows = table.querySelectorAll('tbody tr');
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td')).map(td =>
        td.textContent.trim()
      );
      if (cells.length < 2) continue;

      const entry = {};
      headers.forEach((h, i) => {
        if (i < cells.length) entry[h] = cells[i];
      });
      results.push(entry);
    }
  }

  return results;
}

