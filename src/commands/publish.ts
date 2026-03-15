import fs from 'fs/promises';
import path from 'path';
import type { GlobalOptions } from '../lib/cli.js';
import { printJson, resolveApiKey, resolveApiUrl } from '../lib/cli.js';
import { apiRequest } from '../lib/api.js';
import { validateSkillbook } from '../lib/validation.js';

interface PublishResponse {
  published: boolean;
  name: string;
  version: string;
  pages_count: number;
  url: string;
}

/** Max total payload size: 50MB */
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
/** Max single file size: 5MB */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Skip these directories */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.wrangler']);
/** Only include text file extensions */
const TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt', '.html', '.css', '.js', '.ts']);

/**
 * Recursively read text files in a directory, returning { relativePath: content }.
 * Skips binary files, node_modules, .git, and enforces size limits.
 */
async function readAllFiles(dir: string, base: string = dir): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  let totalBytes = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await readAllFiles(fullPath, base);
      for (const [k, v] of Object.entries(subFiles)) {
        totalBytes += Buffer.byteLength(v);
        if (totalBytes > MAX_TOTAL_BYTES) {
          throw new Error(`Total content exceeds ${MAX_TOTAL_BYTES / 1024 / 1024}MB limit`);
        }
        files[k] = v;
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) continue;

      const stat = await fs.stat(fullPath);
      if (stat.size > MAX_FILE_BYTES) {
        console.warn(`  ⚠ Skipping ${entry.name} (${(stat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_FILE_BYTES / 1024 / 1024}MB limit)`);
        continue;
      }

      const relativePath = path.relative(base, fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      totalBytes += Buffer.byteLength(content);
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new Error(`Total content exceeds ${MAX_TOTAL_BYTES / 1024 / 1024}MB limit`);
      }
      files[relativePath] = content;
    }
  }
  return files;
}

export async function publishAction(targetPath: string, options: GlobalOptions): Promise<void> {
  try {
    const validation = await validateSkillbook(targetPath);

    if (validation.errors.length > 0) {
      console.error('✗ Validation failed:');
      validation.errors.forEach((error) => console.error(`  ✗ ${error}`));
      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => console.warn(`  ⚠ ${warning}`));
      }
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.warn('Warnings:');
      validation.warnings.forEach((warning) => console.warn(`  ⚠ ${warning}`));
    }

    const apiKey = resolveApiKey(options);
    const apiUrl = resolveApiUrl(options);

    // Read package.json for name + version
    const packageJsonPath = path.join(validation.absolutePath, 'package.json');
    let packageJson: { name?: string; version?: string };
    try {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    } catch {
      console.error('✗ Cannot read package.json — required for name and version');
      process.exit(1);
    }

    const name = packageJson.name ?? path.basename(validation.absolutePath);
    const version = packageJson.version ?? '1.0.0';

    console.log(`Publishing ${name}@${version}...`);

    // Read all files into a { path: content } map
    const files = await readAllFiles(validation.absolutePath);
    console.log(`  ${Object.keys(files).length} files`);

    const response = await apiRequest<PublishResponse>(
      new URL('/publish', apiUrl).toString(),
      {
        method: 'POST',
        body: JSON.stringify({ name, version, files }),
      },
      { apiKey },
    );

    if ('json' in options && options.json) {
      printJson(response);
      return;
    }

    console.log(`✓ Published ${response.name}@${response.version}`);
    console.log(`  Pages: ${response.pages_count}`);
    console.log(`  URL:   ${response.url}`);
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  }
}
