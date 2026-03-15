import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { displayNameFromSlug, writeTextFile } from '../lib/skillbook.js';

interface InitAnswers {
  slug: string;
  title: string;
  description: string;
  publisher: string;
  contentAuthor: string;
  contact: string;
  license: string;
  language: string;
  price: string;
  sections: string[];
  generateTagIndex: boolean;
}

async function ask(question: string, fallback = ''): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const suffix = fallback ? ` (${fallback})` : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

function normalizeSectionName(value: string, index: number): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  const slug = cleaned || `section-${index + 1}`;
  return /^\d{2}-/u.test(slug) ? slug : `${String(index + 1).padStart(2, '0')}-${slug}`;
}

async function collectAnswers(): Promise<InitAnswers> {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  📚 Skillbook Init');
  console.log('═══════════════════════════════════════════');
  console.log('');

  const slug = await ask('  Book slug (lowercase, hyphens, e.g. art-of-war)');
  if (!slug) {
    throw new Error('Slug is required.');
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/u.test(slug)) {
    throw new Error('Slug must be lowercase alphanumeric with hyphens (e.g. my-book).');
  }

  const title = await ask('  Title (human-readable)', displayNameFromSlug(slug));
  const description = await ask('  One-line description', `A skillbook about ${title}.`);
  const publisher = await ask('  Publisher (your name/handle)', 'anonymous');
  const contentAuthor = await ask('  Content author (press Enter if same as publisher)', publisher);
  const contact = await ask('  Contact email or URL (optional)');
  const license = await ask('  License', 'all-rights-reserved');
  const language = await ask('  Language code', 'en');
  const price = await ask('  Suggested price', '$5.00');
  const sectionsAnswer = await ask('  Sections (comma-separated)', 'foundations');
  const generateTagIndexAnswer = await ask('  Generate empty TAG-INDEX.json? (y/N)', 'N');

  return {
    slug,
    title,
    description,
    publisher,
    contentAuthor,
    contact,
    license,
    language,
    price,
    sections: sectionsAnswer.split(',').map((value, index) => normalizeSectionName(value, index)),
    generateTagIndex: /^y(es)?$/iu.test(generateTagIndexAnswer),
  };
}

export async function initAction(targetPath = '.'): Promise<void> {
  try {
    const answers = await collectAnswers();
    const bookDir = path.resolve(process.cwd(), targetPath, answers.slug);
    const today = new Date().toISOString().slice(0, 10);

    await mkdir(bookDir, { recursive: true });
    await mkdir(path.join(bookDir, 'sources'), { recursive: true });

    for (const section of answers.sections) {
      await mkdir(path.join(bookDir, section), { recursive: true });
    }

    const metadataLines = [
      'metadata:',
      `  skillbook-title: "${answers.title}"`,
      `  skillbook-author: "${answers.contentAuthor}"`,
      '  skillbook-server: "https://skillbooks.ai"',
      '  skillbook-version: "1.0.0"',
      '  skillbook-pages: "0"',
      `  skillbook-price: "${answers.price}"`,
      `  skillbook-language: "${answers.language}"`,
      '  skillbook-verified: "false"',
    ];

    if (answers.contact) {
      metadataLines.push(`  skillbook-contact: "${answers.contact}"`);
    }

    const skillContent = `---
name: ${answers.slug}
description: >-
  ${answers.description}
author: ${answers.publisher}
license: "${answers.license}"
compatibility: "Requires HTTPS access to https://skillbooks.ai"
${metadataLines.join('\n')}
---

# ${answers.title}

${answers.description}

## How to Use This Skillbook

1. Browse the table of contents below.
2. Load the pages that match your task.
3. Keep the book metadata in sync with package.json.

## Quick Start

<!-- Add your best entry points here. -->

## Table of Contents

<!-- Run: skillbooks index . -->

## License

${answers.license}
`;

    const readmeContent = `# ${answers.title}

${answers.description}

## What's Inside

<!-- List the key topics and sections. -->

## At a Glance

- Pages: 0
- Sections: ${answers.sections.length}
- License: ${answers.license}
- Author: ${answers.contentAuthor}
- Sources: See \`sources/SOURCES.md\`
- Last Updated: ${today}
`;

    const packageContent = `${JSON.stringify({
      name: answers.slug,
      version: '1.0.0',
      description: answers.description,
      author: answers.publisher,
      license: answers.license,
      private: true,
      devDependencies: {
        '@skillbooks/cli': '^2.0.0',
      },
      scripts: {
        validate: 'skillbooks validate .',
        index: 'skillbooks index .',
      },
      skillbook: {
        title: answers.title,
        author: answers.contentAuthor,
        ...(answers.contact ? { contact: answers.contact } : {}),
        server: 'https://skillbooks.ai',
        pages: '0',
        price: answers.price,
        language: answers.language,
        verified: false,
      },
    }, null, 2)}
`;

    const sourcesContent = `# Sources

| File | Source | Date Accessed | License |
|------|--------|---------------|---------|
| <!-- example.pdf --> | <!-- Where it came from --> | <!-- ${today} --> | <!-- Public Domain --> |
`;

    const gitignoreContent = `_build/
.verify/
node_modules/
.env*
.DS_Store
*.log
`;

    const envContent = `SKILLBOOKS_API_KEY=
# SKILLBOOKS_API=https://api.skillbooks.ai
`;

    await writeTextFile(path.join(bookDir, 'SKILL.md'), skillContent);
    await writeTextFile(path.join(bookDir, 'README.md'), readmeContent);
    await writeTextFile(path.join(bookDir, 'package.json'), packageContent);
    await writeTextFile(path.join(bookDir, 'sources', 'SOURCES.md'), sourcesContent);
    await writeTextFile(path.join(bookDir, '.gitignore'), gitignoreContent);
    await writeTextFile(path.join(bookDir, '.env.local'), envContent);

    for (const section of answers.sections) {
      const title = displayNameFromSlug(section.replace(/^\d{2}-/u, ''));
      const overviewContent = `# ${title}

<!-- What does this section cover? -->

## When to Read This Section

- ...

## Pages in This Section

- \`00-overview.md\` — This overview
`;
      await writeTextFile(path.join(bookDir, section, '00-overview.md'), overviewContent);
    }

    if (answers.generateTagIndex) {
      await writeFile(path.join(bookDir, 'TAG-INDEX.json'), '{}\n', 'utf8');
    }

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log(`  ✅ Skillbook initialized: ${bookDir}`);
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('  Next steps:');
    console.log('');
    console.log(`  1. Add source material under ${path.join(bookDir, 'sources')}/`);
    console.log('  2. Draft your content pages');
    console.log(`  3. Run: skillbooks index ${bookDir}`);
    console.log(`  4. Run: skillbooks validate ${bookDir}`);
    console.log('');
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  }
}
