import { validateSemver } from "./validateSemver.js";
import {
  createResult,
  enforceContentSizeLimit,
  extractReferencedMarkdownPaths,
  extractTocBulletLines,
  finalizeResult,
  parseFrontmatter,
  validateRequiredSkillFields,
} from "./utils.js";
import type { ValidationResult } from "./types.js";

const TOC_LINE_PATTERN = /^- `([a-z0-9][^`\s]*\.md)`\s+[-–—]\s+.+$/u;

/**
 * Validates SKILL.md frontmatter and TOC link formatting.
 *
 * @param {string} content
 * @returns {ValidationResult}
 */
export function validateSkillMd(content: string): ValidationResult {
  const result = createResult();
  if (!enforceContentSizeLimit(content, result, "SKILL.md content")) {
    return finalizeResult(result);
  }

  const { frontmatter, body, errors } = parseFrontmatter(content);

  result.errors.push(...errors);
  validateRequiredSkillFields(frontmatter, result);

  // Validate skillbook-type (required, must be "reference" or "guide")
  const skillbookType = frontmatter['skillbook-type'];
  if (skillbookType === undefined || skillbookType === '') {
    result.errors.push('SKILL.md frontmatter is missing required field "skillbook-type" (under metadata).');
  } else if (skillbookType !== 'reference' && skillbookType !== 'guide') {
    result.errors.push('SKILL.md frontmatter "skillbook-type" must be either "reference" or "guide".');
  }

  if (frontmatter.version !== undefined) {
    const semverResult = validateSemver(String(frontmatter.version));
    result.errors.push(...semverResult.errors.map((error) => `SKILL.md version: ${error}`));
  }

  if (!/(?:^|\n)## License\b/u.test(body)) {
    result.errors.push('SKILL.md must contain a "## License" section.');
  }

  const tocLines = extractTocBulletLines(body);
  if (tocLines.length === 0) {
    result.errors.push("SKILL.md must contain at least one TOC bullet entry.");
  }

  for (const line of tocLines) {
    if (!TOC_LINE_PATTERN.test(line)) {
      result.errors.push(`Invalid TOC entry format: "${line}".`);
    }
  }

  const referencedPaths = extractReferencedMarkdownPaths(body);
  const uniquePaths = new Set<string>();

  for (const reference of referencedPaths) {
    if (reference.startsWith("/") || reference.startsWith("../")) {
      result.errors.push(`Referenced path must be book-relative: "${reference}".`);
    }

    uniquePaths.add(reference);
  }

  if (uniquePaths.size === 0) {
    result.warnings.push("SKILL.md does not reference any markdown content pages.");
  }

  return finalizeResult(result);
}
