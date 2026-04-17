/**
 * RaceCor iRacing Sync — Popup Script
 *
 * On popup open, scrapes the current iRacing page and syncs to Pro Drive.
 *   - Profile page → licenses, iRating history, career stats
 *   - Results page → full race history from S3 JSON
 *
 * All automatic — no clicks needed. Shows a retry button on failure.
 */

const accountBar = document.getElementById('accountBar');
const accountAvatar = document.getElementById('accountAvatar');
const accountName = document.getElementById('accountName');
const accountDetail = document.getElementById('accountDetail');
const statusText = document.getElementById('statusText');
const retryBtn = document.getElementById('retryBtn');
const resultsDiv = document.getElementById('results');
const resultRowsDiv = document.getElementById('resultRows');
const endpointInput = document.getElementById('endpoint');
const settingsLink = document.getElementById('settingsLink');
const settingsPanel = document.getElementById('settingsPanel');

const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3'),
];

let activeTabId = null;

// ─── Settings toggle ────────────────────────────────────────────────────────

settingsLink.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
  settingsLink.textContent = settingsPanel.classList.contains('open') ? 'Hide settings' : 'Settings';
});

// ─── Init: restore saved endpoint, then run ─────────────────────────────────

(async function init() {
  const stored = await chrome.storage.local.get(['endpoint']);
  if (stored.endpoint) endpointInput.value = stored.endpoint;

  endpointInput.addEventListener('change', () => {
    chrome.storage.local.set({ endpoint: endpointInput.value });
  });

  await run();
})();

retryBtn.addEventListener('click', () => {
  retryBtn.style.display = 'none';
  resultsDiv.style.display = 'none';
  steps.forEach(s => s.className = 'progress-step');
  run();
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main flow ──────────────────────────────────────────────────────────────

async function run() {
  try {
    // Step 1: Check page + fetch account
    setStep(0, 'active');
    setStatus('Checking page & account…', 'syncing');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('members-ng.iracing.com')) {
      throw new Error('Navigate to members-ng.iracing.com first');
    }
    activeTabId = tab.id;

    // Ping content script
    let pingResp;
    try {
      pingResp = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    } catch {
      throw new Error('Content script not loaded — reload the iRacing page and try again');
    }

    const pageType = pingResp?.pageType || 'unknown';

    // Check Pro Drive session
    const endpoint = endpointInput.value.trim();
    const cookieHeader = await getSessionCookie(endpoint);
    if (!cookieHeader) {
      throw new Error('Not logged into Pro Drive — sign in at prodrive.racecor.io first');
    }

    await fetchAccount();
    setStep(0, 'done');

    // Step 2: Scrape current page
    setStep(1, 'active');
    if (pageType === 'results') {
      setStatus('Capturing race results…', 'syncing');
    } else {
      setStatus('Scraping profile data…', 'syncing');
    }

    const scrapeResp = await chrome.tabs.sendMessage(activeTabId, { type: 'SCRAPE_STATS' });
    if (!scrapeResp?.ok) {
      throw new Error(scrapeResp?.error || 'Scrape failed');
    }
    const data = scrapeResp.data;
    setStep(1, 'done');

    // Step 3: Sync to Pro Drive
    setStep(2, 'active');
    setStatus('Syncing to Pro Drive…', 'syncing');

    const baseUrl = new URL(endpoint).origin;
    let result;

    if (pageType === 'results' && data.fullResults) {
      // Results page → send S3 JSON to /api/iracing/upload
      const uploadEndpoint = `${baseUrl}/api/iracing/upload`;
      const resp = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
        credentials: 'include',
        body: JSON.stringify(data.fullResults),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`${resp.status}: ${text.substring(0, 200)}`);
      }
      result = await resp.json();
      result._pageType = 'results';
      result._resultCount = Array.isArray(data.fullResults) ? data.fullResults.length : 0;
    } else {
      // Profile page → send scraped DOM data to extension-sync
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`${resp.status}: ${text.substring(0, 200)}`);
      }
      result = await resp.json();
      result._pageType = 'profile';
    }

    setStep(2, 'done');

    // Show success
    const msg = result.message || 'Synced!';
    setStatus(msg, 'success');
    showResults(data, result);

  } catch (err) {
    const activeIdx = steps.findIndex(s => s.classList.contains('active'));
    if (activeIdx >= 0) setStep(activeIdx, 'error');

    setStatus(err.message, 'error');
    retryBtn.style.display = 'block';
  }
}

