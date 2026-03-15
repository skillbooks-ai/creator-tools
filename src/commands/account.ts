import type { GlobalOptions, JsonOptions } from '../lib/cli.js';
import {
  formatCredits,
  isJsonOutput,
  printJson,
  resolveApiKey,
  resolveApiUrl,
} from '../lib/cli.js';
import { apiRequest } from '../lib/api.js';

interface BookStats {
  id: string;
  title?: string;
  total_reads?: number;
  unique_readers?: number;
  revenue_credits?: number;
  pages_served?: number;
}

interface AccountResponse {
  balance?: number;
  credits?: number;
  type?: string;
  plan?: string;
  email?: string | null;
  publisher?: {
    status?: string;
    stripe_connected?: boolean;
    books_published?: number;
    total_earnings?: number;
  };
  stripe_connected?: boolean;
  books_published?: number;
  total_earnings?: number;
  usage?: {
    total_reads?: number;
    pages_served?: number;
  };
  books?: BookStats[];
}

export async function accountAction(options: GlobalOptions & JsonOptions): Promise<void> {
  try {
    const apiKey = resolveApiKey(options);
    const apiUrl = resolveApiUrl(options);
    const response = await apiRequest<AccountResponse>(
      new URL('/account', apiUrl).toString(),
      {},
      { apiKey },
    );

    if (isJsonOutput(options)) {
      printJson(response);
      return;
    }

    const balance = response.balance ?? response.credits ?? 0;
    const accountType = response.type ?? response.plan ?? 'buyer';
    const publisher = response.publisher ?? {};
    const stripeConnected = publisher.stripe_connected ?? response.stripe_connected;
    const booksPublished = publisher.books_published ?? response.books_published;
    const totalEarnings = publisher.total_earnings ?? response.total_earnings;

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  Skillbooks Account');
    console.log('═══════════════════════════════════════════');
    console.log('');
    if (response.email) {
      console.log(`  Email:             ${response.email}`);
    }
    console.log(`  Balance:           ${formatCredits(balance)}`);
    console.log(`  Account type:      ${accountType}`);
    console.log(`  Publisher status:  ${publisher.status ?? (stripeConnected ? 'connected' : 'not connected')}`);
    console.log(`  Stripe connected:  ${stripeConnected ? 'yes' : 'no'}`);
    if (typeof booksPublished === 'number') {
      console.log(`  Books published:   ${booksPublished}`);
    }
    if (typeof totalEarnings === 'number') {
      console.log(`  Total earnings:    ${formatCredits(totalEarnings)}`);
    }
    if (response.usage) {
      if (typeof response.usage.total_reads === 'number') {
        console.log(`  Total reads:       ${response.usage.total_reads.toLocaleString()}`);
      }
      if (typeof response.usage.pages_served === 'number') {
        console.log(`  Pages served:      ${response.usage.pages_served.toLocaleString()}`);
      }
    }

    const books = response.books ?? [];
    if (books.length > 0) {
      console.log('');
      console.log('  Published Books');
      console.log('  ───────────────────────────────────────');
      for (const book of books) {
        const title = book.title ?? book.id;
        const reads = book.total_reads?.toLocaleString() ?? '—';
        const readers = book.unique_readers?.toLocaleString() ?? '—';
        const revenue = typeof book.revenue_credits === 'number'
          ? formatCredits(book.revenue_credits)
          : '—';
        const pages = book.pages_served?.toLocaleString() ?? '—';
        console.log(`  ${title}`);
        console.log(`    reads: ${reads}  |  readers: ${readers}  |  revenue: ${revenue}  |  pages: ${pages}`);
      }
    }

    console.log('');
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  }
}
