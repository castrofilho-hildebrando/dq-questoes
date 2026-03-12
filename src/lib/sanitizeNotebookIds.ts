/**
 * Notebook ID sanitization utilities
 * 
 * IMPORTANT: question_notebook_ids is stored as TEXT[] (not uuid[])
 * All functions treat IDs as strings and never cast to UUID.
 * 
 * Uses generic UUID regex (v1-v5) to avoid false negatives.
 */

/**
 * Generic UUID regex pattern (supports v1-v5)
 * More permissive than v4-only to avoid rejecting valid legacy UUIDs
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID (generic, v1-v5)
 */
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * Sanitizes notebook IDs:
 * 1. Filters to strings only
 * 2. Trims whitespace
 * 3. Validates UUID format (generic v1-v5)
 * 4. Deduplicates while preserving order
 * 
 * @param ids - Unknown input (could be array, null, undefined, or malformed)
 * @returns Clean array of valid UUID strings
 */
export function sanitizeNotebookIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  
  // Step 1: Filter to strings and trim
  const trimmed = ids
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  
  // Step 2: Validate UUID format
  const validUUIDs = trimmed.filter(isValidUUID);
  
  // Step 3: Normalize to lowercase for consistency + deduplicate
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const id of validUUIDs) {
    const lower = id.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduped.push(lower); // Standardize to lowercase
    }
  }
  
  return deduped;
}

/**
 * Result type for notebook resolution
 */
export interface NotebookResolutionResult {
  source: 'TOPIC_DIRECT' | 'TOPIC_SOURCE_FALLBACK' | 'DISCIPLINE_DEFAULT' | 'NONE';
  rawIds: string[];
  sanitizedIds: string[];
  validatedIds: string[];
  removedInvalidCount: number;
  removedNonexistentCount: number;
  notes: string[];
}

/**
 * Creates a resolution result for logging/audit
 */
export function createResolutionResult(
  source: NotebookResolutionResult['source'],
  rawIds: string[],
  sanitizedIds: string[],
  validatedIds: string[]
): NotebookResolutionResult {
  const notes: string[] = [];
  
  const removedInvalidCount = rawIds.length - sanitizedIds.length;
  if (removedInvalidCount > 0) {
    notes.push(`Removed ${removedInvalidCount} invalid UUID(s)`);
  }
  
  const removedNonexistentCount = sanitizedIds.length - validatedIds.length;
  if (removedNonexistentCount > 0) {
    notes.push(`Removed ${removedNonexistentCount} nonexistent/inactive notebook(s)`);
  }
  
  if (validatedIds.length === 0 && rawIds.length > 0) {
    notes.push('All notebook references were invalid - goal will have empty notebook list');
  }
  
  return {
    source,
    rawIds,
    sanitizedIds,
    validatedIds,
    removedInvalidCount,
    removedNonexistentCount,
    notes,
  };
}
