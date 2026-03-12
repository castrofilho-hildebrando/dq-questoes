import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from '@/hooks/useAdminData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  Shield, 
  Users, 
  Loader2,
  ArrowLeft,
  Lock,
  HelpCircle,
  Upload,
  Building2,
  FileText,
  FilePlus,
  Layers,
  BookOpen,
  ClipboardList,
  FolderArchive,
  Mail,
  Settings,
  AlertCircle,
  MessageSquare,
  MessageSquarePlus,
  Gift,
  ShieldAlert,
  
  GraduationCap,
  Sparkles,
  Calendar,
  Map,
  Target,
  RefreshCw,
  Bot,
  Database,
  Pencil,
  Activity,
  Video,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Home,
  Palette,
  Crown,
} from 'lucide-react';
import { AdminOrgaos } from '@/components/admin/AdminOrgaos';
import { AdminBancas } from '@/components/admin/AdminBancas';
import { AdminProvas } from '@/components/admin/AdminProvas';
import { AdminImportarQuestoes } from '@/components/admin/AdminImportarQuestoes';
import { AdminImportarMassa } from '@/components/admin/AdminImportarMassa';
import { AdminQuestoes } from '@/components/admin/AdminQuestoes';
import { AdminDisciplines } from '@/components/admin/AdminDisciplines';
import { AdminUsersManagement } from '@/components/admin/AdminUsersManagement';
import AdminAuthorizedEmails from '@/components/admin/AdminAuthorizedEmails';
import AdminIntegrations from '@/components/admin/AdminIntegrations';
import { AdminQuestionManagement } from '@/components/admin/AdminQuestionManagement';
import { AdminComments } from '@/components/admin/AdminComments';
import { AdminTrials } from '@/components/admin/AdminTrials';
import AdminEmailTemplates from '@/components/admin/AdminEmailTemplates';
import AdminAuthErrorLogs from '@/components/admin/AdminAuthErrorLogs';

import { AdminSchoolsManager } from '@/components/admin/AdminSchoolsManager';
import { AdminEditaisSimples } from '@/components/admin/AdminEditaisSimples';
import { AdminEditalMapping } from '@/components/admin/AdminEditalMapping';
import { AdminAreas } from '@/components/admin/AdminAreas';
import { AdminTopicGoals } from '@/components/admin/AdminTopicGoals';
import { AdminTopicRevisions } from '@/components/admin/AdminTopicRevisions';
import { AdminPdfMaterials } from '@/components/admin/AdminPdfMaterials';
import { AdminDataExport } from '@/components/admin/AdminDataExport';
import { AdminDatabaseDDL } from '@/components/admin/AdminDatabaseDDL';
import { AdminFullDatabaseExport } from '@/components/admin/AdminFullDatabaseExport';
import { AdminBatchRecalculate } from '@/components/admin/AdminBatchRecalculate';
import { AdminPlatformConfig } from '@/components/admin/AdminPlatformConfig';
import { AdminSchoolEditor } from '@/components/admin/AdminSchoolEditor';
import { AdminCronogramaHealthCheck } from '@/components/admin/AdminCronogramaHealthCheck';
import { AdminDisciplinaAvulsa } from '@/components/admin/AdminDisciplinaAvulsa';
import { AdminProvasScraper } from '@/components/admin/AdminProvasScraper';
import { AdminEditalMappingPrompt } from '@/components/admin/AdminEditalMappingPrompt';
import { AdminTutorialVideos } from '@/components/admin/AdminTutorialVideos';
import { AdminTutoriais } from '@/components/admin/AdminTutoriais';
import { AdminGravacoes } from '@/components/admin/AdminGravacoes';
import { AdminWorkloadDashboard } from '@/components/admin/AdminWorkloadDashboard';
import { AdminDissertativa } from '@/components/admin/AdminDissertativa';
import { AdminDissertativeWorkspace } from '@/components/admin/AdminDissertativeWorkspace';
import { AdminDissertativePrompts } from '@/components/admin/AdminDissertativePrompts';
import { AdminDissertativeExamContexts } from '@/components/admin/AdminDissertativeExamContexts';
import { AdminAppearance } from '@/components/admin/AdminAppearance';
import { AdminCardAccess } from '@/components/admin/AdminCardAccess';
import { AdminProducts } from '@/components/admin/AdminProducts';
import { AdminDidatica } from '@/components/admin/AdminDidatica';
import { AdminComunidades } from '@/components/admin/AdminComunidades';
import { AdminConselhoIF } from '@/components/admin/AdminConselhoIF';

