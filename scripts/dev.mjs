/**
 * dev.mjs — запуск dev-сервера.
 *
 * GitHub Pages обслуговує корінь гілки main, тому index.html
 * у корені — це ЗБІРКА (з assets/). Для розробки Vite потребує
 * вихідний index.html (з посиланням на /src/main.js), який
 * зберігається як index.src.html.
 *
 * Цей скрипт:
 * 1) підміняє index.html на вихідний (index.src.html);
 * 2) запускає vite dev;
 * 3) після зупинки повертає збірний index.html на місце.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const rootDir = join(root, '..');

const indexSrc = join(rootDir, 'index.src.html');
const indexBuild = join(rootDir, 'index.html');

if (!existsSync(indexSrc)) {
  console.error('[dev] index.src.html not found. Run `npm run build` once to generate it.');
  process.exit(1);
}

const buildBackup = join(rootDir, '.index.build.html');
const originalSrc = readFileSync(indexSrc, 'utf8');

copyFileSync(indexBuild, buildBackup);
writeFileSync(indexBuild, originalSrc);

console.log('[dev] Swapped index.html -> dev source. Starting Vite...');

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite'],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);

const restore = () => {
  if (existsSync(buildBackup)) {
    copyFileSync(buildBackup, indexBuild);
    execSync('node -e "require(\'fs\').unlinkSync(\'' + buildBackup.replace(/\\/g, '/') + '\')"', { stdio: 'ignore' });
  }
};

child.on('exit', restore);
child.on('error', (err) => {
  console.error('[dev] Failed to start Vite:', err);
  restore();
  process.exit(1);
});

process.on('SIGINT', () => {
  child.kill();
  restore();
  process.exit(0);
});
