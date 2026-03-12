import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Save, FolderOpen, Video, FileText, Eye, EyeOff, Trash2, Upload, ImageIcon } from "lucide-react";

interface Course { id: string; title: string; }
interface Section {
  id: string; course_id: string; title: string; description: string | null;
  thumbnail_url: string | null; display_order: number; is_active: boolean;
}
interface MaterialModule {
  id: string; section_id: string; title: string; module_type: string;
  video_url: string | null; pdf_url: string | null; thumbnail_url: string | null;
  duration_minutes: number | null; display_order: number; is_active: boolean;
}

export function AdminDissertativaMateriais() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [sections, setSections] = useState<Section[]>([]);
  const [modules, setModules] = useState<MaterialModule[]>([]);
  const [loading, setLoading] = useState(true);

  // Section dialog
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Partial<Section> | null>(null);

  // Module dialog
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Partial<MaterialModule> & { _sectionId?: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from("dissertative_courses").select("id, title").order("title")
      .then(({ data }) => {
        setCourses(data || []);
        if (data?.length) setSelectedCourse(data[0].id);
        setLoading(false);
      });
  }, []);

  const fetchSectionsAndModules = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    const { data: secs } = await supabase
      .from("dissertativa_material_sections")
      .select("*")
      .eq("course_id", selectedCourse)
      .order("display_order");
    setSections(secs || []);

    if (secs?.length) {
      const secIds = secs.map(s => s.id);
      const { data: mods } = await supabase
        .from("dissertativa_material_modules")
        .select("*")
        .in("section_id", secIds)
        .order("display_order");
      setModules(mods || []);
    } else {
      setModules([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (selectedCourse) fetchSectionsAndModules(); }, [selectedCourse]);

  // ─── Section CRUD ─────────────────────────────────
  const saveSection = async () => {
    if (!editingSection?.title) { toast.error("Título obrigatório"); return; }
    const payload = {
      title: editingSection.title,
      course_id: selectedCourse,
      description: editingSection.description || null,
      thumbnail_url: editingSection.thumbnail_url || null,
      display_order: editingSection.display_order ?? 0,
      is_active: editingSection.is_active ?? true,
    };
    if (editingSection.id) {
      const { error } = await supabase.from("dissertativa_material_sections").update(payload).eq("id", editingSection.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Seção atualizada");
    } else {
      const { error } = await supabase.from("dissertativa_material_sections").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Seção criada");
    }
    setSectionDialogOpen(false);
    setEditingSection(null);
    fetchSectionsAndModules();
  };

  const toggleSectionActive = async (sec: Section) => {
    await supabase.from("dissertativa_material_sections").update({ is_active: !sec.is_active }).eq("id", sec.id);
    fetchSectionsAndModules();
  };

  const deleteSection = async (sec: Section) => {
    const secModules = modules.filter(m => m.section_id === sec.id);
    const msg = secModules.length > 0
      ? `Esta seção possui ${secModules.length} módulo(s). Excluir a seção e todos os seus módulos?`
      : "Excluir esta seção?";
    if (!confirm(msg)) return;
    if (secModules.length > 0) {
      await supabase.from("dissertativa_material_modules").delete().eq("section_id", sec.id);
    }
    await supabase.from("dissertativa_material_sections").delete().eq("id", sec.id);
    toast.success("Seção excluída");
    fetchSectionsAndModules();
  };

  // ─── Module CRUD ──────────────────────────────────
  const saveModule = async () => {
    if (!editingModule?.title || !editingModule?._sectionId) { toast.error("Título e seção obrigatórios"); return; }
    const payload = {
      title: editingModule.title,
      section_id: editingModule._sectionId,
      module_type: editingModule.module_type || "video",
      video_url: editingModule.video_url || null,
      pdf_url: editingModule.pdf_url || null,
      thumbnail_url: editingModule.thumbnail_url || null,
      duration_minutes: editingModule.duration_minutes || null,
      display_order: editingModule.display_order ?? 0,
      is_active: editingModule.is_active ?? true,
    };
    if (editingModule.id) {
      const { error } = await supabase.from("dissertativa_material_modules").update(payload).eq("id", editingModule.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Módulo atualizado");
    } else {
      const { error } = await supabase.from("dissertativa_material_modules").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Módulo criado");
    }
    setModuleDialogOpen(false);
    setEditingModule(null);
    fetchSectionsAndModules();
  };

  const deleteModule = async (id: string) => {
    if (!confirm("Excluir este módulo?")) return;
    await supabase.from("dissertativa_material_modules").delete().eq("id", id);
    toast.success("Módulo excluído");
    fetchSectionsAndModules();
  };

  const courseName = courses.find(c => c.id === selectedCourse)?.title || "";

  if (loading && !courses.length) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Course selector + new section button */}
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
          <SelectContent>
            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => {
            setEditingSection({ is_active: true, display_order: sections.length });
            setSectionDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Nova Seção
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : sections.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma seção criada para "{courseName}".</p>
      ) : (
        <Accordion type="multiple" defaultValue={sections.map(s => s.id)} className="space-y-2">
          {sections.map(sec => {
            const secModules = modules.filter(m => m.section_id === sec.id);
            return (
              <AccordionItem key={sec.id} value={sec.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <FolderOpen className="w-4 h-4 text-primary" />
                    <span className="font-medium">{sec.title}</span>
                    <Badge variant="secondary" className="text-xs">{secModules.length} módulos</Badge>
                    {!sec.is_active && <Badge variant="outline" className="text-xs">Inativa</Badge>}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingSection(sec); setSectionDialogOpen(true); }}
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Editar Seção
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSectionActive(sec)}
                      >
                        {sec.is_active ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                        {sec.is_active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteSection(sec)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingModule({ is_active: true, display_order: secModules.length, module_type: "video", _sectionId: sec.id });
                          setModuleDialogOpen(true);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Módulo
                      </Button>
                    </div>

                    {secModules.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Nenhum módulo nesta seção.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead className="w-24">Tipo</TableHead>
                            <TableHead className="w-20">Ordem</TableHead>
                            <TableHead className="w-20">Status</TableHead>
                            <TableHead className="w-28">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {secModules.map(mod => (
                            <TableRow key={mod.id}>
                              <TableCell className="font-medium">{mod.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {mod.module_type === "video_pdf" ? "vídeo+pdf" : mod.module_type}
                                </Badge>
                              </TableCell>
                              <TableCell>{mod.display_order}</TableCell>
                              <TableCell>
                                <Badge variant={mod.is_active ? "default" : "secondary"}>
                                  {mod.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingModule({ ...mod, _sectionId: mod.section_id });
                                      setModuleDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteModule(mod.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection?.id ? "Editar Seção" : "Nova Seção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editingSection?.title || ""} onChange={e => setEditingSection(prev => ({ ...prev, title: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Input value={editingSection?.description || ""} onChange={e => setEditingSection(prev => ({ ...prev, description: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Thumbnail</Label>
              {editingSection?.thumbnail_url ? (
                <div className="relative group">
                  <img src={editingSection.thumbnail_url} alt="Thumb" className="w-full h-24 object-cover rounded-md border" />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer">
                    <span className="text-white text-xs font-medium">Trocar imagem</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = file.name.split(".").pop() || "jpg";
                      const path = `thumbnails/sections/${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from("dissertative-materials").upload(path, file);
                      if (error) { toast.error(error.message); return; }
                      const { data: u } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
                      setEditingSection(prev => ({ ...prev, thumbnail_url: u.publicUrl }));
                      toast.success("Thumbnail enviada!");
                    }} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Enviar thumbnail</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = file.name.split(".").pop() || "jpg";
                    const path = `thumbnails/sections/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("dissertative-materials").upload(path, file);
                    if (error) { toast.error(error.message); return; }
                    const { data: u } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
                    setEditingSection(prev => ({ ...prev, thumbnail_url: u.publicUrl }));
                    toast.success("Thumbnail enviada!");
                  }} />
                </label>
              )}
            </div>
            <div><Label>Ordem</Label><Input type="number" value={editingSection?.display_order ?? 0} onChange={e => setEditingSection(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={editingSection?.is_active ?? true} onCheckedChange={v => setEditingSection(prev => ({ ...prev, is_active: v }))} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSection}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModule?.id ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={editingModule?.title || ""} onChange={e => setEditingModule(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={editingModule?.module_type || "video"} onValueChange={v => setEditingModule(prev => ({ ...prev, module_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="video_pdf">Vídeo + PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(editingModule?.module_type === "video" || editingModule?.module_type === "video_pdf") && (
              <div className="space-y-1.5">
                <Label>URL do Vídeo (YouTube)</Label>
                <Input value={editingModule?.video_url || ""} onChange={e => setEditingModule(prev => ({ ...prev, video_url: e.target.value }))} />
              </div>
            )}
            {(editingModule?.module_type === "pdf" || editingModule?.module_type === "video_pdf") && (
              <div className="space-y-2">
                <Label>PDF</Label>
                {editingModule?.pdf_url && (
                  <p className="text-xs text-muted-foreground break-all">Atual: {editingModule.pdf_url}</p>
                )}
                <Input
                  type="file"
                  accept=".pdf"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `materiais/${Date.now()}_${safeName}`;
                    const { error } = await supabase.storage.from("dissertative-materials").upload(path, file);
                    if (error) { toast.error("Erro: " + error.message); setUploading(false); return; }
                    const { data: urlData } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
                    setEditingModule(prev => ({ ...prev, pdf_url: urlData.publicUrl }));
                    toast.success("PDF enviado!");
                    setUploading(false);
                  }}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Thumbnail</Label>
              {editingModule?.thumbnail_url ? (
                <div className="relative group">
                  <img src={editingModule.thumbnail_url} alt="Thumb" className="w-full h-24 object-cover rounded-md border" />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer">
                    <span className="text-white text-xs font-medium">Trocar imagem</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = file.name.split(".").pop() || "jpg";
                      const path = `thumbnails/modules/${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from("dissertative-materials").upload(path, file);
                      if (error) { toast.error(error.message); return; }
                      const { data: u } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
                      setEditingModule(prev => ({ ...prev, thumbnail_url: u.publicUrl }));
                      toast.success("Thumbnail enviada!");
                    }} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Enviar thumbnail</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ext = file.name.split(".").pop() || "jpg";
                    const path = `thumbnails/modules/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("dissertative-materials").upload(path, file);
                    if (error) { toast.error(error.message); return; }
                    const { data: u } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
                    setEditingModule(prev => ({ ...prev, thumbnail_url: u.publicUrl }));
                    toast.success("Thumbnail enviada!");
                  }} />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duração (min)</Label>
                <Input type="number" value={editingModule?.duration_minutes ?? ""} onChange={e => setEditingModule(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || null }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input type="number" value={editingModule?.display_order ?? 0} onChange={e => setEditingModule(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editingModule?.is_active ?? true} onCheckedChange={v => setEditingModule(prev => ({ ...prev, is_active: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveModule} disabled={uploading}>
              <Save className="w-4 h-4 mr-1" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
