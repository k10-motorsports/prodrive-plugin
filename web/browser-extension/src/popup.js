/**
 * RaceCor iRacing Sync — Popup Script
 *
 * Controls the popup UI. Flow:
 *   1. Check if the active tab is on members-ng.iracing.com
 *   2. "Scrape Stats" sends a message to the content script
 *   3. Display scraped data summary
 *   4. "Sync to Pro Drive" POSTs the data to the configured endpoint
 */

const pageStatusEl = document.getElementById('pageStatus');
const scrapeBtn = document.getElementById('scrapeBtn');
const syncBtn = document.getElementById('syncBtn');
const endpointInput = document.getElementById('endpoint');
const resultsDiv = document.getElementById('results');
const resultRowsDiv = document.getElementById('resultRows');

let scrapedData = null;
let activeTabId = null;

// ─── Init ───────────────────────────────────────────────────────────────────

(async function init() {
  // Restore saved endpoint
  const stored = await chrome.storage.local.get(['endpoint']);
  if (stored.endpoint) endpointInput.value = stored.endpoint;

  // Save endpoint on change
  endpointInput.addEventListener('change', () => {
    chrome.storage.local.set({ endpoint: endpointInput.value });
  });

  // Find the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('members-ng.iracing.com')) {
    pageStatusEl.textContent = 'Not on iRacing member site';
    pageStatusEl.classList.add('error');
    return;
  }

  activeTabId = tab.id;

  // Ping the content script to make sure it's loaded
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    if (resp && resp.ok) {
      pageStatusEl.textContent = 'Connected to iRacing page';
      pageStatusEl.classList.add('success');
      scrapeBtn.disabled = false;
    }
  } catch {
    pageStatusEl.textContent = 'Content script not loaded — reload the iRacing page';
    pageStatusEl.classList.add('error');
  }
})();

// ─── Scrape ─────────────────────────────────────────────────────────────────

scrapeBtn.addEventListener('click', async () => {
  scrapeBtn.disabled = true;
  scrapeBtn.innerHTML = '<span class="spinner"></span>Scraping…';

  try {
    const resp = await chrome.tabs.sendMessage(activeTabId, { type: 'SCRAPE_STATS' });

    if (!resp || !resp.ok) {
      throw new Error(resp?.error || 'Unknown scrape error');
    }

    scrapedData = resp.data;
    showResults(scrapedData);
    syncBtn.disabled = false;
  } catch (err) {
    pageStatusEl.textContent = `Scrape failed: ${err.message}`;
    pageStatusEl.classList.add('error');
    pageStatusEl.classList.remove('success');
  } finally {
    scrapeBtn.innerHTML = 'Scrape Stats from This Page';
    scrapeBtn.disabled = false;
  }
});

// ─── Display results ────────────────────────────────────────────────────────

function showResults(data) {
  resultsDiv.style.display = 'block';
  resultRowsDiv.innerHTML = '';

  const rows = [
    ['Category', data.category || 'unknown'],
    ['Rating history points', data.ratingHistory?.length || 0],
    ['Career stat rows', data.careerStats?.length || 0],
    ['Recent race results', data.recentRaces?.length || 0],
  ];

  if (data.ratingHistory?.length > 0) {
    const first = data.ratingHistory[0];
    const last = data.ratingHistory[data.ratingHistory.length - 1];
    rows.push(['Date range', `${first.date || '?'} → ${last.date || '?'}`]);
    rows.push(['iRating range', `${last.iRating} → ${first.iRating}`]);
  }

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}</span>
    `;
    resultRowsDiv.appendChild(row);
  }
}

// ─── Sync to Pro Drive ──────────────────────────────────────────────────────

syncBtn.addEventListener('click', async () => {
  if (!scrapedData) return;

  syncBtn.disabled = true;
  syncBtn.innerHTML = '<span class="spinner"></span>Syncing…';

  const endpoint = endpointInput.value.trim();

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(scrapedData),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`${resp.status}: ${text.substring(0, 200)}`);
    }

    const result = await resp.json();
    pageStatusEl.textContent = `Synced! ${result.message || 'Data sent to Pro Drive.'}`;
    pageStatusEl.classList.add('success');
    pageStatusEl.classList.remove('error');
  } catch (err) {
    pageStatusEl.textContent = `Sync failed: ${err.message}`;
    pageStatusEl.classList.add('error');
    pageStatusEl.classList.remove('success');
  } finally {
    syncBtn.innerHTML = 'Sync to Pro Drive';
    syncBtn.disabled = false;
  }
});
