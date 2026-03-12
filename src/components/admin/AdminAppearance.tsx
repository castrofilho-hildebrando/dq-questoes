import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Image, Upload, Loader2, Trash2, Eye, Save, Type } from "lucide-react";
import { gatewayCards, gatewayBanner, gatewayTexture } from "@/data/gatewayAssets";
import classicLoginBanner from "@/assets/gateway/login-banner.jpg";

// Map asset keys to their default bundled images
const DEFAULT_IMAGES: Record<string, string> = {
  gateway_banner: gatewayBanner,
  gateway_texture: gatewayTexture,
  card_dossie_if: gatewayCards["dossie-if"],
  card_codigo_if: gatewayCards["codigo-if"],
  card_conselho_if: gatewayCards["conselho-if"],
  card_mapa_questoes: gatewayCards["mapa-questoes"],
  card_banco_questoes: gatewayCards["banco-questoes"],
  card_robo_tutor: gatewayCards["robo-tutor"],
  card_revisao_tatica: gatewayCards["revisao-tatica"],
  card_materiais_dissecados: gatewayCards["materiais-dissecados"],
  card_dissertativa: gatewayCards["dissecando-dissertativa"],
  card_didatica: gatewayCards["dissecando-didatica"],
  card_comunidades: gatewayCards["comunidades-dissecadores"],
  login_banner: classicLoginBanner,
};

const ASSET_CATEGORIES = [
  {
    key: "gateway",
    label: "Área de Membros",
    assets: [
      { key: "gateway_banner", label: "Banner principal" },
      { key: "gateway_texture", label: "Textura de fundo" },
    ],
  },
  {
    key: "cards",
    label: "Capas dos Cards",
    assets: [
      { key: "card_dossie_if", label: "Dossiê IF" },
      { key: "card_codigo_if", label: "Código IF" },
      { key: "card_conselho_if", label: "O Conselho IF" },
      { key: "card_mapa_questoes", label: "Mapa das Questões" },
      { key: "card_banco_questoes", label: "Questões Ultraselecionadas" },
      { key: "card_robo_tutor", label: "Robô Tutor" },
      { key: "card_revisao_tatica", label: "Revisão Tática" },
      { key: "card_materiais_dissecados", label: "Materiais Dissecados" },
      { key: "card_dissertativa", label: "Dissecando a Dissertativa" },
      { key: "card_didatica", label: "Dissecando a Didática" },
      { key: "card_comunidades", label: "Comunidades Dissecadores" },
    ],
  },
  {
    key: "login",
    label: "Tela de Login",
    assets: [
      { key: "login_banner", label: "Banner do login" },
      { key: "login_texture", label: "Textura de fundo do login" },
    ],
  },
];

// Default texts that auto-populate the fields
const DEFAULT_TEXTS: Record<string, { label: string; defaultValue: string }> = {
  // Gateway texts
  "text_gateway_title": { label: "Título principal", defaultValue: "Ecossistema Dissecando Questões (DQ)" },
  "text_gateway_subtitle": { label: "Subtítulo", defaultValue: "Você Professor do IF em 2026!" },
  // Login texts
  "text_login_title": { label: "Título do login", defaultValue: "Dissecando Questões" },
  "text_login_description": { label: "Descrição do login", defaultValue: "A plataforma completa para sua aprovação nos Institutos Federais. Método exclusivo que acelera seu aprendizado." },
  "text_login_cta": { label: "CTA do login", defaultValue: "Você Professor do IF em 2026!" },
  // Card names
  "text_card_dossie_if_name": { label: "Nome do card", defaultValue: "Dossiê IF" },
  "text_card_dossie_if_desc": { label: "Descrição do card", defaultValue: "Acesse seu dossiê completo de estudos e acompanhe seu progresso." },
  "text_card_codigo_if_name": { label: "Nome do card", defaultValue: "Código IF" },
  "text_card_codigo_if_desc": { label: "Descrição do card", defaultValue: "Desvende os códigos e padrões das avaliações." },
  "text_card_conselho_if_name": { label: "Nome do card", defaultValue: "O Conselho IF" },
  "text_card_conselho_if_desc": { label: "Descrição do card", defaultValue: "Orientações estratégicas dos nossos especialistas." },
  "text_card_mapa_questoes_name": { label: "Nome do card", defaultValue: "Mapa das Questões" },
  "text_card_mapa_questoes_desc": { label: "Descrição do card", defaultValue: "Visualize o mapa completo das questões por tema e área." },
  "text_card_banco_questoes_name": { label: "Nome do card", defaultValue: "Questões Ultraselecionadas" },
  "text_card_banco_questoes_desc": { label: "Descrição do card", defaultValue: "Banco de questões curado com os melhores exercícios." },
  "text_card_robo_tutor_name": { label: "Nome do card", defaultValue: "Robô Tutor" },
  "text_card_robo_tutor_desc": { label: "Descrição do card", defaultValue: "Inteligência artificial para auxiliar seus estudos." },
  "text_card_revisao_tatica_name": { label: "Nome do card", defaultValue: "Revisão Tática" },
  "text_card_revisao_tatica_desc": { label: "Descrição do card", defaultValue: "Flashcards inteligentes para revisão estratégica." },
  "text_card_materiais_dissecados_name": { label: "Nome do card", defaultValue: "Materiais Dissecados" },
  "text_card_materiais_dissecados_desc": { label: "Descrição do card", defaultValue: "Materiais de estudo aprofundados e detalhados." },
  "text_card_dissertativa_name": { label: "Nome do card", defaultValue: "Dissecando a Dissertativa" },
  "text_card_dissertativa_desc": { label: "Descrição do card", defaultValue: "Domine a arte da dissertação com técnicas avançadas." },
  "text_card_didatica_name": { label: "Nome do card", defaultValue: "Dissecando a Didática" },
  "text_card_didatica_desc": { label: "Descrição do card", defaultValue: "Aperfeiçoe sua didática com métodos comprovados." },
  "text_card_comunidades_name": { label: "Nome do card", defaultValue: "Comunidades Dissecadores" },
  "text_card_comunidades_desc": { label: "Descrição do card", defaultValue: "Conecte-se com outros estudantes e troque experiências." },
};

