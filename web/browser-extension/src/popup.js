/**
 * RaceCor iRacing Sync — Popup Script
 *
 * On popup open, runs a full auto-sync from ANY iRacing member site page:
 *   1. Check account + verify we're on iRacing
 *   2. Navigate to profile stats → scrape ratings, licenses, career stats
 *   3. Navigate to results-stats → trigger search → capture race history
 *   4. Sync everything to Pro Drive
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
  document.getElementById('step4'),
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

// ─── Navigation helper ─────────────────────────────────────────────────────

/**
 * Navigate the tab to a path on the same iRacing domain.
 * Uses the content script's window.location to preserve session cookies.
 * Falls back to chrome.tabs.update if content script can't navigate.
 */
function navigateTab(tabId, url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Page load timed out'));
    }, 20000);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        // Give content script a moment to inject
        setTimeout(() => resolve(), 800);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    // Extract path from URL and use content script to navigate
    // (preserves iRacing session cookies vs chrome.tabs.update)
    const path = new URL(url).pathname;
    chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE', path }).catch(() => {
      // Content script not available — fall back to direct tab update
      chrome.tabs.update(tabId, { url });
    });
  });
}

/**
 * Wait for the content script to respond to PING.
 * Retries a few times since the script may still be initializing.
 */
async function waitForContentScript(tabId, maxRetries = 6) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (resp?.ok) return resp;
    } catch {
      // Content script not ready yet
    }
    await sleep(500);
  }
  throw new Error('Content script not responding — reload the page and try again');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main flow ──────────────────────────────────────────────────────────────

async function run() {
  let profileData = null;
  let resultsData = null;

  try {
    // ── Step 1: Check we're on iRacing + fetch Pro Drive account ──
    setStep(0, 'active');
    setStatus('Checking page & account…', 'syncing');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('members-ng.iracing.com')) {
      throw new Error('Navigate to any page on members-ng.iracing.com first');
    }
    activeTabId = tab.id;

    // Check Pro Drive account
    const endpoint = endpointInput.value.trim();
    const cookieHeader = await getSessionCookie(endpoint);
    if (!cookieHeader) {
      throw new Error('Not logged into Pro Drive — sign in at prodrive.racecor.io first');
    }
    await fetchAccount();
    setStep(0, 'done');

    // ── Step 2: Navigate to profile stats → scrape ratings & licenses ──
    setStep(1, 'active');
    setStatus('Scraping profile & ratings…', 'syncing');

    const currentUrl = new URL(tab.url);
    const origin = currentUrl.origin;

    // Navigate to profile page (licenses are in sidebar here)
    if (!tab.url.includes('profile')) {
      await navigateTab(activeTabId, `${origin}/web/member-home/profile`);
    }
    await waitForContentScript(activeTabId);

    // Wait for React to render the sidebar
    await sleep(2500);

    // Scrape profile data — retry if license sidebar wasn't found yet
    let profileResp = await chrome.tabs.sendMessage(activeTabId, { type: 'SCRAPE_STATS' });
    if (!profileResp?.ok) {
      throw new Error(profileResp?.error || 'Profile scrape failed');
    }

    if (!profileResp.data?.licenseData?.length) {
      setStatus('Waiting for license data…', 'syncing');
      await sleep(3000);
      const retry = await chrome.tabs.sendMessage(activeTabId, { type: 'SCRAPE_STATS' });
      if (retry?.ok && retry.data?.licenseData?.length) {
        profileResp = retry;
      }
    }

    profileData = profileResp.data;

    // Navigate to the stats tab for the SVG iRating chart + career stats table
    if (!tab.url.includes('tab/stats') && !tab.url.includes('tab=stats')) {
      await navigateTab(activeTabId, `${origin}/web/member-home/profile/tab/stats`);
      await waitForContentScript(activeTabId);
      await sleep(2000);

      const statsResp = await chrome.tabs.sendMessage(activeTabId, { type: 'SCRAPE_STATS' });
      if (statsResp?.ok && statsResp.data) {
        // Merge: chart + career from stats page, keep license data from profile page
        if (statsResp.data.ratingHistory?.length > 0) {
          profileData.ratingHistory = statsResp.data.ratingHistory;
          profileData.category = statsResp.data.category;
        }
        if (statsResp.data.careerStats?.length > 0) {
          profileData.careerStats = statsResp.data.careerStats;
        }
        if (statsResp.data.licenseData?.length > 0 && !profileData.licenseData?.length) {
          profileData.licenseData = statsResp.data.licenseData;
        }
      }
    }
    setStep(1, 'done');

    // ── Step 3: Navigate to results-stats → capture race history ──
    // This step is non-fatal — profile data is the priority.
    setStep(2, 'active');
    setStatus('Capturing race history…', 'syncing');

    try {
      await navigateTab(activeTabId, `${origin}/web/racing/results-stats/results`);
      await waitForContentScript(activeTabId);

      // Wait for the results page to fully render its search form
      await sleep(3000);

      // Tell the content script to trigger the search
      const searchResp = await chrome.tabs.sendMessage(activeTabId, { type: 'TRIGGER_SEARCH' });

      if (searchResp?.ok && searchResp.alreadyCaptured) {
        // Data was already captured from a previous page load
        const scrape = await chrome.tabs.sendMessage(activeTabId, { type: 'SCRAPE_STATS' });
        if (scrape?.ok && scrape.data?.fullResults) {
          resultsData = scrape.data.fullResults;
        }
      } else if (searchResp?.ok) {
        // Wait for S3 data to be captured by the fetch interceptor
        setStatus('Waiting for results data…', 'syncing');
        resultsData = await waitForResultsData(activeTabId, 20000);
      }
    } catch (err) {
      console.log('[RaceCor] Results capture failed (non-fatal):', err.message);
    }
    setStep(2, resultsData ? 'done' : 'done');

    // ── Step 4: Sync everything to Pro Drive ──
    setStep(3, 'active');
    setStatus('Syncing to Pro Drive…', 'syncing');

    const syncResult = await syncAllData(profileData, resultsData, endpoint, cookieHeader);
    setStep(3, 'done');

    // Show success
    setStatus(syncResult.message, 'success');
    showResults(profileData, resultsData, syncResult);

  } catch (err) {
    const activeIdx = steps.findIndex(s => s.classList.contains('active'));
    if (activeIdx >= 0) setStep(activeIdx, 'error');

    setStatus(err.message, 'error');
    retryBtn.style.display = 'block';
  }
}

