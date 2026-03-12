import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Plus, 
  RefreshCw, 
  Loader2, 
  FolderPlus,
  Folder,
  FolderOpen,
  FileText,
  Link,
  Copy,
  Trash2,
  Edit,
  ChevronRight,
  SquareCheck,
  Square,
  MoveRight,
  Search
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EditalSchoolFilter } from './EditalFilter';

interface Notebook {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
  question_count: number;
  is_active: boolean;
  created_at: string;
}

interface NotebookFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  school_id: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export function AdminCadernosQuestoes() {
  const [loading, setLoading] = useState(true);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [folders, setFolders] = useState<NotebookFolder[]>([]);
  const [allFolders, setAllFolders] = useState<NotebookFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEditalId, setFilterEditalId] = useState('');
  const [filterEdital, setFilterEdital] = useState(''); // School ID
  
  // Dialog states
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<NotebookFolder | null>(null);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  
  // Form states
  const [folderName, setFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string>('');
  const [notebookName, setNotebookName] = useState('');
  const [notebookDescription, setNotebookDescription] = useState('');
  const [notebookFolderId, setNotebookFolderId] = useState<string>('');
  
  // Selection states
  const [selectedNotebooks, setSelectedNotebooks] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Cascade delete dialog (disciplina/pasta ou tópico/caderno)
  const [cascadeDialogOpen, setCascadeDialogOpen] = useState(false);
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [cascadeDeleting, setCascadeDeleting] = useState(false);
  const [cascadePlan, setCascadePlan] = useState<null | {
    targetType: 'folder' | 'notebook';
    targetName: string;
    folderIds: string[];
    notebookIds: string[];
    disciplineIds: string[];
    topicIds: string[];
    questionCount: number;
  }>(null);
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Filter folders when edital changes
    if (filterEdital && filterEdital !== 'all') {
      setFolders(allFolders.filter(f => f.school_id === filterEdital));
    } else {
      setFolders(allFolders);
    }
  }, [filterEdital, allFolders]);

  const fetchData = async () => {
    setLoading(true);
    
    const [foldersRes, notebooksRes] = await Promise.all([
      supabase
        .from('admin_notebook_folders')
        .select('*')
        .order('display_order'),
      supabase
        .from('admin_question_notebooks')
        .select('*')
        .order('created_at', { ascending: false })
    ]);

    setAllFolders(foldersRes.data || []);
    setFolders(foldersRes.data || []);
    setNotebooks(notebooksRes.data || []);
    setLoading(false);
  };

  // Build folder tree structure - filtered by search
  const buildFolderTree = () => {
    const lowerSearch = searchTerm.toLowerCase();
    const rootFolders = folders.filter(f => !f.parent_folder_id && f.is_active);
    
    if (!searchTerm) return rootFolders;
    
    // Filter folders that match or have matching notebooks
    return rootFolders.filter(folder => {
      const folderMatches = folder.name.toLowerCase().includes(lowerSearch);
      const notebooksInFolder = notebooks.filter(n => n.folder_id === folder.id && n.is_active);
      const hasMatchingNotebook = notebooksInFolder.some(n => 
        n.name.toLowerCase().includes(lowerSearch) || 
        n.description?.toLowerCase().includes(lowerSearch)
      );
      return folderMatches || hasMatchingNotebook;
    });
  };

  const getChildFolders = (parentId: string) => {
    const lowerSearch = searchTerm.toLowerCase();
    const children = folders.filter(f => f.parent_folder_id === parentId && f.is_active);
    
    if (!searchTerm) return children;
    
    return children.filter(folder => {
      const folderMatches = folder.name.toLowerCase().includes(lowerSearch);
      const notebooksInFolder = notebooks.filter(n => n.folder_id === folder.id && n.is_active);
      const hasMatchingNotebook = notebooksInFolder.some(n => 
        n.name.toLowerCase().includes(lowerSearch) || 
        n.description?.toLowerCase().includes(lowerSearch)
      );
      return folderMatches || hasMatchingNotebook;
    });
  };

  const getNotebooksInFolder = (folderId: string | null) => {
    const lowerSearch = searchTerm.toLowerCase();
    const notebooksInFolder = notebooks.filter(n => n.folder_id === folderId && n.is_active);
    
    if (!searchTerm) return notebooksInFolder;
    
    return notebooksInFolder.filter(n => 
      n.name.toLowerCase().includes(lowerSearch) || 
      n.description?.toLowerCase().includes(lowerSearch)
    );
  };

  const getUnorganizedNotebooks = () => {
    const lowerSearch = searchTerm.toLowerCase();
    const unorganized = notebooks.filter(n => !n.folder_id && n.is_active);
    
    if (!searchTerm) return unorganized;
    
    return unorganized.filter(n => 
      n.name.toLowerCase().includes(lowerSearch) || 
      n.description?.toLowerCase().includes(lowerSearch)
    );
  };

  const getFolderSubtreeIds = (rootId: string) => {
    const ids: string[] = [];
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!ids.includes(current)) ids.push(current);

      const children = folders
        .filter(f => f.parent_folder_id === current)
        .map(f => f.id);

      queue.push(...children);
    }

    return ids;
  };

  const countLinkedQuestions = async (disciplineIds: string[], topicIds: string[]) => {
    if (disciplineIds.length === 0 && topicIds.length === 0) return 0;

    let query = supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (disciplineIds.length > 0 && topicIds.length > 0) {
      query = query.or(
        `study_discipline_id.in.(${disciplineIds.join(',')}),study_topic_id.in.(${topicIds.join(',')})`
      );
    } else if (disciplineIds.length > 0) {
      query = query.in('study_discipline_id', disciplineIds);
    } else {
      query = query.in('study_topic_id', topicIds);
    }

    const { count } = await query;
    return count || 0;
  };

  const openCascadeDeleteForFolder = async (folder: NotebookFolder) => {
    setCascadeDialogOpen(true);
    setCascadeLoading(true);
    setCascadePlan(null);

    try {
      const folderIds = getFolderSubtreeIds(folder.id);
      const notebookIds = notebooks
        .filter(n => n.is_active && n.folder_id && folderIds.includes(n.folder_id))
        .map(n => n.id);

      const { data: disciplinesData, error: disciplinesError } = await supabase
        .from('study_disciplines')
        .select('id')
        .in('source_notebook_folder_id', folderIds)
        .eq('is_active', true);

      if (disciplinesError) throw disciplinesError;

      const disciplineIds = (disciplinesData || []).map(d => d.id);

      const [topicsFromNotebooksRes, topicsFromDisciplinesRes] = await Promise.all([
        notebookIds.length > 0
          ? supabase
              .from('study_topics')
              .select('id')
              .in('source_notebook_id', notebookIds)
              .eq('is_active', true)
          : Promise.resolve({ data: [] as any[] }),
        disciplineIds.length > 0
          ? supabase
              .from('study_topics')
              .select('id')
              .in('study_discipline_id', disciplineIds)
              .eq('is_active', true)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const topicIds = Array.from(
        new Set([
          ...(topicsFromNotebooksRes.data || []).map(t => t.id),
          ...(topicsFromDisciplinesRes.data || []).map(t => t.id),
        ])
      );

      const questionCount = await countLinkedQuestions(disciplineIds, topicIds);

      setCascadePlan({
        targetType: 'folder',
        targetName: folder.name,
        folderIds,
        notebookIds,
        disciplineIds,
        topicIds,
        questionCount,
      });
    } catch (error) {
      console.error('Error building folder delete plan:', error);
      toast.error('Erro ao preparar exclusão');
      setCascadeDialogOpen(false);
    } finally {
      setCascadeLoading(false);
    }
  };

  const openCascadeDeleteForNotebook = async (notebook: Notebook) => {
    setCascadeDialogOpen(true);
    setCascadeLoading(true);
    setCascadePlan(null);

    try {
      const { data: topicsData, error: topicsError } = await supabase
        .from('study_topics')
        .select('id, study_discipline_id')
        .eq('source_notebook_id', notebook.id)
        .eq('is_active', true);

      if (topicsError) throw topicsError;

      const topicIds = (topicsData || []).map(t => t.id);
      const disciplineIds = Array.from(new Set((topicsData || []).map(t => t.study_discipline_id).filter(Boolean)));

      const questionCount = await countLinkedQuestions(disciplineIds, topicIds);

      setCascadePlan({
        targetType: 'notebook',
        targetName: notebook.name,
        folderIds: [],
        notebookIds: [notebook.id],
        disciplineIds,
        topicIds,
        questionCount,
      });
    } catch (error) {
      console.error('Error building notebook delete plan:', error);
      toast.error('Erro ao preparar exclusão');
      setCascadeDialogOpen(false);
    } finally {
      setCascadeLoading(false);
    }
  };

  const executeCascadeDelete = async () => {
    if (!cascadePlan) return;

    setCascadeDeleting(true);
    try {
      const { folderIds, notebookIds, disciplineIds, topicIds } = cascadePlan;

      // Desativar questões vinculadas
      if (disciplineIds.length > 0 || topicIds.length > 0) {
        let q = supabase.from('questions').update({ is_active: false }).eq('is_active', true);
        if (disciplineIds.length > 0 && topicIds.length > 0) {
          q = q.or(
            `study_discipline_id.in.(${disciplineIds.join(',')}),study_topic_id.in.(${topicIds.join(',')})`
          );
        } else if (disciplineIds.length > 0) {
          q = q.in('study_discipline_id', disciplineIds);
        } else {
          q = q.in('study_topic_id', topicIds);
        }

        const { error: qError } = await q;
        if (qError) throw qError;
      }

      // Remover vínculos de questões↔cadernos (admin)
      if (notebookIds.length > 0) {
        await supabase.from('admin_notebook_questions').delete().in('notebook_id', notebookIds);
      }

      // Desativar tópicos
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('study_topics')
          .update({ is_active: false })
          .in('id', topicIds);
        if (error) throw error;
      }

      // Desativar cadernos
      if (notebookIds.length > 0) {
        const { error } = await supabase
          .from('admin_question_notebooks')
          .update({ is_active: false })
          .in('id', notebookIds);
        if (error) throw error;
      }

      // Desativar disciplinas
      if (disciplineIds.length > 0) {
        const { error } = await supabase
          .from('study_disciplines')
          .update({ is_active: false })
          .in('id', disciplineIds);
        if (error) throw error;
      }

      // Desativar pastas (disciplina) e subpastas
      if (folderIds.length > 0) {
        const { error } = await supabase
          .from('admin_notebook_folders')
          .update({ is_active: false })
          .in('id', folderIds);
        if (error) throw error;
      }

      toast.success('Exclusão concluída!');
      setCascadeDialogOpen(false);
      setCascadePlan(null);
      setSelectedNotebooks(new Set());
      fetchData();
    } catch (error) {
      console.error('Error executing cascade delete:', error);
      toast.error('Erro ao excluir');
    } finally {
      setCascadeDeleting(false);
    }
  };

  // Folder CRUD
  const handleOpenCreateFolder = (parentId?: string) => {
    setEditingFolder(null);
    setFolderName('');
    setParentFolderId(parentId ? parentId : 'none');
    setFolderDialogOpen(true);
  };

  const handleOpenEditFolder = (folder: NotebookFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setParentFolderId(folder.parent_folder_id || 'none');
    setFolderDialogOpen(true);
  };

  const handleSaveFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Nome da pasta é obrigatório');
      return;
    }

    if (editingFolder) {
      // Update folder
      const { error } = await supabase
        .from('admin_notebook_folders')
        .update({ 
          name: folderName.trim(),
          parent_folder_id: parentFolderId === 'none' ? null : parentFolderId
        })
        .eq('id', editingFolder.id);

      if (error) {
        toast.error('Erro ao atualizar pasta');
        return;
      }
      
      // Also update linked discipline name
      await supabase
        .from('study_disciplines')
        .update({ name: folderName.trim() })
        .eq('source_notebook_folder_id', editingFolder.id);
      
      toast.success('Pasta atualizada!');
    } else {
      // Create folder
      const { data: newFolder, error } = await supabase
        .from('admin_notebook_folders')
        .insert({ 
          name: folderName.trim(),
          parent_folder_id: parentFolderId === 'none' ? null : parentFolderId
        })
        .select('id')
        .single();

      if (error || !newFolder) {
        toast.error('Erro ao criar pasta');
        return;
      }
      
      // Also create study_discipline linked to this folder
      await supabase
        .from('study_disciplines')
        .insert({
          name: folderName.trim(),
          source_notebook_folder_id: newFolder.id,
          is_auto_generated: true,
          is_active: true
        });
      
      toast.success('Pasta e disciplina criadas!');
    }

    setFolderDialogOpen(false);
    fetchData();
  };

  // Notebook CRUD
  const handleOpenEditNotebook = (notebook: Notebook) => {
    setEditingNotebook(notebook);
    setNotebookName(notebook.name);
    setNotebookDescription(notebook.description || '');
    setNotebookFolderId(notebook.folder_id || 'none');
    setNotebookDialogOpen(true);
  };

  const handleSaveNotebook = async () => {
    if (!notebookName.trim()) {
      toast.error('Nome do caderno é obrigatório');
      return;
    }

    if (editingNotebook) {
      const { error } = await supabase
        .from('admin_question_notebooks')
        .update({ 
          name: notebookName.trim(),
          description: notebookDescription.trim() || null,
          folder_id: notebookFolderId === 'none' ? null : notebookFolderId
        })
        .eq('id', editingNotebook.id);

      if (error) {
        toast.error('Erro ao atualizar caderno');
        return;
      }
      toast.success('Caderno atualizado!');
    }

    setNotebookDialogOpen(false);
    fetchData();
  };

  const handleBatchDelete = async () => {
    const notebookIds = [...selectedNotebooks];
    
    // Delete study_topics linked to these notebooks
    await supabase
      .from('study_topics')
      .delete()
      .in('source_notebook_id', notebookIds);

    const { error } = await supabase
      .from('admin_question_notebooks')
      .update({ is_active: false })
      .in('id', notebookIds);

    if (error) {
      toast.error('Erro ao excluir cadernos');
      return;
    }

    toast.success(`${selectedNotebooks.size} caderno(s) e tópico(s) excluído(s)!`);
    setSelectedNotebooks(new Set());
    setDeleteDialogOpen(false);
    fetchData();
  };

  const handleMoveToFolder = async (notebookId: string, folderId: string | null) => {
    const { error } = await supabase
      .from('admin_question_notebooks')
      .update({ folder_id: folderId })
      .eq('id', notebookId);

    if (error) {
      toast.error('Erro ao mover caderno');
      return;
    }

    toast.success('Caderno movido!');
    fetchData();
  };

  const handleBatchMoveToFolder = async (folderId: string | null) => {
    const { error } = await supabase
      .from('admin_question_notebooks')
      .update({ folder_id: folderId })
      .in('id', [...selectedNotebooks]);

    if (error) {
      toast.error('Erro ao mover cadernos');
      return;
    }

    toast.success(`${selectedNotebooks.size} caderno(s) movido(s)!`);
    setSelectedNotebooks(new Set());
    fetchData();
  };

  const copyLink = (notebookId: string) => {
    const link = `${window.location.origin}/caderno/${notebookId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const toggleSelectNotebook = (id: string) => {
    const newSelected = new Set(selectedNotebooks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotebooks(newSelected);
  };

  const selectAllNotebooks = () => {
    const activeNotebooks = notebooks.filter(n => n.is_active);
    if (selectedNotebooks.size === activeNotebooks.length) {
      setSelectedNotebooks(new Set());
    } else {
      setSelectedNotebooks(new Set(activeNotebooks.map(n => n.id)));
    }
  };

  // Render notebook card
  const NotebookCard = ({ notebook }: { notebook: Notebook }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <Checkbox
        checked={selectedNotebooks.has(notebook.id)}
        onCheckedChange={() => toggleSelectNotebook(notebook.id)}
      />
      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{notebook.name}</p>
        <p className="text-xs text-muted-foreground">
          {notebook.question_count} questões
        </p>
      </div>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Mover para pasta">
              <MoveRight className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleMoveToFolder(notebook.id, null)}>
              <FileText className="w-4 h-4 mr-2" />
              Sem pasta
            </DropdownMenuItem>
            {folders.filter(f => f.is_active && f.id !== notebook.folder_id).length > 0 && (
              <DropdownMenuSeparator />
            )}
            {folders.filter(f => f.is_active && f.id !== notebook.folder_id).map(folder => (
              <DropdownMenuItem key={folder.id} onClick={() => handleMoveToFolder(notebook.id, folder.id)}>
                <Folder className="w-4 h-4 mr-2 text-amber-500" />
                {folder.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(notebook.id)}>
          <Copy className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditNotebook(notebook)}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => openCascadeDeleteForNotebook(notebook)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // Render folder with notebooks
  const FolderSection = ({ folder, depth = 0 }: { folder: NotebookFolder; depth?: number }) => {
    const childFolders = getChildFolders(folder.id);
    const folderNotebooks = getNotebooksInFolder(folder.id);

    return (
      <AccordionItem value={folder.id} className="border-none">
        <AccordionTrigger className="hover:no-underline py-2 px-3 rounded-lg hover:bg-muted/50">
          <div className="flex items-center gap-2 flex-1">
            <Folder className="w-4 h-4 text-amber-500" />
            <span className="font-medium">{folder.name}</span>
            <Badge variant="secondary" className="text-xs">
              {folderNotebooks.length}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pl-4 pt-2 space-y-2">
          {/* Sub-folders */}
          {childFolders.length > 0 && (
            <Accordion type="multiple" className="space-y-1">
              {childFolders.map(childFolder => (
                <FolderSection key={childFolder.id} folder={childFolder} depth={depth + 1} />
              ))}
            </Accordion>
          )}
          
          {/* Notebooks in this folder */}
          <div className="space-y-2">
            {folderNotebooks.map(notebook => (
              <NotebookCard key={notebook.id} notebook={notebook} />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => handleOpenCreateFolder(folder.id)}>
              <FolderPlus className="w-4 h-4 mr-1" />
              Subpasta
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleOpenEditFolder(folder)}>
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => openCascadeDeleteForFolder(folder)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rootFolders = buildFolderTree();
  const unorganizedNotebooks = getUnorganizedNotebooks();
  const activeNotebooks = notebooks.filter(n => n.is_active);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link className="w-5 h-5" />
              Disciplinas e Tópicos
            </CardTitle>
            <CardDescription>
              Gerencie as disciplinas (pastas) e tópicos (cadernos) do banco de questões
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => handleOpenCreateFolder()}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Nova Disciplina
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Edital + School Filter */}
        <div className="pb-2 border-b">
          <EditalSchoolFilter 
            editalValue={filterEditalId}
            schoolValue={filterEdital}
            onEditalChange={(v) => setFilterEditalId(v === 'all' ? '' : v)}
            onSchoolChange={(v) => setFilterEdital(v === 'all' ? '' : v)} 
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar disciplinas ou tópicos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {/* Batch actions */}
        {selectedNotebooks.size > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted flex-wrap">
            <span className="text-sm font-medium">
              {selectedNotebooks.size} selecionado(s)
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedNotebooks(new Set())}>
              Desmarcar tudo
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoveRight className="w-4 h-4 mr-1" />
                  Mover para
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBatchMoveToFolder(null)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Sem pasta
                </DropdownMenuItem>
                {folders.filter(f => f.is_active).length > 0 && (
                  <DropdownMenuSeparator />
                )}
                {folders.filter(f => f.is_active).map(folder => (
                  <DropdownMenuItem key={folder.id} onClick={() => handleBatchMoveToFolder(folder.id)}>
                    <Folder className="w-4 h-4 mr-2 text-amber-500" />
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir Selecionados
            </Button>
          </div>
        )}

        {/* Select all */}
        {activeNotebooks.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedNotebooks.size === activeNotebooks.length && activeNotebooks.length > 0}
              onCheckedChange={selectAllNotebooks}
            />
            <span className="text-sm text-muted-foreground">Selecionar todos</span>
          </div>
        )}

        <ScrollArea className="h-[500px]">
          {/* Folders */}
          {rootFolders.length > 0 && (
            <Accordion type="multiple" className="space-y-1">
              {rootFolders.map(folder => (
                <FolderSection key={folder.id} folder={folder} />
              ))}
            </Accordion>
          )}

          {/* Unorganized notebooks */}
          {unorganizedNotebooks.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Sem pasta ({unorganizedNotebooks.length})
              </h3>
              <div className="space-y-2">
                {unorganizedNotebooks.map(notebook => (
                  <NotebookCard key={notebook.id} notebook={notebook} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {rootFolders.length === 0 && unorganizedNotebooks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum caderno de questões ainda.</p>
              <p className="text-sm">Importe questões e crie um caderno automaticamente.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? 'Editar Pasta' : 'Nova Pasta'}
            </DialogTitle>
            <DialogDescription>
              Organize seus cadernos em pastas e subpastas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Pasta</Label>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Ex: Direito Constitucional"
              />
            </div>
            <div className="space-y-2">
              <Label>Pasta Pai (opcional)</Label>
              <Select value={parentFolderId} onValueChange={setParentFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma (pasta raiz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (pasta raiz)</SelectItem>
                  {folders.filter(f => f.is_active && f.id !== editingFolder?.id).map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFolder}>
              {editingFolder ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notebook Dialog */}
      <Dialog open={notebookDialogOpen} onOpenChange={setNotebookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Caderno</DialogTitle>
            <DialogDescription>
              Altere o nome, descrição ou pasta do caderno
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Caderno</Label>
              <Input
                value={notebookName}
                onChange={(e) => setNotebookName(e.target.value)}
                placeholder="Ex: Simulado CESPE 2024"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={notebookDescription}
                onChange={(e) => setNotebookDescription(e.target.value)}
                placeholder="Ex: 100 questões de Direito Constitucional"
              />
            </div>
            <div className="space-y-2">
              <Label>Pasta</Label>
              <Select value={notebookFolderId} onValueChange={setNotebookFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pasta</SelectItem>
                  {folders.filter(f => f.is_active).map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotebookDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNotebook}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cadernos</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedNotebooks.size} caderno(s)?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cascade delete (disciplina/tópico) */}
      <AlertDialog open={cascadeDialogOpen} onOpenChange={setCascadeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cascadeLoading ? 'Preparando...' : 'Confirmar exclusão'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cascadeLoading && 'Carregando dados vinculados...'}
              {!cascadeLoading && cascadePlan && (
                <div className="space-y-2">
                  <p>
                    Existem <strong>{cascadePlan.questionCount}</strong> questão(ões) vinculada(s) a <strong>{cascadePlan.targetName}</strong>.
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {cascadePlan.targetType === 'folder' && (
                      <p>Disciplinas (pastas) afetadas: {cascadePlan.folderIds.length}</p>
                    )}
                    <p>Tópicos (cadernos) afetados: {cascadePlan.notebookIds.length}</p>
                    <p>Registros de disciplina: {cascadePlan.disciplineIds.length}</p>
                    <p>Registros de tópico: {cascadePlan.topicIds.length}</p>
                  </div>
                  <p className="text-sm">
                    Ao confirmar, vamos <strong>inativar</strong> todas as questões, tópicos e disciplinas vinculadas (e remover vínculos com cadernos).
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cascadeDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeCascadeDelete}
              disabled={cascadeLoading || cascadeDeleting || !cascadePlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cascadeDeleting ? 'Excluindo...' : 'Excluir tudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
