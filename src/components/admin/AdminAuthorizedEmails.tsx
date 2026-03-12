import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Upload, Trash2, RefreshCw, Mail, CheckCircle, XCircle, Loader2, Filter, ShieldCheck, Send, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface AuthorizedEmail {
  id: string;
  email: string;
  is_active: boolean;
  authorized_by: string;
  authorized_at: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  card_ids: string[];
}

interface EmailProduct {
  product_id: string;
  email: string;
}

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

const AdminAuthorizedEmails = () => {
  const [emails, setEmails] = useState<AuthorizedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<AuthorizedEmail | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailProductId, setNewEmailProductId] = useState<string>("");
  const [addingEmail, setAddingEmail] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product filter state
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [emailProductMap, setEmailProductMap] = useState<Map<string, string[]>>(new Map());

  // Access checker state
  const [checkEmail, setCheckEmail] = useState("");
  const [checkResult, setCheckResult] = useState<{ products: Product[]; cards: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);

  // Test email state
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testEmailProduct, setTestEmailProduct] = useState("");
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);

  // Edit products state
  const [editProductsDialogOpen, setEditProductsDialogOpen] = useState(false);
  const [editProductsEmail, setEditProductsEmail] = useState<string>("");
  const [editProductsSelected, setEditProductsSelected] = useState<Set<string>>(new Set());
  const [savingProducts, setSavingProducts] = useState(false);

  useEffect(() => {
    fetchEmails();
    fetchProducts();
    fetchEmailProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("product_definitions" as any)
        .select("id, name, slug, card_ids")
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      setProducts((data || []) as any as Product[]);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchEmailProducts = async () => {
    try {
      const PAGE_SIZE = 1000;
      let allData: EmailProduct[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("authorized_email_products")
          .select("product_id, email")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (data) allData = allData.concat(data);
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      const map = new Map<string, string[]>();
      for (const row of allData) {
        const existing = map.get(row.email) || [];
        existing.push(row.product_id);
        map.set(row.email, existing);
      }
      setEmailProductMap(map);
    } catch (error) {
      console.error("Error fetching email products:", error);
    }
  };

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const PAGE_SIZE = 1000;
      let allData: AuthorizedEmail[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("authorized_emails")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (data) allData = allData.concat(data);
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      setEmails(allData);
    } catch (error) {
      console.error("Error fetching emails:", error);
      toast.error("Erro ao carregar emails autorizados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail) {
      toast.error("Insira um email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error("Email inválido");
      return;
    }

    setAddingEmail(true);
    try {
      const normalizedEmail = newEmail.toLowerCase().trim();

      const { data: existing } = await supabase
        .from("authorized_emails")
        .select("id, is_active")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existing) {
        if (existing.is_active) {
          toast.error("Email já está autorizado");
        } else {
          await supabase
            .from("authorized_emails")
            .update({ is_active: true, authorized_by: "manual", authorized_at: new Date().toISOString() })
            .eq("id", existing.id);
          toast.success("Email reativado com sucesso!");
          fetchEmails();
        }
      } else {
        const { error } = await supabase
          .from("authorized_emails")
          .insert({ email: normalizedEmail, authorized_by: "manual" });

        if (error) throw error;
        toast.success("Email autorizado com sucesso!");
        fetchEmails();
      }

      // Insert product association if selected
      if (newEmailProductId) {
        const { error: prodError } = await supabase
          .from("authorized_email_products")
          .upsert({
            email: normalizedEmail,
            product_id: newEmailProductId,
            access_start: new Date().toISOString(),
          }, { onConflict: "email,product_id" });

        if (prodError) {
          console.error("Error linking product:", prodError);
          toast.error("Email autorizado, mas erro ao vincular produto");
        }
        fetchEmailProducts();
      }

      setNewEmail("");
      setNewEmailProductId("");
      setAddDialogOpen(false);
    } catch (error) {
      console.error("Error adding email:", error);
      toast.error("Erro ao autorizar email");
    } finally {
      setAddingEmail(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBulk(true);
    try {
      const text = await file.text();
      let emailsToAdd: string[] = [];

      if (file.name.endsWith(".csv")) {
        const lines = text.split("\n");
        for (const line of lines) {
          const parts = line.split(",");
          for (const part of parts) {
            const trimmed = part.trim().toLowerCase().replace(/["']/g, "");
            if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
              emailsToAdd.push(trimmed);
            }
          }
        }
      } else {
        const matches = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g);
        if (matches) {
          emailsToAdd = matches.map((m) => m.toLowerCase().trim());
        }
      }

      emailsToAdd = [...new Set(emailsToAdd)];

      if (emailsToAdd.length === 0) {
        toast.error("Nenhum email válido encontrado no arquivo");
        return;
      }

      const emailsData = emailsToAdd.map((email) => ({
        email,
        authorized_by: "bulk",
        is_active: true,
        authorized_at: new Date().toISOString(),
      }));

      const batchSize = 100;

      for (let i = 0; i < emailsData.length; i += batchSize) {
        const batch = emailsData.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from("authorized_emails")
          .upsert(batch, { 
            onConflict: "email",
            ignoreDuplicates: false 
          })
          .select();

        if (error) throw error;
      }

      toast.success(`${emailsToAdd.length} emails processados com sucesso!`);
      fetchEmails();
      setBulkDialogOpen(false);
    } catch (error) {
      console.error("Error uploading bulk:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setUploadingBulk(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleToggleActive = async (email: AuthorizedEmail) => {
    try {
      const { error } = await supabase
        .from("authorized_emails")
        .update({ is_active: !email.is_active })
        .eq("id", email.id);

      if (error) throw error;
      toast.success(email.is_active ? "Email desativado" : "Email ativado");
      fetchEmails();
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!selectedEmail) return;

    setDeleting(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('delete-user', {
        body: { email: selectedEmail.email }
      });

      if (fnError) {
        console.error("Error deleting user:", fnError);
      }

      const { error } = await supabase
        .from("authorized_emails")
        .delete()
        .eq("id", selectedEmail.id);

      if (error) throw error;
      toast.success("Email e usuário removidos com sucesso");
      fetchEmails();
      setDeleteDialogOpen(false);
      setSelectedEmail(null);
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao remover email");
    } finally {
      setDeleting(false);
    }
  };

  // Access checker
  const handleCheckAccess = async () => {
    if (!checkEmail.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const normalized = checkEmail.toLowerCase().trim();
      const { data: emailProds, error } = await supabase
        .from("authorized_email_products")
        .select("product_id")
        .eq("email", normalized);

      if (error) throw error;

      const prodIds = (emailProds || []).map((ep: any) => ep.product_id);
      const matchedProducts = products.filter((p) => prodIds.includes(p.id));
      const allCards = [...new Set(matchedProducts.flatMap((p) => p.card_ids))];

      setCheckResult({ products: matchedProducts, cards: allCards });
    } catch (error) {
      console.error("Error checking access:", error);
      toast.error("Erro ao verificar acesso");
    } finally {
      setChecking(false);
    }
  };

  // Test email sender
  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      toast.error("Insira um email de destino");
      return;
    }
    setSendingTestEmail(true);
    try {
      const { error } = await supabase.functions.invoke('send-authorized-welcome', {
        body: { 
          email: testEmailAddress.toLowerCase().trim(),
          product_id: testEmailProduct || null,
          is_test: true
        }
      });

      if (error) throw error;
      toast.success(`Email de teste enviado para ${testEmailAddress}`);
      setTestEmailDialogOpen(false);
      setTestEmailAddress("");
      setTestEmailProduct("");
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(`Erro ao enviar: ${error.message || "erro desconhecido"}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Open edit products dialog
  const openEditProducts = (email: string) => {
    setEditProductsEmail(email);
    const currentProds = emailProductMap.get(email) || [];
    setEditProductsSelected(new Set(currentProds));
    setEditProductsDialogOpen(true);
  };

  // Save product changes and sync card access
  const handleSaveProducts = async () => {
    if (!editProductsEmail) return;
    setSavingProducts(true);
    try {
      const currentProds = emailProductMap.get(editProductsEmail) || [];
      const newProds = Array.from(editProductsSelected);

      // Products to remove
      const toRemove = currentProds.filter(p => !newProds.includes(p));
      // Products to add
      const toAdd = newProds.filter(p => !currentProds.includes(p));

      for (const prodId of toRemove) {
        await supabase
          .from("authorized_email_products")
          .delete()
          .eq("email", editProductsEmail)
          .eq("product_id", prodId);
      }

      for (const prodId of toAdd) {
        await supabase
          .from("authorized_email_products")
          .insert({
            email: editProductsEmail,
            product_id: prodId,
            access_start: new Date().toISOString(),
          });
      }

      // --- Sync gateway_card_user_access ---
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", editProductsEmail)
        .maybeSingle();

      if (profile?.user_id) {
        // Union of card_ids from ALL selected products
        const allCardIds = new Set<string>();
        for (const prodId of newProds) {
          const product = products.find(p => p.id === prodId);
          if (product?.card_ids) {
            for (const cardId of product.card_ids) {
              allCardIds.add(cardId);
            }
          }
        }

        // Current card access
        const { data: currentAccess } = await supabase
          .from("gateway_card_user_access")
          .select("card_id, has_access")
          .eq("user_id", profile.user_id);

        const currentCards = new Set(
          (currentAccess || []).filter(a => a.has_access).map(a => a.card_id)
        );

        // Cards to grant / revoke
        const cardsToGrant = Array.from(allCardIds).filter(c => !currentCards.has(c));
        const cardsToRevoke = Array.from(currentCards).filter(c => !allCardIds.has(c));

        for (const cardId of cardsToGrant) {
          await supabase
            .from("gateway_card_user_access")
            .upsert({
              user_id: profile.user_id,
              card_id: cardId,
              has_access: true,
              access_start: new Date().toISOString(),
            }, { onConflict: "user_id,card_id" });
        }

        for (const cardId of cardsToRevoke) {
          await supabase
            .from("gateway_card_user_access")
            .update({ has_access: false, access_end: new Date().toISOString() })
            .eq("user_id", profile.user_id)
            .eq("card_id", cardId);
        }

        const changes: string[] = [];
        if (cardsToGrant.length > 0) changes.push(`+${cardsToGrant.length} cards liberados`);
        if (cardsToRevoke.length > 0) changes.push(`-${cardsToRevoke.length} cards revogados`);

        toast.success(
          `Produtos atualizados! ${changes.length > 0 ? `(${changes.join(", ")})` : "(sem alteração de cards)"}`
        );
      } else {
        toast.success("Produtos atualizados! (usuário ainda não cadastrado, cards serão aplicados no signup)");
      }

      setEditProductsDialogOpen(false);
      fetchEmailProducts();
    } catch (error) {
      console.error("Error saving products:", error);
      toast.error("Erro ao salvar produtos");
    } finally {
      setSavingProducts(false);
    }
  };

  // Filter logic
  const filteredEmails = emails.filter((e) => {
    const matchesSearch = e.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedProductFilter === "all") return true;
    if (selectedProductFilter === "none") {
      return !emailProductMap.has(e.email) || emailProductMap.get(e.email)!.length === 0;
    }
    const prods = emailProductMap.get(e.email);
    return prods?.includes(selectedProductFilter) || false;
  });

  const getAuthBadge = (authorizedBy: string) => {
    switch (authorizedBy) {
      case "webhook":
        return <Badge variant="secondary">Webhook</Badge>;
      case "bulk":
        return <Badge variant="outline">Importação</Badge>;
      default:
        return <Badge>Manual</Badge>;
    }
  };

  const getEmailProducts = (email: string) => {
    const prodIds = emailProductMap.get(email) || [];
    return products.filter((p) => prodIds.includes(p.id));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Emails Autorizados
            </CardTitle>
            <CardDescription>
              Gerencie os emails que podem acessar a plataforma
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCheckDialogOpen(true)}>
              <ShieldCheck className="h-4 w-4 mr-1" />
              Verificar Acesso
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTestEmailDialogOpen(true)}>
              <Send className="h-4 w-4 mr-1" />
              Email Teste
            </Button>
            <Button variant="outline" size="sm" onClick={() => { fetchEmails(); fetchEmailProducts(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Importar
            </Button>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Todos os produtos</option>
              <option value="none">Sem produto vinculado</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Autorizado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum email encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmails.map((email) => {
                    const emailProducts = getEmailProducts(email.email);
                    return (
                      <TableRow key={email.id}>
                        <TableCell className="font-medium">{email.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {emailProducts.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              emailProducts.map((p) => (
                                <Badge key={p.id} variant="outline" className="text-xs">
                                  {p.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getAuthBadge(email.authorized_by)}</TableCell>
                        <TableCell>
                          {email.is_active ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(email.authorized_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditProducts(email.email)}
                              title="Editar produtos"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(email)}
                            >
                              {email.is_active ? "Desativar" : "Ativar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEmail(email);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          {filteredEmails.length > 100 
            ? `Mostrando 100 de ${filteredEmails.length} emails` 
            : `Total: ${filteredEmails.length} emails`
          }
        </div>
      </CardContent>

      {/* Add Email Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar Email</DialogTitle>
            <DialogDescription>
              Adicione um email para autorizar o acesso à plataforma
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">Email</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="usuario@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmailProduct">Produto</Label>
              <select
                id="newEmailProduct"
                value={newEmailProductId}
                onChange={(e) => setNewEmailProductId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Nenhum (apenas autorizar)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddEmail} disabled={addingEmail}>
              {addingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autorizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Emails em Massa</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo CSV ou TXT com os emails a serem autorizados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste um arquivo ou clique para selecionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx"
                onChange={handleBulkUpload}
                className="hidden"
                id="bulkUpload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingBulk}
              >
                {uploadingBulk ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Selecionar arquivo
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Email e Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o email <strong>{selectedEmail?.email}</strong>?
              <br /><br />
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remover a autorização de acesso</li>
                <li>Excluir o usuário do sistema (se existir)</li>
              </ul>
              <br />
              Se o email for reautorizado, o aluno precisará refazer o cadastro inicial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Access Checker Dialog */}
      <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Verificar Acesso de Email
            </DialogTitle>
            <DialogDescription>
              Digite um email para ver quais produtos e cards ele tem acesso
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="usuario@email.com"
                value={checkEmail}
                onChange={(e) => setCheckEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckAccess()}
              />
              <Button onClick={handleCheckAccess} disabled={checking || !checkEmail.trim()}>
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
              </Button>
            </div>

            {checkResult && (
              <div className="space-y-4 border rounded-lg p-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Produtos vinculados:</h4>
                  {checkResult.products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum produto vinculado a este email</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {checkResult.products.map((p) => (
                        <Badge key={p.id} variant="default">{p.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Cards liberados:</h4>
                  {checkResult.cards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum card liberado</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {checkResult.cards.map((c) => (
                        <Badge key={c} variant="secondary">{CARD_LABELS[c] || c}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Email de Boas-vindas (Teste)
            </DialogTitle>
            <DialogDescription>
              Envie um email de boas-vindas para testar o template. Não altera nenhum dado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email de destino</Label>
              <Input
                type="email"
                placeholder="destino@email.com"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Produto (template específico)</Label>
              <select
                value={testEmailProduct}
                onChange={(e) => setTestEmailProduct(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Template genérico (fallback)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Se existir um template específico para o produto selecionado, ele será usado. Caso contrário, usa o genérico.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendTestEmail} disabled={sendingTestEmail || !testEmailAddress.trim()}>
              {sendingTestEmail ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Products Dialog */}
      <Dialog open={editProductsDialogOpen} onOpenChange={setEditProductsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Produtos
            </DialogTitle>
            <DialogDescription>
              Gerencie os produtos vinculados a <strong>{editProductsEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {products.map((product) => (
              <label
                key={product.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={editProductsSelected.has(product.id)}
                  onCheckedChange={(checked) => {
                    setEditProductsSelected(prev => {
                      const next = new Set(prev);
                      if (checked) {
                        next.add(product.id);
                      } else {
                        next.delete(product.id);
                      }
                      return next;
                    });
                  }}
                />
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(product.card_ids || []).map(c => CARD_LABELS[c] || c).join(", ")}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProductsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProducts} disabled={savingProducts}>
              {savingProducts ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminAuthorizedEmails;
