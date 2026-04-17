/**
 * RaceCor iRacing Sync — Content Script
 *
 * Runs on members-ng.iracing.com. Listens for messages from the popup
 * and scrapes the current page for:
 *   1. iRating history (from the SVG chart)
 *   2. Career stats (from DOM tables)
 *   3. Race results (from the results table)
 *
 * The iRacing member site is fully SSR — switching category tabs does NOT
 * fire network requests. All data is baked into the DOM on page load, so
 * we read it directly from the rendered elements.
 */

// ─── Message handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SCRAPE_STATS') {
    scrapeCurrentPage()
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (msg.type === 'PING') {
    sendResponse({ ok: true, page: location.href });
    return;
  }
});

// ─── Main scraper ───────────────────────────────────────────────────────────

async function scrapeCurrentPage() {
  const result = {
    scrapedAt: new Date().toISOString(),
    url: location.href,
    category: detectActiveCategory(),
    ratingHistory: [],
    careerStats: [],
    recentRaces: [],
  };

  // 1. Rating history from SVG chart
  result.ratingHistory = scrapeRatingChart();

  // 2. Career stats from DOM tables
  result.careerStats = scrapeCareerStats();

  // 3. Race results from the results tab/table
  result.recentRaces = scrapeRaceResults();

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
