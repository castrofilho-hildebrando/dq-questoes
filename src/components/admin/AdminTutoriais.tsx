import { useState, useEffect, useCallback } from "react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Save,
  Layers, Video, FileText, ChevronDown, ChevronRight, Eye, EyeOff, Copy
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
}

interface TutorialSection {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
  product_id: string | null;
  created_at: string;
}

interface TutorialModule {
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

export function AdminTutoriais() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeProductId, setActiveProductId] = useState<string>("");
  const [sections, setSections] = useState<TutorialSection[]>([]);
  const [modules, setModules] = useState<TutorialModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TutorialSection | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", description: "", thumbnail_url: "" });
  const [savingSection, setSavingSection] = useState(false);

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TutorialModule | null>(null);
  const [moduleParentSectionId, setModuleParentSectionId] = useState<string>("");
  const [moduleForm, setModuleForm] = useState({
    title: "", module_type: "video", video_url: "", pdf_url: "",
    thumbnail_url: "", duration_minutes: "",
  });
  const [savingModule, setSavingModule] = useState(false);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSourceProduct, setImportSourceProduct] = useState<string>("");
  const [selectedImportSections, setSelectedImportSections] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Fetch products first
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("product_definitions")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name");
      if (error) { toast.error("Erro ao carregar produtos"); return; }
      const prods = (data || []) as Product[];
      setProducts(prods);
      if (prods.length > 0 && !activeProductId) {
        setActiveProductId(prods[0].id);
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [secRes, modRes] = await Promise.all([
      supabase.from("tutorial_sections").select("*").order("display_order"),
      supabase.from("tutorial_modules").select("*").order("display_order"),
    ]);
    if (secRes.error) toast.error("Erro ao carregar seções: " + secRes.error.message);
    if (modRes.error) toast.error("Erro ao carregar módulos: " + modRes.error.message);
    setSections((secRes.data as TutorialSection[]) || []);
    setModules((modRes.data as TutorialModule[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter sections by active product tab
  const filteredSections = sections.filter(s => s.product_id === activeProductId);

  // Section CRUD
  const openNewSection = () => {
    setEditingSection(null);
    setSectionForm({ title: "", description: "", thumbnail_url: "" });
    setSectionDialogOpen(true);
  };

  const openEditSection = (s: TutorialSection) => {
    setEditingSection(s);
    setSectionForm({ title: s.title, description: s.description || "", thumbnail_url: s.thumbnail_url || "" });
    setSectionDialogOpen(true);
  };

  const saveSection = async () => {
    if (!sectionForm.title.trim()) { toast.error("Título obrigatório"); return; }
    setSavingSection(true);
    try {
      if (editingSection) {
        const { error } = await supabase.from("tutorial_sections").update({
          title: sectionForm.title.trim(),
          description: sectionForm.description.trim() || null,
          thumbnail_url: sectionForm.thumbnail_url.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", editingSection.id);
        if (error) throw error;
        toast.success("Seção atualizada");
      } else {
        const maxOrder = filteredSections.length > 0 ? Math.max(...filteredSections.map(s => s.display_order)) + 1 : 0;
        const { error } = await supabase.from("tutorial_sections").insert({
          title: sectionForm.title.trim(),
          description: sectionForm.description.trim() || null,
          thumbnail_url: sectionForm.thumbnail_url.trim() || null,
          display_order: maxOrder,
          product_id: activeProductId || null,
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

  const toggleSectionActive = async (s: TutorialSection) => {
    const { error } = await supabase.from("tutorial_sections")
      .update({ is_active: !s.is_active, updated_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(s.is_active ? "Seção desativada" : "Seção ativada");
    fetchData();
  };

  const deleteSection = async (s: TutorialSection) => {
    const sectionModules = modules.filter(m => m.section_id === s.id);
    if (sectionModules.length > 0) {
      toast.error(`Não é possível excluir: ${sectionModules.length} módulo(s) vinculado(s)`);
      return;
    }
    if (!confirm(`Excluir a seção "${s.title}"?`)) return;
    const { error } = await supabase.from("tutorial_sections").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Seção excluída");
    fetchData();
  };

  // Module CRUD
  const openNewModule = (sectionId: string) => {
    setEditingModule(null);
    setModuleParentSectionId(sectionId);
    setModuleForm({ title: "", module_type: "video", video_url: "", pdf_url: "", thumbnail_url: "", duration_minutes: "" });
    setModuleDialogOpen(true);
  };

  const openEditModule = (m: TutorialModule) => {
    setEditingModule(m);
    setModuleParentSectionId(m.section_id);
    setModuleForm({
      title: m.title, module_type: m.module_type, video_url: m.video_url || "",
      pdf_url: m.pdf_url || "", thumbnail_url: m.thumbnail_url || "",
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
        section_id: moduleParentSectionId, title: moduleForm.title.trim(), module_type: moduleForm.module_type,
        video_url: moduleForm.video_url.trim() || null, pdf_url: moduleForm.pdf_url.trim() || null,
        thumbnail_url: moduleForm.thumbnail_url.trim() || null,
        duration_minutes: moduleForm.duration_minutes ? parseInt(moduleForm.duration_minutes) : null,
        updated_at: new Date().toISOString(),
      };
      if (editingModule) {
        const { error } = await supabase.from("tutorial_modules").update(payload).eq("id", editingModule.id);
        if (error) throw error;
        toast.success("Módulo atualizado");
      } else {
        const sectionModules = modules.filter(m => m.section_id === moduleParentSectionId);
        const maxOrder = sectionModules.length > 0 ? Math.max(...sectionModules.map(m => m.display_order)) + 1 : 0;
        const { error } = await supabase.from("tutorial_modules").insert({ ...payload, display_order: maxOrder });
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

  const toggleModuleActive = async (m: TutorialModule) => {
    const { error } = await supabase.from("tutorial_modules")
      .update({ is_active: !m.is_active, updated_at: new Date().toISOString() })
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(m.is_active ? "Módulo desativado" : "Módulo ativado");
    fetchData();
  };

  const deleteModule = async (m: TutorialModule) => {
    if (!confirm(`Excluir o módulo "${m.title}"?`)) return;
    const { error } = await supabase.from("tutorial_modules").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Módulo excluído");
    fetchData();
  };

  const toggleExpand = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Import logic
  const openImportDialog = () => {
    setImportSourceProduct("");
    setSelectedImportSections(new Set());
    setImportDialogOpen(true);
  };

  const otherProducts = products.filter(p => p.id !== activeProductId);
  const importSourceSections = sections.filter(s => s.product_id === importSourceProduct);

  const toggleImportSection = (id: string) => {
    setSelectedImportSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllImportSections = () => {
    if (selectedImportSections.size === importSourceSections.length) {
      setSelectedImportSections(new Set());
    } else {
      setSelectedImportSections(new Set(importSourceSections.map(s => s.id)));
    }
  };

  const handleImport = async () => {
    if (selectedImportSections.size === 0) { toast.error("Selecione pelo menos uma seção"); return; }
    setImporting(true);
    try {
      const maxOrder = filteredSections.length > 0 ? Math.max(...filteredSections.map(s => s.display_order)) : -1;
      let orderOffset = maxOrder + 1;

      for (const sectionId of selectedImportSections) {
        const sourceSection = sections.find(s => s.id === sectionId);
        if (!sourceSection) continue;

        // Create new section for the target product
        const { data: newSection, error: secError } = await supabase
          .from("tutorial_sections")
          .insert({
            title: sourceSection.title,
            description: sourceSection.description,
            thumbnail_url: sourceSection.thumbnail_url,
            display_order: orderOffset++,
            is_active: sourceSection.is_active,
            product_id: activeProductId,
          })
          .select("id")
          .single();
        if (secError) throw secError;

        // Copy modules from source section
        const sourceModules = modules.filter(m => m.section_id === sectionId);
        if (sourceModules.length > 0) {
          const modulesPayload = sourceModules.map(m => ({
            section_id: newSection.id,
            title: m.title,
            module_type: m.module_type,
            video_url: m.video_url,
            pdf_url: m.pdf_url,
            thumbnail_url: m.thumbnail_url,
            duration_minutes: m.duration_minutes,
            display_order: m.display_order,
            is_active: m.is_active,
          }));
          const { error: modError } = await supabase.from("tutorial_modules").insert(modulesPayload);
          if (modError) throw modError;
        }
      }

      toast.success(`${selectedImportSections.size} seção(ões) importada(s) com sucesso`);
      setImportDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao importar: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const moduleTypeLabel = (t: string) => t === "video" ? "Vídeo" : t === "pdf" ? "PDF" : t === "video_pdf" ? "Vídeo + PDF" : t;
  const moduleTypeIcon = (t: string) => t === "video" ? <Video className="w-3.5 h-3.5" /> : t === "pdf" ? <FileText className="w-3.5 h-3.5" /> : t === "video_pdf" ? <><Video className="w-3.5 h-3.5" /><FileText className="w-3.5 h-3.5" /></> : null;

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" />Tutoriais</CardTitle>
              <CardDescription>Gerencie seções e módulos de tutoriais por produto</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={openImportDialog} size="sm" disabled={!activeProductId || otherProducts.length === 0}>
                <Copy className="w-4 h-4 mr-1" />Importar
              </Button>
              <Button onClick={openNewSection} size="sm" disabled={!activeProductId}>
                <Plus className="w-4 h-4 mr-1" />Nova Seção
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum produto encontrado.</div>
          ) : (
            <Tabs value={activeProductId} onValueChange={setActiveProductId}>
              <TabsList className="w-full justify-start overflow-x-auto mb-4 flex-wrap h-auto gap-1">
                {products.map((p) => {
                  const count = sections.filter(s => s.product_id === p.id).length;
                  return (
                    <TabsTrigger key={p.id} value={p.id} className="min-w-0 truncate max-w-[200px] text-xs">
                      {p.name}
                      {count > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">{count}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {products.map((product) => (
                <TabsContent key={product.id} value={product.id}>
                  <SectionsList
                    sections={sections.filter(s => s.product_id === product.id)}
                    modules={modules}
                    expandedSections={expandedSections}
                    toggleExpand={toggleExpand}
                    openNewModule={openNewModule}
                    toggleSectionActive={toggleSectionActive}
                    openEditSection={openEditSection}
                    deleteSection={deleteSection}
                    toggleModuleActive={toggleModuleActive}
                    openEditModule={openEditModule}
                    deleteModule={deleteModule}
                    moduleTypeLabel={moduleTypeLabel}
                    moduleTypeIcon={moduleTypeIcon}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSection ? "Editar Seção" : "Nova Seção"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título *</Label><Input value={sectionForm.title} onChange={e => setSectionForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={sectionForm.description} onChange={e => setSectionForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>URL da Thumbnail</Label><Input value={sectionForm.thumbnail_url} onChange={e => setSectionForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveSection} disabled={savingSection}>{savingSection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título *</Label><Input value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Tipo</Label><Select value={moduleForm.module_type} onValueChange={v => setModuleForm(f => ({ ...f, module_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="video">Vídeo</SelectItem><SelectItem value="pdf">PDF</SelectItem><SelectItem value="video_pdf">Vídeo + PDF</SelectItem></SelectContent></Select></div>
            {(moduleForm.module_type === "video" || moduleForm.module_type === "video_pdf") && <div><Label>URL do Vídeo</Label><Input value={moduleForm.video_url} onChange={e => setModuleForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://youtube.com/..." /></div>}
            {(moduleForm.module_type === "pdf" || moduleForm.module_type === "video_pdf") && <div><Label>URL do PDF</Label><Input value={moduleForm.pdf_url} onChange={e => setModuleForm(f => ({ ...f, pdf_url: e.target.value }))} placeholder="https://..." /></div>}
            <div><Label>URL da Thumbnail</Label><Input value={moduleForm.thumbnail_url} onChange={e => setModuleForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://..." /></div>
            <div><Label>Duração (minutos)</Label><Input type="number" value={moduleForm.duration_minutes} onChange={e => setModuleForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveModule} disabled={savingModule}>{savingModule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="w-5 h-5" />Importar Seções de Outro Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto de origem</Label>
              <Select value={importSourceProduct} onValueChange={v => { setImportSourceProduct(v); setSelectedImportSections(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                <SelectContent>
                  {otherProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {importSourceProduct && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Seções para importar</Label>
                  {importSourceSections.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAllImportSections}>
                      {selectedImportSections.size === importSourceSections.length ? "Desmarcar todas" : "Selecionar todas"}
                    </Button>
                  )}
                </div>
                {importSourceSections.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma seção neste produto.</p>
                ) : (
                  <ScrollArea className="max-h-[280px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {importSourceSections.sort((a, b) => a.display_order - b.display_order).map(section => {
                        const sectionMods = modules.filter(m => m.section_id === section.id);
                        return (
                          <label key={section.id} className="flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                            <Checkbox
                              checked={selectedImportSections.has(section.id)}
                              onCheckedChange={() => toggleImportSection(section.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{section.title}</span>
                                {!section.is_active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {sectionMods.length} módulo(s)
                                {section.description && ` · ${section.description.slice(0, 60)}${section.description.length > 60 ? "…" : ""}`}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || selectedImportSections.size === 0}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
              Importar {selectedImportSections.size > 0 ? `(${selectedImportSections.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Extracted sections list component
function SectionsList({
  sections, modules, expandedSections, toggleExpand,
  openNewModule, toggleSectionActive, openEditSection, deleteSection,
  toggleModuleActive, openEditModule, deleteModule,
  moduleTypeLabel, moduleTypeIcon,
}: {
  sections: TutorialSection[];
  modules: TutorialModule[];
  expandedSections: Set<string>;
  toggleExpand: (id: string) => void;
  openNewModule: (sectionId: string) => void;
  toggleSectionActive: (s: TutorialSection) => void;
  openEditSection: (s: TutorialSection) => void;
  deleteSection: (s: TutorialSection) => void;
  toggleModuleActive: (m: TutorialModule) => void;
  openEditModule: (m: TutorialModule) => void;
  deleteModule: (m: TutorialModule) => void;
  moduleTypeLabel: (t: string) => string;
  moduleTypeIcon: (t: string) => React.ReactNode;
}) {
  if (sections.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhuma seção para este produto. Clique em "Nova Seção" para começar.</div>;
  }

  return (
    <div className="space-y-3">
      {sections.sort((a, b) => a.display_order - b.display_order).map((section) => {
        const sectionModules = modules.filter(m => m.section_id === section.id).sort((a, b) => a.display_order - b.display_order);
        const isExpanded = expandedSections.has(section.id);
        return (
          <div key={section.id} className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleExpand(section.id)}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{section.title}</span>
                  <Badge variant={section.is_active ? "default" : "secondary"} className="text-xs">{section.is_active ? "Ativa" : "Inativa"}</Badge>
                  <Badge variant="outline" className="text-xs">{sectionModules.length} módulo(s)</Badge>
                </div>
                {section.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{section.description}</p>}
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openNewModule(section.id)}><Plus className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSectionActive(section)}>{section.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSection(section)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteSection(section)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            {isExpanded && (
              <div className="border-t">
                {sectionModules.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum módulo nesta seção. <button className="text-primary underline" onClick={() => openNewModule(section.id)}>Adicionar módulo</button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Título</TableHead><TableHead className="w-28">Tipo</TableHead><TableHead className="w-20">Duração</TableHead><TableHead className="w-20">Status</TableHead><TableHead className="w-28 text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sectionModules.map((mod, idx) => (
                        <TableRow key={mod.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell><div className="flex items-center gap-2">{mod.thumbnail_url && <img src={mod.thumbnail_url} alt="" className="w-10 h-7 rounded object-cover" />}<span className="font-medium">{mod.title}</span></div></TableCell>
                          <TableCell><Badge variant="outline" className="flex items-center gap-1 w-fit">{moduleTypeIcon(mod.module_type)}{moduleTypeLabel(mod.module_type)}</Badge></TableCell>
                          <TableCell>{mod.duration_minutes ? `${mod.duration_minutes} min` : "—"}</TableCell>
                          <TableCell><Badge variant={mod.is_active ? "default" : "secondary"} className="text-xs">{mod.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleModuleActive(mod)}>{mod.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModule(mod)}><Pencil className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteModule(mod)}><Trash2 className="w-4 h-4" /></Button>
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
  );
}

interface TutorialSection {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
  product_id: string | null;
  created_at: string;
}
