#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { accountAction } from './commands/account.js';
import { indexAction } from './commands/index.js';
import { initAction } from './commands/init.js';
import { publishAction } from './commands/publish.js';
import { searchAction } from './commands/search.js';
import { loginAction } from './commands/login.js';
import { validateAction } from './commands/validate.js';
import { CliError, DEFAULT_API_URL } from './lib/cli.js';

function readPackageVersion(): string {
  for (const candidate of ['../package.json', '../../package.json']) {
    try {
      return (JSON.parse(readFileSync(new URL(candidate, import.meta.url), 'utf8')) as { version: string }).version;
    } catch {
      continue;
    }
  }

  return '0.0.0';
}

const program = new Command();

program
  .name('skillbook')
  .description('Skillbooks CLI — publish, search, and manage your AI skillbooks')
  .version(readPackageVersion(), '-V, --version', 'Print the CLI version')
  .option('--api-url <url>', 'Skillbooks API base URL', process.env.SKILLBOOKS_API ?? DEFAULT_API_URL)
  .option('--key <api-key>', 'Skillbooks API key (or set SKILLBOOKS_API_KEY)');

program
  .command('validate')
  .description('Validate a skillbook directory before publishing')
  .argument('[path]', 'Path to the skillbook directory', '.')
  .action(validateAction);

program
  .command('init')
  .description('Interactively scaffold a new skillbook project')
  .argument('[path]', 'Parent directory for the new skillbook', '.')
  .action(initAction);

program
  .command('index')
  .description('Build TAG-INDEX.json and regenerate the SKILL.md table of contents')
  .argument('[path]', 'Path to the skillbook directory', '.')
  .option('--tags-only', 'Only rebuild TAG-INDEX.json')
  .option('--toc-only', 'Only rebuild the SKILL.md table of contents')
  .option('--dry-run', 'Preview changes without writing files')
  .action(indexAction);

program
  .command('publish')
  .description('Validate and publish a skillbook to Skillbooks')
  .argument('[path]', 'Path to the skillbook directory', '.')
  .action(async (targetPath: string, _opts: Record<string, unknown>, command: Command) => {
    await publishAction(targetPath, command.optsWithGlobals());
  });

program
  .command('search')
  .description('Search the Skillbooks catalog')
  .argument('<query>', 'Search query')
  .option('--format <format>', 'Output format: text or json', 'text')
  .action(async (query: string, _opts: Record<string, unknown>, command: Command) => {
    await searchAction(query, command.optsWithGlobals());
  });

program
  .command('login')
  .description('Authenticate the CLI with your Skillbooks API key')
  .option('--format <format>', 'Output format: text or json', 'text')
  .action(async (_opts: Record<string, unknown>, command: Command) => {
    await loginAction(command.optsWithGlobals());
  });

program
  .command('account')
  .description('Show current balance, usage totals, and publisher status')
  .option('--format <format>', 'Output format: text or json', 'text')
  .action(async (_opts: Record<string, unknown>, command: Command) => {
    await accountAction(command.optsWithGlobals());
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    process.exit(error.exitCode);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
