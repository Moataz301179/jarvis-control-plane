import dns from 'node:dns/promises';
import net from 'node:net';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/srv/jarvis/shared/ms-playwright';

const CHROMIUM_PATHS = [
  process.env.CHROMIUM_PATH,
  '/snap/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);

let browserPromise = null;

function blockedAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return true;
}

export async function assertPublicUrl(value) {
  let url;
  try { url = new URL(String(value)); }
  catch { throw Object.assign(new Error('Enter a complete http or https URL'), { statusCode: 400 }); }
  if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(new Error('Only http and https URLs are supported'), { statusCode: 400 });
  if (url.username || url.password) throw Object.assign(new Error('URLs containing credentials are not allowed'), { statusCode: 400 });
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) throw Object.assign(new Error('Private network URLs are blocked'), { statusCode: 400 });
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => blockedAddress(address))) throw Object.assign(new Error('Private, local and metadata network addresses are blocked'), { statusCode: 400 });
  return url;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright-core');
      let lastError;
      const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-networking'],
      };
      try { return await chromium.launch(launchOptions); }
      catch (error) { lastError = error; }
      for (const executablePath of CHROMIUM_PATHS) {
        try {
          return await chromium.launch({ ...launchOptions, executablePath });
        } catch (error) { lastError = error; }
      }
      browserPromise = null;
      throw new Error(`No usable Chromium runtime found: ${lastError?.message || 'unknown error'}`);
    })();
  }
  return browserPromise;
}

async function newPage() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 JARVIS-Browser/1.0',
    locale: 'en-US',
    javaScriptEnabled: true,
  });
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(30000);
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (/^(data|blob|about):/i.test(requestUrl)) return route.continue();
    try {
      await assertPublicUrl(requestUrl);
      return route.continue();
    } catch { return route.abort('blockedbyclient'); }
  });
  return { context, page };
}

function tidy(value, limit = 24000) {
  return String(value || '').replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, limit);
}

export async function openWebPage({ url, max_chars = 18000 }) {
  const target = await assertPublicUrl(url);
  const { context, page } = await newPage();
  try {
    const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    const finalUrl = page.url();
    await assertPublicUrl(finalUrl);
    const title = tidy(await page.title(), 300);
    const text = tidy(await page.locator('body').innerText({ timeout: 10000 }).catch(() => ''), Math.min(Math.max(Number(max_chars) || 18000, 1000), 30000));
    const links = await page.locator('a[href]').evaluateAll((nodes) => nodes.slice(0, 240).map((node) => ({ text: (node.innerText || node.getAttribute('aria-label') || '').trim().slice(0, 220), href: node.href })).filter((link) => link.text && /^https?:/.test(link.href))).catch(() => []);
    return { url: finalUrl, title, status: response?.status() ?? null, text, links: links.slice(0, 200) };
  } finally {
    await context.close().catch(() => {});
  }
}

export async function searchWeb({ query, max_results = 6 }) {
  const q = tidy(query, 500);
  if (!q) throw Object.assign(new Error('A search query is required'), { statusCode: 400 });
  const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`;
  try {
    const yahooPage = await openWebPage({ url: yahooUrl, max_chars: 30000 });
    const found = [];
    const seen = new Set();
    for (const link of yahooPage.links) {
      if (!/^https?:/.test(link.href) || /search\.yahoo\.com|yahoo\.com\/search|bing\.com\/images/i.test(link.href) || seen.has(link.href)) continue;
      const lines = link.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2 || !/\./.test(lines[0])) continue;
      seen.add(link.href);
      found.push({ title: lines.at(-1).slice(0, 300), url: link.href, snippet: lines.slice(0, -1).join(' · ').slice(0, 600) });
    }
    if (found.length) return { query: q, search_url: yahooUrl, results: found.slice(0, Math.min(Math.max(Number(max_results) || 6, 1), 10)), page_title: yahooPage.title };
  } catch {}
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en`;
  const { context, page } = await newPage();
  try {
    await page.goto(bingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(700);
    const found = await page.locator('li.b_algo').evaluateAll((nodes) => nodes.map((node) => {
      const anchor = node.querySelector('h2 a');
      const snippet = node.querySelector('.b_caption p, .b_snippet');
      return anchor ? { title: (anchor.textContent || '').trim(), url: anchor.href, snippet: (snippet?.textContent || '').trim() } : null;
    }).filter(Boolean));
    if (found.length) return { query: q, search_url: bingUrl, results: found.slice(0, Math.min(Math.max(Number(max_results) || 6, 1), 10)), page_title: await page.title() };
  } finally {
    await context.close().catch(() => {});
  }
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const pageResult = await openWebPage({ url: searchUrl, max_chars: 22000 });
  const lines = pageResult.text.split('\n').map((line) => line.trim()).filter(Boolean);
  const results = [];
  for (let index = 0; index < lines.length && results.length < Math.min(Math.max(Number(max_results) || 6, 1), 10); index += 1) {
    if (/^result\b/i.test(lines[index]) || /Add Image/i.test(lines[index])) continue;
    const link = pageResult.links.find((candidate) => candidate.text && lines[index].includes(candidate.text.slice(0, 80)));
    if (!link) continue;
    let href = link.href;
    try {
      const redirect = new URL(href);
      if (redirect.hostname.endsWith('duckduckgo.com') && redirect.searchParams.get('uddg')) href = redirect.searchParams.get('uddg');
    } catch {}
    if (!/^https?:\/\//.test(href) || results.some((result) => result.url === href)) continue;
    results.push({ title: link.text, url: href, snippet: tidy(lines[index + 1] || '', 400) });
  }
  return { query: q, search_url: searchUrl, results, page_title: pageResult.title };
}

export async function executeBrowserTool(name, input = {}) {
  const started = Date.now();
  try {
    const result = name === 'search_web' ? await searchWeb(input) : name === 'open_web_page' ? await openWebPage(input) : null;
    if (!result) throw new Error(`Unsupported browser tool: ${name}`);
    return { ok: true, tool: name, duration_ms: Date.now() - started, result };
  } catch (error) {
    return { ok: false, tool: name, duration_ms: Date.now() - started, error: error.message };
  }
}

export const browserToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the public web for current information. Use when the owner asks to search, research, verify or find something online.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, max_results: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_web_page',
      description: 'Open a public web page and return its readable text, title, status, links and final URL. Use when a specific URL is supplied or search results need inspection.',
      parameters: { type: 'object', properties: { url: { type: 'string' }, max_chars: { type: 'integer', minimum: 1000, maximum: 30000 } }, required: ['url'] },
    },
  },
];

export async function closeBrowser() {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  const browser = await pending.catch(() => null);
  await browser?.close().catch(() => {});
}
