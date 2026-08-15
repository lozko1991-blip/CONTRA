/**
 * build.mjs — продакшн-збірка.
 *
 * GitHub Pages обслуговує корінь гілки main, тому index.html
 * у корені — це ЗБІРКА (з assets/). Vite для build потребує
 * вихідний index.html (з посиланням на /src/main.js), який
 * зберігається як index.src.html.
 *
 * Цей скрипт:
 * 1) підміняє index.html на вихідний (index.src.html);
 * 2) запускає vite build;
 * 3) після завершення повертає збірний index.html на місце.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const rootDir = join(root, '..');

const indexSrc = join(rootDir, 'index.src.html');
const indexBuild = join(rootDir, 'index.html');

if (!existsSync(indexSrc)) {
  console.error('[build] index.src.html not found. Restore it from git: git checkout index.src.html');
  process.exit(1);
}

const buildBackup = join(rootDir, '.index.build.html');
const originalSrc = readFileSync(indexSrc, 'utf8');

copyFileSync(indexBuild, buildBackup);
writeFileSync(indexBuild, originalSrc);

console.log('[build] Swapped index.html -> dev source. Running Vite build...');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'build'],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);

// Restore built index.html regardless of result.
if (existsSync(buildBackup)) {
  copyFileSync(buildBackup, indexBuild);
  execSync('node -e "require(\'fs\').unlinkSync(\'' + buildBackup.replace(/\\/g, '/') + '\')"', { stdio: 'ignore' });
}

process.exit(result.status ?? 1);
