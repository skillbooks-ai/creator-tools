import { validateSkillbook } from '../lib/validation.js';

export async function validateAction(targetPath: string): Promise<void> {
  try {
    const result = await validateSkillbook(targetPath);

    console.log('═══════════════════════════════════════════');
    console.log('  Skillbook Validator v1.1');
    console.log(`  Book: ${result.absolutePath}`);
    console.log('═══════════════════════════════════════════');
    console.log('');

    for (const section of result.sections) {
      console.log(section.title);
      for (const line of section.lines) {
        console.log(line);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════');
    if (result.errors.length > 0) {
      console.log(`  ❌ ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
      console.log('  Fix errors before publishing.');
      console.log('═══════════════════════════════════════════');
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.log(`  ⚠️  ${result.warnings.length} warning(s), 0 errors`);
      console.log('  Book is publishable, but consider fixing warnings.');
      console.log('═══════════════════════════════════════════');
      process.exit(2);
    } else {
      console.log('  ✅ All checks passed!');
      console.log('═══════════════════════════════════════════');
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