// ─── Navigation structure ───────────────────────────────────────────
interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: 'usuarios',
    label: 'Usuários & Acesso',
    icon: Users,
    items: [
      { id: 'users', label: 'Gestão de Usuários', icon: Users },
      { id: 'emails-autorizados', label: 'Emails Autorizados', icon: Mail },
      { id: 'emails-templates', label: 'Templates de Email', icon: FileText },
      { id: 'trials', label: 'Trials', icon: Gift },
      { id: 'auth-errors', label: 'Auth Logs', icon: ShieldAlert },
    ],
  },
  {
    id: 'questoes',
    label: 'Banco de Questões',
    icon: HelpCircle,
    items: [
      { id: 'q-gerenciar', label: 'Gerenciar Questões', icon: HelpCircle },
      
      { id: 'q-editais', label: 'Editais', icon: GraduationCap },
      { id: 'q-mapeamento', label: 'Mapeamento', icon: Sparkles },
      { id: 'q-disciplinas', label: 'Disciplinas', icon: BookOpen },
      { id: 'q-atributos', label: 'Atributos', icon: Building2 },
      { id: 'q-imports', label: 'Imports', icon: Upload },
      { id: 'q-avaliar', label: 'Avaliar Questões', icon: MessageSquare },
    ],
  },
  {
    id: 'cronograma',
    label: 'Cronograma & Conteúdo',
    icon: Calendar,
    items: [
      { id: 'c-areas', label: 'Áreas', icon: Map },
      { id: 'c-escolas', label: 'Escolas', icon: GraduationCap },
      { id: 'c-editor', label: 'Editor', icon: Pencil },
      { id: 'c-metas', label: 'Metas', icon: Target },
      { id: 'c-revisoes', label: 'Revisões', icon: RefreshCw },
      { id: 'c-carga-horaria', label: 'Carga Horária', icon: Activity },
      { id: 'c-pdfs', label: 'PDFs / Materiais', icon: FileText },
      { id: 'c-avulsa', label: 'Disciplina Avulsa', icon: FilePlus },
      { id: 'c-recalcular', label: 'Recalcular', icon: Layers },
    ],
  },
  {
    id: 'materiais',
    label: 'Materiais Dissecados',
    icon: FileText,
    items: [
      { id: 'c-pdfs', label: 'PDFs / Materiais', icon: FileText },
    ],
  },
  {
    id: 'videos',
    label: 'Vídeos & Tutoriais',
    icon: Video,
    items: [
      { id: 'c-tutoriais', label: 'Tutoriais (Seções)', icon: Layers },
      { id: 'c-gravacoes', label: 'Gravações (Seções)', icon: Video },
      { id: 'c-videos', label: 'Tutoriais (Legado)', icon: Video },
    ],
  },
  {
    id: 'mapa',
    label: 'Mapa das Questões',
    icon: Map,
    items: [
      { id: 'c-mapa-biblioteca', label: 'Biblioteca', icon: FileText },
      { id: 'c-mapa-prompt', label: 'Prompt IA', icon: Sparkles },
    ],
  },
  {
    id: 'dissertativa',
    label: 'Dissertativa',
    icon: Pencil,
    items: [
      { id: 'd-dissertativa', label: 'Cursos & Módulos', icon: BookOpen },
      { id: 'd-pipeline', label: 'Pipeline Questões', icon: ClipboardList },
      { id: 'd-prompts', label: 'Prompts IA', icon: Sparkles },
      { id: 'd-exam-context', label: 'Contexto da Banca', icon: FileText },
    ],
  },
  {
    id: 'didatica',
    label: 'Didática',
    icon: GraduationCap,
    items: [
      { id: 'dd-conteudo', label: 'Seções & Módulos', icon: Layers },
    ],
  },
  {
    id: 'comunidades',
    label: 'Comunidades',
    icon: Users,
    items: [
      { id: 'com-grupos', label: 'Seções & Grupos', icon: Users },
    ],
  },
  {
    id: 'conselho',
    label: 'Conselho IF',
    icon: Crown,
    items: [
      { id: 'conselho-recursos', label: 'Recursos Exclusivos', icon: Crown },
    ],
  },
  {
    id: 'ia',
    label: 'IA & Robôs',
    icon: Bot,
    items: [
      { id: 'robots', label: 'Robôs Tutores', icon: Bot },
    ],
  },
  {
    id: 'produtos',
    label: 'Produtos & Acesso',
    icon: Shield,
    items: [
      { id: 'p-catalogo', label: 'Produtos & Tokens', icon: Shield },
      { id: 'p-acesso-individual', label: 'Acesso Individual', icon: Users },
      { id: 'p-emails-autorizados', label: 'E-mails Autorizados', icon: Mail },
    ],
  },
  {
    id: 'aparencia',
    label: 'Aparência',
    icon: Palette,
    items: [
      { id: 'a-aparencia', label: 'Capas & Fundos', icon: Palette },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Settings,
    items: [
      { id: 's-plataforma', label: 'Configurações', icon: MessageSquarePlus },
      { id: 's-exportar', label: 'Exportar Dados', icon: Database },
      { id: 's-integracoes', label: 'Integrações', icon: Settings },
    ],
  },
];

