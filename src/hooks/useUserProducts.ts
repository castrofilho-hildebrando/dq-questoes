import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProduct {
  slug: string;
  name: string;
  cardIds: string[];
}

/**
 * Returns the list of products a user has based on their email
 * in authorized_email_products + product_definitions.
 */
export function useUserProducts(userEmail: string | undefined) {
  return useQuery({
    queryKey: ["user-products", userEmail],
    queryFn: async (): Promise<UserProduct[]> => {
      if (!userEmail) return [];

      const { data, error } = await supabase
        .from("authorized_email_products")
        .select("product_id")
        .eq("email", userEmail);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const productIds = data.map((d) => d.product_id);

      const { data: products, error: prodError } = await supabase
        .from("product_definitions")
        .select("slug, name, card_ids")
        .in("id", productIds)
        .eq("is_active", true);

      if (prodError) throw prodError;

      return (products || []).map((p) => ({
        slug: p.slug,
        name: p.name,
        cardIds: p.card_ids || [],
      }));
    },
    enabled: !!userEmail,
    staleTime: 5 * 60 * 1000,
  });
}
