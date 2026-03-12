import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Key,
  Mail,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Shield,
  Plus,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ─── Card labels ────────────────────────────────────────────────────
const ALL_CARD_IDS = [
  "dossie-if",
  "codigo-if",
  "conselho-if",
  "mapa-questoes",
  "banco-questoes",
  "robo-tutor",
  "revisao-tatica",
  "materiais-dissecados",
  "dissecando-dissertativa",
  "dissecando-didatica",
  "comunidades-dissecadores",
  "cronograma",
];

const CARD_LABELS: Record<string, string> = {
  "dossie-if": "Dossiê IF",
  "codigo-if": "Código IF",
  "conselho-if": "O Conselho IF",
  "mapa-questoes": "Mapa das Questões",
  "banco-questoes": "Questões Ultraselecionadas",
  "robo-tutor": "Robô Tutor",
  "revisao-tatica": "Revisão Tática",
  "materiais-dissecados": "Materiais Dissecados",
  "dissecando-dissertativa": "Dissecando a Dissertativa",
  "dissecando-didatica": "Dissecando a Didática",
  "comunidades-dissecadores": "Comunidades Dissecadores",
  "cronograma": "Cronograma Inteligente",
};

// ─── Types ──────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  slug: string;
  card_ids: string[];
  is_active: boolean;
  created_at: string;
  email_count: number;
  active_tokens: number;
}

interface OfferToken {
  id: string;
  offer_token: string;
  product_id: string;
  duration_days: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  product_name?: string;
}