const TEXT_SECTIONS = [
  {
    key: "textos_gateway",
    label: "Textos da Área de Membros",
    fields: ["text_gateway_title", "text_gateway_subtitle"],
  },
  {
    key: "textos_login",
    label: "Textos da Tela de Login",
    fields: ["text_login_title", "text_login_description", "text_login_cta"],
  },
  {
    key: "textos_cards",
    label: "Textos dos Cards",
    fields: Object.keys(DEFAULT_TEXTS).filter((k) => k.startsWith("text_card_")),
  },
];

// Group card text fields in pairs (name + desc)
function groupCardFields(fields: string[]) {
  const groups: { cardLabel: string; nameKey: string; descKey: string }[] = [];
  const nameFields = fields.filter((f) => f.endsWith("_name"));
  for (const nf of nameFields) {
    const base = nf.replace("_name", "");
    const df = `${base}_desc`;
    const cardLabel = DEFAULT_TEXTS[nf]?.defaultValue || nf;
    groups.push({ cardLabel, nameKey: nf, descKey: df });
  }
  return groups;
}

export function AdminAppearance() {
  const queryClient = useQueryClient();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [savingTexts, setSavingTexts] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  // Fetch current appearance assets from platform_config
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["appearance-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("*")
        .like("id", "appearance_%");
      if (error) throw error;
      return data || [];
    },
  });

  // Initialize text values from DB or defaults
  useEffect(() => {
    const values: Record<string, string> = {};
    for (const [key, def] of Object.entries(DEFAULT_TEXTS)) {
      const dbItem = configs.find((c) => c.id === `appearance_${key}`);
      values[key] = dbItem?.value || def.defaultValue;
    }
    setTextValues(values);
    setDirtyKeys(new Set());
  }, [configs]);

  const getAssetUrl = (key: string): string | null => {
    const item = configs.find((a) => a.id === `appearance_${key}`);
    return item?.value || null;
  };

  const handleTextChange = (key: string, value: string) => {
    setTextValues((prev) => ({ ...prev, [key]: value }));
    setDirtyKeys((prev) => new Set(prev).add(key));
  };

  const handleSaveTexts = async (keysToSave?: string[]) => {
    const keys = keysToSave || Array.from(dirtyKeys);
    if (keys.length === 0) {
      toast.info("Nenhuma alteração para salvar");
      return;
    }

    setSavingTexts(true);
    try {
      const upserts = keys.map((key) => ({
        id: `appearance_${key}`,
        value: textValues[key] || DEFAULT_TEXTS[key]?.defaultValue || "",
        description: `Aparência: ${DEFAULT_TEXTS[key]?.label || key}`,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("platform_config").upsert(upserts);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["appearance-assets"] });
      queryClient.invalidateQueries({ queryKey: ["appearance-config"] });
      setDirtyKeys(new Set());
      toast.success(`${keys.length} texto(s) salvo(s) com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingTexts(false);
    }
  };

  const handleUpload = async (assetKey: string, file: File) => {
    setUploadingKey(assetKey);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `appearance/${assetKey}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("platform-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("platform-assets")
        .getPublicUrl(filePath);

      const { error: configError } = await supabase
        .from("platform_config")
        .upsert({
          id: `appearance_${assetKey}`,
          value: urlData.publicUrl,
          description: `Aparência: ${assetKey}`,
          updated_at: new Date().toISOString(),
        });

      if (configError) throw configError;

      queryClient.invalidateQueries({ queryKey: ["appearance-assets"] });
      queryClient.invalidateQueries({ queryKey: ["appearance-config"] });
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(`Erro ao enviar imagem: ${err.message}`);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemove = async (assetKey: string) => {
    try {
      const { error } = await supabase
        .from("platform_config")
        .delete()
        .eq("id", `appearance_${assetKey}`);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["appearance-assets"] });
      queryClient.invalidateQueries({ queryKey: ["appearance-config"] });
      toast.success("Imagem removida");
    } catch (err: any) {
      toast.error(`Erro ao remover: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const renderImageAsset = (assetKey: string, label: string) => {
    const currentUrl = getAssetUrl(assetKey);
    const isUploading = uploadingKey === assetKey;

    return (
      <Card key={assetKey} className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Image className="w-4 h-4" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentUrl ? (
            <div className="relative group">
              <img
                src={currentUrl}
                alt={label}
                className="w-full h-32 object-cover rounded-md border border-border"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => window.open(currentUrl, "_blank")}>
                  <Eye className="w-4 h-4 mr-1" /> Ver
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleRemove(assetKey)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Remover
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-32 border-2 border-dashed border-border rounded-md overflow-hidden">
              {DEFAULT_IMAGES[assetKey] ? (
                <>
                  <img
                    src={DEFAULT_IMAGES[assetKey]}
                    alt={`Padrão: ${label}`}
                    className="w-full h-full object-cover opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-background/80 text-muted-foreground text-xs px-2 py-1 rounded">
                      Imagem padrão
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem imagem padrão
                </div>
              )}
            </div>
          )}
          <div>
            <Label htmlFor={`upload-${assetKey}`} className="cursor-pointer">
              <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {currentUrl ? "Trocar imagem" : "Enviar imagem"}
              </div>
            </Label>
            <Input
              id={`upload-${assetKey}`}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(assetKey, file);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Aparência da Plataforma
          </CardTitle>
          <CardDescription>
            Gerencie imagens, textos dos cards, títulos e descrições da área de membros e tela de login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="textos_gateway" className="w-full">
            <TabsList className="mb-6 flex-wrap h-auto gap-1">
              {TEXT_SECTIONS.map((sec) => (
                <TabsTrigger key={sec.key} value={sec.key}>
                  <Type className="w-3 h-3 mr-1" />
                  {sec.label}
                </TabsTrigger>
              ))}
              {ASSET_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.key} value={cat.key}>
                  <Image className="w-3 h-3 mr-1" />
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Text sections */}
            {TEXT_SECTIONS.map((section) => (
              <TabsContent key={section.key} value={section.key}>
                <div className="space-y-6">
                  {section.key === "textos_cards" ? (
                    // Grouped card fields (name + desc pairs)
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {groupCardFields(section.fields).map((group) => (
                        <Card key={group.nameKey}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">{group.cardLabel}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Nome</Label>
                              <Input
                                value={textValues[group.nameKey] || ""}
                                onChange={(e) => handleTextChange(group.nameKey, e.target.value)}
                                className={dirtyKeys.has(group.nameKey) ? "border-primary" : ""}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Descrição</Label>
                              <Textarea
                                value={textValues[group.descKey] || ""}
                                onChange={(e) => handleTextChange(group.descKey, e.target.value)}
                                rows={2}
                                className={dirtyKeys.has(group.descKey) ? "border-primary" : ""}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    // Regular text fields
                    <div className="grid grid-cols-1 gap-4 max-w-2xl">
                      {section.fields.map((fieldKey) => {
                        const def = DEFAULT_TEXTS[fieldKey];
                        if (!def) return null;
                        const isLongText = def.defaultValue.length > 60;
                        return (
                          <div key={fieldKey}>
                            <Label className="text-sm font-medium">{def.label}</Label>
                            {isLongText ? (
                              <Textarea
                                value={textValues[fieldKey] || ""}
                                onChange={(e) => handleTextChange(fieldKey, e.target.value)}
                                rows={3}
                                className={dirtyKeys.has(fieldKey) ? "border-primary" : ""}
                              />
                            ) : (
                              <Input
                                value={textValues[fieldKey] || ""}
                                onChange={(e) => handleTextChange(fieldKey, e.target.value)}
                                className={dirtyKeys.has(fieldKey) ? "border-primary" : ""}
                              />
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Padrão: {def.defaultValue}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Save button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => handleSaveTexts(section.fields.filter((f) => dirtyKeys.has(f)))}
                      disabled={savingTexts || !section.fields.some((f) => dirtyKeys.has(f))}
                    >
                      {savingTexts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Salvar alterações
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}

            {/* Image sections */}
            {ASSET_CATEGORIES.map((cat) => (
              <TabsContent key={cat.key} value={cat.key}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cat.assets.map((asset) => renderImageAsset(asset.key, asset.label))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
