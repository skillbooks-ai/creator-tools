import { createInterface } from 'node:readline/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GlobalOptions, JsonOptions } from '../lib/cli.js';
import { isJsonOutput, printJson, resolveApiUrl } from '../lib/cli.js';
import { apiRequest } from '../lib/api.js';

interface AccountResponse {
  email?: string;
  type?: string;
  credits?: number;
  publisher?: boolean;
  [key: string]: unknown;
}

/**
 * Write SKILLBOOKS_API_KEY to the .env file in the current directory.
 * Creates .env if it doesn't exist.
 * If an existing key is present, renames it to SKILLBOOKS_API_KEY_<datestamp>
 * and puts the new key above it — so the old key is preserved but inactive.
 */
async function writeEnvKey(apiKey: string): Promise<{ envPath: string; previousKey: string | null }> {
  const envPath = join(process.cwd(), '.env');
  let content = '';
  let previousKey: string | null = null;

  try {
    content = await readFile(envPath, 'utf8');
  } catch {
    // File doesn't exist — we'll create it.
  }

  const keyLine = `SKILLBOOKS_API_KEY=${apiKey}`;
  const existingMatch = content.match(/^(SKILLBOOKS_API_KEY\s*=\s*(\S+))$/m);

  if (existingMatch) {
    previousKey = existingMatch[2];
    const datestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    const archivedLine = `SKILLBOOKS_API_KEY_${datestamp}=${previousKey}`;
    // Replace old key line with: new key, then archived old key below it
    content = content.replace(existingMatch[1], `${keyLine}\n${archivedLine}`);
  } else {
    // Append (with newline separator if file has content)
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    content = content + separator + keyLine + '\n';
  }

  await writeFile(envPath, content, 'utf8');
  return { envPath, previousKey };
}

export type LoginOptions = GlobalOptions & JsonOptions;

export async function loginAction(options: LoginOptions): Promise<void> {
  try {
    console.log('🔑 Paste your Skillbooks API key:');
    console.log("   (Don't have one? Sign up at https://skillbooks.ai/signup)\n");

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const apiKey = (await rl.question('API key: ')).trim();
    rl.close();

    if (!apiKey) {
      console.error('Error: No API key provided.');
      process.exit(1);
    }

    // Validate the key by calling GET /account
    const apiUrl = resolveApiUrl(options);
    const account = await apiRequest<AccountResponse>(
      new URL('/account', apiUrl).toString(),
      { method: 'GET' },
      { apiKey },
    );

    if (isJsonOutput(options)) {
      printJson({ apiKey, account });
      return;
    }

    const { envPath, previousKey } = await writeEnvKey(apiKey);

    console.log('\n✓ Login successful!');
    if (account.email) console.log(`  Account: ${account.email}`);
    if (account.type) console.log(`  Type: ${account.type}`);
    if (typeof account.credits === 'number') console.log(`  Credits: ${account.credits.toLocaleString()}`);
    if (previousKey) {
      console.log(`⚠ Previous key archived in .env (SKILLBOOKS_API_KEY_<date>)`);
    }
    console.log(`✓ API key saved to ${envPath}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
