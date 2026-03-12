import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DissertativeContentRenderer } from "@/components/dissertativa/DissertativeContentRenderer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Save, BookOpen, FileText, GraduationCap, Sparkles, Eye, EyeOff, Library, Upload
} from "lucide-react";
import { AdminDissertativaMateriais } from "./AdminDissertativaMateriais";

// ─── Types ──────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  access_mode: string;
}

interface Question {
  id: string;
  course_id: string;
  discipline_id: string;
  statement: string;
  answer_key: string;
  is_active: boolean;
  display_order: number;
}

interface PromptTemplate {
  id: string;
  prompt_type: string;
  prompt_text: string;
  model_settings: any;
  course_id: string | null;
  discipline_id: string | null;
  is_active: boolean;
  version: number;
}

interface Discipline {
  id: string;
  name: string;
}

// ─── Main Component ────────────────────────────────────────────
export function AdminDissertativa() {
  const [activeTab, setActiveTab] = useState("courses");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Dissecando a Dissertativa
        </CardTitle>
        <CardDescription>
          Gerencie cursos e módulos do Dissecando a Dissertativa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="courses" className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              Cursos
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Questões
            </TabsTrigger>
            <TabsTrigger value="materiais" className="flex items-center gap-1.5">
              <Library className="w-4 h-4" />
              Materiais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses"><CoursesTab /></TabsContent>
          <TabsContent value="questions"><QuestionsTab /></TabsContent>
          <TabsContent value="materiais"><AdminDissertativaMateriais /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Courses Tab ────────────────────────────────────────────────
function CoursesTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dissertative_courses")
      .select("*")
      .order("display_order");
    setCourses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, []);

  const saveCourse = async () => {
    if (!editingCourse?.title || !editingCourse?.slug) {
      toast.error("Título e slug são obrigatórios");
      return;
    }
    const payload = {
      title: editingCourse.title,
      slug: editingCourse.slug,
      description: editingCourse.description || null,
      image_url: editingCourse.image_url || null,
      is_active: editingCourse.is_active ?? true,
      display_order: editingCourse.display_order ?? 0,
    };

    if (editingCourse.id) {
      const { error } = await supabase.from("dissertative_courses").update(payload).eq("id", editingCourse.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Curso atualizado");
    } else {
      const { error } = await supabase.from("dissertative_courses").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Curso criado");
    }
    setDialogOpen(false);
    setEditingCourse(null);
    fetchCourses();
  };

  const toggleActive = async (course: Course) => {
    await supabase.from("dissertative_courses").update({ is_active: !course.is_active }).eq("id", course.id);
    fetchCourses();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingCourse({ is_active: true, display_order: 0 })}>
              <Plus className="w-4 h-4 mr-1" /> Novo Curso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingCourse?.id ? "Editar Curso" : "Novo Curso"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editingCourse?.title || ""} onChange={e => setEditingCourse(prev => ({ ...prev, title: e.target.value }))} /></div>
              <div><Label>Slug</Label><Input value={editingCourse?.slug || ""} onChange={e => setEditingCourse(prev => ({ ...prev, slug: e.target.value }))} /></div>
              <div><Label>Descrição</Label><Textarea value={editingCourse?.description || ""} onChange={e => setEditingCourse(prev => ({ ...prev, description: e.target.value }))} /></div>
              <div>
                <Label>Capa do Curso</Label>
                {editingCourse?.image_url ? (
                  <div className="relative group mt-1">
                    <img src={editingCourse.image_url} alt="Capa" className="w-full h-32 object-cover rounded-md border" />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer">
                      <span className="text-white text-xs font-medium">Trocar capa</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split(".").pop() || "jpg";
                        const path = `covers/${(editingCourse?.id || "new")}_${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage.from("dissertative-materials").upload(path, file, { upsert: true });
                        if (upErr) { toast.error("Erro no upload: " + upErr.message); return; }
                        const { data: urlData } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
                        setEditingCourse(prev => ({ ...prev, image_url: urlData.publicUrl }));
                        toast.success("Imagem enviada!");
                      }} />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 mt-1 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Clique para enviar a capa</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = file.name.split(".").pop() || "jpg";
                      const path = `covers/${(editingCourse?.id || "new")}_${Date.now()}.${ext}`;
                      const { error: upErr } = await supabase.storage.from("dissertative-materials").upload(path, file, { upsert: true });
                      if (upErr) { toast.error("Erro no upload: " + upErr.message); return; }
                      const { data: urlData } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
                      setEditingCourse(prev => ({ ...prev, image_url: urlData.publicUrl }));
                      toast.success("Imagem enviada!");
                    }} />
                  </label>
                )}
              </div>
              <div><Label>Ordem</Label><Input type="number" value={editingCourse?.display_order ?? 0} onChange={e => setEditingCourse(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editingCourse?.is_active ?? true} onCheckedChange={v => setEditingCourse(prev => ({ ...prev, is_active: v }))} />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={saveCourse}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Acesso</TableHead>
            <TableHead>Ordem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map(course => (
            <TableRow key={course.id}>
              <TableCell className="font-medium">{course.title}</TableCell>
              <TableCell className="text-muted-foreground">{course.slug}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={async () => {
                    const newMode = course.access_mode === 'all' ? 'area_based' : 'all';
                    const { error } = await supabase
                      .from("dissertative_courses")
                      .update({ access_mode: newMode })
                      .eq("id", course.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success(newMode === 'all' ? 'Liberado para todos' : 'Restrito por áreas');
                    fetchCourses();
                  }}
                >
                  {course.access_mode === 'all' ? (
                    <Badge variant="default" className="text-xs">Todos</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Por área</Badge>
                  )}
                </Button>
              </TableCell>
              <TableCell>{course.display_order}</TableCell>
              <TableCell>
                <Badge variant={course.is_active ? "default" : "secondary"}>
                  {course.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingCourse(course); setDialogOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(course)}>
                    {course.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Questions Tab ──────────────────────────────────────────────
function QuestionsTab() {
  const [questions, setQuestions] = useState<(Question & { model_answer?: string; topic_id?: string })[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [filterDisciplines, setFilterDisciplines] = useState<Discipline[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedDisciplineFilter, setSelectedDisciplineFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingQuestion, setViewingQuestion] = useState<(Question & { model_answer?: string }) | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: q }, { data: c }] = await Promise.all([
      supabase.from("dissertative_questions").select("*").order("display_order"),
      supabase.from("dissertative_courses").select("id, title").order("title"),
    ]);
    setQuestions(q || []);
    setCourses((c as any) || []);
    setLoading(false);
  };

  const fetchCourseDisciplines = async (courseId: string) => {
    const { data } = await supabase
      .from("dissertative_course_disciplines")
      .select("discipline_id, study_disciplines:discipline_id(id, name)")
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("display_order");
    const mapped = (data || [])
      .map((d: any) => d.study_disciplines)
      .filter(Boolean) as Discipline[];
    setDisciplines(mapped);
  };

  useEffect(() => { fetchData(); }, []);

  // Load filter disciplines when course filter changes
  useEffect(() => {
    if (selectedCourse === "all") {
      setFilterDisciplines([]);
      setSelectedDisciplineFilter("all");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("dissertative_course_disciplines")
        .select("discipline_id, study_disciplines:discipline_id(id, name)")
        .eq("course_id", selectedCourse)
        .eq("is_active", true)
        .order("display_order");
      const mapped = (data || []).map((d: any) => d.study_disciplines).filter(Boolean) as Discipline[];
      setFilterDisciplines(mapped);
      setSelectedDisciplineFilter("all");
    })();
  }, [selectedCourse]);

  const filtered = questions.filter(q => {
    if (selectedCourse !== "all" && q.course_id !== selectedCourse) return false;
    if (selectedDisciplineFilter !== "all" && q.discipline_id !== selectedDisciplineFilter) return false;
    return true;
  });

  const saveQuestion = async () => {
    if (!editingQuestion?.statement || !editingQuestion?.answer_key || !editingQuestion?.course_id || !editingQuestion?.discipline_id) {
      toast.error("Enunciado, gabarito, curso e disciplina são obrigatórios");
      return;
    }
    const payload = {
      statement: editingQuestion.statement,
      answer_key: editingQuestion.answer_key,
      course_id: editingQuestion.course_id,
      discipline_id: editingQuestion.discipline_id,
      is_active: editingQuestion.is_active ?? true,
      display_order: editingQuestion.display_order ?? 0,
    };

    if (editingQuestion.id) {
      const { error } = await supabase.from("dissertative_questions").update(payload).eq("id", editingQuestion.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Questão atualizada");
    } else {
      const { error } = await supabase.from("dissertative_questions").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Questão criada");
    }
    setDialogOpen(false);
    setEditingQuestion(null);
    fetchData();
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Tem certeza? Isso também excluirá todas as submissões dos alunos para esta questão.")) return;
    setDeleting(id);
    try {
      // Cascade: delete submissions first
      await supabase.from("dissertative_submissions").delete().eq("question_id", id);
      await supabase.from("dissertative_questions").delete().eq("id", id);
      toast.success("Questão e submissões excluídas");
      setViewingQuestion(null);
      fetchData();
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
    setDeleting(null);
  };

  /** Extract a short preview from JSON statement */
  const getStatementPreview = (statement: string) => {
    try {
      const cleaned = statement.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned);
      const q = parsed.question;
      if (q?.ponto_tematico) return q.ponto_tematico.substring(0, 120);
      if (q?.comando) return q.comando.substring(0, 120);
    } catch {}
    return statement.substring(0, 120);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por curso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cursos</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedCourse !== "all" && filterDisciplines.length > 0 && (
            <Select value={selectedDisciplineFilter} onValueChange={setSelectedDisciplineFilter}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por disciplina" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as disciplinas</SelectItem>
                {filterDisciplines.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Badge variant="outline">{filtered.length} questões</Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingQuestion({ is_active: true, display_order: 0 })}>
              <Plus className="w-4 h-4 mr-1" /> Nova Questão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingQuestion?.id ? "Editar Questão" : "Nova Questão"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Curso</Label>
                  <Select value={editingQuestion?.course_id || ""} onValueChange={v => { setEditingQuestion(prev => ({ ...prev, course_id: v, discipline_id: "" })); fetchCourseDisciplines(v); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Disciplina</Label>
                  <Select value={editingQuestion?.discipline_id || ""} onValueChange={v => setEditingQuestion(prev => ({ ...prev, discipline_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{disciplines.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Enunciado</Label><Textarea rows={5} value={editingQuestion?.statement || ""} onChange={e => setEditingQuestion(prev => ({ ...prev, statement: e.target.value }))} /></div>
              <div><Label>Padrão de Resposta (Gabarito)</Label><Textarea rows={5} value={editingQuestion?.answer_key || ""} onChange={e => setEditingQuestion(prev => ({ ...prev, answer_key: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Ordem</Label><Input type="number" value={editingQuestion?.display_order ?? 0} onChange={e => setEditingQuestion(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} /></div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={editingQuestion?.is_active ?? true} onCheckedChange={v => setEditingQuestion(prev => ({ ...prev, is_active: v }))} />
                  <Label>Ativa</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={saveQuestion}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Enunciado</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-28">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(q => (
            <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingQuestion(q)}>
              <TableCell className="max-w-md">
                <p className="truncate text-sm">{getStatementPreview(q.statement)}</p>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">{courses.find(c => c.id === q.course_id)?.title || "—"}</TableCell>
              <TableCell><Badge variant={q.is_active ? "default" : "secondary"}>{q.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => setViewingQuestion(q)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingQuestion(q); fetchCourseDisciplines(q.course_id); setDialogOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)} disabled={deleting === q.id}>
                    {deleting === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma questão encontrada</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {/* Detail View Dialog */}
      <Dialog open={!!viewingQuestion} onOpenChange={open => !open && setViewingQuestion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingQuestion && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Detalhes da Questão</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditingQuestion(viewingQuestion); fetchCourseDisciplines(viewingQuestion.course_id); setViewingQuestion(null); setDialogOpen(true); }}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteQuestion(viewingQuestion.id)} disabled={deleting === viewingQuestion.id}>
                      {deleting === viewingQuestion.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                      Excluir
                    </Button>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant="outline">{courses.find(c => c.id === viewingQuestion.course_id)?.title}</Badge>
                  <Badge variant={viewingQuestion.is_active ? "default" : "secondary"}>{viewingQuestion.is_active ? "Ativa" : "Inativa"}</Badge>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Enunciado</h4>
                  <div className="border rounded-lg p-4">
                    <DissertativeContentRenderer content={viewingQuestion.statement} type="statement" />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Gabarito Comentado</h4>
                  <div className="border rounded-lg p-4">
                    <DissertativeContentRenderer content={viewingQuestion.answer_key} type="answer_key" />
                  </div>
                </div>

                {viewingQuestion.model_answer && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Resposta-Modelo</h4>
                    <div className="border rounded-lg p-4">
                      <DissertativeContentRenderer content={viewingQuestion.model_answer} type="model_answer" />
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  ID: {viewingQuestion.id}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Prompts Tab ────────────────────────────────────────────────
function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<Partial<PromptTemplate> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dissertative_prompt_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setPrompts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPrompts(); }, []);

  const savePrompt = async () => {
    if (!editingPrompt?.prompt_text) {
      toast.error("Texto do prompt é obrigatório");
      return;
    }
    const payload = {
      prompt_type: editingPrompt.prompt_type || "correction",
      prompt_text: editingPrompt.prompt_text,
      model_settings: editingPrompt.model_settings || null,
      course_id: editingPrompt.course_id || null,
      discipline_id: editingPrompt.discipline_id || null,
      is_active: editingPrompt.is_active ?? true,
      version: editingPrompt.version ?? 1,
    };

    if (editingPrompt.id) {
      const { error } = await supabase.from("dissertative_prompt_templates").update(payload).eq("id", editingPrompt.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Prompt atualizado");
    } else {
      const { error } = await supabase.from("dissertative_prompt_templates").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Prompt criado");
    }
    setDialogOpen(false);
    setEditingPrompt(null);
    fetchPrompts();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditingPrompt({ is_active: true, version: 1, prompt_type: "correction" })}>
              <Plus className="w-4 h-4 mr-1" /> Novo Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingPrompt?.id ? "Editar Prompt" : "Novo Prompt"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editingPrompt?.prompt_type || "correction"} onValueChange={v => setEditingPrompt(prev => ({ ...prev, prompt_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="correction">Correção</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Versão</Label>
                  <Input type="number" value={editingPrompt?.version ?? 1} onChange={e => setEditingPrompt(prev => ({ ...prev, version: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div>
                <Label>Prompt</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Variáveis: {"{{enunciado}}"}, {"{{padrao_resposta}}"}, {"{{resposta_aluno}}"}
                </p>
                <Textarea rows={12} value={editingPrompt?.prompt_text || ""} onChange={e => setEditingPrompt(prev => ({ ...prev, prompt_text: e.target.value }))} className="font-mono text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingPrompt?.is_active ?? true} onCheckedChange={v => setEditingPrompt(prev => ({ ...prev, is_active: v }))} />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={savePrompt}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Versão</TableHead>
            <TableHead>Preview</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prompts.map(p => (
            <TableRow key={p.id}>
              <TableCell><Badge variant="outline">{p.prompt_type}</Badge></TableCell>
              <TableCell>v{p.version}</TableCell>
              <TableCell className="max-w-sm truncate text-muted-foreground text-xs">{p.prompt_text.substring(0, 100)}...</TableCell>
              <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => { setEditingPrompt(p); setDialogOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {prompts.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum prompt encontrado</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
