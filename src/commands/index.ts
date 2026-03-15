import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  buildGeneratedToc,
  extractTagsFromFrontmatter,
  listMarkdownFiles,
  listSkillbookSections,
  readJsonFile,
  updateFrontmatterValue,
  updateSkillbookToc,
  writeTextFile,
} from '../lib/skillbook.js';

interface IndexOptions {
  tagsOnly?: boolean;
  tocOnly?: boolean;
  dryRun?: boolean;
}

export async function indexAction(targetPath: string, options: IndexOptions = {}): Promise<void> {
  try {
    const absolutePath = path.resolve(process.cwd(), targetPath);

    console.log('═══════════════════════════════════════════');
    console.log('  Skillbook Indexer v1.1');
    console.log(`  Book: ${targetPath}`);
    console.log('═══════════════════════════════════════════');
    console.log('');

    if (!options.tocOnly) {
      console.log('🏷️  Building TAG-INDEX.json...');
      console.log('');

      const markdownFiles = await listMarkdownFiles(absolutePath);
      const tagIndex = new Map<string, string[]>();
      let taggedFiles = 0;
      let totalTags = 0;

      for (const relativePath of markdownFiles) {
        const tags = extractTagsFromFrontmatter(await readFile(path.join(absolutePath, relativePath), 'utf8'));
        if (tags.length === 0) {
          continue;
        }

        taggedFiles += 1;
        for (const tag of tags) {
          const existing = tagIndex.get(tag) ?? [];
          existing.push(relativePath);
          tagIndex.set(tag, existing);
          totalTags += 1;
        }
      }

      console.log(`  📊 ${taggedFiles} files with tags`);
      console.log(`  🏷️  ${tagIndex.size} unique tags, ${totalTags} total entries`);

      const tagIndexPath = path.join(absolutePath, 'TAG-INDEX.json');
      const tagIndexObject = Object.fromEntries(
        Array.from(tagIndex.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([tag, pages]) => [tag, pages.sort((left, right) => left.localeCompare(right))]),
      );

      if (tagIndex.size === 0) {
        console.log('');
        console.log('  ℹ️  No tags found in page frontmatter.');
      } else if (options.dryRun) {
        console.log('');
        console.log(`  [dry-run] Would write TAG-INDEX.json (${tagIndex.size} tags)`);
      } else {
        await writeTextFile(tagIndexPath, JSON.stringify(tagIndexObject, null, 2));
        console.log('');
        console.log('  ✅ Written TAG-INDEX.json');
      }

      console.log('');
    }

    if (!options.tagsOnly) {
      console.log('📑 Rebuilding SKILL.md Table of Contents...');
      console.log('');

      const skillPath = path.join(absolutePath, 'SKILL.md');
      const skillContent = await readFile(skillPath, 'utf8');
      const sections = await listSkillbookSections(absolutePath);
      const { toc, totalPages } = buildGeneratedToc(sections);
      const updatedSkill = updateSkillbookToc(skillContent, toc);

      if (updatedSkill === null) {
        console.log("  ⚠️  No '## Table of Contents' found in SKILL.md");
        console.log("  ℹ️  Add a '## Table of Contents' section and re-run");
        console.log(`  Generated TOC (${totalPages} pages):`);
        console.log('');
        console.log(toc);
      } else if (options.dryRun) {
        console.log(`  [dry-run] Would update TOC (${totalPages} pages across ${sections.length} sections)`);
      } else {
        let nextSkill = updateFrontmatterValue(updatedSkill, ['metadata', 'skillbook-pages'], String(totalPages));
        await writeTextFile(skillPath, nextSkill);

        const packagePath = path.join(absolutePath, 'package.json');
        try {
          const packageJson = await readJsonFile<Record<string, unknown>>(packagePath);
          const skillbook = packageJson.skillbook;
          if (skillbook && typeof skillbook === 'object' && !Array.isArray(skillbook)) {
            (skillbook as Record<string, unknown>).pages = String(totalPages);
            await writeTextFile(packagePath, JSON.stringify(packageJson, null, 2));
          }
        } catch {
          // Leave package.json untouched if it cannot be parsed.
        }

        console.log(`  ✅ Updated SKILL.md TOC (${totalPages} pages, ${sections.length} sections)`);
        console.log(`  ✅ Updated page count → ${totalPages}`);
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════════');
    console.log('  Done.');
    console.log('═══════════════════════════════════════════');
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  }
}
