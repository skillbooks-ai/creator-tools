import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GlobalOptions, JsonOptions } from '../lib/cli.js';
import { isJsonOutput, printJson, resolveApiUrl } from '../lib/cli.js';
import { apiRequest } from '../lib/api.js';

interface SignupResponse {
  api_key?: string;  // worker returns snake_case
  apiKey?: string;   // legacy camelCase fallback
  key?: string;      // legacy fallback
}

/**
 * Write or update SKILLBOOKS_API_KEY in the .env file in the current directory.
 * Creates .env if it doesn't exist. Preserves existing content.
 */
async function writeEnvKey(apiKey: string): Promise<string> {
  const envPath = join(process.cwd(), '.env');
  let content = '';

  try {
    content = await readFile(envPath, 'utf8');
  } catch {
    // File doesn't exist — we'll create it.
  }

  const keyLine = `SKILLBOOKS_API_KEY=${apiKey}`;

  if (/^SKILLBOOKS_API_KEY\s*=/m.test(content)) {
    // Replace existing line
    content = content.replace(/^SKILLBOOKS_API_KEY\s*=.*$/m, keyLine);
  } else {
    // Append (with newline separator if file has content)
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    content = content + separator + keyLine + '\n';
  }

  await writeFile(envPath, content, 'utf8');
  return envPath;
}

export interface SignupOptions extends GlobalOptions, JsonOptions {
  force?: boolean;
}

export async function signupAction(options: SignupOptions): Promise<void> {
  try {
    // Check for existing key before hitting the API
    if (!options.force) {
      const envPath = join(process.cwd(), '.env');
      try {
        const existing = await readFile(envPath, 'utf8');
        if (/^SKILLBOOKS_API_KEY\s*=\s*\S+/m.test(existing)) {
          console.error('⚠ SKILLBOOKS_API_KEY already exists in .env');
          console.error('  Use --force to overwrite, or edit .env manually.');
          process.exit(1);
        }
      } catch {
        // No .env yet — safe to proceed.
      }
    }

    const apiUrl = resolveApiUrl(options);

    const response = await apiRequest<SignupResponse>(new URL('/signup', apiUrl).toString(), {
      method: 'POST',
    });

    const apiKey = response.api_key ?? response.apiKey ?? response.key;

    if (isJsonOutput(options)) {
      printJson({ apiKey });
      return;
    }

    if (!apiKey) {
      printJson(response);
      return;
    }

    const envPath = await writeEnvKey(apiKey);

    console.log('✓ Signup successful!');
    console.log(`API key: ${apiKey}`);
    console.log(`✓ Saved to ${envPath}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
