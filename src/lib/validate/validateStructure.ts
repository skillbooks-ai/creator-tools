import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { validateBookJson } from "./validateBookJson.js";
import { validateSkillMd } from "./validateSkillMd.js";
import {
  MAX_CONTENT_BYTES,
  MAX_FILE_BYTES,
  createResult,
  extractReferencedMarkdownPaths,
  finalizeResult,
  isDirectory,
  isFile,
  listFiles,
  parseFrontmatter,
  readText,
} from "./utils.js";
import type { ValidationResult } from "./types.js";

/**
 * Validates the required Skillbooks directory structure and key files.
 *
 * @param {string} rootPath
 * @returns {Promise<ValidationResult>}
 */
export async function validateStructure(rootPath: string): Promise<ValidationResult> {
  const result = createResult();

  if (!(await isDirectory(rootPath))) {
    result.errors.push(`Path does not exist or is not a directory: ${rootPath}`);
    return finalizeResult(result);
  }

  const requiredFiles = ["SKILL.md", "README.md", "SUMMARY.md", "book.json"];
  let totalBytes = 0;

  for (const fileName of requiredFiles) {
    const absolutePath = path.join(rootPath, fileName);
    if (!(await isFile(absolutePath))) {
      result.errors.push(`Missing required file: ${fileName}`);
      continue;
    }

    const fileStats = await stat(absolutePath);
    totalBytes += fileStats.size;
    if (fileStats.size > MAX_FILE_BYTES) {
      result.errors.push(`${fileName} exceeds the maximum allowed size of ${MAX_FILE_BYTES} bytes.`);
    }
  }

  const entries = await readdir(rootPath, { withFileTypes: true });

  const contentDirectories = entries
    .filter((entry) => entry.isDirectory() && /^\d{2}-[a-z0-9-]+$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (contentDirectories.length === 0) {
    result.errors.push("At least one numbered content directory is required.");
  }

  const skillPath = path.join(rootPath, "SKILL.md");
  if (await isFile(skillPath)) {
    const skillContent = await readText(skillPath);
    const skillResult = validateSkillMd(skillContent);
    result.errors.push(...skillResult.errors);
    result.warnings.push(...skillResult.warnings);

    const referencedPaths = extractReferencedMarkdownPaths(parseFrontmatter(skillContent).body);
    const resolvedRoot = path.resolve(rootPath);
    for (const reference of referencedPaths) {
      // Resolve candidate against the book root then verify it stays inside.
      // path.resolve normalises ".." segments so "foo/../../etc/passwd" becomes
      // an absolute path that will not start with resolvedRoot + sep.
      const resolvedRef = path.resolve(resolvedRoot, reference);
      const withinRoot =
        resolvedRef === resolvedRoot ||
        resolvedRef.startsWith(resolvedRoot + path.sep);

      if (!withinRoot) {
        result.errors.push(`Referenced path escapes book root: "${reference}".`);
        continue;
      }

      if (!(await isFile(resolvedRef))) {
        result.errors.push(`SKILL.md references a missing file: ${reference}`);
      }
    }
  }

  const bookJsonPath = path.join(rootPath, "book.json");
  if (await isFile(bookJsonPath)) {
    try {
      const parsed = JSON.parse(await readText(bookJsonPath)) as unknown;
      const bookResult = validateBookJson(parsed);
      result.errors.push(...bookResult.errors);
      result.warnings.push(...bookResult.warnings);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`book.json is not valid JSON: ${message}`);
    }
  }

  const summaryPath = path.join(rootPath, "SUMMARY.md");
  if (await isFile(summaryPath)) {
    const summaryContent = await readText(summaryPath);

    for (const directory of contentDirectories) {
      if (!summaryContent.includes(directory)) {
        result.warnings.push(`SUMMARY.md does not mention content directory ${directory}.`);
      }
    }
  }

  for (const directory of contentDirectories) {
    const absoluteDirectory = path.join(rootPath, directory);
    const directoryEntries = await readdir(absoluteDirectory, { withFileTypes: true });

    const markdownFiles = directoryEntries.filter(
      (entry) => entry.isFile() && /^\d{2}-[a-z0-9-]+\.md$/u.test(entry.name),
    );

    if (markdownFiles.length === 0) {
      result.warnings.push(`Content directory ${directory} does not contain any numbered markdown pages.`);
    }
  }

  const allFiles = await listFiles(rootPath);
  for (const relativePath of allFiles) {
    const absolutePath = path.join(rootPath, relativePath);
    const fileStats = await stat(absolutePath);
    totalBytes += requiredFiles.includes(relativePath as (typeof requiredFiles)[number]) ? 0 : fileStats.size;

    if (fileStats.size > MAX_FILE_BYTES) {
      result.errors.push(
        `File exceeds the maximum allowed size of ${MAX_FILE_BYTES} bytes: ${relativePath}`,
      );
    }
  }

  if (totalBytes > MAX_CONTENT_BYTES) {
    result.errors.push(
      `Book content exceeds the maximum allowed size of ${MAX_CONTENT_BYTES} bytes.`,
    );
  }

  return finalizeResult(result);
}
