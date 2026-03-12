import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, PlayCircle, Users, Calendar, FileText } from 'lucide-react';
import { AdminConselhoSessoes } from './AdminConselhoSessoes';
import { AdminConselhoGrupos } from './AdminConselhoGrupos';
import { AdminConselhoMentor } from './AdminConselhoMentor';
import { AdminConselhoRelatorios } from './AdminConselhoRelatorios';

const subTabs = [
  { value: 'sessoes', label: 'Sessões Gravadas', icon: PlayCircle },
  { value: 'grupo', label: 'Grupo Individual', icon: Users },
  { value: 'mentor', label: 'Marque com o Mentor', icon: Calendar },
  { value: 'relatorios', label: 'Relatórios Semanais', icon: FileText },
];

export function AdminConselhoIF() {
  const [activeTab, setActiveTab] = useState('sessoes');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          Conselho IF — Recursos Exclusivos
        </CardTitle>
        <CardDescription>
          Gerencie os recursos exclusivos da mentoria premium
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            {subTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="sessoes">
            <AdminConselhoSessoes />
          </TabsContent>

          <TabsContent value="grupo">
            <AdminConselhoGrupos />
          </TabsContent>

          <TabsContent value="mentor">
            <AdminConselhoMentor />
          </TabsContent>

          <TabsContent value="relatorios">
            <AdminConselhoRelatorios />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
