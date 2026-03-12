import type { UserProduct } from "@/hooks/useUserProducts";

/**
 * Gateway Card Visibility Rules (consolidated v2)
 * =================================================
 *
 * Determines which cards are VISIBLE in the Gateway based on the user's products.
 * Visibility ≠ unlock status. Visible cards can still be locked (vitrine).
 *
 * Cards that exist INSIDE a product's dashboard are HIDDEN from the Gateway
 * (they are accessed via the dashboard, not the Gateway).
 *
 * | Product        | Hidden from Gateway (inside dashboard)                          |
 * |----------------|----------------------------------------------------------------|
 * | Dossiê IF      | banco-questoes, mapa-questoes, materiais-dissecados,           |
 * |                | robo-tutor, revisao-tatica, dissecando-didatica,               |
 * |                | comunidades-dissecadores, dissecando-dissertativa, codigo-if   |
 * | Código IF      | banco-questoes, mapa-questoes, materiais-dissecados            |
 * | Conselho IF    | (redirect if alone) / conselho-if card hidden if combined      |
 * | Avulsos        | (none) — all cards visible as vitrine                          |
 *
 * Special cases:
 * - Conselho IF as ONLY product → returns null (redirect to /conselho-if)
 * - Dossiê + Código → Dossiê rules dominate (codigo-if hidden)
 *
 * Returns null when user should be redirected (Conselho IF only).
 * Returns string[] of visible card IDs otherwise.
 */

/** Cards that live inside the Dossiê IF dashboard */
const DOSSIE_DASHBOARD_CARDS = new Set([
  "banco-questoes",
  "mapa-questoes",
  "materiais-dissecados",
  "robo-tutor",
  "revisao-tatica",
  "dissecando-didatica",
  "comunidades-dissecadores",
  "dissecando-dissertativa",
  "codigo-if",
]);

/** Cards that live inside the Código IF dashboard */
const CODIGO_DASHBOARD_CARDS = new Set([
  "banco-questoes",
  "mapa-questoes",
  "materiais-dissecados",
]);

export function getGatewayVisibleCards(
  products: UserProduct[],
  allCardIds: string[]
): string[] | null {
  if (products.length === 0) return allCardIds;

  const slugs = new Set(products.map((p) => p.slug));

  const hasDossie = slugs.has("dossie_if");
  const hasConselho = slugs.has("conselho-if");
  const hasCodigo = slugs.has("codigo_if");

  // Conselho IF as sole product → redirect to dashboard
  if (hasConselho && slugs.size === 1) {
    return null;
  }

  // Build the set of cards to HIDE
  const hiddenCards = new Set<string>();

  // Dossiê IF: hide all cards that are inside its dashboard
  if (hasDossie) {
    DOSSIE_DASHBOARD_CARDS.forEach((id) => hiddenCards.add(id));
  }

  // Código IF: hide cards inside its dashboard
  if (hasCodigo) {
    CODIGO_DASHBOARD_CARDS.forEach((id) => hiddenCards.add(id));
  }

  // Conselho IF combined with other products → hide conselho-if card
  // (user accesses Conselho via its dedicated dashboard)
  if (hasConselho && slugs.size > 1) {
    hiddenCards.add("conselho-if");
  }

  return allCardIds.filter((id) => !hiddenCards.has(id));
}
