import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Save, FileJson, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

interface ExamContext {
  id: string;
  course_id: string | null;
  exam_name: string;
  exam_code: string;
  context_json: Record<string, unknown>;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Course {
  id: string;
  title: string;
}

export function AdminDissertativeExamContexts() {
  const [contexts, setContexts] = useState<ExamContext[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourseId, setFilterCourseId] = useState<string>("all");

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    course_id: "" as string,
    exam_name: "",
    exam_code: "",
    context_json_text: "",
    version: 1,
    is_active: true,
  });
  const [jsonValid, setJsonValid] = useState<boolean | null>(null);

  useEffect(() => {
    fetchCourses();
    fetchContexts();
  }, []);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from("dissertative_courses")
      .select("id, title")
      .order("display_order");
    if (data) setCourses(data);
  };

  const fetchContexts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dissertative_exam_contexts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar contextos");
    } else {
      setContexts((data || []) as ExamContext[]);
    }
    setLoading(false);
  };

  const validateJson = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
      return true;
    } catch {
      return false;
    }
  };

  const handleValidateJson = () => {
    const valid = validateJson(formData.context_json_text);
    setJsonValid(valid);
    if (valid) {
      toast.success("JSON válido!");
    } else {
      toast.error("JSON inválido. Verifique a sintaxe.");
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData({
      course_id: filterCourseId !== "all" ? filterCourseId : (courses[0]?.id || ""),
      exam_name: "",
      exam_code: "",
      context_json_text: "{\n  \n}",
      version: 1,
      is_active: true,
    });
    setJsonValid(null);
    setDialogOpen(true);
  };

  const openEditDialog = (ctx: ExamContext) => {
    setEditingId(ctx.id);
    setFormData({
      course_id: ctx.course_id || "",
      exam_name: ctx.exam_name,
      exam_code: ctx.exam_code,
      context_json_text: JSON.stringify(ctx.context_json, null, 2),
      version: ctx.version,
      is_active: ctx.is_active,
    });
    setJsonValid(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.course_id || !formData.exam_name.trim() || !formData.exam_code.trim()) {
      toast.error("Curso, nome e código do exame são obrigatórios");
      return;
    }
    if (!validateJson(formData.context_json_text)) {
      toast.error("O JSON não é válido");
      return;
    }

    setSaving(true);
    const payload = {
      course_id: formData.course_id,
      exam_name: formData.exam_name.trim(),
      exam_code: formData.exam_code.trim(),
      context_json: JSON.parse(formData.context_json_text),
      version: formData.version,
      is_active: formData.is_active,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("dissertative_exam_contexts")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("dissertative_exam_contexts")
        .insert(payload));
    }

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } else {
      toast.success(editingId ? "Contexto atualizado!" : "Contexto criado!");
      setDialogOpen(false);
      fetchContexts();
    }
    setSaving(false);
  };

  const filteredContexts = filterCourseId === "all"
    ? contexts
    : contexts.filter((c) => c.course_id === filterCourseId);

  const getCourseName = (courseId: string | null) => {
    return courses.find((c) => c.id === courseId)?.title || "—";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="w-5 h-5" />
          Contexto da Banca (Exam Context)
        </CardTitle>
        <CardDescription>
          Configure o JSON de contexto oficial da banca usado em todas as etapas do pipeline dissertativo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters + Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filterCourseId} onValueChange={setFilterCourseId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtrar por curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cursos</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreateDialog} className="ml-auto">
            <Plus className="w-4 h-4 mr-1" /> Novo Contexto
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredContexts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum contexto cadastrado.
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Exame</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-center">Versão</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContexts.map((ctx) => (
                  <TableRow key={ctx.id}>
                    <TableCell className="font-medium">{getCourseName(ctx.course_id)}</TableCell>
                    <TableCell>{ctx.exam_name}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{ctx.exam_code}</code></TableCell>
                    <TableCell className="text-center">{ctx.version}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={ctx.is_active ? "default" : "secondary"}>
                        {ctx.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(ctx)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Contexto da Banca" : "Novo Contexto da Banca"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Curso</Label>
                  <Select
                    value={formData.course_id || ""}
                    onValueChange={(v) => setFormData({ ...formData, course_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Versão</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Exame</Label>
                  <Input
                    placeholder="ex: IFAL - Edital 03/2026"
                    value={formData.exam_name}
                    onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código do Exame</Label>
                  <Input
                    placeholder="ex: IFAL_2026_COPEVE"
                    value={formData.exam_code}
                    onChange={(e) => setFormData({ ...formData, exam_code: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Ativo</Label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Contexto JSON</Label>
                  <div className="flex items-center gap-2">
                    {jsonValid === true && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {jsonValid === false && <XCircle className="w-4 h-4 text-destructive" />}
                    <Button variant="outline" size="sm" onClick={handleValidateJson}>
                      Validar JSON
                    </Button>
                  </div>
                </div>
                <Textarea
                  className="font-mono text-sm min-h-[400px]"
                  placeholder='{"criterios": [...], "pesos": {...}}'
                  value={formData.context_json_text}
                  onChange={(e) => {
                    setFormData({ ...formData, context_json_text: e.target.value });
                    setJsonValid(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Cole aqui o JSON completo com critérios, pesos, laudas e demais regras da banca.
                  Este JSON será injetado como <code>{"{exam_context_json}"}</code> em todos os prompts do pipeline.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
