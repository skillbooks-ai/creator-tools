import path from 'node:path';
import { rm, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist', 'src');

async function buildDirectory(currentSource, currentDist) {
  await mkdir(currentDist, { recursive: true });
  const entries = await readdir(currentSource, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(currentSource, entry.name);
    const distPath = path.join(
      currentDist,
      entry.isFile() && entry.name.endsWith('.ts') ? entry.name.replace(/\.ts$/u, '.js') : entry.name,
    );

    if (entry.isDirectory()) {
      await buildDirectory(sourcePath, distPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      continue;
    }

    const source = await readFile(sourcePath, 'utf8');
    const transformed = stripTypeScriptTypes(source, {
      mode: 'transform',
      sourceUrl: sourcePath,
    });
    await writeFile(distPath, transformed, 'utf8');
  }
}

await rm(path.join(rootDir, 'dist'), { recursive: true, force: true });
await buildDirectory(sourceDir, distDir);
