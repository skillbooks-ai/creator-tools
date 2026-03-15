import { validateSemver } from "./validateSemver.js";
import { createResult, finalizeResult } from "./utils.js";
import type { ValidationResult } from "./types.js";

type JsonRecord = Record<string, unknown>;

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates `book.json` against the Skillbooks metadata schema.
 *
 * @param {unknown} data
 * @returns {ValidationResult}
 */
export function validateBookJson(data: unknown): ValidationResult {
  const result = createResult();

  if (!isObject(data)) {
    result.errors.push("book.json must be a JSON object.");
    return finalizeResult(result);
  }

  if (typeof data.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(data.id)) {
    result.errors.push('book.json field "id" must be a lowercase kebab-case string.');
  }

  if (typeof data.title !== "string" || data.title.trim() === "") {
    result.errors.push('book.json field "title" is required.');
  }

  if (typeof data.description !== "undefined" && (typeof data.description !== "string" || data.description.trim() === "")) {
    result.errors.push('book.json field "description", when present, must be a non-empty string.');
  }

  if (typeof data.author !== "undefined" && (typeof data.author !== "string" || data.author.trim() === "")) {
    result.errors.push('book.json field "author", when present, must be a non-empty string.');
  }

  if (typeof data.version !== "string") {
    result.errors.push('book.json field "version" is required.');
  } else {
    const semverResult = validateSemver(data.version);
    result.errors.push(...semverResult.errors.map((error) => `book.json version: ${error}`));
  }

  if (typeof data.language !== "string" || !/^[a-z]{2}$/u.test(data.language)) {
    result.errors.push('book.json field "language" must be an ISO 639-1 code like "en".');
  }

  if (typeof data.verified !== "boolean") {
    result.errors.push('book.json field "verified" must be a boolean.');
  }

  if (!isObject(data.structure)) {
    result.errors.push('book.json field "structure" must be an object.');
  } else {
    if (data.structure.readme !== "README.md") {
      result.errors.push('book.json structure.readme must equal "README.md".');
    }

    if (data.structure.summary !== "SUMMARY.md") {
      result.errors.push('book.json structure.summary must equal "SUMMARY.md".');
    }

    if (
      typeof data.structure.tagIndex !== "undefined" &&
      data.structure.tagIndex !== "TAG-INDEX.json"
    ) {
      result.errors.push('book.json structure.tagIndex must equal "TAG-INDEX.json" when present.');
    }
  }

  if (typeof data.sources !== "undefined") {
    if (!isObject(data.sources)) {
      result.errors.push('book.json field "sources", when present, must be an object.');
    } else if (data.sources.enabled === true) {
      if (data.sources.path !== "sources/") {
        result.errors.push('book.json sources.path must equal "sources/" when sources are enabled.');
      }

      if (data.sources.index !== "sources/SOURCES.md") {
        result.errors.push('book.json sources.index must equal "sources/SOURCES.md" when sources are enabled.');
      }
    }
  }

  if (typeof data.pricing !== "undefined") {
    if (!isObject(data.pricing)) {
      result.errors.push('book.json field "pricing", when present, must be an object.');
    } else if (typeof data.pricing.fullBook !== "string" || !/^\$\d+(?:\.\d{2})$/u.test(data.pricing.fullBook)) {
      result.errors.push('book.json pricing.fullBook must be formatted like "$12.00".');
    }
  } else {
    result.warnings.push('book.json does not include a "pricing" object; current PRD pricing is primarily defined in SKILL.md frontmatter.');
  }

  return finalizeResult(result);
}
