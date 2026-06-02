/**
 * Собирает contact-function.zip для загрузки в Yandex Cloud Functions.
 * Запуск: node scripts/package-contact-function.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'cloud-function-email');
const out = join(process.cwd(), 'contact-function.zip');

if (!existsSync(dir)) {
  console.error('Папка cloud-function-email не найдена');
  process.exit(1);
}

const isWin = process.platform === 'win32';
if (isWin) {
  execSync(
    `powershell -NoProfile -Command "Set-Location '${dir}'; Compress-Archive -Path index.js,package.json,node_modules -DestinationPath '${out}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`cd "${dir}" && zip -r "${out}" index.js package.json node_modules -x "node_modules/.cache/*"`, {
    stdio: 'inherit',
  });
}

console.log('Готово:', out);
