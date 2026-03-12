import { useState, useEffect, useCallback } from "react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Save, GripVertical,
  Layers, Video, FileText, ChevronDown, ChevronRight, Eye, EyeOff, Image
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
interface DidaticaSection {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

interface DidaticaModule {
  id: string;
  section_id: string;
  title: string;
  module_type: string;
  video_url: string | null;
  pdf_url: string | null;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// ─── Main Component ────────────────────────────────────────────
export function AdminDidatica() {
  const [sections, setSections] = useState<DidaticaSection[]>([]);
  const [modules, setModules] = useState<DidaticaModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Section dialog
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<DidaticaSection | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", description: "", thumbnail_url: "" });
  const [savingSection, setSavingSection] = useState(false);

  // Module dialog
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<DidaticaModule | null>(null);
  const [moduleParentSectionId, setModuleParentSectionId] = useState<string>("");
  const [moduleForm, setModuleForm] = useState({
    title: "", module_type: "video", video_url: "", pdf_url: "",
    thumbnail_url: "", duration_minutes: "",
  });
  const [savingModule, setSavingModule] = useState(false);

  // ─── Data fetching ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [secRes, modRes] = await Promise.all([
      supabase.from("didatica_sections").select("*").order("display_order"),
      supabase.from("didatica_modules").select("*").order("display_order"),
    ]);
    if (secRes.error) toast.error("Erro ao carregar seções: " + secRes.error.message);
    if (modRes.error) toast.error("Erro ao carregar módulos: " + modRes.error.message);
    setSections((secRes.data as DidaticaSection[]) || []);
    setModules((modRes.data as DidaticaModule[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Section CRUD ─────────────────────────────────────────────
  const openNewSection = () => {
    setEditingSection(null);
    setSectionForm({ title: "", description: "", thumbnail_url: "" });
    setSectionDialogOpen(true);
  };

  const openEditSection = (s: DidaticaSection) => {
    setEditingSection(s);
    setSectionForm({ title: s.title, description: s.description || "", thumbnail_url: s.thumbnail_url || "" });
    setSectionDialogOpen(true);
  };

  const saveSection = async () => {
    if (!sectionForm.title.trim()) { toast.error("Título obrigatório"); return; }
    setSavingSection(true);
    try {
      if (editingSection) {
        const { error } = await supabase.from("didatica_sections").update({
          title: sectionForm.title.trim(),
          description: sectionForm.description.trim() || null,
          thumbnail_url: sectionForm.thumbnail_url.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", editingSection.id);
        if (error) throw error;
        toast.success("Seção atualizada");
      } else {
        const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order)) + 1 : 0;
        const { error } = await supabase.from("didatica_sections").insert({
          title: sectionForm.title.trim(),
          description: sectionForm.description.trim() || null,
          thumbnail_url: sectionForm.thumbnail_url.trim() || null,
          display_order: maxOrder,
        });
        if (error) throw error;
        toast.success("Seção criada");
      }
      setSectionDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSavingSection(false);
    }
  };

  const toggleSectionActive = async (s: DidaticaSection) => {
    const { error } = await supabase.from("didatica_sections")
      .update({ is_active: !s.is_active, updated_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(s.is_active ? "Seção desativada" : "Seção ativada");
    fetchData();
  };

  const deleteSection = async (s: DidaticaSection) => {
    const sectionModules = modules.filter(m => m.section_id === s.id);
    if (sectionModules.length > 0) {
      toast.error(`Não é possível excluir: ${sectionModules.length} módulo(s) vinculado(s)`);
      return;
    }
    if (!confirm(`Excluir a seção "${s.title}"?`)) return;
    const { error } = await supabase.from("didatica_sections").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Seção excluída");
    fetchData();
  };

  // ─── Module CRUD ──────────────────────────────────────────────
  const openNewModule = (sectionId: string) => {
    setEditingModule(null);
    setModuleParentSectionId(sectionId);
    setModuleForm({ title: "", module_type: "video", video_url: "", pdf_url: "", thumbnail_url: "", duration_minutes: "" });
    setModuleDialogOpen(true);
  };

  const openEditModule = (m: DidaticaModule) => {
    setEditingModule(m);
    setModuleParentSectionId(m.section_id);
    setModuleForm({
      title: m.title,
      module_type: m.module_type,
      video_url: m.video_url || "",
      pdf_url: m.pdf_url || "",
      thumbnail_url: m.thumbnail_url || "",
      duration_minutes: m.duration_minutes?.toString() || "",
    });
    setModuleDialogOpen(true);
  };

  const saveModule = async () => {
    if (!moduleForm.title.trim()) { toast.error("Título obrigatório"); return; }
    if (!moduleParentSectionId) { toast.error("Seção obrigatória"); return; }
    setSavingModule(true);
    try {
      const payload = {
        section_id: moduleParentSectionId,
        title: moduleForm.title.trim(),
        module_type: moduleForm.module_type,
        video_url: moduleForm.video_url.trim() || null,
        pdf_url: moduleForm.pdf_url.trim() || null,
        thumbnail_url: moduleForm.thumbnail_url.trim() || null,
        duration_minutes: moduleForm.duration_minutes ? parseInt(moduleForm.duration_minutes) : null,
        updated_at: new Date().toISOString(),
      };

      if (editingModule) {
        const { error } = await supabase.from("didatica_modules").update(payload).eq("id", editingModule.id);
        if (error) throw error;
        toast.success("Módulo atualizado");
      } else {
        const sectionModules = modules.filter(m => m.section_id === moduleParentSectionId);
        const maxOrder = sectionModules.length > 0 ? Math.max(...sectionModules.map(m => m.display_order)) + 1 : 0;
        const { error } = await supabase.from("didatica_modules").insert({ ...payload, display_order: maxOrder });
        if (error) throw error;
        toast.success("Módulo criado");
      }
      setModuleDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSavingModule(false);
    }
  };

  const toggleModuleActive = async (m: DidaticaModule) => {
    const { error } = await supabase.from("didatica_modules")
      .update({ is_active: !m.is_active, updated_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(m.is_active ? "Módulo desativado" : "Módulo ativado");
    fetchData();
  };

  const deleteModule = async (m: DidaticaModule) => {
    if (!confirm(`Excluir o módulo "${m.title}"?`)) return;
    const { error } = await supabase.from("didatica_modules").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Módulo excluído");
    fetchData();
  };

  // ─── Toggle expand ────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Module type helpers ──────────────────────────────────────
  const moduleTypeLabel = (t: string) => {
    switch (t) {
      case "video": return "Vídeo";
      case "pdf": return "PDF";
      case "video_pdf": return "Vídeo + PDF";
      default: return t;
    }
  };

  const moduleTypeIcon = (t: string) => {
    switch (t) {
      case "video": return <Video className="w-3.5 h-3.5" />;
      case "pdf": return <FileText className="w-3.5 h-3.5" />;
      case "video_pdf": return <><Video className="w-3.5 h-3.5" /><FileText className="w-3.5 h-3.5" /></>;
      default: return null;
    }
  };

  // ─── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Dissecando a Didática
              </CardTitle>
              <CardDescription>
                Gerencie seções e módulos do curso (layout Netflix)
              </CardDescription>
            </div>
            <Button onClick={openNewSection} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Nova Seção
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma seção criada. Clique em "Nova Seção" para começar.
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => {
                const sectionModules = modules
                  .filter(m => m.section_id === section.id)
                  .sort((a, b) => a.display_order - b.display_order);
                const isExpanded = expandedSections.has(section.id);

                return (
                  <div key={section.id} className="border rounded-lg overflow-hidden">
                    {/* Section header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(section.id)}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{section.title}</span>
                          <Badge variant={section.is_active ? "default" : "secondary"} className="text-xs">
                            {section.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {sectionModules.length} módulo(s)
                          </Badge>
                        </div>
                        {section.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{section.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openNewModule(section.id)} title="Adicionar módulo">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSectionActive(section)} title={section.is_active ? "Desativar" : "Ativar"}>
                          {section.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSection(section)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteSection(section)} title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Modules list */}
                    {isExpanded && (
                      <div className="border-t">
                        {sectionModules.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            Nenhum módulo nesta seção.{" "}
                            <button className="text-primary underline" onClick={() => openNewModule(section.id)}>
                              Adicionar módulo
                            </button>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Título</TableHead>
                                <TableHead className="w-28">Tipo</TableHead>
                                <TableHead className="w-20">Duração</TableHead>
                                <TableHead className="w-20">Status</TableHead>
                                <TableHead className="w-28 text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sectionModules.map((mod, idx) => (
                                <TableRow key={mod.id}>
                                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {mod.thumbnail_url && (
                                        <img src={mod.thumbnail_url} alt="" className="w-10 h-7 rounded object-cover" />
                                      )}
                                      <span className="font-medium">{mod.title}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                      {moduleTypeIcon(mod.module_type)}
                                      {moduleTypeLabel(mod.module_type)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {mod.duration_minutes ? `${mod.duration_minutes} min` : "—"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={mod.is_active ? "default" : "secondary"} className="text-xs">
                                      {mod.is_active ? "Ativo" : "Inativo"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleModuleActive(mod)}>
                                        {mod.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditModule(mod)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteModule(mod)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Section Dialog ──────────────────────────────────────── */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? "Editar Seção" : "Nova Seção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={sectionForm.title}
                onChange={e => setSectionForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Módulo 1 — Introdução à Didática"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={sectionForm.description}
                onChange={e => setSectionForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Descrição opcional da seção"
                rows={3}
              />
            </div>
            <ImageUpload
              value={sectionForm.thumbnail_url}
              onChange={url => setSectionForm(p => ({ ...p, thumbnail_url: url }))}
              label="Capa da Seção"
              folder="didatica/sections"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveSection} disabled={savingSection}>
              {savingSection ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Module Dialog ───────────────────────────────────────── */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Seção</Label>
              <Select value={moduleParentSectionId} onValueChange={setModuleParentSectionId}>
                <SelectTrigger><SelectValue placeholder="Selecione a seção" /></SelectTrigger>
                <SelectContent>
                  {sections.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input
                value={moduleForm.title}
                onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Aula 01 — Planejamento de Aula"
              />
            </div>
            <div>
              <Label>Tipo de Conteúdo</Label>
              <Select value={moduleForm.module_type} onValueChange={v => setModuleForm(p => ({ ...p, module_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="video_pdf">Vídeo + PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(moduleForm.module_type === "video" || moduleForm.module_type === "video_pdf") && (
              <div>
                <Label>URL do Vídeo</Label>
                <Input
                  value={moduleForm.video_url}
                  onChange={e => setModuleForm(p => ({ ...p, video_url: e.target.value }))}
                  placeholder="https://youtube.com/... ou https://vimeo.com/..."
                />
              </div>
            )}
            {(moduleForm.module_type === "pdf" || moduleForm.module_type === "video_pdf") && (
              <div>
                <Label>URL do PDF</Label>
                <Input
                  value={moduleForm.pdf_url}
                  onChange={e => setModuleForm(p => ({ ...p, pdf_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            )}
            <ImageUpload
              value={moduleForm.thumbnail_url}
              onChange={url => setModuleForm(p => ({ ...p, thumbnail_url: url }))}
              label="Capa do Módulo"
              folder="didatica/modules"
            />
            <div>
              <Label>Duração (minutos)</Label>
              <Input
                type="number"
                value={moduleForm.duration_minutes}
                onChange={e => setModuleForm(p => ({ ...p, duration_minutes: e.target.value }))}
                placeholder="Ex: 45"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveModule} disabled={savingModule}>
              {savingModule ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
