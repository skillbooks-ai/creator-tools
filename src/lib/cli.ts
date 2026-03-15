export const DEFAULT_API_URL = 'https://api.skillbooks.ai';

export interface GlobalOptions {
  apiUrl?: string;
  key?: string;
}

export interface JsonOptions {
  format?: string;
}

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export function resolveApiUrl(options: GlobalOptions): string {
  return options.apiUrl ?? process.env.SKILLBOOKS_API ?? process.env.SKILLBOOK_API ?? DEFAULT_API_URL;
}

export function resolveApiKey(options: GlobalOptions): string {
  const key = options.key ?? process.env.SKILLBOOKS_API_KEY ?? process.env.SKILLBOOK_KEY;
  if (!key) {
    throw new CliError('Missing API key. Pass --key or set SKILLBOOKS_API_KEY.');
  }

  return key;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function formatCredits(credits: number | undefined): string {
  if (typeof credits !== 'number' || Number.isNaN(credits)) {
    return 'n/a';
  }

  return `${credits.toLocaleString()} credits`;
}

export function formatCurrencyUSD(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function isJsonOutput(options: JsonOptions): boolean {
  return options.format === 'json';
}
