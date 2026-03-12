import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Upload, Users, Loader2, ExternalLink } from "lucide-react";

interface Section {
  id: string;
  title: string;
  sort_order: number;
}

interface Group {
  id: string;
  section_id: string;
  name: string;
  description: string | null;
  link: string | null;
  qr_code_url: string | null;
  image_url: string | null;
  sort_order: number;
}

export function AdminComunidades() {
  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Section dialog
  const [sectionDialog, setSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");

  // Group dialog
  const [groupDialog, setGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupSectionId, setGroupSectionId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupLink, setGroupLink] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [groupImageUrl, setGroupImageUrl] = useState("");
  const [groupQrUrl, setGroupQrUrl] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [secRes, grpRes] = await Promise.all([
      supabase.from("community_sections").select("*").order("sort_order"),
      supabase.from("community_groups").select("*").order("sort_order"),
    ]);
    if (secRes.data) setSections(secRes.data);
    if (grpRes.data) setGroups(grpRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Section CRUD ──
  const openNewSection = () => {
    setEditingSection(null);
    setSectionTitle("");
    setSectionDialog(true);
  };

  const openEditSection = (s: Section) => {
    setEditingSection(s);
    setSectionTitle(s.title);
    setSectionDialog(true);
  };

  const saveSection = async () => {
    if (!sectionTitle.trim()) return;
    if (editingSection) {
      const { error } = await supabase
        .from("community_sections")
        .update({ title: sectionTitle.trim() })
        .eq("id", editingSection.id);
      if (error) { toast.error("Erro ao atualizar seção"); return; }
      toast.success("Seção atualizada");
    } else {
      const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from("community_sections")
        .insert({ title: sectionTitle.trim(), sort_order: maxOrder });
      if (error) { toast.error("Erro ao criar seção"); return; }
      toast.success("Seção criada");
    }
    setSectionDialog(false);
    fetchData();
  };

  const deleteSection = async (id: string) => {
    if (!confirm("Excluir esta seção e todos os seus grupos?")) return;
    const { error } = await supabase.from("community_sections").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir seção"); return; }
    toast.success("Seção excluída");
    fetchData();
  };

  // ── Group CRUD ──
  const openNewGroup = (sectionId: string) => {
    setEditingGroup(null);
    setGroupSectionId(sectionId);
    setGroupName("");
    setGroupDescription("");
    setGroupLink("");
    setGroupImageUrl("");
    setGroupQrUrl("");
    setGroupDialog(true);
  };

  const openEditGroup = (g: Group) => {
    setEditingGroup(g);
    setGroupSectionId(g.section_id);
    setGroupName(g.name);
    setGroupDescription(g.description || "");
    setGroupLink(g.link || "");
    setGroupImageUrl(g.image_url || "");
    setGroupQrUrl(g.qr_code_url || "");
    setGroupDialog(true);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("community-assets").upload(path, file);
    if (error) { toast.error("Erro no upload"); return null; }
    const { data } = supabase.storage.from("community-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const url = await uploadFile(file, "images");
    if (url) setGroupImageUrl(url);
    setUploadingImage(false);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    const url = await uploadFile(file, "qrcodes");
    if (url) setGroupQrUrl(url);
    setUploadingQr(false);
  };

  const saveGroup = async () => {
    if (!groupName.trim()) return;
    const payload = {
      section_id: groupSectionId,
      name: groupName.trim(),
      description: groupDescription.trim() || null,
      link: groupLink.trim() || null,
      image_url: groupImageUrl || null,
      qr_code_url: groupQrUrl || null,
    };
    if (editingGroup) {
      const { error } = await supabase.from("community_groups").update(payload).eq("id", editingGroup.id);
      if (error) { toast.error("Erro ao atualizar grupo"); return; }
      toast.success("Grupo atualizado");
    } else {
      const sectionGroups = groups.filter(g => g.section_id === groupSectionId);
      const maxOrder = sectionGroups.length > 0 ? Math.max(...sectionGroups.map(g => g.sort_order)) + 1 : 0;
      const { error } = await supabase.from("community_groups").insert({ ...payload, sort_order: maxOrder });
      if (error) { toast.error("Erro ao criar grupo"); return; }
      toast.success("Grupo criado");
    }
    setGroupDialog(false);
    fetchData();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Excluir este grupo?")) return;
    const { error } = await supabase.from("community_groups").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir grupo"); return; }
    toast.success("Grupo excluído");
    fetchData();
  };

  if (loading) {
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Comunidades Dissecadores
              </CardTitle>
              <CardDescription>Gerencie as seções e grupos de comunidade</CardDescription>
            </div>
            <Button onClick={openNewSection} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nova Seção
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sections.map(section => {
            const sectionGroups = groups.filter(g => g.section_id === section.id);
            return (
              <div key={section.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{section.title}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditSection(section)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteSection(section.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openNewGroup(section.id)}>
                      <Plus className="w-4 h-4 mr-1" /> Grupo
                    </Button>
                  </div>
                </div>

                {sectionGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum grupo nesta seção.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sectionGroups.map(group => (
                      <div key={group.id} className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/20">
                        {group.image_url && (
                          <img src={group.image_url} alt={group.name} className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{group.name}</p>
                          {group.link && (
                            <a href={group.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Link
                            </a>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openEditGroup(group)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteGroup(group.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Section Dialog */}
      <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? "Editar Seção" : "Nova Seção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} placeholder="Ex: Avisos" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog(false)}>Cancelar</Button>
            <Button onClick={saveSection}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nome do grupo" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={groupDescription} onChange={e => setGroupDescription(e.target.value)} placeholder="Descrição do grupo" rows={3} />
            </div>
            <div>
              <Label>Link do grupo</Label>
              <Input value={groupLink} onChange={e => setGroupLink(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Imagem do card</Label>
              <div className="flex items-center gap-3">
                {groupImageUrl && <img src={groupImageUrl} alt="preview" className="w-16 h-16 rounded-md object-cover" />}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploadingImage}>
                    <span>
                      {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      Upload
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>
            <div>
              <Label>QR Code</Label>
              <div className="flex items-center gap-3">
                {groupQrUrl && <img src={groupQrUrl} alt="qr" className="w-16 h-16 rounded-md object-cover" />}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploadingQr}>
                    <span>
                      {uploadingQr ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      Upload
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancelar</Button>
            <Button onClick={saveGroup}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
