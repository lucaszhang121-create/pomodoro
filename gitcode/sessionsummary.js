const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CDP_URL        = 'http://localhost:9222';
const POLL_INTERVAL  = 3000;
const REPORT_FILE    = 'tab-report.json';
const SESSION_LENGTH = 0;

const tabActivity = new Map();
const pageIds     = new WeakMap();
let   idCounter   = 0;

function getId(page) {
  if (!pageIds.has(page)) pageIds.set(page, `tab-${++idCounter}`);
  return pageIds.get(page);
}

function now() {
  return new Date().toISOString();
}

function fmt(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function domainOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function summarizeWithCohere(reportFile) {
  const script = `
import cohere, json, os
from dotenv import load_dotenv
load_dotenv()
co = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))
report = json.load(open("${reportFile}"))
tabs = report["tabs"]
data = "\\n".join(f"- {t['title']} ({t['domain']}, visits: {t['visits']}, closed: {t['closed']})" for t in tabs)
res = co.chat(
    model="command-a-03-2025",
    messages=[{"role": "user", "content": f"Summarize this browser session into a clean, concise paragraph. Mention key sites visited, how many tabs were open vs closed, and overall browsing behavior:\\n{data}"}],
)
print(res.message.content[0].text)
`;
  try {
    const result = execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, {
      cwd: path.resolve(__dirname),
      encoding: 'utf-8',
    });
    console.log('\n══════════════════════════════════════════');
    console.log('  AI SESSION SUMMARY (Cohere)');
    console.log('══════════════════════════════════════════');
    console.log(`  ${result.trim()}`);
    console.log('══════════════════════════════════════════\n');
  } catch (err) {
    console.error('  Cohere summary error:', err.message);
  }
}

async function attachListeners(page) {
  const id = getId(page);

  if (!tabActivity.has(id)) {
    tabActivity.set(id, {
      id,
      url:       page.url(),
      title:     '',
      visits:    0,
      focusTime: 0,
      lastSeen:  null,
      firstSeen: now(),
      closed:    false,
    });
  }

  try {
    const entry = tabActivity.get(id);
    entry.title = await page.title();
    entry.url   = page.url();
  } catch {}

  page.on('load', async () => {
    const entry = tabActivity.get(id);
    if (!entry) return;
    entry.visits++;
    entry.lastSeen = now();
    try {
      entry.title = await page.title();
      entry.url   = page.url();
    } catch {}
    console.log(`  [${id}] navigated -> ${entry.url}`);
  });

  let focusStart = null;

  page.on('domcontentloaded', () => {
    const entry = tabActivity.get(id);
    if (entry) { entry.lastSeen = now(); }
  });

  page.on('framenavigated', () => {
    const entry = tabActivity.get(id);
    if (entry) entry.lastSeen = now();
  });

  page.on('close', () => {
    const entry = tabActivity.get(id);
    if (entry) {
      entry.closed   = true;
      entry.lastSeen = now();
      console.log(`  [${id}] closed - ${entry.url}`);
    }
  });
}

async function pollTabs(browser) {
  const contexts = browser.contexts();
  for (const ctx of contexts) {
    for (const page of ctx.pages()) {
      const id = getId(page);
      if (!tabActivity.has(id)) {
        console.log(`  New tab detected: ${page.url()}`);
        await attachListeners(page);
      }
    }
  }
}

function snapshot() {
  return [...tabActivity.values()].map(e => ({
    id:        e.id,
    domain:    domainOf(e.url),
    url:       e.url,
    title:     e.title || '(no title)',
    visits:    e.visits,
    firstSeen: e.firstSeen,
    lastSeen:  e.lastSeen || e.firstSeen,
    closed:    e.closed,
  }));
}

function printSummary() {
  const tabs = snapshot();
  const open   = tabs.filter(t => !t.closed);
  const closed = tabs.filter(t =>  t.closed);

  console.log('\n══════════════════════════════════════════');
  console.log('  TAB ACTIVITY SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log(`  Open tabs   : ${open.length}`);
  console.log(`  Closed tabs : ${closed.length}`);
  console.log('');

  if (open.length) {
    console.log('  OPEN TABS:');
    open.forEach(t => {
      console.log(`    [${t.id}] ${t.title}`);
      console.log(`           ${t.url}`);
      console.log(`           visits: ${t.visits}  |  first seen: ${t.firstSeen}`);
    });
  }

  if (closed.length) {
    console.log('\n  CLOSED TABS:');
    closed.forEach(t => {
      console.log(`    [${t.id}] ${t.title} — closed at ${t.lastSeen}`);
    });
  }

  const domainMap = {};
  tabs.forEach(t => {
    domainMap[t.domain] = (domainMap[t.domain] || 0) + t.visits;
  });
  const sorted = Object.entries(domainMap).sort((a, b) => b[1] - a[1]);
  if (sorted.length) {
    console.log('\n  MOST VISITED DOMAINS:');
    sorted.slice(0, 10).forEach(([d, v]) => {
      const bar = '█'.repeat(Math.min(v * 2, 20));
      console.log(`    ${bar.padEnd(20)} ${v.toString().padStart(3)} visits  ${d}`);
    });
  }

  console.log('══════════════════════════════════════════\n');
}

function saveReport() {
  const data = {
    generatedAt: now(),
    tabs:        snapshot(),
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(data, null, 2));
  console.log(`\nReport saved to ${path.resolve(REPORT_FILE)}`);
}

(async () => {
  console.log(`\nConnecting to Chrome at ${CDP_URL} ...`);
  console.log('   (Make sure Chrome was launched with --remote-debugging-port=9222)\n');

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (err) {
    console.error('Could not connect to Chrome.');
    console.error('   Start Chrome with: --remote-debugging-port=9222');
    console.error('   Error:', err.message);
    process.exit(1);
  }

  console.log('Connected\n');

  const contexts = browser.contexts();
  let initialCount = 0;
  for (const ctx of contexts) {
    for (const page of ctx.pages()) {
      await attachListeners(page);
      initialCount++;
    }
  }
  console.log(`Found ${initialCount} existing tab(s). Monitoring...\n`);

  const poller = setInterval(() => {
    pollTabs(browser);
  }, POLL_INTERVAL);

  async function shutdown() {
    clearInterval(poller);
    printSummary();
    saveReport();
    summarizeWithCohere(REPORT_FILE);
    await browser.close();
    process.exit(0);
  }

  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);

  if (SESSION_LENGTH > 0) {
    console.log(`Will auto-save after ${fmt(SESSION_LENGTH)}. Press Ctrl+C to stop early.\n`);
    setTimeout(shutdown, SESSION_LENGTH);
  } else {
    console.log('Running until Ctrl+C...\n');
  }
})();
