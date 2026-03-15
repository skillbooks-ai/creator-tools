import { createResult, finalizeResult } from "./utils.js";
import type { ValidationResult } from "./types.js";

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

function parseSemver(version: string): ParsedSemver | null {
  const match = version.match(SEMVER_PATTERN);
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function compareSemver(left: ParsedSemver, right: ParsedSemver): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}

/**
 * Validates semver formatting and version bump behavior against a previous version.
 *
 * @param {string} version
 * @param {string} [previousVersion]
 * @returns {ValidationResult}
 */
export function validateSemver(version: string, previousVersion?: string): ValidationResult {
  const result = createResult();
  const next = parseSemver(version);

  if (!next) {
    result.errors.push(`Version "${version}" is not valid semver.`);
    return finalizeResult(result);
  }

  if (!previousVersion) {
    return finalizeResult(result);
  }

  const previous = parseSemver(previousVersion);
  if (!previous) {
    result.errors.push(`Previous version "${previousVersion}" is not valid semver.`);
    return finalizeResult(result);
  }

  const comparison = compareSemver(next, previous);
  if (comparison < 0) {
    result.errors.push(`Version ${version} cannot go backward from ${previousVersion}.`);
    return finalizeResult(result);
  }

  if (comparison === 0) {
    result.errors.push(`Version ${version} has already been published.`);
    return finalizeResult(result);
  }

  const majorChanged = next.major !== previous.major;
  const minorChanged = next.minor !== previous.minor;
  if (majorChanged) {
    if (next.minor !== 0 || next.patch !== 0) {
      result.errors.push("Major version bumps must reset minor and patch to 0.");
    }
    return finalizeResult(result);
  }

  if (minorChanged && next.patch !== 0) {
    result.errors.push("Minor version bumps must reset patch to 0.");
  }

  return finalizeResult(result);
}
