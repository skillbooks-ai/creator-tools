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

export async function signupAction(options: GlobalOptions & JsonOptions): Promise<void> {
  try {
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
