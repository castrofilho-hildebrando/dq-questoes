import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Sparkles } from "lucide-react";

interface Course { id: string; title: string; }

interface PromptConfig {
  id?: string;
  prompt_type: string;
  prompt_text: string;
  model_settings: any;
  course_id: string | null;
  discipline_id: string | null;
  is_active: boolean;
  version: number;
}

const PROMPT_TYPES = [
  {
    type: "generate_question",
    label: "1. Geração de Questão",
    description: "Prompt para gerar questões inéditas a partir de um tópico.",
    variables: ["{{topico}}", "{{disciplina}}", "{{exam_context_json}}"],
  },
  {
    type: "generate_answer_key",
    label: "2. Gabarito Comentado",
    description: "Prompt para gerar o padrão de resposta / gabarito comentado.",
    variables: ["{{enunciado}}", "{{topico}}", "{{disciplina}}", "{{exam_context_json}}"],
  },
  {
    type: "generate_model_answer",
    label: "3. Resposta-Modelo",
    description: "Prompt para gerar uma resposta-modelo baseada no gabarito.",
    variables: ["{{enunciado}}", "{{padrao_resposta}}", "{{topico}}", "{{disciplina}}", "{{exam_context_json}}"],
  },
  {
    type: "correct_answer",
    label: "4. Correção",
    description: "Prompt para corrigir a resposta do aluno.",
    variables: ["{{enunciado}}", "{{padrao_resposta}}", "{{resposta_aluno}}", "{{exam_context_json}}"],
  },
];

export function AdminDissertativePrompts() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [prompts, setPrompts] = useState<Record<string, PromptConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("dissertative_courses").select("id, title").order("title")
      .then(({ data }) => setCourses(data || []));
  }, []);

  useEffect(() => {
    const loadPrompts = async () => {
      setLoading(true);
      if (!selectedCourse) { setPrompts({}); setLoading(false); return; }

      const { data } = await supabase
        .from("dissertative_prompt_templates")
        .select("*")
        .eq("course_id", selectedCourse)
        .order("version", { ascending: false });

      const map: Record<string, PromptConfig> = {};
      (data || []).forEach((p: any) => {
        if (!map[p.prompt_type]) map[p.prompt_type] = p;
      });
      setPrompts(map);
      setLoading(false);
    };
    loadPrompts();
  }, [selectedCourse]);

  const handleSave = async (promptType: string) => {
    setSaving(promptType);
    const existing = prompts[promptType];

    if (existing?.id) {
      const { error } = await supabase
        .from("dissertative_prompt_templates")
        .update({
          prompt_text: existing.prompt_text,
          is_active: existing.is_active,
          model_settings: existing.model_settings,
        })
        .eq("id", existing.id);
      if (error) toast.error(error.message);
      else toast.success("Prompt salvo");
    } else if (existing?.prompt_text) {
      const { error } = await supabase
        .from("dissertative_prompt_templates")
        .insert({
          prompt_type: promptType,
          prompt_text: existing.prompt_text,
          course_id: selectedCourse,
          discipline_id: null,
          is_active: true,
          version: 1,
        });
      if (error) toast.error(error.message);
      else toast.success("Prompt criado");
    }
    setSaving(null);
  };

  const updatePrompt = (type: string, field: string, value: any) => {
    setPrompts(prev => ({
      ...prev,
      [type]: {
        ...(prev[type] || { prompt_type: type, prompt_text: "", is_active: true, version: 1, course_id: null, discipline_id: null, model_settings: null }),
        [field]: value,
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Prompts da Dissertativa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <Label className="text-xs">Curso</Label>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
            <SelectContent>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {PROMPT_TYPES.map(pt => {
              const prompt = prompts[pt.type];
              return (
                <div key={pt.type} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">{pt.label}</h4>
                      <p className="text-xs text-muted-foreground">{pt.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={prompt?.is_active ?? true}
                        onCheckedChange={v => updatePrompt(pt.type, "is_active", v)}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSave(pt.type)}
                        disabled={saving === pt.type || !selectedCourse}
                      >
                        {saving === pt.type ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Variáveis: {pt.variables.join(", ")}
                    </Label>
                    <Textarea
                      rows={8}
                      className="font-mono text-xs mt-1"
                      placeholder="Digite o prompt aqui..."
                      value={prompt?.prompt_text || ""}
                      onChange={e => updatePrompt(pt.type, "prompt_text", e.target.value)}
                    />
                  </div>
                  {prompt?.id && (
                    <p className="text-xs text-muted-foreground">
                      Versão {prompt.version} · {prompt.is_active ? "Ativo" : "Inativo"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
