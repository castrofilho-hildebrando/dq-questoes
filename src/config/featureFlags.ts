/**
 * Feature flags for the application
 * These can be toggled to enable/disable features without code changes
 */

export const FEATURE_FLAGS = {
  /**
   * When enabled, areas are automatically created/synced when:
   * 1. A new discipline is created via ZIP upload
   * 2. The "Sincronizar" button is clicked in AdminAreas
   * 
   * This flag should be enabled after the initial backfill is complete
   * and validated in production.
   */
  ENABLE_AREAS_AUTO_SYNC: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] ?? false;
}
