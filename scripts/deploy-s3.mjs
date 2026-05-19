import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

/** Подхватывает .env до чтения process.env (без зависимости dotenv). */
function loadDotEnv() {
  const p = join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const DIST = join(process.cwd(), "dist");
const BUCKET = process.env.S3_BUCKET ?? "azoneai.ru";
const ENDPOINT = process.env.S3_ENDPOINT ?? "https://storage.yandexcloud.net";
const PROFILE = process.env.AWS_PROFILE ?? "yc";
const REGION = process.env.AWS_REGION ?? "ru-central1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".map": "application/json",
};

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkFiles(p)));
    else out.push(p);
  }
  return out;
}

function toKey(absPath) {
  return relative(DIST, absPath).split(sep).join("/");
}

function guessContentType(absPath) {
  const lower = absPath.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  return MIME[ext] ?? "application/octet-stream";
}

async function main() {
  try {
    await stat(DIST);
  } catch {
    console.error("Нет папки dist/. Сначала выполните: npm run build");
    process.exit(1);
  }

  const iniProvider = fromIni({ profile: PROFILE });
  const client = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: async () => {
      const id = process.env.AWS_ACCESS_KEY_ID;
      const secret = process.env.AWS_SECRET_ACCESS_KEY;
      if (id && secret) {
        return {
          accessKeyId: id,
          secretAccessKey: secret,
          sessionToken: process.env.AWS_SESSION_TOKEN,
        };
      }
      return iniProvider();
    },
    forcePathStyle: false,
  });

  const absFiles = await walkFiles(DIST);
  const localKeys = new Set(absFiles.map(toKey));

  console.log(`S3: ${BUCKET} (${ENDPOINT}), профиль «${PROFILE}»`);
  console.log(`Загрузка ${localKeys.size} файлов…`);

  let n = 0;
  for (const abs of absFiles) {
    const Key = toKey(abs);
    const Body = await readFile(abs);
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key,
        Body,
        ContentType: guessContentType(abs),
      }),
    );
    n++;
    if (n % 40 === 0 || n === absFiles.length) console.log(`  … ${n}/${absFiles.length}`);
  }

  const remoteKeys = [];
  let token;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: token,
      }),
    );
    for (const o of out.Contents ?? []) {
      if (o.Key) remoteKeys.push(o.Key);
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);

  const toDelete = remoteKeys.filter((k) => !localKeys.has(k));
  if (toDelete.length > 0) {
    console.log(`Удаление объектов, которых нет в dist: ${toDelete.length}`);
    for (let i = 0; i < toDelete.length; i += 1000) {
      const Objects = toDelete.slice(i, i + 1000).map((Key) => ({ Key }));
      await client.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects, Quiet: true },
        }),
      );
    }
  } else {
    console.log("Лишних объектов в бакете нет.");
  }

  console.log("Деплой завершён.");
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.name === "CredentialsProviderError" || /credentials/i.test(String(err.message))) {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    console.error(
      [
        "Нет ключей для S3. Сделайте одно из:",
        `  1) Файл .env в корне проекта: AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY (статический ключ сервисного аккаунта Yandex Cloud);`,
        `  2) Файл ${home ? join(home, ".aws", "credentials") : "%USERPROFILE%\\.aws\\credentials"} с секцией [${PROFILE}] (aws_access_key_id / aws_secret_access_key).`,
        "  3) Экспорт переменных AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY в сессию терминала.",
      ].join("\n"),
    );
  }
  process.exit(1);
});
