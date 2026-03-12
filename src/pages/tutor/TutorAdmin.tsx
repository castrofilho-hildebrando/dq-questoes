import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Bot, 
  ArrowLeft, 
  Loader2,
  Layers,
  Coins,
  FileText,
  Cpu,
  Map
} from 'lucide-react';
import { AdminRobots } from '@/components/admin/AdminRobots';
import { TutorAdminAreas } from '@/components/tutor/admin/TutorAdminAreas';
import { TutorAdminTokenUsage } from '@/components/tutor/admin/TutorAdminTokenUsage';
import { TutorAdminTemplate } from '@/components/tutor/admin/TutorAdminTemplate';
import { TutorAdminModels } from '@/components/tutor/admin/TutorAdminModels';
import { AdminEditalMappingPrompt } from '@/components/admin/AdminEditalMappingPrompt';

const tutorTabs = [
  { value: 'robots', icon: Bot, label: 'Robôs' },
  { value: 'areas', icon: Layers, label: 'Áreas' },
  { value: 'models', icon: Cpu, label: 'Modelos IA' },
  { value: 'tokens', icon: Coins, label: 'Uso de Tokens' },
  { value: 'template', icon: FileText, label: 'Template Robôs' },
  { value: 'edital-mapping', icon: Map, label: 'Mapear Edital' },
];

export default function TutorAdmin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'robots');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && !isAdmin) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold">Painel Admin</h1>
                <p className="text-sm text-muted-foreground">Gerenciar robôs e usuários</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {tutorTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="robots">
            <AdminRobots />
          </TabsContent>

          <TabsContent value="areas">
            <TutorAdminAreas />
          </TabsContent>

          <TabsContent value="models">
            <TutorAdminModels />
          </TabsContent>

          <TabsContent value="tokens">
            <TutorAdminTokenUsage />
          </TabsContent>

          <TabsContent value="template">
            <TutorAdminTemplate />
          </TabsContent>

          <TabsContent value="edital-mapping">
            <AdminEditalMappingPrompt />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