// ─── Account fetcher ────────────────────────────────────────────────────────

async function fetchAccount() {
  const endpoint = endpointInput.value.trim();
  const url = new URL(endpoint);
  const sessionUrl = `${url.origin}/api/auth/session`;

  try {
    const cookieHeader = await getSessionCookie(endpoint);
    if (!cookieHeader) {
      accountBar.classList.add('no-account');
      accountName.textContent = 'Not signed in';
      accountDetail.textContent = 'Sign in at prodrive.racecor.io';
      return;
    }

    const resp = await fetch(sessionUrl, {
      headers: { 'Cookie': cookieHeader },
      credentials: 'include',
    });

    if (resp.ok) {
      const session = await resp.json();
      if (session?.user) {
        const user = session.user;
        accountName.textContent = user.name || user.discordUsername || 'Pro Drive Member';
        accountDetail.textContent = user.email || '';
        if (user.image) {
          accountAvatar.src = user.image;
        } else {
          accountAvatar.style.display = 'none';
        }
        return;
      }
    }
  } catch { /* fall through */ }

  accountBar.classList.add('no-account');
  accountName.textContent = 'Not signed in';
  accountDetail.textContent = 'Sign in at prodrive.racecor.io';
}

// ─── Cookie helper ──────────────────────────────────────────────────────────

async function getSessionCookie(endpoint) {
  const url = new URL(endpoint);
  const domain = url.hostname;
  const cookieNames = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];

  for (const name of cookieNames) {
    const cookie = await chrome.cookies.get({ url: url.origin, name });
    if (cookie) return `${cookie.name}=${cookie.value}`;
  }

  const all = await chrome.cookies.getAll({ domain });
  if (all.length > 0) {
    return all.map(c => `${c.name}=${c.value}`).join('; ');
  }

  return null;
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function setStep(idx, state) {
  steps[idx].className = `progress-step ${state}`;
}

function setStatus(msg, type) {
  statusText.textContent = msg;
  statusText.className = `value ${type || ''}`;
}

function showResults(data, result) {
  resultsDiv.style.display = 'block';
  resultRowsDiv.innerHTML = '';

  let rows = [];

  if (result._pageType === 'results') {
    const received = result._resultCount || 0;
    const imported = result.imported?.sessions || 0;
    const skipped = received - imported;
    rows.push(['Results found', `${received}`]);
    rows.push(['Races imported', `${imported} new`]);
    if (skipped > 0) rows.push(['Already synced', `${skipped}`]);
    if (result.imported?.ratingHistoryFromRaces > 0) rows.push(['Rating points', `${result.imported.ratingHistoryFromRaces}`]);
  } else {
    rows.push(['Category', data.category || 'road']);
    if (result.imported?.ratingHistory > 0) rows.push(['Rating points', `${result.imported.ratingHistory} new`]);
    if (result.skipped > 0 && result.imported?.ratingHistory === 0) rows.push(['Rating points', `${result.skipped} already synced`]);
    if (result.imported?.licenses > 0) rows.push(['Licenses', `${result.imported.licenses} updated`]);
    if (result.imported?.recentRaces > 0) rows.push(['Races', `${result.imported.recentRaces}`]);

    if (data.ratingHistory?.length > 0) {
      const first = data.ratingHistory[0];
      const last = data.ratingHistory[data.ratingHistory.length - 1];
      if (first.date && last.date) rows.push(['Date range', `${first.date} → ${last.date}`]);
    }
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
