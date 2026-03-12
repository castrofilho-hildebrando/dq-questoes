import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Unlock, Search, UserPlus, Trash2, Shield } from "lucide-react";

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
};

export function AdminCardAccess() {
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [addEmail, setAddEmail] = useState("");

  // Fetch global card configs
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["gateway-cards-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gateway_cards_config" as any)
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch user access for selected card
  const { data: userAccessList = [], isLoading: loadingAccess } = useQuery({
    queryKey: ["gateway-card-user-access-admin", selectedCard],
    queryFn: async () => {
      if (!selectedCard) return [];
      const { data, error } = await supabase
        .from("gateway_card_user_access" as any)
        .select("*")
        .eq("card_id", selectedCard);
      if (error) throw error;

      // Enrich with user emails
      const userIds = (data || []).map((d: any) => d.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds);

      return (data || []).map((access: any) => {
        const profile = profiles?.find((p) => p.user_id === access.user_id);
        return { ...access, email: profile?.email, full_name: profile?.full_name };
      });
    },
    enabled: !!selectedCard,
  });

  // Toggle global default
  const toggleDefault = useMutation({
    mutationFn: async ({ cardId, unlocked }: { cardId: string; unlocked: boolean }) => {
      const { error } = await supabase
        .from("gateway_cards_config" as any)
        .update({ is_unlocked_default: unlocked, updated_at: new Date().toISOString() } as any)
        .eq("card_id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-cards-config"] });
      toast.success("Configuração atualizada");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Add user access
  const addUserAccess = useMutation({
    mutationFn: async ({ cardId, email }: { cardId: string; email: string }) => {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error("Aluno não encontrado com esse e-mail");

      const { error } = await supabase
        .from("gateway_card_user_access" as any)
        .upsert({
          card_id: cardId,
          user_id: profile.user_id,
          has_access: true,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "card_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-card-user-access-admin", selectedCard] });
      setAddEmail("");
      toast.success("Acesso concedido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Remove user access
  const removeUserAccess = useMutation({
    mutationFn: async (accessId: string) => {
      const { error } = await supabase
        .from("gateway_card_user_access" as any)
        .delete()
        .eq("id", accessId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-card-user-access-admin", selectedCard] });
      toast.success("Acesso removido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Acesso aos Cards da Área de Membros
          </CardTitle>
          <CardDescription>
            Gerencie quais cards estão desbloqueados por padrão e conceda acesso individual a alunos específicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="global" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="global">Configuração Global</TabsTrigger>
              <TabsTrigger value="individual">Acesso Individual</TabsTrigger>
            </TabsList>

            {/* Global config */}
            <TabsContent value="global">
              <div className="space-y-3">
                {cards.map((card: any) => (
                  <div
                    key={card.card_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      {card.is_unlocked_default ? (
                        <Unlock className="w-5 h-5 text-green-500" />
                      ) : (
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{CARD_LABELS[card.card_id] || card.card_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {card.is_unlocked_default ? "Desbloqueado para todos" : "Bloqueado por padrão"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={card.is_unlocked_default ? "default" : "secondary"}>
                        {card.is_unlocked_default ? "Desbloqueado" : "Bloqueado"}
                      </Badge>
                      <Switch
                        checked={card.is_unlocked_default}
                        onCheckedChange={(checked) =>
                          toggleDefault.mutate({ cardId: card.card_id, unlocked: checked })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Individual access */}
            <TabsContent value="individual">
              <div className="space-y-6">
                {/* Card selector */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Selecione o card</Label>
                  <div className="flex flex-wrap gap-2">
                    {cards.map((card: any) => (
                      <Button
                        key={card.card_id}
                        variant={selectedCard === card.card_id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCard(card.card_id)}
                      >
                        {card.is_unlocked_default ? (
                          <Unlock className="w-3 h-3 mr-1" />
                        ) : (
                          <Lock className="w-3 h-3 mr-1" />
                        )}
                        {CARD_LABELS[card.card_id] || card.card_id}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedCard && (
                  <>
                    {/* Add user */}
                    <div className="flex gap-2 max-w-md">
                      <Input
                        placeholder="E-mail do aluno..."
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && addEmail.trim()) {
                            addUserAccess.mutate({ cardId: selectedCard, email: addEmail });
                          }
                        }}
                      />
                      <Button
                        onClick={() => addUserAccess.mutate({ cardId: selectedCard, email: addEmail })}
                        disabled={!addEmail.trim() || addUserAccess.isPending}
                      >
                        {addUserAccess.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4 mr-1" />
                        )}
                        Conceder
                      </Button>
                    </div>

                    {/* User list */}
                    {loadingAccess ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : userAccessList.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        Nenhum acesso individual configurado para este card.
                        {cards.find((c: any) => c.card_id === selectedCard)?.is_unlocked_default
                          ? " (Este card já está desbloqueado para todos)"
                          : " Adicione alunos acima para conceder acesso."}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Aluno</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Acesso</TableHead>
                            <TableHead className="w-[80px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userAccessList
                            .filter((a: any) =>
                              !searchEmail || a.email?.toLowerCase().includes(searchEmail.toLowerCase())
                            )
                            .map((access: any) => (
                              <TableRow key={access.id}>
                                <TableCell>{access.full_name || "—"}</TableCell>
                                <TableCell className="text-sm">{access.email || access.user_id}</TableCell>
                                <TableCell>
                                  <Badge variant={access.has_access ? "default" : "destructive"}>
                                    {access.has_access ? "Liberado" : "Bloqueado"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeUserAccess.mutate(access.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