// ─── Component ──────────────────────────────────────────────────────
export function AdminProducts() {
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingCardIds, setPendingCardIds] = useState<string[]>([]);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [confirmDeactivateToken, setConfirmDeactivateToken] = useState<OfferToken | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // New token form
  const [newTokenProduct, setNewTokenProduct] = useState("");
  const [newTokenValue, setNewTokenValue] = useState("");
  const [newTokenNotes, setNewTokenNotes] = useState("");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "pwgordrpgfxhcczsnqpk";
  const webhookBaseUrl = `https://${projectId}.supabase.co/functions/v1/guru-webhook`;

  // ─── Queries ────────────────────────────────────────────────────
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data: prods, error } = await supabase
        .from("product_definitions" as any)
        .select("*")
        .order("created_at");
      if (error) throw error;

      // Enrich with counts
      const enriched: Product[] = [];
      for (const p of prods || []) {
        const { count: emailCount } = await supabase
          .from("authorized_email_products")
          .select("*", { count: "exact", head: true })
          .eq("product_id", (p as any).id);

        const { count: tokenCount } = await supabase
          .from("product_offer_tokens" as any)
          .select("*", { count: "exact", head: true })
          .eq("product_id", (p as any).id)
          .eq("is_active", true);

        enriched.push({
          ...(p as any),
          email_count: emailCount || 0,
          active_tokens: tokenCount || 0,
        });
      }
      return enriched;
    },
  });

  const { data: tokens = [], isLoading: loadingTokens } = useQuery({
    queryKey: ["admin-offer-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_offer_tokens" as any)
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data || []) as any as OfferToken[];
    },
  });

  const { data: emailsByProduct = [] } = useQuery({
    queryKey: ["admin-emails-by-product"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("authorized_email_products")
          .select("product_id, email, created_at")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (data) allData = allData.concat(data);
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allData;
    },
  });

  // ─── Mutations ──────────────────────────────────────────────────

  // Update card_ids (protected)
  const updateCardIds = useMutation({
    mutationFn: async ({ productId, cardIds }: { productId: string; cardIds: string[] }) => {
      console.log("[AdminProducts] Updating card_ids:", { productId, cardIds });
      const { data, error } = await supabase
        .from("product_definitions" as any)
        .update({ card_ids: cardIds, updated_at: new Date().toISOString() } as any)
        .eq("id", productId)
        .select();
      if (error) {
        console.error("[AdminProducts] Update error:", error);
        throw error;
      }
      console.log("[AdminProducts] Update result:", data);
      if (!data || data.length === 0) {
        throw new Error("Nenhuma linha atualizada — verifique permissões de admin");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setEditingProduct(null);
      setPendingCardIds([]);
      setConfirmEditOpen(false);
      toast.success("Cards do produto atualizados");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Deactivate token (soft-delete)
  const deactivateToken = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("product_offer_tokens" as any)
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offer-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setConfirmDeactivateToken(null);
      toast.success("Token desativado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Create token
  const createToken = useMutation({
    mutationFn: async () => {
      if (!newTokenProduct || !newTokenValue.trim()) throw new Error("Preencha produto e token");
      const { error } = await supabase
        .from("product_offer_tokens" as any)
        .insert({
          product_id: newTokenProduct,
          offer_token: newTokenValue.trim(),
          notes: newTokenNotes.trim() || null,
          is_active: true,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offer-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setNewTokenProduct("");
      setNewTokenValue("");
      setNewTokenNotes("");
      toast.success("Token criado com sucesso");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Helpers ────────────────────────────────────────────────────
  const handleCopyUrl = async (token: string) => {
    const url = `${webhookBaseUrl}?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("URL copiada!");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleStartEditCards = (product: Product) => {
    setEditingProduct(product);
    setPendingCardIds([...product.card_ids]);
  };

  const handleConfirmEditCards = () => {
    if (!editingProduct) return;

    // Check what changed
    const removed = editingProduct.card_ids.filter((c) => !pendingCardIds.includes(c));
    if (removed.length > 0 && editingProduct.email_count > 0) {
      // Show confirmation dialog
      setConfirmEditOpen(true);
    } else {
      // Safe change (only additions), proceed directly
      updateCardIds.mutate({ productId: editingProduct.id, cardIds: pendingCardIds });
    }
  };

  const toggleCardId = (cardId: string) => {
    setPendingCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((c) => c !== cardId) : [...prev, cardId]
    );
  };

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name || productId;

  // ─── Render ─────────────────────────────────────────────────────
  if (loadingProducts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="catalogo" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="catalogo" className="gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-1.5">
            <Key className="w-3.5 h-3.5" />
            Tokens de Oferta
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Emails por Produto
          </TabsTrigger>
        </TabsList>

        {/* ── Catálogo de Produtos ── */}
        <TabsContent value="catalogo">
          <div className="space-y-4">
            {products.map((product) => {
              const isExpanded = expandedProduct === product.id;
              const isEditing = editingProduct?.id === product.id;

              return (
                <Card key={product.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            {product.name}
                            <Badge variant={product.is_active ? "default" : "secondary"}>
                              {product.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <code className="text-xs bg-muted px-1 rounded">{product.slug}</code>
                            <span className="mx-2">•</span>
                            <span>{product.card_ids.length} cards</span>
                            <span className="mx-2">•</span>
                            <span className="font-medium">{product.email_count} emails</span>
                            <span className="mx-2">•</span>
                            <span>{product.active_tokens} token(s) ativo(s)</span>
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          isEditing ? setEditingProduct(null) : handleStartEditCards(product)
                        }
                      >
                        {isEditing ? "Cancelar" : "Editar cards"}
                      </Button>
                    </div>
                  </CardHeader>

                  {(isExpanded || isEditing) && (
                    <CardContent>
                      {isEditing ? (
                        <div className="space-y-4">
                          <Label className="text-sm font-medium">
                            Selecione os cards liberados por este produto:
                          </Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {ALL_CARD_IDS.map((cardId) => {
                              const isSelected = pendingCardIds.includes(cardId);
                              const wasOriginal = editingProduct.card_ids.includes(cardId);
                              const isRemoved = wasOriginal && !isSelected;
                              const isAdded = !wasOriginal && isSelected;

                              return (
                                <label
                                  key={cardId}
                                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                                    isRemoved
                                      ? "border-destructive/50 bg-destructive/5"
                                      : isAdded
                                        ? "border-primary/50 bg-primary/5"
                                        : isSelected
                                          ? "border-primary/30 bg-primary/5"
                                          : "border-border"
                                  }`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleCardId(cardId)}
                                  />
                                  <span className="text-sm">
                                    {CARD_LABELS[cardId] || cardId}
                                  </span>
                                  {isRemoved && (
                                    <Badge variant="destructive" className="text-[10px] ml-auto">
                                      removido
                                    </Badge>
                                  )}
                                  {isAdded && (
                                    <Badge className="text-[10px] ml-auto bg-primary">
                                      novo
                                    </Badge>
                                  )}
                                </label>
                              );
                            })}
                          </div>

                          {/* Impact warning */}
                          {(() => {
                            const removed = editingProduct.card_ids.filter(
                              (c) => !pendingCardIds.includes(c)
                            );
                            if (removed.length > 0 && editingProduct.email_count > 0) {
                              return (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                                  <div className="text-sm">
                                    <p className="font-medium text-destructive">
                                      Atenção: remoção de cards
                                    </p>
                                    <p className="text-muted-foreground mt-1">
                                      Você está removendo{" "}
                                      <strong>{removed.map((c) => CARD_LABELS[c] || c).join(", ")}</strong>.
                                      Isso afetará <strong>{editingProduct.email_count} emails</strong>{" "}
                                      vinculados a este produto. Novos signups não receberão esses cards.
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                      Usuários já provisionados não serão afetados.
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="flex gap-2">
                            <Button
                              onClick={handleConfirmEditCards}
                              disabled={updateCardIds.isPending}
                            >
                              {updateCardIds.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                              ) : (
                                <Shield className="w-4 h-4 mr-1" />
                              )}
                              Salvar alterações
                            </Button>
                            <Button variant="ghost" onClick={() => setEditingProduct(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {product.card_ids.map((cardId) => (
                            <Badge key={cardId} variant="secondary" className="text-xs">
                              {CARD_LABELS[cardId] || cardId}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Tokens de Oferta ── */}
        <TabsContent value="tokens">
          <div className="space-y-6">
            {/* Existing tokens */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Tokens Ativos
                </CardTitle>
                <CardDescription>
                  Cada token vincula uma URL de webhook a um produto. Use na Guru ou outra plataforma de vendas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTokens ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                ) : tokens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum token cadastrado.</p>
                ) : (
                  <div className="space-y-3">
                    {tokens.map((token) => {
                      const product = products.find((p) => p.id === token.product_id);
                      const fullUrl = `${webhookBaseUrl}?token=${token.offer_token}`;
                      const isCopied = copiedToken === token.offer_token;

                      return (
                        <div
                          key={token.id}
                          className={`p-4 rounded-lg border ${
                            token.is_active ? "border-border" : "border-border/50 opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={token.is_active ? "default" : "secondary"}>
                                  {token.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                                <span className="font-medium text-sm">
                                  {product?.name || "Produto desconhecido"}
                                </span>
                                {token.notes && (
                                  <span className="text-xs text-muted-foreground">
                                    — {token.notes}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate block max-w-lg">
                                  {fullUrl}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0"
                                  onClick={() => handleCopyUrl(token.offer_token)}
                                >
                                  {isCopied ? (
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            {token.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmDeactivateToken(token)}
                              >
                                Desativar
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add new token */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Novo Token
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <select
                      value={newTokenProduct}
                      onChange={(e) => setNewTokenProduct(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Selecione...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Token</Label>
                    <Input
                      value={newTokenValue}
                      onChange={(e) => setNewTokenValue(e.target.value)}
                      placeholder="ex: meu_token_unico"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas (opcional)</Label>
                    <Input
                      value={newTokenNotes}
                      onChange={(e) => setNewTokenNotes(e.target.value)}
                      placeholder="ex: Oferta Black Friday"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => createToken.mutate()}
                  disabled={!newTokenProduct || !newTokenValue.trim() || createToken.isPending}
                >
                  {createToken.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1" />
                  )}
                  Criar Token
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Emails por Produto ── */}
        <TabsContent value="emails">
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {products.map((product) => (
                <Card key={product.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {product.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{product.email_count}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      emails autorizados
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent emails table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Emails autorizados por produto</CardTitle>
                <CardDescription>
                  Mostrando todos os {emailsByProduct.length} registros da tabela ponte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailsByProduct.slice(0, 50).map((row: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {getProductName(row.product_id)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {emailsByProduct.length > 50 && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Mostrando 50 de {emailsByProduct.length} registros
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Confirmation Dialog: Edit Card IDs ── */}
      <AlertDialog open={confirmEditOpen} onOpenChange={setConfirmEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar alteração de cards
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está removendo cards do produto{" "}
                  <strong>{editingProduct?.name}</strong>.
                </p>
                <div className="bg-destructive/10 p-3 rounded-lg text-sm">
                  <p>
                    <strong>{editingProduct?.email_count} emails</strong> estão vinculados a este
                    produto. Novos signups com esses emails <strong>não receberão</strong> os cards
                    removidos.
                  </p>
                </div>
                <p className="text-xs">
                  Usuários que já fizeram signup não serão afetados — seus cards atuais permanecem.
                </p>
                <p className="font-medium">Tem certeza que deseja continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (editingProduct) {
                  updateCardIds.mutate({
                    productId: editingProduct.id,
                    cardIds: pendingCardIds,
                  });
                }
              }}
            >
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation Dialog: Deactivate Token ── */}
      <AlertDialog
        open={!!confirmDeactivateToken}
        onOpenChange={(open) => !open && setConfirmDeactivateToken(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Desativar token de oferta
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Ao desativar este token, o webhook vinculado{" "}
                  <strong>parará de funcionar imediatamente</strong>.
                </p>
                <div className="bg-destructive/10 p-3 rounded-lg text-sm space-y-1">
                  <p>
                    <strong>Produto:</strong>{" "}
                    {getProductName(confirmDeactivateToken?.product_id || "")}
                  </p>
                  <p>
                    <strong>Token:</strong>{" "}
                    <code className="bg-muted px-1 rounded">
                      {confirmDeactivateToken?.offer_token}
                    </code>
                  </p>
                  <p className="text-destructive font-medium mt-2">
                    Novas compras com este token não serão processadas.
                  </p>
                </div>
                <p className="text-xs">
                  O token não será deletado — pode ser reativado manualmente no banco de dados se
                  necessário.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeactivateToken) {
                  deactivateToken.mutate(confirmDeactivateToken.id);
                }
              }}
            >
              Desativar token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
