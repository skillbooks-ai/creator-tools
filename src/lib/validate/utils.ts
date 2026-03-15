import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ValidationResult } from "./types.js";

const FRONTMATTER_DELIMITER = "---";
export const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 1024 * 1024;
const REQUIRED_SKILL_FIELDS = [
  "name",
  "title",
  "description",
  "server",
  "version",
  "pages",
  "price",
  "license",
] as const;

export type SkillFrontmatter = Record<string, string | number | boolean>;

/**
 * Creates an empty result container.
 *
 * @returns {ValidationResult}
 */
export function createResult(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Finalizes a mutable result before returning it.
 *
 * @param {ValidationResult} result
 * @returns {ValidationResult}
 */
export function finalizeResult(result: ValidationResult): ValidationResult {
  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Parses a simple YAML-like frontmatter block used by SKILL.md.
 *
 * @param {string} content
 * @returns {{ frontmatter: SkillFrontmatter; body: string; errors: string[] }}
 */
export function parseFrontmatter(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
  errors: string[];
} {
  const lines = content.split(/\r?\n/u);
  const errors: string[] = [];

  if (lines[0] !== FRONTMATTER_DELIMITER) {
    return {
      frontmatter: {},
      body: content,
      errors: ["SKILL.md must start with a frontmatter block delimited by ---."],
    };
  }

  const closingIndex = lines.indexOf(FRONTMATTER_DELIMITER, 1);
  if (closingIndex === -1) {
    return {
      frontmatter: {},
      body: content,
      errors: ["SKILL.md frontmatter is missing its closing --- delimiter."],
    };
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const frontmatter: SkillFrontmatter = {};

  for (const rawLine of frontmatterLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      errors.push(`Invalid frontmatter line: "${rawLine}".`);
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      errors.push(`Invalid frontmatter line: "${rawLine}".`);
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (/^(true|false)$/u.test(value)) {
      frontmatter[key] = value === "true";
      continue;
    }

    if (/^-?\d+$/u.test(value) && key !== "version") {
      const parsedValue = Number.parseInt(value, 10);
      if (!Number.isSafeInteger(parsedValue)) {
        errors.push(
          `Frontmatter field "${key}" contains an integer outside the safe integer range (> 2^53 − 1).`,
        );
        continue;
      }
      frontmatter[key] = parsedValue;
      continue;
    }

    if (/^-?\d+$/u.test(value)) {
      frontmatter[key] = value;
      continue;
    }

    frontmatter[key] = value;
  }

  return {
    frontmatter,
    body: lines.slice(closingIndex + 1).join("\n"),
    errors,
  };
}

/**
 * Validates required SKILL.md frontmatter fields.
 *
 * @param {SkillFrontmatter} frontmatter
 * @param {ValidationResult} result
 * @returns {void}
 */
export function validateRequiredSkillFields(
  frontmatter: SkillFrontmatter,
  result: ValidationResult,
): void {
  for (const field of REQUIRED_SKILL_FIELDS) {
    if (frontmatter[field] === undefined || frontmatter[field] === "") {
      result.errors.push(`SKILL.md frontmatter is missing required field "${field}".`);
    }
  }

  if (frontmatter.name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(String(frontmatter.name))) {
    result.errors.push('SKILL.md frontmatter "name" must be lowercase kebab-case.');
  }

  if (frontmatter.version && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(String(frontmatter.version))) {
    result.errors.push('SKILL.md frontmatter "version" must be valid semver (major.minor.patch).');
  }

  if (frontmatter.pages !== undefined && (!Number.isInteger(frontmatter.pages) || Number(frontmatter.pages) <= 0)) {
    result.errors.push('SKILL.md frontmatter "pages" must be a positive integer.');
  }

  if (frontmatter.price && !/^\$\d+(?:\.\d{2})$/u.test(String(frontmatter.price))) {
    result.errors.push('SKILL.md frontmatter "price" must be formatted like "$12.00".');
  }
}

/**
 * Returns the UTF-8 byte length of a string.
 *
 * @param {string} content
 * @returns {number}
 */
export function getContentSizeBytes(content: string): number {
  return Buffer.byteLength(content, "utf8");
}

/**
 * Adds a validation error when a content blob exceeds the configured size budget.
 *
 * @param {string} content
 * @param {ValidationResult} result
 * @param {string} label
 * @returns {boolean}
 */
export function enforceContentSizeLimit(
  content: string,
  result: ValidationResult,
  label: string,
): boolean {
  const sizeBytes = getContentSizeBytes(content);
  if (sizeBytes > MAX_CONTENT_BYTES) {
    result.errors.push(
      `${label} exceeds the maximum allowed size of ${MAX_CONTENT_BYTES} bytes.`,
    );
    return false;
  }

  return true;
}

/**
 * Extracts relative markdown paths listed in SKILL.md bullet items and quick-start lines.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function extractReferencedMarkdownPaths(body: string): string[] {
  const matches = body.matchAll(/`([^`\n]+\.md)`/gu);
  return Array.from(matches, (match) => match[1]);
}

/**
 * Resolves a book-relative path and reports whether it stays within the root.
 *
 * @param {string} rootPath
 * @param {string} candidatePath
 * @returns {{ resolvedPath: string; withinRoot: boolean }}
 */
export function resolveBookPath(
  rootPath: string,
  candidatePath: string,
): { resolvedPath: string; withinRoot: boolean } {
  const resolvedRootPath = path.resolve(rootPath);
  const resolvedPath = path.resolve(resolvedRootPath, candidatePath);
  const relativePath = path.relative(resolvedRootPath, resolvedPath);

  return {
    resolvedPath,
    withinRoot:
      relativePath === "" ||
      (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)),
  };
}

/**
 * Extracts TOC bullet entries in the canonical format.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function extractTocBulletLines(body: string): string[] {
  return body
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- `") && line.includes("`"));
}

/**
 * Recursively lists files beneath a directory using POSIX-style relative paths.
 *
 * @param {string} rootPath
 * @param {(relativePath: string, absolutePath: string) => boolean} [includeFile]
 * @returns {Promise<string[]>}
 */
export async function listFiles(
  rootPath: string,
  includeFile?: (relativePath: string, absolutePath: string) => boolean,
): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = toPosix(path.relative(rootPath, absolutePath));

      if (entry.isDirectory()) {
        if ([".git", ".verify", "node_modules"].includes(entry.name)) {
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!includeFile || includeFile(relativePath, absolutePath)) {
        files.push(relativePath);
      }
    }
  }

  await walk(rootPath);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

/**
 * Returns true when the path exists and is a file.
 *
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
export async function isFile(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isFile();
  } catch {
    return false;
  }
}

/**
 * Returns true when the path exists and is a directory.
 *
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Reads UTF-8 text from disk.
 *
 * @param {string} targetPath
 * @returns {Promise<string>}
 */
export async function readText(targetPath: string): Promise<string> {
  return readFile(targetPath, "utf8");
}

/**
 * Converts a path to POSIX separators.
 *
 * @param {string} value
 * @returns {string}
 */
export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

/**
 * Creates a SHA-256 hash for a string or buffer.
 *
 * @param {Buffer | string} data
 * @returns {string}
 */
export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
