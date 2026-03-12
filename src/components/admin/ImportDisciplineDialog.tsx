import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ChevronRight, BookOpen, School, FileText, Check, Import } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImportDisciplineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetSchoolId: string;
  targetSchoolName: string;
  existingDisciplineIds: string[];
  onSuccess: () => void;
}

interface Edital {
  id: string;
  name: string;
}

interface SchoolOption {
  id: string;
  name: string;
  discipline_count: number;
}

interface DisciplineOption {
  id: string;
  name: string;
  is_source: boolean;
  topic_count: number;
}

export function ImportDisciplineDialog({
  open,
  onOpenChange,
  targetSchoolId,
  targetSchoolName,
  existingDisciplineIds,
  onSuccess
}: ImportDisciplineDialogProps) {
  const { toast } = useToast();
  
  // Navigation state
  const [step, setStep] = useState<'edital' | 'school' | 'discipline'>('edital');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Data
  const [editals, setEditals] = useState<Edital[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  
  // Selections
  const [selectedEdital, setSelectedEdital] = useState<Edital | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineOption | null>(null);
  
  // Fetch editals on open
  useEffect(() => {
    if (open) {
      fetchEditals();
      resetSelections();
    }
  }, [open]);
  
  const resetSelections = () => {
    setStep('edital');
    setSelectedEdital(null);
    setSelectedSchool(null);
    setSelectedDiscipline(null);
    setSchools([]);
    setDisciplines([]);
  };
  
  const fetchEditals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setEditals(data || []);
    } catch (error) {
      console.error('Error fetching editals:', error);
      toast({ title: 'Erro ao carregar editais', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSchoolsForEdital = async (editalId: string) => {
    setLoading(true);
    try {
      // Fetch schools for this edital
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name')
        .eq('is_active', true)
        .eq('edital_id', editalId)
        .neq('id', targetSchoolId); // Exclude target school
      
      if (schoolsError) throw schoolsError;
      
      // Fetch discipline counts for each school
      const schoolsWithCounts = await Promise.all(
        (schoolsData || []).map(async (school) => {
          const { count } = await supabase
            .from('school_disciplines')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id)
            .eq('is_active', true);
          
          return {
            id: school.id,
            name: school.name,
            discipline_count: count || 0
          };
        })
      );
      
      // Only show schools that have at least one discipline
      const filteredSchools = schoolsWithCounts.filter(s => s.discipline_count > 0);
      
      setSchools(filteredSchools);
      setStep('school');
    } catch (error) {
      console.error('Error fetching schools:', error);
      toast({ title: 'Erro ao carregar escolas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDisciplinesForSchool = async (schoolId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('school_disciplines')
        .select(`
          discipline_id,
          study_disciplines!inner(id, name, is_source)
        `)
        .eq('school_id', schoolId)
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Get topic counts
      const disciplinesWithCounts = await Promise.all(
        (data || []).map(async (sd: any) => {
          const disc = sd.study_disciplines;
          const { count } = await supabase
            .from('study_topics')
            .select('*', { count: 'exact', head: true })
            .eq('study_discipline_id', disc.id)
            .eq('is_active', true);
          
          return {
            id: disc.id,
            name: disc.name,
            is_source: disc.is_source || false,
            topic_count: count || 0
          };
        })
      );
      
      // Filter out disciplines already in target school
      const filteredDisciplines = disciplinesWithCounts.filter(
        d => !existingDisciplineIds.includes(d.id)
      );
      
      setDisciplines(filteredDisciplines);
      setStep('discipline');
    } catch (error) {
      console.error('Error fetching disciplines:', error);
      toast({ title: 'Erro ao carregar disciplinas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleEditalSelect = (edital: Edital) => {
    setSelectedEdital(edital);
    fetchSchoolsForEdital(edital.id);
  };
  
  const handleSchoolSelect = (school: SchoolOption) => {
    setSelectedSchool(school);
    fetchDisciplinesForSchool(school.id);
  };
  
  const handleDisciplineSelect = (discipline: DisciplineOption) => {
    setSelectedDiscipline(discipline);
  };
  
  const handleImport = async () => {
    if (!selectedDiscipline) return;
    
    setImporting(true);
    try {
      const { data, error } = await supabase.rpc('import_discipline_to_school', {
        p_source_discipline_id: selectedDiscipline.id,
        p_target_school_id: targetSchoolId
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; discipline_name?: string; affected_cronogramas?: number } | null;
      
      if (!result?.success) {
        throw new Error(result?.error || 'Erro desconhecido');
      }
      
      toast({
        title: 'Disciplina importada!',
        description: `${result.discipline_name} foi adicionada à escola. ${result.affected_cronogramas || 0} cronogramas marcados para atualização.`
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error importing discipline:', error);
      toast({ 
        title: 'Erro ao importar disciplina', 
        description: error.message || 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setImporting(false);
    }
  };
  
  const handleBack = () => {
    if (step === 'discipline') {
      setStep('school');
      setSelectedSchool(null);
      setSelectedDiscipline(null);
      setDisciplines([]);
    } else if (step === 'school') {
      setStep('edital');
      setSelectedEdital(null);
      setSchools([]);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="w-5 h-5" />
            Importar Disciplina
          </DialogTitle>
          <DialogDescription>
            Selecione uma disciplina de outra escola para adicionar a <strong>{targetSchoolName}</strong>
          </DialogDescription>
        </DialogHeader>
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
          <button 
            onClick={() => step !== 'edital' && handleBack()}
            className={step === 'edital' ? 'text-primary font-medium' : 'hover:text-primary cursor-pointer'}
          >
            Edital
          </button>
          {selectedEdital && (
            <>
              <ChevronRight className="w-4 h-4" />
              <button
                onClick={() => step === 'discipline' && handleBack()}
                className={step === 'school' ? 'text-primary font-medium' : step === 'discipline' ? 'hover:text-primary cursor-pointer' : ''}
              >
                {selectedEdital.name.length > 20 ? selectedEdital.name.substring(0, 20) + '...' : selectedEdital.name}
              </button>
            </>
          )}
          {selectedSchool && (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-primary font-medium">
                {selectedSchool.name.length > 20 ? selectedSchool.name.substring(0, 20) + '...' : selectedSchool.name}
              </span>
            </>
          )}
        </div>
        
        {/* Content */}
        <div className="py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* Step 1: Select Edital */}
              {step === 'edital' && (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Selecione o edital de origem:</Label>
                    {editals.map((edital) => (
                      <button
                        key={edital.id}
                        onClick={() => handleEditalSelect(edital)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">{edital.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
              
              {/* Step 2: Select School */}
              {step === 'school' && (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Selecione a escola de origem:</Label>
                    {schools.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        Nenhuma outra escola encontrada neste edital
                      </p>
                    ) : (
                      schools.map((school) => (
                        <button
                          key={school.id}
                          onClick={() => handleSchoolSelect(school)}
                          className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <School className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <span className="font-medium block">{school.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {school.discipline_count} disciplinas
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
              
              {/* Step 3: Select Discipline */}
              {step === 'discipline' && (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Selecione a disciplina para importar:</Label>
                    {disciplines.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        Nenhuma disciplina disponível para importar (todas já existem na escola destino)
                      </p>
                    ) : (
                      disciplines.map((discipline) => (
                        <button
                          key={discipline.id}
                          onClick={() => handleDisciplineSelect(discipline)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                            selectedDiscipline?.id === discipline.id 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:bg-accent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <BookOpen className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <span className="font-medium block">{discipline.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {discipline.topic_count} tópicos
                                </span>
                                {discipline.is_source && (
                                  <Badge variant="secondary" className="text-xs">ZIP</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedDiscipline?.id === discipline.id && (
                            <Check className="w-5 h-5 text-primary" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          {step !== 'edital' && (
            <Button variant="outline" onClick={handleBack} disabled={importing}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          {selectedDiscipline && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Import className="w-4 h-4 mr-2" />
                  Importar Disciplina
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
