/**
 * Публикует public/{INDEXNOW_KEY}.txt для IndexNow (Яндекс).
 * npm run indexnow:setup — создать ключ в .env
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const root = process.cwd();
const envPath = join(root, '.env');
const publicDir = join(root, 'public');
const init = process.argv.includes('--init');

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

let key = (process.env.INDEXNOW_KEY || '').trim();

if (!key && init) {
  key = randomBytes(16).toString('hex');
  const prev = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const line = `INDEXNOW_KEY=${key}\n`;
  const base = prev && !prev.endsWith('\n') ? `${prev}\n` : prev;
  writeFileSync(envPath, base + line, 'utf8');
  console.log(`INDEXNOW_KEY записан в .env`);
}

if (!key) process.exit(0);

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, `${key}.txt`), key, 'utf8');

if (init) {
  console.log(`Файл проверки: https://azoneai.ru/${key}.txt`);
  console.log('После деплоя URL из sitemap отправляются в Яндекс автоматически (npm run deploy).');
}
