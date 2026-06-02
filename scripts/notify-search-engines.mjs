/**
 * После деплоя уведомляет Яндекс (IndexNow) о новых/изменённых URL из sitemap.
 * Запуск: npm run notify:index (или автоматически в npm run deploy)
 *
 * .env: INDEXNOW_KEY, SITE_URL (по умолчанию https://azoneai.ru)
 * NOTIFY_INDEXNOW=all — отправить все URL из sitemap, не только новые
 * INDEXNOW_GLOBAL=1 — дополнительно api.indexnow.org (Bing, не Яндекс)
 *
 * Переобход роботом Яндекса: POST на https://yandex.com/indexnow (всегда при деплое).
 * api.indexnow.org к Яндексу не относится — это хаб Bing/Microsoft.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const distDir = join(root, 'dist');
const cachePath = join(root, '.sitemap-notify-cache.json');
const envPath = join(root, '.env');

function loadDotEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv();

const siteUrl = (process.env.SITE_URL || 'https://azoneai.ru').replace(/\/$/, '');
const host = new URL(siteUrl).host;
const indexNowKey = (process.env.INDEXNOW_KEY || '').trim();
const notifyAll = process.env.NOTIFY_INDEXNOW === 'all';
const notifyGlobal = process.env.INDEXNOW_GLOBAL === '1';
const keyLocation = `${siteUrl}/${indexNowKey}.txt`;

if (!indexNowKey) {
  console.log('IndexNow: пропуск — задайте INDEXNOW_KEY в .env (npm run indexnow:setup)');
  process.exit(0);
}

function parseSitemapUrls() {
  const files = ['sitemap-0.xml', 'sitemap-index.xml'];
  const urls = new Set();
  for (const name of files) {
    const path = join(distDir, name);
    if (!existsSync(path)) continue;
    const xml = readFileSync(path, 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const loc = m[1].trim();
      if (loc.startsWith('http') && !loc.endsWith('.xml')) urls.add(loc);
    }
  }
  return [...urls];
}

function astroFileToUrl(file) {
  const norm = file.replace(/\\/g, '/');
  if (!norm.startsWith('src/pages/') || !norm.endsWith('.astro')) return null;
  if (norm.includes('[')) return null;
  let path = norm.slice('src/pages/'.length, -'.astro'.length);
  if (path === 'index') return `${siteUrl}/`;
  if (path.endsWith('/index')) path = path.slice(0, -'/index'.length);
  return `${siteUrl}/${path}/`;
}

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf8',
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function urlsFromGitChanges() {
  const urls = new Set();
  const outputs = [
    runGit('diff --name-only HEAD -- src/pages/'),
    runGit('diff --name-only --cached -- src/pages/'),
    runGit('diff --name-only HEAD~1 HEAD -- src/pages/'),
  ];
  for (const out of outputs) {
    for (const line of out.split('\n')) {
      const u = astroFileToUrl(line.trim());
      if (u) urls.add(u);
    }
  }
  return [...urls];
}

function loadCache() {
  if (!existsSync(cachePath)) return { urls: [] };
  try {
    return JSON.parse(readFileSync(cachePath, 'utf8'));
  } catch {
    return { urls: [] };
  }
}

function saveCache(urls) {
  writeFileSync(
    cachePath,
    JSON.stringify({ urls: [...urls].sort(), updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isKeyFileAvailable() {
  try {
    const res = await fetch(keyLocation, { cache: 'no-store' });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return text === indexNowKey;
  } catch {
    return false;
  }
}

async function waitForKeyFile() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    if (await isKeyFileAvailable()) return true;
    if (attempt < 6) await sleep(5000);
  }

  console.warn(`IndexNow: файл проверки пока недоступен: ${keyLocation}`);
  return false;
}

async function postToEndpoint(endpoint, urlList, body) {
  const label = endpoint.includes('yandex') ? 'Яндекс' : 'Bing (IndexNow)';
  const maxAttempts = endpoint.includes('api.indexnow.org') ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
      });
      if (res.status === 200 || res.status === 202) {
        const hint = endpoint.includes('yandex') ? ' — сигнал на переобход URL' : '';
        console.log(`${label} IndexNow: принято ${urlList.length} URL (HTTP ${res.status})${hint}`);
        return true;
      }

      const text = await res.text();
      const shouldRetry = endpoint.includes('api.indexnow.org') && res.status === 403 && attempt < maxAttempts;
      if (shouldRetry) {
        console.warn(`${label}: HTTP ${res.status} — повтор через 15 сек.`);
        await sleep(15000);
        continue;
      }

      console.warn(`${label}: HTTP ${res.status} — ${text.slice(0, 200)}`);
      return false;
    } catch (err) {
      if (attempt < maxAttempts) {
        console.warn(`${label}: ${err.message} — повтор через 15 сек.`);
        await sleep(15000);
        continue;
      }
      console.warn(`${label}: ${err.message}`);
      return false;
    }
  }

  return false;
}

/** @returns {{ yandexOk: boolean, globalOk: boolean | null }} */
async function postIndexNow(urlList) {
  if (urlList.length === 0) return { yandexOk: true, globalOk: null };
  const body = JSON.stringify({ host, key: indexNowKey, keyLocation, urlList });

  const yandexOk = await postToEndpoint('https://yandex.com/indexnow', urlList, body);
  let globalOk = null;
  if (notifyGlobal) {
    globalOk = await postToEndpoint('https://api.indexnow.org/indexnow', urlList, body);
  }

  return { yandexOk, globalOk };
}

async function main() {
  if (!existsSync(join(distDir, 'sitemap-0.xml'))) {
    console.error('Нет dist/sitemap-0.xml — сначала npm run build');
    process.exit(1);
  }

  const sitemapUrls = parseSitemapUrls();
  const cache = loadCache();
  const cachedSet = new Set(cache.urls || []);
  const gitUrls = urlsFromGitChanges();

  let toNotify;
  if (notifyAll || cachedSet.size === 0) {
    toNotify = [...new Set([...sitemapUrls, ...gitUrls])];
    console.log(`IndexNow: полная отправка (${toNotify.length} URL)`);
  } else {
    const newFromSitemap = sitemapUrls.filter((u) => !cachedSet.has(u));
    toNotify = [...new Set([...newFromSitemap, ...gitUrls])];
    console.log(
      `IndexNow: новых ${newFromSitemap.length}, из git ${gitUrls.length}, всего к отправке ${toNotify.length}`,
    );
  }

  if (toNotify.length === 0) {
    console.log('IndexNow: новых URL нет, уведомление не требуется.');
    saveCache(sitemapUrls);
    return;
  }

  const batchSize = 10000;
  await waitForKeyFile();
  let yandexOk = true;
  let globalOk = notifyGlobal;
  for (let i = 0; i < toNotify.length; i += batchSize) {
    const result = await postIndexNow(toNotify.slice(i, i + batchSize));
    yandexOk = yandexOk && result.yandexOk;
    if (notifyGlobal) globalOk = globalOk && result.globalOk;
  }

  if (!yandexOk) {
    console.warn('IndexNow: Яндекс не принял URL — кэш не обновлён. Повторите npm run notify:index позже.');
    return;
  }

  saveCache(sitemapUrls);
  console.log('Кэш sitemap обновлён:', cachePath);
  console.log(`Яндекс получил IndexNow для ${toNotify.length} URL (endpoint yandex.com/indexnow).`);

  if (notifyGlobal && !globalOk) {
    console.log('Bing (api.indexnow.org): ошибка — на переобход в Яндексе не влияет.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
