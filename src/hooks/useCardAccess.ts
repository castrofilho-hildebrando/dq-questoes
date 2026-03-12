import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CardAccessInfo {
  cardId: string;
  isUnlockedDefault: boolean;
  hasUserOverride: boolean;
  userHasAccess: boolean;
}

/**
 * Hook to determine card lock status for the current user.
 * Reads from gateway_cards_config (global defaults) and gateway_card_user_access (per-user overrides).
 */
export function useCardAccess(userId: string | undefined) {
  const { data: globalConfig = [], isLoading: loadingConfig } = useQuery({
    queryKey: ["gateway-cards-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gateway_cards_config" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: userAccess = [], isLoading: loadingAccess } = useQuery({
    queryKey: ["gateway-card-user-access", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("gateway_card_user_access" as any)
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!userId,
  });

  const isCardUnlocked = useCallback((cardId: string): boolean => {
    // Check for user-specific override first
    const override = userAccess.find((a: any) => a.card_id === cardId);
    if (override) return override.has_access;

    // Fall back to global default
    const config = globalConfig.find((c: any) => c.card_id === cardId);
    if (config) return config.is_unlocked_default;

    // If no config exists, default to locked
    return false;
  }, [userAccess, globalConfig]);

  return {
    isCardUnlocked,
    isLoading: loadingConfig || loadingAccess,
    globalConfig,
    userAccess,
  };
}
