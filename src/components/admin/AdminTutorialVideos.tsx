import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FolderPlus, Video, GripVertical, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TutorialFolder {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  parent_folder_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface TutorialVideo {
  id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export function AdminTutorialVideos() {
  const queryClient = useQueryClient();
  const [activeModule, setActiveModule] = useState<'dossie-if' | 'codigo-if'>('dossie-if');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Folder dialog
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TutorialFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [folderParentId, setFolderParentId] = useState<string | null>(null);

  // Video dialog
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<TutorialVideo | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFolderId, setVideoFolderId] = useState<string | null>(null);

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['tutorial-folders', activeModule],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorial_video_folders')
        .select('*')
        .eq('module', activeModule)
        .order('display_order');
      if (error) throw error;
      return data as TutorialFolder[];
    },
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['tutorial-videos', activeModule],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorial_videos')
        .select('*')
        .eq('module', activeModule)
        .order('display_order');
      if (error) throw error;
      return data as TutorialVideo[];
    },
  });

  // Folder mutations
  const saveFolder = useMutation({
    mutationFn: async () => {
      if (editingFolder) {
        const { error } = await supabase
          .from('tutorial_video_folders')
          .update({ name: folderName, description: folderDescription || null, parent_folder_id: folderParentId })
          .eq('id', editingFolder.id);
        if (error) throw error;
      } else {
        const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.display_order)) + 1 : 0;
        const { error } = await supabase
          .from('tutorial_video_folders')
          .insert({ name: folderName, description: folderDescription || null, parent_folder_id: folderParentId, display_order: maxOrder, module: activeModule });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-folders'] });
      setFolderDialogOpen(false);
      toast.success(editingFolder ? 'Pasta atualizada' : 'Pasta criada');
    },
    onError: () => toast.error('Erro ao salvar pasta'),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutorial_video_folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-folders'] });
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
      toast.success('Pasta removida');
    },
    onError: () => toast.error('Erro ao remover pasta'),
  });

  const toggleFolderActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('tutorial_video_folders').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-folders'] });
      toast.success('Status atualizado');
    },
  });

  // Video mutations
  const saveVideo = useMutation({
    mutationFn: async () => {
      if (editingVideo) {
        const { error } = await supabase
          .from('tutorial_videos')
          .update({ title: videoTitle, description: videoDescription || null, youtube_url: videoUrl, folder_id: videoFolderId })
          .eq('id', editingVideo.id);
        if (error) throw error;
      } else {
        const folderVideos = videos.filter(v => v.folder_id === videoFolderId);
        const maxOrder = folderVideos.length > 0 ? Math.max(...folderVideos.map(v => v.display_order)) + 1 : 0;
        const { error } = await supabase
          .from('tutorial_videos')
          .insert({ title: videoTitle, description: videoDescription || null, youtube_url: videoUrl, folder_id: videoFolderId, display_order: maxOrder, module: activeModule });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
      setVideoDialogOpen(false);
      toast.success(editingVideo ? 'Vídeo atualizado' : 'Vídeo adicionado');
    },
    onError: () => toast.error('Erro ao salvar vídeo'),
  });

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutorial_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
      toast.success('Vídeo removido');
    },
    onError: () => toast.error('Erro ao remover vídeo'),
  });

  const toggleVideoActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('tutorial_videos').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
      toast.success('Status atualizado');
    },
  });

  const openFolderDialog = (folder?: TutorialFolder, parentId?: string | null) => {
    setEditingFolder(folder || null);
    setFolderName(folder?.name || '');
    setFolderDescription(folder?.description || '');
    setFolderParentId(folder?.parent_folder_id ?? parentId ?? null);
    setFolderDialogOpen(true);
  };

  const openVideoDialog = (folderId: string | null, video?: TutorialVideo) => {
    setEditingVideo(video || null);
    setVideoTitle(video?.title || '');
    setVideoDescription(video?.description || '');
    setVideoUrl(video?.youtube_url || '');
    setVideoFolderId(video?.folder_id ?? folderId);
    setVideoDialogOpen(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
    return match?.[1] || null;
  };

  // Root folders (no parent)
  const rootFolders = folders.filter(f => !f.parent_folder_id);

  const renderFolder = (folder: TutorialFolder, depth: number = 0) => {
    const childFolders = folders.filter(f => f.parent_folder_id === folder.id);
    const folderVideos = videos.filter(v => v.folder_id === folder.id);
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id} className="border rounded-lg" style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 p-3 bg-muted/50">
          <button onClick={() => toggleExpanded(folder.id)} className="p-1 hover:bg-muted rounded">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium flex-1">{folder.name}</span>
          <Badge variant={folder.is_active ? "default" : "secondary"}>
            {folder.is_active ? "Ativo" : "Inativo"}
          </Badge>
          <Switch
            checked={folder.is_active}
            onCheckedChange={(checked) => toggleFolderActive.mutate({ id: folder.id, is_active: checked })}
          />
          <Button variant="ghost" size="icon" onClick={() => openFolderDialog(folder)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteFolder.mutate(folder.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
        {isExpanded && (
          <div className="p-3 space-y-2">
            {folder.description && (
              <p className="text-sm text-muted-foreground">{folder.description}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openFolderDialog(undefined, folder.id)}>
                <FolderPlus className="w-4 h-4 mr-1" /> Sub-pasta
              </Button>
              <Button variant="outline" size="sm" onClick={() => openVideoDialog(folder.id)}>
                <Plus className="w-4 h-4 mr-1" /> Vídeo
              </Button>
            </div>

            {/* Child folders */}
            {childFolders.map(child => renderFolder(child, depth + 1))}

            {/* Videos */}
            {folderVideos.map(video => {
              const ytId = getYouTubeId(video.youtube_url);
              return (
                <div key={video.id} className="flex items-center gap-3 p-2 border rounded bg-background">
                  {ytId && (
                    <img 
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-24 h-14 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{video.title}</p>
                    {video.description && <p className="text-xs text-muted-foreground truncate">{video.description}</p>}
                  </div>
                  <Switch
                    checked={video.is_active}
                    onCheckedChange={(checked) => toggleVideoActive.mutate({ id: video.id, is_active: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => window.open(video.youtube_url, '_blank')}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openVideoDialog(video.folder_id, video)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteVideo.mutate(video.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              );
            })}

            {childFolders.length === 0 && folderVideos.length === 0 && (
              <p className="text-sm text-muted-foreground italic py-2">Nenhum conteúdo nesta pasta</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Videos without folder
  const orphanVideos = videos.filter(v => !v.folder_id);

  return (
    <div className="space-y-6">
      <Tabs value={activeModule} onValueChange={(v) => { setActiveModule(v as 'dossie-if' | 'codigo-if'); setExpandedFolders(new Set()); }}>
        <TabsList>
          <TabsTrigger value="dossie-if">Dossiê IF</TabsTrigger>
          <TabsTrigger value="codigo-if">Código IF</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Vídeos Tutoriais
              </CardTitle>
              <CardDescription>Gerencie pastas e vídeos exibidos na seção "Comece por aqui"</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => openFolderDialog()}>
                <FolderPlus className="w-4 h-4 mr-2" /> Nova Pasta
              </Button>
              <Button onClick={() => openVideoDialog(null)}>
                <Plus className="w-4 h-4 mr-2" /> Novo Vídeo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {foldersLoading || videosLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <>
              {rootFolders.map(folder => renderFolder(folder))}
              {orphanVideos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Sem pasta</p>
                  {orphanVideos.map(video => {
                    const ytId = getYouTubeId(video.youtube_url);
                    return (
                      <div key={video.id} className="flex items-center gap-3 p-2 border rounded">
                        {ytId && (
                          <img 
                            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                            alt={video.title}
                            className="w-24 h-14 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{video.title}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openVideoDialog(null, video)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteVideo.mutate(video.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {rootFolders.length === 0 && orphanVideos.length === 0 && (
                <p className="text-muted-foreground text-center py-8">Nenhuma pasta ou vídeo cadastrado</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Editar Pasta' : 'Nova Pasta'}</DialogTitle>
            <DialogDescription>Organize os vídeos em pastas e sub-pastas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Ex: Módulo 1 - Introdução" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={folderDescription} onChange={e => setFolderDescription(e.target.value)} placeholder="Descrição da pasta" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveFolder.mutate()} disabled={!folderName.trim() || saveFolder.isPending}>
              {saveFolder.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVideo ? 'Editar Vídeo' : 'Novo Vídeo'}</DialogTitle>
            <DialogDescription>Adicione um link do YouTube</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={videoTitle} onChange={e => setVideoTitle(e.target.value)} placeholder="Título do vídeo" />
            </div>
            <div className="space-y-2">
              <Label>URL do YouTube</Label>
              <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={videoDescription} onChange={e => setVideoDescription(e.target.value)} placeholder="Descrição do vídeo" />
            </div>
            <div className="space-y-2">
              <Label>Pasta</Label>
              <select 
                className="w-full border rounded-md p-2 bg-background text-foreground"
                value={videoFolderId || ''}
                onChange={e => setVideoFolderId(e.target.value || null)}
              >
                <option value="">Sem pasta</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {videoUrl && getYouTubeId(videoUrl) && (
              <div className="rounded overflow-hidden">
                <img 
                  src={`https://img.youtube.com/vi/${getYouTubeId(videoUrl)}/mqdefault.jpg`}
                  alt="Preview"
                  className="w-full rounded"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveVideo.mutate()} disabled={!videoTitle.trim() || !videoUrl.trim() || saveVideo.isPending}>
              {saveVideo.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