// ─── Wait for S3 results data ──────────────────────────────────────────────

async function waitForResultsData(tabId, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ping = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (ping?.hasResultsData) {
        // Scrape to get the fullResults
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_STATS' });
        if (resp?.ok && resp.data?.fullResults) {
          return resp.data.fullResults;
        }
      }
    } catch {
      // Content script may have reloaded
    }
    await sleep(1000);
  }
  return null; // Timed out — not fatal, we still have profile data
}

// ─── Sync all collected data ───────────────────────────────────────────────

async function syncAllData(profileData, resultsData, endpoint, cookieHeader) {
  const baseUrl = new URL(endpoint).origin;
  const results = { profile: null, races: null };

  // 1. Sync profile data (ratings, licenses, career stats) to extension-sync
  if (profileData) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });
    if (resp.ok) {
      results.profile = await resp.json();
    } else {
      const text = await resp.text();
      throw new Error(`Profile sync failed: ${resp.status}: ${text.substring(0, 200)}`);
    }
  }

  // 2. Sync race results to /api/iracing/upload (handles iRacing's native format)
  if (resultsData && Array.isArray(resultsData) && resultsData.length > 0) {
    const uploadEndpoint = `${baseUrl}/api/iracing/upload`;
    const resp = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      credentials: 'include',
      body: JSON.stringify(resultsData),
    });
    if (resp.ok) {
      results.races = await resp.json();
    }
    // Non-fatal if race upload fails — profile data already synced
  }

  // Build summary message
  const parts = [];
  if (results.profile?.message) parts.push(results.profile.message);
  if (results.races?.imported?.sessions > 0) {
    parts.push(`${results.races.imported.sessions} race results imported`);
  }
  if (parts.length === 0) parts.push('No new data to sync.');

  return {
    message: parts.join(' · '),
    profile: results.profile,
    races: results.races,
  };
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
  } catch {
    // Fall through
  }

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

function showResults(profileData, resultsData, syncResult) {
  resultsDiv.style.display = 'block';
  resultRowsDiv.innerHTML = '';

  const rows = [];

  // Profile sync results
  const pr = syncResult.profile;
  if (pr) {
    if (pr.imported?.ratingHistory > 0) rows.push(['Rating points', `${pr.imported.ratingHistory} new`]);
    if (pr.skipped > 0 && pr.imported?.ratingHistory === 0) rows.push(['Rating points', `${pr.skipped} already synced`]);
    if (pr.imported?.licenses > 0) rows.push(['Licenses', `${pr.imported.licenses} updated`]);
    if (profileData?.category) rows.push(['Category', profileData.category]);
  }

  // Race results sync
  const rr = syncResult.races;
  if (rr) {
    const received = rr.received?.races || 0;
    const imported = rr.imported?.sessions || 0;
    if (received > 0) rows.push(['Results found', `${received}`]);
    if (imported > 0) rows.push(['Races imported', `${imported} new`]);
    if (received > 0 && imported === 0) rows.push(['Race results', 'Already up to date']);
    if (rr.imported?.ratingHistoryFromRaces > 0) rows.push(['iRating history', `${rr.imported.ratingHistoryFromRaces} points`]);
  } else if (resultsData === null) {
    rows.push(['Race history', 'Use JSON import for race history']);
  }

  // Rating date range
  if (profileData?.ratingHistory?.length > 0) {
    const first = profileData.ratingHistory[0];
    const last = profileData.ratingHistory[profileData.ratingHistory.length - 1];
    if (first.date && last.date) {
      rows.push(['Rating span', `${first.date} → ${last.date}`]);
    }
  }

  if (rows.length === 0) {
    rows.push(['Status', 'No new data found']);
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