// Map old URL tab values to new section IDs for backwards compat
const urlTabMap: Record<string, string> = {
  users: 'users',
  emails: 'emails-autorizados',
  trials: 'trials',
  questions: 'q-gerenciar',
  questoes: 'q-gerenciar',
  'mapa-questoes': 'c-mapa-biblioteca',
  cronograma: 'c-areas',
  robots: 'robots',
  comments: 'q-avaliar',
  gestao: 'q-avaliar',
  'auth-errors': 'auth-errors',
  export: 's-exportar',
  platform: 's-plataforma',
  videos: 'c-videos',
  integrations: 's-integracoes',
  importar: 'q-imports',
};

function findGroupForSection(sectionId: string): string | undefined {
  return navGroups.find(g => g.items.some(i => i.id === sectionId))?.id;
}

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const adminData = useAdminData();

  const urlTab = searchParams.get('tab');
  const urlSearch = searchParams.get('search');

  const initialSection = urlTab ? (urlTabMap[urlTab] || 'users') : 'users';

  const [activeSection, setActiveSection] = useState(initialSection);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const group = findGroupForSection(initialSection);
    if (group) initial.add(group);
    return initial;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleSelectSection = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    const group = findGroupForSection(sectionId);
    if (group) {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.add(group);
        return next;
      });
    }
  }, []);

  // Current section info for breadcrumb
  const currentInfo = useMemo(() => {
    for (const group of navGroups) {
      const item = group.items.find(i => i.id === activeSection);
      if (item) return { group, item };
    }
    return null;
  }, [activeSection]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  if (authLoading || adminData.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página. 
              Entre em contato com um administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <Home className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(prev => !prev)}
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-lg font-bold leading-tight">Painel Admin</h1>
              </div>
            </div>
            {/* Breadcrumb */}
            {currentInfo && (
              <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground ml-2">
                <span>/</span>
                <currentInfo.group.icon className="w-3.5 h-3.5" />
                <span>{currentInfo.group.label}</span>
                <span>/</span>
                <span className="text-foreground font-medium">{currentInfo.item.label}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "border-r border-border bg-muted/30 flex-shrink-0 transition-all duration-200 overflow-hidden",
            sidebarCollapsed ? "w-14" : "w-64"
          )}
        >
          <ScrollArea className="h-[calc(100vh-57px)]">
            <nav className="py-2">
              {navGroups.map(group => {
                const isExpanded = expandedGroups.has(group.id);
                const hasActiveChild = group.items.some(i => i.id === activeSection);

                return (
                  <div key={group.id} className="mb-1">
                    {/* Group header */}
                    <button
                      onClick={() => {
                        if (sidebarCollapsed) {
                          setSidebarCollapsed(false);
                          setExpandedGroups(prev => new Set(prev).add(group.id));
                        } else {
                          toggleGroup(group.id);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                        hasActiveChild && "text-primary"
                      )}
                      title={group.label}
                    >
                      <group.icon className="w-4 h-4 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{group.label}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </>
                      )}
                    </button>

                    {/* Group items */}
                    {!sidebarCollapsed && isExpanded && (
                      <div className="ml-3 border-l border-border pl-2 space-y-0.5 pb-1">
                        {group.items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectSection(item.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors hover:bg-muted",
                              activeSection === item.id
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground"
                            )}
                          >
                            <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-6 max-w-6xl">
            <div className="space-y-6">
              {/* ── Usuários & Acesso ── */}
              {activeSection === 'users' && (
                <AdminUsersManagement
                  users={adminData.users}
                  onToggleActive={adminData.toggleUserActive}
                  onUpdateRole={adminData.updateUserRole}
                  onRefresh={adminData.fetchUsers}
                />
              )}

              {activeSection === 'emails-autorizados' && <AdminAuthorizedEmails />}

              {activeSection === 'emails-templates' && <AdminEmailTemplates />}

              {activeSection === 'trials' && <AdminTrials />}

              {activeSection === 'auth-errors' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5" />
                      Logs de Erros de Autenticação
                    </CardTitle>
                    <CardDescription>
                      Monitore erros de login, registro e sessão para identificar problemas recorrentes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdminAuthErrorLogs />
                  </CardContent>
                </Card>
              )}

              {/* ── Banco de Questões ── */}
              {activeSection === 'q-gerenciar' && (
                <AdminQuestoes initialSearch={urlTab === 'questoes' ? urlSearch || '' : ''} />
              )}

              

              {activeSection === 'q-editais' && <AdminEditaisSimples />}

              {activeSection === 'q-mapeamento' && <AdminEditalMapping />}

              {activeSection === 'q-disciplinas' && <AdminDisciplines />}

              {activeSection === 'q-atributos' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Atributos de Questões
                      </CardTitle>
                      <CardDescription>
                        Gerencie órgãos, bancas e provas utilizados nas questões
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="orgaos" className="w-full">
                        <TabsList className="mb-4">
                          <TabsTrigger value="orgaos">Órgãos</TabsTrigger>
                          <TabsTrigger value="bancas">Bancas</TabsTrigger>
                          <TabsTrigger value="provas">Provas</TabsTrigger>
                        </TabsList>
                        <TabsContent value="orgaos"><AdminOrgaos /></TabsContent>
                        <TabsContent value="bancas"><AdminBancas /></TabsContent>
                        <TabsContent value="provas"><AdminProvas /></TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeSection === 'q-imports' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Importação de Questões
                    </CardTitle>
                    <CardDescription>
                      Importe questões manualmente ou em massa via arquivo ZIP
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="manual" className="w-full">
                      <TabsList className="mb-4">
                        <TabsTrigger value="manual">Importar Questão</TabsTrigger>
                        <TabsTrigger value="zip">Importar ZIP</TabsTrigger>
                      </TabsList>
                      <TabsContent value="manual"><AdminImportarQuestoes /></TabsContent>
                      <TabsContent value="zip"><AdminImportarMassa /></TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {activeSection === 'q-avaliar' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Avaliar Questões
                    </CardTitle>
                    <CardDescription>
                      Gerencie comentários, erros reportados e questões desativadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="comentarios" className="w-full">
                      <TabsList className="mb-4">
                        <TabsTrigger value="comentarios">Comentários</TabsTrigger>
                        <TabsTrigger value="erros">Erros & Desativadas</TabsTrigger>
                      </TabsList>
                      <TabsContent value="comentarios"><AdminComments /></TabsContent>
                      <TabsContent value="erros"><AdminQuestionManagement /></TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {/* ── Cronograma & Conteúdo ── */}
              {activeSection === 'c-areas' && <AdminAreas />}

              {activeSection === 'c-escolas' && <AdminSchoolsManager />}

              {activeSection === 'c-editor' && <AdminSchoolEditor />}

              {activeSection === 'c-metas' && <AdminTopicGoals />}

              {activeSection === 'c-revisoes' && <AdminTopicRevisions />}

              {activeSection === 'c-carga-horaria' && <AdminWorkloadDashboard />}

              {activeSection === 'c-pdfs' && <AdminPdfMaterials />}

              {activeSection === 'c-avulsa' && <AdminDisciplinaAvulsa />}

              {activeSection === 'c-recalcular' && <AdminBatchRecalculate />}

              

              {activeSection === 'c-mapa-biblioteca' && <AdminProvasScraper />}

              {activeSection === 'c-mapa-prompt' && <AdminEditalMappingPrompt />}

              {activeSection === 'c-tutoriais' && <AdminTutoriais />}
              {activeSection === 'c-gravacoes' && <AdminGravacoes />}
              {activeSection === 'c-videos' && <AdminTutorialVideos />}

              {/* ── Dissertativa ── */}
              {activeSection === 'd-dissertativa' && <AdminDissertativa />}
              {activeSection === 'd-pipeline' && <AdminDissertativeWorkspace />}
              {activeSection === 'd-prompts' && <AdminDissertativePrompts />}
              {activeSection === 'd-exam-context' && <AdminDissertativeExamContexts />}

              {/* ── Didática ── */}
              {activeSection === 'dd-conteudo' && <AdminDidatica />}

              {/* ── Comunidades ── */}
              {activeSection === 'com-grupos' && <AdminComunidades />}

              {/* ── Conselho IF ── */}
              {activeSection === 'conselho-recursos' && <AdminConselhoIF />}

              {/* ── IA & Robôs ── */}
              {activeSection === 'robots' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      Gerenciamento de Robôs Tutores
                    </CardTitle>
                    <CardDescription>
                      Acesse o painel completo para gerenciar robôs tutores, áreas, tokens e templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => navigate('/tutor/admin')}>
                      Acessar Painel de Robôs
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* ── Sistema ── */}
              {activeSection === 's-plataforma' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquarePlus className="w-5 h-5" />
                      Configurações da Plataforma
                    </CardTitle>
                    <CardDescription>
                      Configure links e opções exibidas aos alunos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdminPlatformConfig />
                  </CardContent>
                </Card>
              )}

              {activeSection === 's-exportar' && (
                <>
                  <AdminFullDatabaseExport />
                  <AdminDataExport />
                  <AdminDatabaseDDL />
                </>
              )}

              {activeSection === 's-integracoes' && <AdminIntegrations />}

              {/* ── Produtos & Acesso ── */}
              {activeSection === 'p-catalogo' && <AdminProducts />}
              {activeSection === 'p-acesso-individual' && <AdminCardAccess />}
              {activeSection === 'p-emails-autorizados' && <AdminAuthorizedEmails />}

              {/* ── Aparência ── */}
              {activeSection === 'a-aparencia' && <AdminAppearance />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
