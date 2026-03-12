import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, ExternalLink, MessageSquarePlus, RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlatformConfigRow {
  id: string;
  value: string | null;
  description: string | null;
  updated_at: string;
}

export function AdminPlatformConfig() {
  const queryClient = useQueryClient();
  const [suggestionsLink, setSuggestionsLink] = useState("");
  const [minAppVersion, setMinAppVersion] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["platform-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("*");
      
      if (error) throw error;
      return data as PlatformConfigRow[];
    },
    refetchOnWindowFocus: false,
  });

  // Initialize state when config loads
  useEffect(() => {
    if (config) {
      const link = config.find(c => c.id === "suggestions_link");
      if (link?.value) setSuggestionsLink(link.value);
      
      const version = config.find(c => c.id === "min_app_version");
      if (version?.value) setMinAppVersion(version.value);
    }
  }, [config]);

  const suggestionsValue = config?.find(c => c.id === "suggestions_link")?.value || "";
  const minVersionValue = config?.find(c => c.id === "min_app_version")?.value || "";

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string | null }) => {
      const { error } = await supabase
        .from("platform_config")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-config"] });
      toast.success("Configuração salva com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  const handleSaveSuggestionsLink = () => {
    updateMutation.mutate({ id: "suggestions_link", value: suggestionsLink || suggestionsValue });
  };

  const handleSaveMinAppVersion = () => {
    const valueToSave = minAppVersion.trim() || null;
    updateMutation.mutate({ id: "min_app_version", value: valueToSave });
  };

  const handleClearMinAppVersion = () => {
    setMinAppVersion("");
    updateMutation.mutate({ id: "min_app_version", value: null });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Versão Mínima Obrigatória */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Atualização Obrigatória
          </CardTitle>
          <CardDescription>
            Force todos os usuários a atualizar para uma versão específica do app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="min-version">Versão mínima obrigatória</Label>
            <div className="flex gap-2">
              <Input
                id="min-version"
                type="text"
                placeholder="Ex: 2026.01.24.1"
                value={minAppVersion}
                onChange={(e) => setMinAppVersion(e.target.value)}
                className="flex-1 font-mono"
              />
              {minVersionValue && (
                <Badge variant="secondary" className="flex items-center gap-1 px-3">
                  <AlertTriangle className="w-3 h-3" />
                  Ativo: {minVersionValue}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Quando definido, usuários com versão inferior serão forçados a atualizar sem opção de dispensar.
              Deixe vazio para desativar a atualização obrigatória.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveMinAppVersion}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
            {minVersionValue && (
              <Button
                variant="outline"
                onClick={handleClearMinAppVersion}
                disabled={updateMutation.isPending}
              >
                Desativar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Solicitações e Sugestões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5" />
            Solicitações e Sugestões
          </CardTitle>
          <CardDescription>
            Configure o link que aparece na tela inicial para os alunos enviarem sugestões
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="suggestions-link">Link externo</Label>
            <div className="flex gap-2">
              <Input
                id="suggestions-link"
                type="url"
                placeholder="https://forms.google.com/..."
                defaultValue={suggestionsValue}
                onChange={(e) => setSuggestionsLink(e.target.value)}
                className="flex-1"
              />
              {(suggestionsLink || suggestionsValue) && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(suggestionsLink || suggestionsValue, "_blank")}
                  title="Testar link"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cole aqui o link para o formulário ou página de sugestões (Google Forms, Typeform, etc.)
            </p>
          </div>

          <Button
            onClick={handleSaveSuggestionsLink}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}