import path from 'node:path';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { load as loadYaml } from 'js-yaml';

export const BOOK_SKIP_DIRS = new Set(['.git', '.verify', 'node_modules', 'dist', '_build']);

export interface SkillbookFrontmatter {
  raw: string;
  data: Record<string, unknown>;
  body: string;
}

export interface SkillbookPage {
  relativePath: string;
  absolutePath: string;
  lineCount: number;
  title: string;
  tags: string[];
}

export interface SkillbookSection {
  name: string;
  absolutePath: string;
  pages: SkillbookPage[];
  subsections: SkillbookSection[];
}

export function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

export function displayNameFromSlug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function countLines(content: string): number {
  const normalized = content.replace(/\r\n/gu, '\n');
  const matches = normalized.match(/\n/gu);
  return matches ? matches.length : 0;
}

export function parseSkillbookFrontmatter(content: string): SkillbookFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);
  if (!match) {
    return { raw: '', data: {}, body: content };
  }

  let data: Record<string, unknown> = {};
  try {
    const parsed = loadYaml(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = {};
  }

  return {
    raw: match[1],
    data,
    body: match[2],
  };
}

export async function readFrontmatterFile(filePath: string): Promise<SkillbookFrontmatter> {
  return parseSkillbookFrontmatter(await readFile(filePath, 'utf8'));
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    return (await stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

export function getMarkdownTitle(content: string, fallbackPath: string): string {
  const { body } = parseSkillbookFrontmatter(content);
  for (const line of body.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
  }

  const base = path.basename(fallbackPath, '.md');
  const withoutPrefix = base.replace(/^\d{2}-/u, '');
  return displayNameFromSlug(withoutPrefix || base);
}

export function stripFencedCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/gu, '');
}

export function extractBacktickMarkdownPaths(content: string): string[] {
  const stripped = stripFencedCodeBlocks(content);
  return Array.from(
    stripped.matchAll(/`((?:\d{2}-[^`\n/]+\/)*\d{2}-[^`\n]+\.md)`/gu),
    (match) => match[1],
  );
}

export function extractTagsFromFrontmatter(content: string): string[] {
  const { data } = parseSkillbookFrontmatter(content);
  const tagsValue = data.tags;
  if (Array.isArray(tagsValue)) {
    return tagsValue
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof tagsValue === 'string') {
    return tagsValue
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/gu, '').toLowerCase())
      .filter(Boolean);
  }

  return [];
}

async function loadPage(basePath: string, absolutePath: string): Promise<SkillbookPage> {
  const content = await readFile(absolutePath, 'utf8');
  return {
    relativePath: toPosix(path.relative(basePath, absolutePath)),
    absolutePath,
    lineCount: countLines(content),
    title: getMarkdownTitle(content, absolutePath),
    tags: extractTagsFromFrontmatter(content),
  };
}

async function loadSection(basePath: string, absolutePath: string): Promise<SkillbookSection> {
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const pages = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => loadPage(basePath, path.join(absolutePath, entry.name))),
  );

  const subsections = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && /^\d{2}-/u.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => loadSection(basePath, path.join(absolutePath, entry.name))),
  );

  return {
    name: path.basename(absolutePath),
    absolutePath,
    pages,
    subsections,
  };
}

export async function listSkillbookSections(bookPath: string): Promise<SkillbookSection[]> {
  const entries = await readdir(bookPath, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && /^\d{2}-/u.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => loadSection(bookPath, path.join(bookPath, entry.name))),
  );
}

export async function listMarkdownFiles(bookPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = toPosix(path.relative(bookPath, absolutePath));

      if (entry.isDirectory()) {
        if (BOOK_SKIP_DIRS.has(entry.name) || entry.name === 'sources') {
          continue;
        }
        await walk(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(relativePath);
      }
    }
  }

  await walk(bookPath);
  results.sort((left, right) => left.localeCompare(right));
  return results;
}

export function buildGeneratedToc(sections: SkillbookSection[]): { toc: string; totalPages: number } {
  const lines: string[] = ['## Table of Contents', ''];
  let totalPages = 0;

  for (const section of sections) {
    const display = displayNameFromSlug(section.name.slice(3));
    lines.push(`### ${section.name.slice(0, 2)} — ${display}`);

    for (const page of section.pages) {
      totalPages += 1;
      const description = path.basename(page.relativePath) === '00-overview.md'
        ? 'Section overview and reading guide'
        : page.title;
      lines.push(`- \`${page.relativePath}\` — ${description}`);
    }

    for (const subsection of section.subsections) {
      lines.push('');
      lines.push(`#### ${displayNameFromSlug(subsection.name.slice(3))}`);
      for (const page of subsection.pages) {
        totalPages += 1;
        const description = path.basename(page.relativePath) === '00-overview.md'
          ? 'Overview'
          : page.title;
        lines.push(`- \`${page.relativePath}\` — ${description}`);
      }
    }

    lines.push('');
  }

  return { toc: lines.join('\n').replace(/\n{3,}/gu, '\n\n').trimEnd(), totalPages };
}

export function updateSkillbookToc(content: string, toc: string): string | null {
  const tocPattern = /## Table of Contents\r?\n[\s\S]*?(?=\r?\n## (?!Table of Contents)|$)/u;
  if (!tocPattern.test(content)) {
    return null;
  }

  return content.replace(tocPattern, toc);
}

export function updateFrontmatterValue(
  content: string,
  keyPath: string[],
  value: string,
): string {
  const parsed = parseSkillbookFrontmatter(content);
  if (!parsed.raw) {
    return content;
  }

  const lines = parsed.raw.split(/\r?\n/u);
  const lastKey = keyPath[keyPath.length - 1];
  const keyIndent = '  '.repeat(Math.max(0, keyPath.length - 1));
  const targetPattern = new RegExp(`^${keyIndent}${lastKey}:`, 'u');
  let parentIndex = -1;
  let targetIndex = -1;

  if (keyPath.length > 1) {
    const parentIndent = '  '.repeat(keyPath.length - 2);
    const parentPattern = new RegExp(`^${parentIndent}${keyPath[keyPath.length - 2]}:\\s*$`, 'u');
    parentIndex = lines.findIndex((line) => parentPattern.test(line));
  }

  const searchStart = parentIndex >= 0 ? parentIndex + 1 : 0;
  for (let index = searchStart; index < lines.length; index += 1) {
    const line = lines[index];
    if (keyPath.length > 1 && line.trim() && !line.startsWith(keyIndent) && !line.startsWith(`${keyIndent} `)) {
      if (!line.startsWith(' '.repeat(keyIndent.length + 1))) {
        break;
      }
    }
    if (targetPattern.test(line)) {
      targetIndex = index;
      break;
    }
  }

  if (targetIndex >= 0) {
    lines[targetIndex] = `${keyIndent}${lastKey}: "${value}"`;
    return `---\n${lines.join('\n')}\n---\n${parsed.body}`;
  }

  if (parentIndex >= 0) {
    lines.splice(parentIndex + 1, 0, `${keyIndent}${lastKey}: "${value}"`);
    return `---\n${lines.join('\n')}\n---\n${parsed.body}`;
  }

  lines.push(`${keyIndent}${lastKey}: "${value}"`);
  return `---\n${lines.join('\n')}\n---\n${parsed.body}`;
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}
