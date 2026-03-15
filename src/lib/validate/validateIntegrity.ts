import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { IntegrityValidationResult } from "./types.js";
import {
  MAX_CONTENT_BYTES,
  MAX_FILE_BYTES,
  createResult,
  finalizeResult,
  isDirectory,
  listFiles,
  sha256,
} from "./utils.js";

/**
 * Generates a SHA-256 manifest for book files and validates integrity inputs.
 *
 * @param {string} rootPath
 * @returns {Promise<IntegrityValidationResult>}
 */
export async function validateIntegrity(rootPath: string): Promise<IntegrityValidationResult> {
  const base = createResult();
  const manifest: Record<string, string> = {};

  if (!(await isDirectory(rootPath))) {
    base.errors.push(`Path does not exist or is not a directory: ${rootPath}`);
    return { ...finalizeResult(base), manifest };
  }

  const files = await listFiles(
    rootPath,
    (relativePath) => !relativePath.startsWith(".verify/"),
  );
  let totalBytes = 0;

  for (const file of files) {
    const absolutePath = path.join(rootPath, file);
    const fileStats = await stat(absolutePath);
    totalBytes += fileStats.size;

    if (fileStats.size > MAX_FILE_BYTES) {
      base.errors.push(`File exceeds the maximum allowed size of ${MAX_FILE_BYTES} bytes: ${file}`);
      continue;
    }

    const contents = await readFile(absolutePath);
    manifest[file] = sha256(contents);
  }

  if (Object.keys(manifest).length === 0) {
    base.warnings.push("No files were found to hash.");
  }

  if (totalBytes > MAX_CONTENT_BYTES) {
    base.errors.push(`Book content exceeds the maximum allowed size of ${MAX_CONTENT_BYTES} bytes.`);
  }

  return { ...finalizeResult(base), manifest };
}
