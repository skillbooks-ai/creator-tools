import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CliError } from './cli.js';

const execFileAsync = promisify(execFile);

export async function apiRequest<T>(
  url: string,
  init: RequestInit = {},
  options: { apiKey?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers ?? {});

  if (options.apiKey) {
    headers.set('Authorization', `Bearer ${options.apiKey}`);
  }

  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    throw new CliError(`Request failed: ${(error as Error).message}`);
  }

  if (!response.ok) {
    throw new CliError(await buildHttpError(response), response.status >= 500 ? 2 : 1);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

async function buildHttpError(response: Response): Promise<string> {
  const fallback = `API request failed: ${response.status} ${response.statusText}`;
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as Record<string, unknown>;
      if (typeof payload.error === 'string') {
        return payload.error;
      }
      if (typeof payload.message === 'string') {
        return payload.message;
      }
    } else {
      const text = (await response.text()).trim();
      if (text) {
        return text;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export async function createTarball(sourceDirectory: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillbook-publish-'));
  const archivePath = path.join(tempDir, `${path.basename(sourceDirectory)}.tar.gz`);

  try {
    await execFileAsync('tar', [
      '-czf',
      archivePath,
      '-C',
      path.dirname(sourceDirectory),
      path.basename(sourceDirectory),
    ]);
  } catch (error) {
    throw new CliError(`Failed to package skillbook: ${(error as Error).message}`);
  }

  return archivePath;
}
