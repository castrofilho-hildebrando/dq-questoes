import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Download, 
  Webhook, 
  Copy, 
  Check, 
  Loader2, 
  Users, 
  FileSpreadsheet,
  Calendar,
  Database,
  BarChart3,
  Plus,
  Trash2,
  RefreshCw
} from "lucide-react";
import { format, subDays } from "date-fns";

interface UserExportData {
  user_id: string;
  email: string;
  full_name: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  accuracy_rate: number;
  last_activity: string;
}

interface WebhookField {
  id: string;
  field_name: string;
  display_order: number;
  is_active: boolean;
}

interface OfferWebhook {
  id: string;
  name: string;
  is_active: boolean;
}

const AdminIntegrations = () => {
  const queryClient = useQueryClient();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportPeriod, setExportPeriod] = useState("30");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const [includeUserInfo, setIncludeUserInfo] = useState(true);
  const [includeStats, setIncludeStats] = useState(true);
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [includeNotebooks, setIncludeNotebooks] = useState(false);
  
  // Webhook fields management
  const [newFieldName, setNewFieldName] = useState("");
  const [addingField, setAddingField] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "pwgordrpgfxhcczsnqpk";
  // Token is managed server-side only - not exposed in client code
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/guru-webhook`;

  // Fetch offer webhooks (without secrets - secrets are managed server-side only)
  const { data: offerWebhooks, refetch: refetchWebhooks } = useQuery({
    queryKey: ["offer-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offer_webhooks")
        .select("id, name, is_active")
        .order("created_at");
      if (error) throw error;
      return data as OfferWebhook[];
    },
  });

  // Fetch webhook email fields
  const { data: webhookFields, refetch: refetchFields } = useQuery({
    queryKey: ["webhook-email-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_email_fields")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as WebhookField[];
    },
  });

  // Fetch users for export filter
  const { data: users } = useQuery({
    queryKey: ["admin-users-export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch disciplines
  const { data: disciplines } = useQuery({
    queryKey: ["admin-disciplines-export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_disciplines")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const handleAddField = async () => {
    if (!newFieldName.trim()) {
      toast.error("Digite o nome do campo");
      return;
    }
    
    setAddingField(true);
    try {
      const maxOrder = Math.max(...(webhookFields?.map(f => f.display_order) || [0]), 0);
      const { error } = await supabase
        .from("webhook_email_fields")
        .insert({ field_name: newFieldName.trim(), display_order: maxOrder + 1 });
      
      if (error) throw error;
      
      toast.success("Campo adicionado com sucesso");
      setNewFieldName("");
      refetchFields();
    } catch (error) {
      console.error("Error adding field:", error);
      toast.error("Erro ao adicionar campo");
    } finally {
      setAddingField(false);
    }
  };

  const handleToggleField = async (field: WebhookField) => {
    try {
      const { error } = await supabase
        .from("webhook_email_fields")
        .update({ is_active: !field.is_active })
        .eq("id", field.id);
      
      if (error) throw error;
      refetchFields();
    } catch (error) {
      console.error("Error toggling field:", error);
      toast.error("Erro ao atualizar campo");
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from("webhook_email_fields")
        .delete()
        .eq("id", fieldId);
      
      if (error) throw error;
      
      toast.success("Campo removido");
      refetchFields();
    } catch (error) {
      console.error("Error deleting field:", error);
      toast.error("Erro ao remover campo");
    }
  };

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };


  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const days = parseInt(exportPeriod);
      const startDate = days > 0 ? subDays(new Date(), days).toISOString() : null;

      // Build query for user answers with stats
      let answersQuery = supabase
        .from("user_answers")
        .select(`
          user_id,
          is_correct,
          answered_at,
          profiles!inner(email, full_name)
        `);
      
      if (startDate) {
        answersQuery = answersQuery.gte("answered_at", startDate);
      }

      if (selectedUser !== "all") {
        answersQuery = answersQuery.eq("user_id", selectedUser);
      }

      const { data: answers, error } = await answersQuery;

      if (error) throw error;

      // Group by user
      const userStats: Record<string, UserExportData> = {};

      answers?.forEach((answer: any) => {
        const userId = answer.user_id;
        if (!userStats[userId]) {
          userStats[userId] = {
            user_id: userId,
            email: answer.profiles?.email || "",
            full_name: answer.profiles?.full_name || "",
            total_questions: 0,
            correct_answers: 0,
            wrong_answers: 0,
            accuracy_rate: 0,
            last_activity: answer.answered_at,
          };
        }
        userStats[userId].total_questions++;
        if (answer.is_correct) {
          userStats[userId].correct_answers++;
        } else {
          userStats[userId].wrong_answers++;
        }
        if (answer.answered_at > userStats[userId].last_activity) {
          userStats[userId].last_activity = answer.answered_at;
        }
      });

      // Calculate accuracy rate
      Object.values(userStats).forEach((user) => {
        user.accuracy_rate = user.total_questions > 0 
          ? Math.round((user.correct_answers / user.total_questions) * 100) 
          : 0;
      });

      const exportData = Object.values(userStats);

      if (exportData.length === 0) {
        toast.info("Nenhum dado encontrado para exportar");
        return;
      }

      // Generate CSV
      const headers = [
        "ID do Usuário",
        "Email",
        "Nome",
        "Total de Questões",
        "Acertos",
        "Erros",
        "Taxa de Acerto (%)",
        "Última Atividade"
      ];

      const rows = exportData.map((user) => [
        user.user_id,
        user.email,
        user.full_name,
        user.total_questions,
        user.correct_answers,
        user.wrong_answers,
        user.accuracy_rate,
        format(new Date(user.last_activity), "dd/MM/yyyy HH:mm")
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
      ].join("\n");

      // Download file
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio-usuarios-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      toast.success(`${exportData.length} registros exportados com sucesso!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportDetailedCSV = async () => {
    setExportLoading(true);
    try {
      const days = parseInt(exportPeriod);
      const startDate = days > 0 ? subDays(new Date(), days).toISOString() : null;

      let query = supabase
        .from("user_answers")
        .select(`
          user_id,
          is_correct,
          selected_answer,
          answered_at,
          profiles!inner(email, full_name),
          questions!inner(
            code,
            question,
            answer,
            study_discipline_id,
            study_disciplines(name),
            study_topics(name)
          )
        `)
        .order("answered_at", { ascending: false });
      
      if (startDate) {
        query = query.gte("answered_at", startDate);
      }

      if (selectedUser !== "all") {
        query = query.eq("user_id", selectedUser);
      }

      if (selectedDiscipline !== "all") {
        query = query.eq("questions.study_discipline_id", selectedDiscipline);
      }

      const { data: answers, error } = await query;

      if (error) throw error;

      if (!answers || answers.length === 0) {
        toast.info("Nenhum dado encontrado para exportar");
        return;
      }

      // Generate detailed CSV
      const headers = [
        "Data/Hora",
        "Email",
        "Nome",
        "Código da Questão",
        "Disciplina",
        "Tópico",
        "Resposta Selecionada",
        "Resposta Correta",
        "Acertou"
      ];

      const rows = answers.map((answer: any) => [
        format(new Date(answer.answered_at), "dd/MM/yyyy HH:mm"),
        answer.profiles?.email || "",
        answer.profiles?.full_name || "",
        answer.questions?.code || "",
        answer.questions?.study_disciplines?.name || "",
        answer.questions?.study_topics?.name || "",
        answer.selected_answer || "",
        answer.questions?.answer || "",
        answer.is_correct ? "Sim" : "Não"
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio-detalhado-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      toast.success(`${answers.length} respostas exportadas com sucesso!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportFullPlatformData = async () => {
    setExportLoading(true);
    try {
      const days = parseInt(exportPeriod);
      const startDate = days > 0 ? subDays(new Date(), days).toISOString() : null;

      let csvSections: string[] = [];

      // User info section
      if (includeUserInfo) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, is_active, last_access_at, created_at")
          .order("created_at", { ascending: false });

        if (profiles && profiles.length > 0) {
          csvSections.push("INFORMAÇÕES DOS USUÁRIOS");
          csvSections.push("ID,Email,Nome,Ativo,Último Acesso,Criado em");
          profiles.forEach((p: any) => {
            csvSections.push(`"${p.user_id}","${p.email}","${p.full_name || ''}","${p.is_active ? 'Sim' : 'Não'}","${p.last_access_at ? format(new Date(p.last_access_at), 'dd/MM/yyyy HH:mm') : 'Nunca'}","${format(new Date(p.created_at), 'dd/MM/yyyy')}"`);
          });
          csvSections.push("");
        }
      }

      // Stats section
      if (includeStats) {
        // First fetch all profiles
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name");
        
        const profilesMap: Record<string, { email: string; full_name: string }> = {};
        allProfiles?.forEach((p: any) => {
          profilesMap[p.user_id] = { email: p.email, full_name: p.full_name || '' };
        });

        let answersQuery = supabase
          .from("user_answers")
          .select(`
            user_id,
            is_correct,
            answered_at,
            questions!inner(
              study_discipline_id,
              study_disciplines(name)
            )
          `);
        
        if (startDate) {
          answersQuery = answersQuery.gte("answered_at", startDate);
        }

        const { data: answers } = await answersQuery;

        if (answers && answers.length > 0) {
          // Group stats by user and discipline
          const userDisciplineStats: Record<string, Record<string, { total: number; correct: number }>> = {};
          
          answers.forEach((a: any) => {
            const userId = a.user_id;
            const discName = a.questions?.study_disciplines?.name || 'Sem disciplina';
            
            if (!userDisciplineStats[userId]) {
              userDisciplineStats[userId] = {};
            }
            if (!userDisciplineStats[userId][discName]) {
              userDisciplineStats[userId][discName] = { total: 0, correct: 0 };
            }
            userDisciplineStats[userId][discName].total++;
            if (a.is_correct) userDisciplineStats[userId][discName].correct++;
          });

          csvSections.push("ESTATÍSTICAS POR USUÁRIO E DISCIPLINA");
          csvSections.push("Email,Nome,Disciplina,Total,Acertos,Erros,Taxa de Acerto");
          
          Object.entries(userDisciplineStats).forEach(([userId, disciplines]) => {
            const profile = profilesMap[userId] || { email: '', full_name: '' };
            
            Object.entries(disciplines).forEach(([discName, stats]) => {
              const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
              csvSections.push(`"${profile.email}","${profile.full_name}","${discName}",${stats.total},${stats.correct},${stats.total - stats.correct},${rate}%`);
            });
          });
          csvSections.push("");
        }
      }

      // Answers section
      if (includeAnswers) {
        // First fetch all profiles
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name");
        
        const profilesMap: Record<string, { email: string; full_name: string }> = {};
        allProfiles?.forEach((p: any) => {
          profilesMap[p.user_id] = { email: p.email, full_name: p.full_name || '' };
        });

        let answersQuery = supabase
          .from("user_answers")
          .select(`
            user_id,
            is_correct,
            selected_answer,
            answered_at,
            questions!inner(code, answer, study_disciplines(name), study_topics(name))
          `)
          .order("answered_at", { ascending: false })
          .limit(10000);
        
        if (startDate) {
          answersQuery = answersQuery.gte("answered_at", startDate);
        }

        const { data: answers } = await answersQuery;

        if (answers && answers.length > 0) {
          csvSections.push("RESPOSTAS INDIVIDUAIS");
          csvSections.push("Data/Hora,Email,Nome,Código,Disciplina,Tópico,Resposta,Correta,Acertou");
          
          answers.forEach((a: any) => {
            const profile = profilesMap[a.user_id] || { email: '', full_name: '' };
            csvSections.push(`"${format(new Date(a.answered_at), 'dd/MM/yyyy HH:mm')}","${profile.email}","${profile.full_name}","${a.questions?.code || ''}","${a.questions?.study_disciplines?.name || ''}","${a.questions?.study_topics?.name || ''}","${a.selected_answer || ''}","${a.questions?.answer || ''}","${a.is_correct ? 'Sim' : 'Não'}"`);
          });
          csvSections.push("");
        }
      }

      // Notebooks section
      if (includeNotebooks) {
        // First fetch all profiles
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name");
        
        const profilesMap: Record<string, { email: string; full_name: string }> = {};
        allProfiles?.forEach((p: any) => {
          profilesMap[p.user_id] = { email: p.email, full_name: p.full_name || '' };
        });

        const { data: notebooks } = await supabase
          .from("study_notebooks")
          .select(`
            id,
            name,
            created_at,
            user_id
          `)
          .order("created_at", { ascending: false });

        if (notebooks && notebooks.length > 0) {
          csvSections.push("CADERNOS DE QUESTÕES");
          csvSections.push("ID,Nome do Caderno,Email do Usuário,Nome do Usuário,Criado em");
          
          notebooks.forEach((n: any) => {
            const profile = profilesMap[n.user_id] || { email: '', full_name: '' };
            csvSections.push(`"${n.id}","${n.name}","${profile.email}","${profile.full_name}","${format(new Date(n.created_at), 'dd/MM/yyyy')}"`);
          });
          csvSections.push("");
        }
      }

      if (csvSections.length === 0) {
        toast.info("Nenhum dado selecionado para exportar");
        return;
      }

      const csvContent = csvSections.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `exportacao-completa-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="webhook" className="space-y-6">
        <TabsList>
          <TabsTrigger value="webhook" className="flex items-center gap-2">
            <Webhook className="w-4 h-4" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="platform-export" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Exportar Plataforma
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhook" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Webhook Guru Manager
              </CardTitle>
              <CardDescription>
                Configure este webhook na plataforma Guru para autorizar emails automaticamente quando uma compra é realizada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input 
                    value={webhookUrl} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" onClick={handleCopyWebhook}>
                    {copiedWebhook ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Como configurar na Guru:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Acesse a plataforma Guru Manager</li>
                  <li>Vá em Configurações → Webhooks</li>
                  <li>Adicione um novo webhook com a URL acima (já contém o token de autenticação)</li>
                  <li>Selecione os eventos de "Compra Aprovada"</li>
                  <li>Salve as configurações</li>
                </ol>
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Campos do payload para buscar email:</h4>
                  <Button variant="ghost" size="sm" onClick={() => refetchFields()}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {webhookFields?.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={field.is_active}
                          onCheckedChange={() => handleToggleField(field)}
                        />
                        <code className="text-sm font-mono">{field.field_name}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteField(field.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do campo (ex: client_email ou payload.contact.email)"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleAddField} disabled={addingField}>
                    {addingField ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  O webhook irá buscar o email nos campos ativos acima, na ordem de prioridade listada. 
                  Suporta caminhos aninhados como <code className="bg-muted px-1 rounded">payload.contact.email</code> ou <code className="bg-muted px-1 rounded">contact.email</code>.
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Teste o webhook</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Você pode testar o webhook usando o curl ou qualquer ferramenta de requisições HTTP.
                  O token de autenticação é gerenciado internamente no servidor.
                </p>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
{`curl -X POST "${webhookUrl}?token=SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"contact": {"email": "teste@exemplo.com"}}'`}
                </pre>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ O token real está configurado no servidor. Contate o administrador para obter o token correto.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Relatórios de Desempenho
              </CardTitle>
              <CardDescription>
                Gere relatórios de desempenho dos usuários com filtros personalizados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Período
                  </Label>
                  <Select value={exportPeriod} onValueChange={setExportPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                      <SelectItem value="365">Último ano</SelectItem>
                      <SelectItem value="0">Todo o período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Usuário
                  </Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Disciplina</Label>
                  <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as disciplinas</SelectItem>
                      {disciplines?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Relatório Resumido</CardTitle>
                    <CardDescription className="text-xs">
                      Um registro por usuário com estatísticas gerais
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={handleExportCSV} 
                      disabled={exportLoading}
                      className="w-full"
                    >
                      {exportLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Exportar CSV Resumido
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Relatório Detalhado</CardTitle>
                    <CardDescription className="text-xs">
                      Cada resposta individual com disciplina e tópico
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={handleExportDetailedCSV} 
                      disabled={exportLoading}
                      variant="outline"
                      className="w-full"
                    >
                      {exportLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Exportar CSV Detalhado
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Campos exportados</h4>
                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <div>
                    <p className="font-medium text-xs text-muted-foreground mb-1">Resumido:</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Email e nome do usuário</li>
                      <li>• Total de questões respondidas</li>
                      <li>• Acertos e erros</li>
                      <li>• Taxa de acerto</li>
                      <li>• Última atividade</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-xs text-muted-foreground mb-1">Detalhado:</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Data e hora de cada resposta</li>
                      <li>• Código da questão</li>
                      <li>• Disciplina e tópico</li>
                      <li>• Resposta selecionada</li>
                      <li>• Se acertou ou errou</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform-export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Exportar Dados da Plataforma
              </CardTitle>
              <CardDescription>
                Exporte todos os dados do dashboard dos usuários para importar em outra plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Período
                </Label>
                <Select value={exportPeriod} onValueChange={setExportPeriod}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="365">Último ano</SelectItem>
                    <SelectItem value="0">Todo o período</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">Selecione os dados a exportar:</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-users" 
                      checked={includeUserInfo}
                      onCheckedChange={(checked) => setIncludeUserInfo(!!checked)}
                    />
                    <label htmlFor="include-users" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Informações dos usuários
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-stats" 
                      checked={includeStats}
                      onCheckedChange={(checked) => setIncludeStats(!!checked)}
                    />
                    <label htmlFor="include-stats" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Estatísticas por disciplina
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-answers" 
                      checked={includeAnswers}
                      onCheckedChange={(checked) => setIncludeAnswers(!!checked)}
                    />
                    <label htmlFor="include-answers" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Todas as respostas individuais
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-notebooks" 
                      checked={includeNotebooks}
                      onCheckedChange={(checked) => setIncludeNotebooks(!!checked)}
                    />
                    <label htmlFor="include-notebooks" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Cadernos de questões
                    </label>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleExportFullPlatformData} 
                disabled={exportLoading || (!includeUserInfo && !includeStats && !includeAnswers && !includeNotebooks)}
                size="lg"
                className="w-full"
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Exportar Dados Completos
              </Button>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Sobre a exportação</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• O arquivo CSV exportado é compatível com Excel, Google Sheets e outras ferramentas</li>
                  <li>• Os dados estão organizados em seções separadas</li>
                  <li>• Ideal para migração de dados ou análise em ferramentas externas</li>
                  <li>• A exportação de respostas individuais está limitada a 10.000 registros</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminIntegrations;
