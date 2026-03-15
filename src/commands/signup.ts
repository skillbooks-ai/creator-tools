import type { GlobalOptions, JsonOptions } from '../lib/cli.js';
import { isJsonOutput, printJson, resolveApiUrl } from '../lib/cli.js';
import { apiRequest } from '../lib/api.js';

interface SignupResponse {
  api_key?: string;  // worker returns snake_case
  apiKey?: string;   // legacy camelCase fallback
  key?: string;      // legacy fallback
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

    console.log('✓ Signup successful!');
    console.log(`API key: ${apiKey}`);
    console.log('⚠ Save this key now — Skillbooks cannot recover it later.');
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
