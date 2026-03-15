import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { validateSemver } from './validate/index.js';
import {
  countLines,
  directoryExists,
  extractBacktickMarkdownPaths,
  extractTagsFromFrontmatter,
  fileExists,
  listMarkdownFiles,
  listSkillbookSections,
  parseSkillbookFrontmatter,
  readJsonFile,
} from './skillbook.js';

export interface ValidationSection {
  title: string;
  lines: string[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  targetPath: string;
  absolutePath: string;
  sections: ValidationSection[];
}

function ok(lines: string[], message: string): void {
  lines.push(`  ✅ ${message}`);
}

function error(result: ValidationResult, lines: string[], message: string): void {
  lines.push(`  ❌ ERROR: ${message}`);
  result.errors.push(message);
}

function warn(result: ValidationResult, lines: string[], message: string): void {
  lines.push(`  ⚠️  WARN:  ${message}`);
  result.warnings.push(message);
}

function info(lines: string[], message: string): void {
  lines.push(`  ℹ️  ${message}`);
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return value === undefined || value === null ? '' : String(value);
}

function getNestedString(record: Record<string, unknown>, pathParts: string[]): string {
  let current: unknown = record;
  for (const part of pathParts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return '';
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current === undefined || current === null ? '' : String(current);
}

function syncCheck(
  result: ValidationResult,
  lines: string[],
  label: string,
  packageValue: string,
  skillValue: string,
  level: 'error' | 'warn' = 'error',
): void {
  if (!packageValue || !skillValue) {
    return;
  }

  if (packageValue === skillValue) {
    ok(lines, `sync: ${label} matches`);
    return;
  }

  const message = `sync: ${label} mismatch — package.json='${packageValue}' vs SKILL.md='${skillValue}'`;
  if (level === 'warn') {
    warn(result, lines, message);
  } else {
    error(result, lines, message);
  }
}

export async function validateSkillbook(targetPath: string): Promise<ValidationResult> {
  const absolutePath = path.resolve(process.cwd(), targetPath);
  const result: ValidationResult = {
    errors: [],
    warnings: [],
    targetPath,
    absolutePath,
    sections: [],
  };

  if (!(await directoryExists(absolutePath))) {
    result.errors.push(`Path does not exist or is not a directory: ${absolutePath}`);
    return result;
  }

  const rootLines: string[] = [];
  const skillPath = path.join(absolutePath, 'SKILL.md');
  const readmePath = path.join(absolutePath, 'README.md');
  const packageJsonPath = path.join(absolutePath, 'package.json');
  const legacyBookJsonPath = path.join(absolutePath, 'book.json');

  if (await fileExists(skillPath)) {
    ok(rootLines, 'SKILL.md exists');
  } else {
    error(result, rootLines, 'SKILL.md not found');
  }

  if (await fileExists(readmePath)) {
    ok(rootLines, 'README.md exists');
  } else {
    error(result, rootLines, 'README.md not found (required for catalog listing)');
  }

  if (await fileExists(packageJsonPath)) {
    ok(rootLines, 'package.json exists');
  } else {
    error(result, rootLines, 'package.json not found');
    if (await fileExists(legacyBookJsonPath)) {
      warn(result, rootLines, 'Found book.json — this was replaced by package.json in FORMAT v1.1');
    }
  }

  result.sections.push({ title: '📁 Root files', lines: rootLines });

  let skillContent = '';
  let skillData: Record<string, unknown> = {};
  let skillMetadata: Record<string, unknown> = {};

  const frontmatterLines: string[] = [];
  if (await fileExists(skillPath)) {
    skillContent = await readFile(skillPath, 'utf8');
    const parsed = parseSkillbookFrontmatter(skillContent);
    skillData = parsed.data;
    skillMetadata = (parsed.data.metadata && typeof parsed.data.metadata === 'object' && !Array.isArray(parsed.data.metadata))
      ? parsed.data.metadata as Record<string, unknown>
      : {};

    for (const field of ['name', 'description', 'license']) {
      if (getString(skillData, field)) {
        ok(frontmatterLines, `frontmatter: ${field} (Agent Skills)`);
      } else {
        error(result, frontmatterLines, `frontmatter missing required field: ${field}`);
      }
    }

    for (const field of ['author', 'compatibility']) {
      if (getString(skillData, field)) {
        ok(frontmatterLines, `frontmatter: ${field} (Agent Skills)`);
      } else {
        warn(result, frontmatterLines, `frontmatter missing recommended field: ${field}`);
      }
    }

    if (Object.keys(skillMetadata).length > 0) {
      ok(frontmatterLines, 'frontmatter: metadata block');
      for (const field of ['skillbook-title', 'skillbook-server', 'skillbook-version', 'skillbook-pages', 'skillbook-price']) {
        if (getString(skillMetadata, field)) {
          ok(frontmatterLines, `metadata: ${field}`);
        } else {
          error(result, frontmatterLines, `metadata missing required field: ${field}`);
        }
      }

      if (getString(skillMetadata, 'skillbook-author')) {
        ok(frontmatterLines, 'metadata: skillbook-author');
      } else {
        warn(result, frontmatterLines, 'metadata missing recommended field: skillbook-author');
      }
    } else {
      error(result, frontmatterLines, 'frontmatter missing metadata block (skillbook extension fields)');
    }

    if (/^## License\b/mu.test(parseSkillbookFrontmatter(skillContent).body)) {
      ok(frontmatterLines, '## License section present');
    } else {
      error(result, frontmatterLines, 'SKILL.md missing ## License section');
    }
  }

  result.sections.push({ title: '📋 SKILL.md frontmatter', lines: frontmatterLines });

  let packageJson: Record<string, unknown> = {};
  const packageLines: string[] = [];
  if (await fileExists(packageJsonPath)) {
    try {
      packageJson = await readJsonFile<Record<string, unknown>>(packageJsonPath);
    } catch (fileError) {
      error(result, packageLines, `package.json is not valid JSON: ${(fileError as Error).message}`);
      result.sections.push({ title: '📦 package.json', lines: packageLines });
      return result;
    }

    for (const field of ['name', 'version', 'license']) {
      if (getString(packageJson, field)) {
        ok(packageLines, `package.json: ${field}`);
      } else {
        error(result, packageLines, `package.json missing required field: ${field}`);
      }
    }

    const version = getString(packageJson, 'version');
    if (version) {
      const semverResult = validateSemver(version);
      for (const message of semverResult.errors) {
        error(result, packageLines, `package.json version: ${message}`);
      }
    }

    for (const field of ['description', 'author']) {
      if (getString(packageJson, field)) {
        ok(packageLines, `package.json: ${field}`);
      } else {
        warn(result, packageLines, `package.json missing recommended field: ${field}`);
      }
    }

    if (packageJson.private === true) {
      ok(packageLines, 'package.json: private: true');
    } else {
      warn(result, packageLines, 'package.json should have private: true (prevents accidental npm publish)');
    }

    const skillbookConfig = packageJson.skillbook;
    if (skillbookConfig && typeof skillbookConfig === 'object' && !Array.isArray(skillbookConfig)) {
      ok(packageLines, 'package.json: skillbook config');
      for (const field of ['title', 'server', 'pages', 'price', 'language', 'verified']) {
        if (getNestedString(packageJson, ['skillbook', field])) {
          ok(packageLines, `skillbook.${field}`);
        } else if (typeof (skillbookConfig as Record<string, unknown>)[field] === 'boolean') {
          ok(packageLines, `skillbook.${field}`);
        } else {
          error(result, packageLines, `package.json missing skillbook.${field}`);
        }
      }
    } else {
      error(result, packageLines, 'package.json missing skillbook config block');
    }

    if (skillContent) {
      syncCheck(result, packageLines, 'name', getString(packageJson, 'name'), getString(skillData, 'name'));
      syncCheck(result, packageLines, 'version', getString(packageJson, 'version'), getString(skillMetadata, 'skillbook-version'));
      syncCheck(result, packageLines, 'description', getString(packageJson, 'description'), getString(skillData, 'description'), 'warn');
      syncCheck(result, packageLines, 'author', getString(packageJson, 'author'), getString(skillData, 'author'), 'warn');
      syncCheck(result, packageLines, 'license', getString(packageJson, 'license'), getString(skillData, 'license'));
      syncCheck(result, packageLines, 'skillbook.title', getNestedString(packageJson, ['skillbook', 'title']), getString(skillMetadata, 'skillbook-title'));
      syncCheck(result, packageLines, 'skillbook.author', getNestedString(packageJson, ['skillbook', 'author']), getString(skillMetadata, 'skillbook-author'), 'warn');
      syncCheck(result, packageLines, 'skillbook.pages', getNestedString(packageJson, ['skillbook', 'pages']), getString(skillMetadata, 'skillbook-pages'));
      syncCheck(result, packageLines, 'skillbook.price', getNestedString(packageJson, ['skillbook', 'price']), getString(skillMetadata, 'skillbook-price'));
      syncCheck(result, packageLines, 'skillbook.server', getNestedString(packageJson, ['skillbook', 'server']), getString(skillMetadata, 'skillbook-server'));
    }

    if (await fileExists(legacyBookJsonPath)) {
      warn(result, packageLines, 'book.json still present — replaced by package.json in FORMAT v1.1. Consider removing.');
    }
  }

  result.sections.push({ title: '📦 package.json', lines: packageLines });

  const structureLines: string[] = [];
  const sections = await listSkillbookSections(absolutePath);
  let contentPageCount = 0;

  for (const section of sections) {
    const overviewPath = path.join(section.absolutePath, '00-overview.md');
    if (await fileExists(overviewPath)) {
      ok(structureLines, `${section.name}/00-overview.md exists`);
    } else {
      error(result, structureLines, `${section.name}/ missing 00-overview.md`);
    }

    const overviewContent = await fileExists(overviewPath) ? await readFile(overviewPath, 'utf8') : '';
    for (const page of section.pages) {
      contentPageCount += 1;
      const pageName = path.basename(page.relativePath);
      if (!/^\d{2}-.+\.md$/u.test(pageName)) {
        error(result, structureLines, `${section.name}/${pageName} — doesn't match NN-name.md pattern`);
      }

      if (page.lineCount < 20) {
        warn(result, structureLines, `${section.name}/${pageName} — only ${page.lineCount} lines (target: 40-100)`);
      } else if (page.lineCount < 40) {
        warn(result, structureLines, `${section.name}/${pageName} — ${page.lineCount} lines (target: 40-100, slightly short)`);
      } else if (page.lineCount > 150) {
        warn(result, structureLines, `${section.name}/${pageName} — ${page.lineCount} lines (target: 40-100, consider splitting)`);
      } else if (page.lineCount > 100) {
        warn(result, structureLines, `${section.name}/${pageName} — ${page.lineCount} lines (target: 40-100, slightly long)`);
      }

      if (pageName !== '00-overview.md' && overviewContent && !overviewContent.includes(pageName)) {
        warn(result, structureLines, `${section.name}/00-overview.md doesn't reference ${pageName}`);
      }
    }

    for (const subsection of section.subsections) {
      const subsectionOverviewPath = path.join(subsection.absolutePath, '00-overview.md');
      if (await fileExists(subsectionOverviewPath)) {
        ok(structureLines, `${section.name}/${subsection.name}/00-overview.md exists`);
      } else {
        error(result, structureLines, `${section.name}/${subsection.name}/ missing 00-overview.md`);
      }

      contentPageCount += subsection.pages.length;
    }
  }

  info(structureLines, `Found ${sections.length} sections, ${contentPageCount} content pages`);
  result.sections.push({ title: '📂 Section structure', lines: structureLines });

  const tocLines: string[] = [];
  if (skillContent) {
    const tocPaths = extractBacktickMarkdownPaths(skillContent);
    let brokenCount = 0;
    for (const tocPath of tocPaths) {
      if (!(await fileExists(path.join(absolutePath, tocPath)))) {
        error(result, tocLines, `TOC references ${tocPath} — file not found`);
        brokenCount += 1;
      }
    }

    if (brokenCount === 0 && tocPaths.length > 0) {
      ok(tocLines, `All ${tocPaths.length} TOC paths resolve`);
    }

    for (const section of sections) {
      for (const page of section.pages) {
        if (!tocPaths.includes(page.relativePath)) {
          warn(result, tocLines, `${page.relativePath} exists but is not in the SKILL.md TOC (orphan page)`);
        }
      }
    }
  }
  result.sections.push({ title: '🔗 TOC link validation', lines: tocLines });

  const tagLines: string[] = [];
  const markdownFiles = await listMarkdownFiles(absolutePath);
  let hasTags = false;
  for (const relativePath of markdownFiles) {
    const content = await readFile(path.join(absolutePath, relativePath), 'utf8');
    if (extractTagsFromFrontmatter(content).length > 0) {
      hasTags = true;
      break;
    }
  }

  if (hasTags) {
    if (await fileExists(path.join(absolutePath, 'TAG-INDEX.json'))) {
      ok(tagLines, 'TAG-INDEX.json exists (pages have tags)');
    } else {
      error(result, tagLines, `Pages have tags in frontmatter but TAG-INDEX.json is missing. Run: skillbooks index ${targetPath}`);
    }

    if (getString(skillMetadata, 'skillbook-tags').toLowerCase() === 'true') {
      ok(tagLines, 'SKILL.md metadata: skillbook-tags: true');
    } else {
      warn(result, tagLines, 'Pages have tags but SKILL.md metadata doesn\'t have skillbook-tags: "true"');
    }
  } else {
    info(tagLines, 'No tags found in page frontmatter');
    if (await fileExists(path.join(absolutePath, 'TAG-INDEX.json'))) {
      warn(result, tagLines, 'TAG-INDEX.json exists but no pages have tags');
    }
  }

  result.sections.push({ title: '🏷️  Tags', lines: tagLines });
  return result;
}
