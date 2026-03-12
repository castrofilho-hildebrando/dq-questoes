import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to read all appearance_* configs from platform_config.
 * Returns a map of key -> value with helper getters.
 */
export function useAppearanceConfig() {
  const { data: configMap = {}, isLoading } = useQuery({
    queryKey: ["appearance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("id, value")
        .like("id", "appearance_%");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.value) map[row.id] = row.value;
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const get = (key: string, fallback: string): string => {
    return configMap[`appearance_${key}`] || fallback;
  };

  const getImage = (key: string): string | null => {
    return configMap[`appearance_${key}`] || null;
  };

  return { get, getImage, isLoading, configMap };
}
