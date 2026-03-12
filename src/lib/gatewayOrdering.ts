import type { Section } from "@/data/gatewayAssets";
import type { UserProduct } from "@/hooks/useUserProducts";

/**
 * Section priority when multiple sections have owned cards.
 * Lower = higher priority. Sections not listed get Infinity.
 */
const SECTION_PRIORITY: Record<string, number> = {
  "preparacoes-dq": 0,
  "ferramentas-dq": 1,
  "cursos-materiais": 2,
};

/**
 * Reorders Gateway sections and cards based on the user's purchased products.
 *
 * Rules:
 * 1. Cards the user owns appear first within each section.
 * 2. All sections containing at least one owned card are promoted to the top,
 *    ordered by SECTION_PRIORITY (Preparações > Ferramentas > Cursos).
 * 3. Within the promoted group, cards are sorted: owned first, primary card first.
 * 4. Sections with no owned cards keep their relative order after promoted ones.
 */
export function reorderGatewaySections(
  sections: Section[],
  products: UserProduct[],
  isAdmin: boolean
): Section[] {
  if (isAdmin || products.length === 0) return sections;

  const ownedCardIds = new Set(products.flatMap((p) => p.cardIds));
  const primaryCardId = getPrimaryCardId(products);

  // Reorder cards within each section
  const reordered = sections.map((section) => ({
    ...section,
    areas: sortCardsOwnedFirst(section.areas, ownedCardIds, primaryCardId),
  }));

  // Split into sections with owned cards vs without
  const withOwned: Section[] = [];
  const withoutOwned: Section[] = [];

  for (const section of reordered) {
    if (section.areas.some((a) => ownedCardIds.has(a.id))) {
      withOwned.push(section);
    } else {
      withoutOwned.push(section);
    }
  }

  // Sort promoted sections by priority
  withOwned.sort(
    (a, b) =>
      (SECTION_PRIORITY[a.id] ?? Infinity) - (SECTION_PRIORITY[b.id] ?? Infinity)
  );

  return [...withOwned, ...withoutOwned];
}

function getPrimaryCardId(products: UserProduct[]): string | null {
  const slugs = new Set(products.map((p) => p.slug));

  if (slugs.has("dossie_if")) return "dossie-if";
  if (slugs.has("codigo_if")) return "codigo-if";
  if (slugs.has("conselho-if")) return "conselho-if";

  for (const p of products) {
    if (p.cardIds.length > 0) return p.cardIds[0];
  }
  return null;
}

function sortCardsOwnedFirst(
  areas: Section["areas"],
  ownedCardIds: Set<string>,
  primaryCardId: string | null
): Section["areas"] {
  return [...areas].sort((a, b) => {
    // Primary card always first
    if (a.id === primaryCardId) return -1;
    if (b.id === primaryCardId) return 1;

    const aOwned = ownedCardIds.has(a.id);
    const bOwned = ownedCardIds.has(b.id);

    if (aOwned && !bOwned) return -1;
    if (!aOwned && bOwned) return 1;

    return 0;
  });
}
