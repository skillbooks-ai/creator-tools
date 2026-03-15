import type { GlobalOptions, JsonOptions } from '../lib/cli.js';
import { formatCurrencyUSD, isJsonOutput, printJson, resolveApiUrl } from '../lib/cli.js';
import { apiRequest } from '../lib/api.js';

interface CatalogBook {
  id?: string;
  title?: string;
  author?: string;
  price?: number;
  description?: string;
}

type CatalogResponse = CatalogBook[] | { count?: number; books?: CatalogBook[]; results?: CatalogBook[] };

export async function searchAction(query: string, options: GlobalOptions & JsonOptions): Promise<void> {
  try {
    const apiUrl = resolveApiUrl(options);
    const url = new URL('/catalog', apiUrl);
    url.searchParams.set('q', query);

    const response = await apiRequest<CatalogResponse>(url.toString());
    // Worker returns { count, books: [...] }; fall back to legacy shapes for compat
    const results = Array.isArray(response)
      ? response
      : ((response as { books?: CatalogBook[] }).books ?? (response as { results?: CatalogBook[] }).results ?? []);

    if (isJsonOutput(options)) {
      printJson(results);
      return;
    }

    if (results.length === 0) {
      console.log('No books found.');
      return;
    }

    results.forEach((book, index) => {
      console.log(`${index + 1}. ${book.title ?? 'Untitled'}${book.id ? ` (${book.id})` : ''}`);
      console.log(`   Author:      ${book.author ?? 'Unknown'}`);
      console.log(`   Price:       ${formatCurrencyUSD(book.price)}`);
      console.log(`   Description: ${book.description ?? 'No description available.'}`);
    });
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
