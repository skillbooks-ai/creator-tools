/**
 * Standard validation result returned by validators in this package.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Result returned by integrity validation with generated file hashes.
 */
export interface IntegrityValidationResult extends ValidationResult {
  manifest: Record<string, string>;
}

/**
 * Supported prompt injection detection classes.
 */
export interface InjectionPatternMatch {
  category: "system-prompt" | "role-play" | "instruction-override";
  message: string;
}
