import { createResult, enforceContentSizeLimit, finalizeResult } from "./utils.js";
import type { InjectionPatternMatch, ValidationResult } from "./types.js";

const INJECTION_PATTERNS: Array<{
  category: InjectionPatternMatch["category"];
  pattern: RegExp;
  message: string;
}> = [
  {
    category: "system-prompt",
    pattern: /\b(system prompt|developer message|hidden instructions?)\b/iu,
    message: "Content references system or hidden prompt layers.",
  },
  {
    category: "role-play",
    pattern: /\b(pretend you are|role-?play as|you are now (?:an?|the))\b/iu,
    message: "Content contains role-play style redirection language.",
  },
  {
    category: "instruction-override",
    pattern: /\b(ignore|disregard|override|forget)\b.{0,40}\b(previous|prior|earlier|all)\b.{0,40}\b(instructions?|rules?)\b/iu,
    message: "Content attempts to override existing instructions.",
  },
  {
    category: "instruction-override",
    pattern: /\b(do not follow|bypass|disable)\b.{0,40}\b(safety|guardrails?|polic(?:y|ies)|restrictions?)\b/iu,
    message: "Content attempts to bypass safeguards or policies.",
  },
  {
    category: "system-prompt",
    pattern: /<\|im_start\|>|<\|im_end\|>|\[(?:system|assistant|developer)\]/iu,
    message: "Content contains prompt delimiter or role-channel injection markers.",
  },
  {
    category: "instruction-override",
    pattern: /<(?:script|iframe)\b|javascript\s*:/iu,
    message: "Content includes executable HTML or JavaScript injection markers.",
  },
  {
    category: "instruction-override",
    pattern: /<!--[\s\S]{0,500}\b(?:ignore|disregard|override|follow these instructions?)\b[\s\S]{0,500}-->/iu,
    message: "Content hides instructions inside HTML comments.",
  },
  {
    category: "instruction-override",
    pattern: /[\u200B-\u200F\u2060\uFEFF]/u,
    message: "Content contains zero-width Unicode characters commonly used for obfuscation.",
  },
  {
    category: "instruction-override",
    pattern: /(?:i[\u0433\u03B3][\u043Dn]ore|[\u0455s]ystem|in[\u0455s]truction[\u0455s])/iu,
    message: "Content contains homoglyph-obfuscated instruction keywords.",
  },
];

/**
 * Detects basic prompt injection patterns in skillbook content.
 *
 * @param {string} content
 * @returns {ValidationResult}
 */
export function detectInjection(content: string): ValidationResult {
  const result = createResult();
  if (!enforceContentSizeLimit(content, result, "Content")) {
    return finalizeResult(result);
  }

  for (const entry of INJECTION_PATTERNS) {
    if (entry.pattern.test(content)) {
      result.errors.push(`${entry.message} [${entry.category}]`);
    }
  }

  return finalizeResult(result);
}
