import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  RefreshCw, 
  Loader2, 
  FolderPlus,
  Folder,
  FolderOpen,
  FileText,
  Trash2,
  Edit,
  Upload,
  Clock,
  BookOpen,
  MoreVertical,
  Search,
  Link2,
  History,
  Eye,
  MoveRight,
  CheckSquare,
  Layers,
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPdfLinkByEdital } from './AdminPdfLinkByEdital';
import { PdfViewerDialog } from '@/components/pdf/PdfViewerDialog';
import { ImageUpload } from './ImageUpload';

interface PdfSection {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface PdfMaterial {
  id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  current_file_url: string;
  current_version: number;
  total_pages: number | null;
  total_study_minutes: number;
  is_active: boolean;
  created_at: string;
  display_order: number;
}

interface PdfFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  section_id: string | null;
  display_order: number;
  is_active: boolean;
  thumbnail_url: string | null;
}

interface PdfVersion {
  id: string;
  pdf_material_id: string;
  version_number: number;
  file_url: string;
  total_pages: number | null;
  change_notes: string | null;
  created_at: string;
}

export function AdminPdfMaterials() {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<PdfMaterial[]>([]);
  const [folders, setFolders] = useState<PdfFolder[]>([]);
  const [sections, setSections] = useState<PdfSection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection & move states
  const [selectedPdfIds, setSelectedPdfIds] = useState<Set<string>>(new Set());
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingToFolderId, setMovingToFolderId] = useState<string>('none');
  const [movingPdfs, setMovingPdfs] = useState(false);
  
  // Dialog states
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PdfFolder | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<PdfMaterial | null>(null);
  const [editingSection, setEditingSection] = useState<PdfSection | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: 'folder' | 'material' | 'section'; item: any } | null>(null);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [selectedMaterialVersions, setSelectedMaterialVersions] = useState<PdfVersion[]>([]);
  const [selectedMaterialName, setSelectedMaterialName] = useState('');
  const [viewerDialogOpen, setViewerDialogOpen] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<PdfMaterial | null>(null);
  
  // Form states
  const [folderName, setFolderName] = useState('');
  const [folderThumbnailUrl, setFolderThumbnailUrl] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string>('none');
  const [folderSectionId, setFolderSectionId] = useState<string>('none');
  const [folderDisplayOrder, setFolderDisplayOrder] = useState(0);
  const [materialName, setMaterialName] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialFolderId, setMaterialFolderId] = useState<string>('none');
  const [materialStudyMinutes, setMaterialStudyMinutes] = useState(60);
  const [materialTotalPages, setMaterialTotalPages] = useState<number | ''>('');
  const [materialDisplayOrder, setMaterialDisplayOrder] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingMaterial, setSavingMaterial] = useState(false);
  
  // Section form
  const [sectionName, setSectionName] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionDisplayOrder, setSectionDisplayOrder] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [sectionsRes, foldersRes, materialsRes] = await Promise.all([
      supabase
        .from('pdf_material_sections')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('pdf_material_folders')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('pdf_materials')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
    ]);

    setSections(sectionsRes.data || []);
    setFolders(foldersRes.data || []);
    setMaterials(materialsRes.data || []);
    setLoading(false);
  };

  // ============ SECTIONS CRUD ============
  const handleOpenCreateSection = () => {
    setEditingSection(null);
    setSectionName('');
    setSectionDescription('');
    setSectionDisplayOrder(sections.length);
    setSectionDialogOpen(true);
  };

  const handleOpenEditSection = (section: PdfSection) => {
    setEditingSection(section);
    setSectionName(section.name);
    setSectionDescription(section.description || '');
    setSectionDisplayOrder(section.display_order);
    setSectionDialogOpen(true);
  };

  const handleSaveSection = async () => {
    if (!sectionName.trim()) {
      toast.error('Nome da seção é obrigatório');
      return;
    }

    if (editingSection) {
      const { error } = await supabase
        .from('pdf_material_sections')
        .update({
          name: sectionName.trim(),
          description: sectionDescription.trim() || null,
          display_order: sectionDisplayOrder,
        })
        .eq('id', editingSection.id);
      if (error) { toast.error('Erro ao atualizar seção'); return; }
      toast.success('Seção atualizada!');
    } else {
      const { error } = await supabase
        .from('pdf_material_sections')
        .insert({
          name: sectionName.trim(),
          description: sectionDescription.trim() || null,
          display_order: sectionDisplayOrder,
        });
      if (error) { toast.error('Erro ao criar seção'); return; }
      toast.success('Seção criada!');
    }

    setSectionDialogOpen(false);
    fetchData();
  };

  // ============ FOLDERS CRUD ============
  const buildFolderTree = () => {
    const lowerSearch = searchTerm.toLowerCase();
    const rootFolders = folders.filter(f => !f.parent_folder_id);
    if (!searchTerm) return rootFolders;
    return rootFolders.filter(folder => {
      const folderMatches = folder.name.toLowerCase().includes(lowerSearch);
      const materialsInFolder = materials.filter(m => m.folder_id === folder.id);
      const hasMatchingMaterial = materialsInFolder.some(m => 
        m.name.toLowerCase().includes(lowerSearch) || m.description?.toLowerCase().includes(lowerSearch)
      );
      return folderMatches || hasMatchingMaterial;
    });
  };

  const getChildFolders = (parentId: string) => {
    const lowerSearch = searchTerm.toLowerCase();
    const children = folders.filter(f => f.parent_folder_id === parentId);
    if (!searchTerm) return children;
    return children.filter(folder => {
      const folderMatches = folder.name.toLowerCase().includes(lowerSearch);
      const materialsInFolder = materials.filter(m => m.folder_id === folder.id);
      const hasMatchingMaterial = materialsInFolder.some(m => 
        m.name.toLowerCase().includes(lowerSearch) || m.description?.toLowerCase().includes(lowerSearch)
      );
      return folderMatches || hasMatchingMaterial;
    });
  };

  const getMaterialsInFolder = (folderId: string | null) => {
    const lowerSearch = searchTerm.toLowerCase();
    const materialsInFolder = materials.filter(m => m.folder_id === folderId);
    if (!searchTerm) return materialsInFolder;
    return materialsInFolder.filter(m => 
      m.name.toLowerCase().includes(lowerSearch) || m.description?.toLowerCase().includes(lowerSearch)
    );
  };

  const getUnorganizedMaterials = () => {
    const lowerSearch = searchTerm.toLowerCase();
    const unorganized = materials.filter(m => !m.folder_id);
    if (!searchTerm) return unorganized;
    return unorganized.filter(m => 
      m.name.toLowerCase().includes(lowerSearch) || m.description?.toLowerCase().includes(lowerSearch)
    );
  };

  const handleOpenCreateFolder = (parentId?: string) => {
    setEditingFolder(null);
    setFolderName('');
    setFolderThumbnailUrl('');
    setParentFolderId(parentId || 'none');
    setFolderSectionId('none');
    setFolderDisplayOrder(0);
    setFolderDialogOpen(true);
  };

  const handleOpenEditFolder = (folder: PdfFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderThumbnailUrl(folder.thumbnail_url || '');
    setParentFolderId(folder.parent_folder_id || 'none');
    setFolderSectionId(folder.section_id || 'none');
    setFolderDisplayOrder(folder.display_order);
    setFolderDialogOpen(true);
  };

  const handleSaveFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Nome da pasta é obrigatório');
      return;
    }

    if (editingFolder) {
      const { error } = await supabase
        .from('pdf_material_folders')
        .update({ 
          name: folderName.trim(),
          parent_folder_id: parentFolderId === 'none' ? null : parentFolderId,
          section_id: folderSectionId === 'none' ? null : folderSectionId,
          thumbnail_url: folderThumbnailUrl.trim() || null,
          display_order: folderDisplayOrder,
        })
        .eq('id', editingFolder.id);
      if (error) { toast.error('Erro ao atualizar pasta'); return; }
      toast.success('Pasta atualizada!');
    } else {
      const { error } = await supabase
        .from('pdf_material_folders')
        .insert({ 
          name: folderName.trim(),
          parent_folder_id: parentFolderId === 'none' ? null : parentFolderId,
          section_id: folderSectionId === 'none' ? null : folderSectionId,
          thumbnail_url: folderThumbnailUrl.trim() || null,
          display_order: folderDisplayOrder,
        });
      if (error) { toast.error('Erro ao criar pasta'); return; }
      toast.success('Pasta criada!');
    }

    setFolderDialogOpen(false);
    fetchData();
  };

  // ============ MATERIALS CRUD ============
  const handleOpenCreateMaterial = (folderId?: string) => {
    setEditingMaterial(null);
    setMaterialName('');
    setMaterialDescription('');
    setMaterialFolderId(folderId || 'none');
    setMaterialStudyMinutes(60);
    setMaterialTotalPages('');
    setMaterialDisplayOrder(0);
    setSelectedFile(null);
    setMaterialDialogOpen(true);
  };

  const handleOpenEditMaterial = (material: PdfMaterial) => {
    setEditingMaterial(material);
    setMaterialName(material.name);
    setMaterialDescription(material.description || '');
    setMaterialFolderId(material.folder_id || 'none');
    setMaterialStudyMinutes(material.total_study_minutes);
    setMaterialTotalPages(material.total_pages || '');
    setMaterialDisplayOrder(material.display_order || 0);
    setSelectedFile(null);
    setMaterialDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') { toast.error('Apenas arquivos PDF são permitidos'); return; }
      if (file.size > 50 * 1024 * 1024) { toast.error('Arquivo muito grande (máximo 50MB)'); return; }
      setSelectedFile(file);
      if (!materialName) setMaterialName(file.name.replace('.pdf', ''));
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${timestamp}_${safeName}`;
    const { error } = await supabase.storage.from('pdf-materials').upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (error) { console.error('Upload error:', error); return null; }
    const { data: urlData } = supabase.storage.from('pdf-materials').getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleSaveMaterial = async () => {
    if (!materialName.trim()) { toast.error('Nome do material é obrigatório'); return; }
    if (!editingMaterial && !selectedFile) { toast.error('Selecione um arquivo PDF'); return; }

    setSavingMaterial(true);
    try {
      let fileUrl = editingMaterial?.current_file_url;
      let newVersion = editingMaterial?.current_version || 1;

      if (selectedFile) {
        setUploadingFile(true);
        const uploadedUrl = await uploadFile(selectedFile);
        setUploadingFile(false);
        if (!uploadedUrl) { toast.error('Erro ao fazer upload do arquivo'); return; }
        fileUrl = uploadedUrl;
        if (editingMaterial) newVersion = editingMaterial.current_version + 1;
      }

      if (editingMaterial) {
        const { error } = await supabase
          .from('pdf_materials')
          .update({ 
            name: materialName.trim(),
            description: materialDescription.trim() || null,
            folder_id: materialFolderId === 'none' ? null : materialFolderId,
            total_study_minutes: materialStudyMinutes,
            total_pages: materialTotalPages || null,
            current_file_url: fileUrl,
            current_version: newVersion,
            display_order: materialDisplayOrder,
          })
          .eq('id', editingMaterial.id);
        if (error) throw error;

        if (selectedFile && fileUrl) {
          await supabase.from('pdf_material_versions').insert({
            pdf_material_id: editingMaterial.id, version_number: newVersion,
            file_url: fileUrl, total_pages: materialTotalPages || null, change_notes: 'Nova versão do arquivo'
          });
        }
        toast.success('Material atualizado!');
      } else {
        const { data: newMaterial, error } = await supabase
          .from('pdf_materials')
          .insert({ 
            name: materialName.trim(),
            description: materialDescription.trim() || null,
            folder_id: materialFolderId === 'none' ? null : materialFolderId,
            total_study_minutes: materialStudyMinutes,
            total_pages: materialTotalPages || null,
            current_file_url: fileUrl,
            current_version: 1,
            display_order: materialDisplayOrder,
          })
          .select('id')
          .single();
        if (error || !newMaterial) throw error;

        await supabase.from('pdf_material_versions').insert({
          pdf_material_id: newMaterial.id, version_number: 1,
          file_url: fileUrl, total_pages: materialTotalPages || null, change_notes: 'Versão inicial'
        });
        toast.success('Material criado!');
      }

      setMaterialDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving material:', error);
      toast.error('Erro ao salvar material');
    } finally {
      setSavingMaterial(false);
    }
  };

  // ============ DELETE ============
  const handleDeleteClick = (type: 'folder' | 'material' | 'section', item: any) => {
    setDeletingItem({ type, item });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      const table = deletingItem.type === 'section' ? 'pdf_material_sections'
        : deletingItem.type === 'folder' ? 'pdf_material_folders' : 'pdf_materials';
      const { error } = await supabase.from(table).update({ is_active: false }).eq('id', deletingItem.item.id);
      if (error) throw error;
      toast.success(`${deletingItem.type === 'section' ? 'Seção' : deletingItem.type === 'folder' ? 'Pasta' : 'Material'} excluído(a)!`);
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erro ao excluir');
    }
  };

  // ============ VERSIONS ============
  const handleViewVersions = async (material: PdfMaterial) => {
    setSelectedMaterialName(material.name);
    const { data, error } = await supabase
      .from('pdf_material_versions')
      .select('*')
      .eq('pdf_material_id', material.id)
      .order('version_number', { ascending: false });
    if (error) { toast.error('Erro ao carregar versões'); return; }
    setSelectedMaterialVersions(data || []);
    setVersionsDialogOpen(true);
  };

  // ============ SELECTION & MOVE ============
  const togglePdfSelection = (pdfId: string) => {
    setSelectedPdfIds(prev => {
      const next = new Set(prev);
      if (next.has(pdfId)) next.delete(pdfId); else next.add(pdfId);
      return next;
    });
  };

  const toggleSelectAll = (pdfIds: string[]) => {
    const allSelected = pdfIds.every(id => selectedPdfIds.has(id));
    if (allSelected) {
      setSelectedPdfIds(prev => { const next = new Set(prev); pdfIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedPdfIds(prev => { const next = new Set(prev); pdfIds.forEach(id => next.add(id)); return next; });
    }
  };

  const handleOpenMoveDialog = () => { setMovingToFolderId('none'); setMoveDialogOpen(true); };

  const handleMovePdfs = async () => {
    if (selectedPdfIds.size === 0) return;
    setMovingPdfs(true);
    try {
      const folderId = movingToFolderId === 'none' ? null : movingToFolderId;
      const { error } = await supabase.from('pdf_materials').update({ folder_id: folderId }).in('id', Array.from(selectedPdfIds));
      if (error) throw error;
      toast.success(`${selectedPdfIds.size} PDF(s) movido(s)!`);
      setSelectedPdfIds(new Set());
      setMoveDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Move error:', error);
      toast.error('Erro ao mover PDFs');
    } finally {
      setMovingPdfs(false);
    }
  };

  const handleOpenViewer = (material: PdfMaterial) => { setViewingMaterial(material); setViewerDialogOpen(true); };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  // ============ RENDER HELPERS ============
  const renderFolder = (folder: PdfFolder, level: number = 0) => {
    const childFolders = getChildFolders(folder.id);
    const materialsInFolder = getMaterialsInFolder(folder.id);
    const hasChildren = childFolders.length > 0 || materialsInFolder.length > 0;
    const sectionName = sections.find(s => s.id === folder.section_id)?.name;

    return (
      <AccordionItem key={folder.id} value={folder.id} className="border-none">
        <div className="flex items-center gap-2 group">
          <AccordionTrigger className="flex-1 hover:no-underline py-2 px-3 rounded-lg hover:bg-muted/50">
            <div className="flex items-center gap-2">
              {hasChildren ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />}
              <span className="font-medium">{folder.name}</span>
              <Badge variant="secondary" className="text-xs">
                {materialsInFolder.length} PDF{materialsInFolder.length !== 1 ? 's' : ''}
              </Badge>
              {sectionName && (
                <Badge variant="outline" className="text-xs">
                  {sectionName}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">#{folder.display_order}</span>
            </div>
          </AccordionTrigger>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenCreateMaterial(folder.id)}>
                <Upload className="w-4 h-4 mr-2" /> Adicionar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenCreateFolder(folder.id)}>
                <FolderPlus className="w-4 h-4 mr-2" /> Criar Subpasta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleOpenEditFolder(folder)}>
                <Edit className="w-4 h-4 mr-2" /> Editar Pasta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDeleteClick('folder', folder)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir Pasta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <AccordionContent className="pl-6 pt-1">
          {childFolders.length > 0 && (
            <Accordion type="multiple" className="space-y-1">
              {childFolders.map(child => renderFolder(child, level + 1))}
            </Accordion>
          )}
          {materialsInFolder.map(material => renderMaterial(material))}
        </AccordionContent>
      </AccordionItem>
    );
  };

  const renderMaterial = (material: PdfMaterial) => (
    <div key={material.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group">
      <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{material.name}</span>
          <Badge variant="outline" className="text-xs">v{material.current_version}</Badge>
          <span className="text-xs text-muted-foreground">#{material.display_order}</span>
        </div>
        {material.description && <p className="text-sm text-muted-foreground truncate">{material.description}</p>}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatStudyTime(material.total_study_minutes)}</span>
          {material.total_pages && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{material.total_pages} páginas</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenViewer(material)} title="Visualizar PDF">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewVersions(material)} title="Ver Versões">
          <History className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenEditMaterial(material)}>
              <Edit className="w-4 h-4 mr-2" /> Editar Material
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleViewVersions(material)}>
              <History className="w-4 h-4 mr-2" /> Ver Versões
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDeleteClick('material', material)} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Excluir Material
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rootFolders = buildFolderTree();
  const unorganizedMaterials = getUnorganizedMaterials();

  return (
    <div className="space-y-6">
      {/* ======= SECTIONS MANAGEMENT ======= */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Seções (Netflix-style)
              </CardTitle>
              <CardDescription>
                Organize os módulos (pastas) em seções visíveis para os alunos.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreateSection}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Seção
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma seção criada.</p>
          ) : (
            <div className="space-y-2">
              {sections.map((section) => {
                const sectionFolders = folders.filter(f => f.section_id === section.id);
                return (
                  <div key={section.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card group">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{section.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {sectionFolders.length} módulo{sectionFolders.length !== 1 ? 's' : ''}
                        </Badge>
                        <span className="text-xs text-muted-foreground">ordem: {section.display_order}</span>
                      </div>
                      {section.description && (
                        <p className="text-sm text-muted-foreground truncate">{section.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditSection(section)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick('section', section)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======= FOLDERS & MATERIALS ======= */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Módulos e PDFs
              </CardTitle>
              <CardDescription>
                Gerencie os módulos (pastas) e materiais PDF. Vincule cada módulo a uma seção.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleOpenCreateFolder()}>
                <FolderPlus className="w-4 h-4 mr-2" /> Novo Módulo
              </Button>
              <Button size="sm" onClick={() => handleOpenCreateMaterial()}>
                <Upload className="w-4 h-4 mr-2" /> Upload PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar materiais..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>

          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <span>{sections.length} seç{sections.length !== 1 ? 'ões' : 'ão'}</span>
            <span>•</span>
            <span>{folders.length} módulo{folders.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{materials.length} PDF{materials.length !== 1 ? 's' : ''}</span>
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {rootFolders.length > 0 && (
                <Accordion type="multiple" className="space-y-1">
                  {rootFolders.map(folder => renderFolder(folder))}
                </Accordion>
              )}

              {unorganizedMaterials.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={unorganizedMaterials.length > 0 && unorganizedMaterials.every(m => selectedPdfIds.has(m.id))}
                        onCheckedChange={() => toggleSelectAll(unorganizedMaterials.map(m => m.id))}
                      />
                      <h4 className="text-sm font-medium text-muted-foreground">Sem pasta ({unorganizedMaterials.length})</h4>
                    </div>
                    {selectedPdfIds.size > 0 && (
                      <Button size="sm" variant="outline" onClick={handleOpenMoveDialog}>
                        <MoveRight className="w-4 h-4 mr-1" /> Mover {selectedPdfIds.size} para pasta
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {unorganizedMaterials.map(material => (
                      <div key={material.id} className="flex items-center gap-2">
                        <Checkbox checked={selectedPdfIds.has(material.id)} onCheckedChange={() => togglePdfSelection(material.id)} />
                        <div className="flex-1">{renderMaterial(material)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rootFolders.length === 0 && unorganizedMaterials.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum material encontrado</p>
                  <p className="text-sm">Comece criando um módulo ou fazendo upload de um PDF</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Link by Edital Section */}
      <AdminPdfLinkByEdital />

      {/* ======= SECTION DIALOG ======= */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Editar Seção' : 'Nova Seção'}</DialogTitle>
            <DialogDescription>Seções agrupam módulos na tela do aluno (estilo Netflix).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Seção</Label>
              <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="Ex: Disciplinas Básicas" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={sectionDescription} onChange={(e) => setSectionDescription(e.target.value)} placeholder="Breve descrição..." rows={2} />
            </div>
            <div>
              <Label>Ordem de Exibição</Label>
              <Input type="number" value={sectionDisplayOrder} onChange={(e) => setSectionDisplayOrder(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSection}>{editingSection ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======= FOLDER DIALOG ======= */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
            <DialogDescription>Módulos aparecem como cards para o aluno dentro de uma seção.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Módulo</Label>
              <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Ex: Direito Constitucional" />
            </div>
            <div>
              <Label>Seção</Label>
              <Select value={folderSectionId} onValueChange={setFolderSectionId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma seção" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem seção</SelectItem>
                  {sections.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pasta Pai (opcional)</Label>
              <Select value={parentFolderId} onValueChange={setParentFolderId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                  {folders.filter(f => f.id !== editingFolder?.id).map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordem de Exibição</Label>
              <Input type="number" value={folderDisplayOrder} onChange={(e) => setFolderDisplayOrder(parseInt(e.target.value) || 0)} />
            </div>
            <ImageUpload
              value={folderThumbnailUrl}
              onChange={setFolderThumbnailUrl}
              label="Imagem de Capa (9:16 recomendado)"
              placeholder="URL da imagem ou faça upload"
              folder="folder-thumbnails"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFolder}>{editingFolder ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======= MATERIAL DIALOG ======= */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMaterial ? 'Editar Material' : 'Novo Material PDF'}</DialogTitle>
            <DialogDescription>
              {editingMaterial 
                ? 'Atualize as informações do material. Para atualizar o arquivo, selecione um novo PDF.'
                : 'Faça upload de um material PDF e configure as informações de estudo.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Arquivo PDF</Label>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect} className="hidden" />
              <div onClick={() => fileInputRef.current?.click()} className="mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <FileText className="w-5 h-5" />
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                ) : editingMaterial ? (
                  <div className="text-muted-foreground">
                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Clique para atualizar o arquivo (opcional)</p>
                    <p className="text-xs mt-1">Versão atual: v{editingMaterial.current_version}</p>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Clique para selecionar um PDF</p>
                    <p className="text-xs mt-1">Máximo 50MB</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Nome do Material</Label>
              <Input value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder="Ex: Apostila de Direito Constitucional" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={materialDescription} onChange={(e) => setMaterialDescription(e.target.value)} placeholder="Breve descrição do conteúdo..." rows={2} />
            </div>
            <div>
              <Label>Módulo (Pasta)</Label>
              <Select value={materialFolderId} onValueChange={setMaterialFolderId}>
                <SelectTrigger><SelectValue placeholder="Selecione um módulo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem módulo</SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tempo (min)</Label>
                <Input type="number" min={1} value={materialStudyMinutes} onChange={(e) => setMaterialStudyMinutes(parseInt(e.target.value) || 60)} />
              </div>
              <div>
                <Label>Páginas</Label>
                <Input type="number" min={1} value={materialTotalPages} onChange={(e) => setMaterialTotalPages(e.target.value ? parseInt(e.target.value) : '')} placeholder="Ex: 150" />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={materialDisplayOrder} onChange={(e) => setMaterialDisplayOrder(parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMaterial} disabled={savingMaterial || uploadingFile}>
              {(savingMaterial || uploadingFile) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploadingFile ? 'Enviando...' : editingMaterial ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======= DELETE DIALOG ======= */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingItem?.type === 'section'
                ? `Tem certeza que deseja excluir a seção "${deletingItem.item.name}"? Os módulos vinculados ficarão sem seção.`
                : deletingItem?.type === 'folder' 
                  ? `Tem certeza que deseja excluir o módulo "${deletingItem.item.name}"? Os PDFs dentro dele ficarão sem módulo.`
                  : `Tem certeza que deseja excluir o material "${deletingItem?.item?.name}"?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ======= VERSIONS DIALOG ======= */}
      <Dialog open={versionsDialogOpen} onOpenChange={setVersionsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de Versões</DialogTitle>
            <DialogDescription>{selectedMaterialName}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3">
              {selectedMaterialVersions.map(version => (
                <div key={version.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={version.version_number === selectedMaterialVersions[0]?.version_number ? 'default' : 'outline'}>
                        v{version.version_number}
                      </Badge>
                      {version.version_number === selectedMaterialVersions[0]?.version_number && (
                        <Badge variant="secondary" className="text-xs">Atual</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(version.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    {version.change_notes && <p className="text-sm mt-1">{version.change_notes}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => window.open(version.file_url, '_blank')}>
                    <Eye className="w-4 h-4 mr-1" /> Ver
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      {viewingMaterial && (
        <PdfViewerDialog
          open={viewerDialogOpen}
          onOpenChange={setViewerDialogOpen}
          pdfUrl={viewingMaterial.current_file_url}
          pdfMaterialId={viewingMaterial.id}
          title={viewingMaterial.name}
          totalPages={viewingMaterial.total_pages || undefined}
        />
      )}

      {/* Move Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MoveRight className="w-5 h-5" /> Mover PDFs para Módulo</DialogTitle>
            <DialogDescription>Selecione o módulo de destino para {selectedPdfIds.size} PDF(s) selecionado(s).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Módulo de Destino</Label>
              <Select value={movingToFolderId} onValueChange={setMovingToFolderId}>
                <SelectTrigger><SelectValue placeholder="Selecione um módulo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem módulo</SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.parent_folder_id ? `↳ ${folder.name}` : folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleMovePdfs} disabled={movingPdfs}>
              {movingPdfs ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MoveRight className="w-4 h-4 mr-1" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
