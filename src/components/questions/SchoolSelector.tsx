import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, GraduationCap, ChevronRight, BookOpen, FileText, Check, ArrowLeft, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface School {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  edital_id: string | null;
}

interface Edital {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  schools: School[];
}

interface SchoolSelectorProps {
  onSelect: (schoolId: string | null, isPreEdital: boolean, editalId?: string | null) => void;
  selectedSchoolId?: string | null;
  selectedEditalId?: string | null;
}

type ViewMode = 'categories' | 'editals' | 'schools';

export function SchoolSelector({ onSelect, selectedSchoolId, selectedEditalId }: SchoolSelectorProps) {
  const [posEditals, setPosEditals] = useState<Edital[]>([]);
  const [preEdital, setPreEdital] = useState<Edital | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [selectedEdital, setSelectedEdital] = useState<Edital | null>(null);

  // All schools from both pré and pós editais
  const allSchools = [...(preEdital?.schools || []), ...posEditals.flatMap(e => e.schools)];
  
  // Find selected school
  const selectedSchool = allSchools.find(s => s.id === selectedSchoolId);
  
  // Check if pré-edital is selected (either direct edital or one of its schools)
  const isPreEditalSelected = preEdital && (
    (selectedEditalId === preEdital.id) || 
    preEdital.schools.some(s => s.id === selectedSchoolId)
  );
  
  // For pós-edital selection
  const selectedPosEdital = posEditals.find(e => 
    e.id === selectedEditalId || e.schools.some(s => s.id === selectedSchoolId)
  );


  const didAutoSelectRef = useRef(false);
  // Flag para detectar se há parâmetros vindos de URL (links do cronograma)
  const hasUrlParamsRef = useRef(false);

  // Detecta se há parâmetros de URL que devem prevalecer sobre auto-select
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlSelection = 
      urlParams.has('schoolId') || 
      urlParams.has('editalId') || 
      urlParams.has('topicId') ||
      urlParams.has('disciplineId');
    
    if (hasUrlSelection) {
      hasUrlParamsRef.current = true;
      console.log('[SchoolSelector] URL params detected, blocking auto-select');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        // Fetch schools with edital info
        const { data: schoolsData, error: schoolsError } = await supabase
          .from('schools')
          .select('id, name, description, is_default, edital_id')
          .eq('is_active', true)
          .order('name');

        if (schoolsError) throw schoolsError;

        // Fetch editals that are active
        const { data: editalsData, error: editalsError } = await supabase
          .from('editals')
          .select('id, name, description, is_default')
          .eq('is_active', true)
          .order('name');

        if (editalsError) throw editalsError;

        const schools = (schoolsData || []) as School[];
        const rawEditals = (editalsData || []) as Omit<Edital, 'schools'>[];

        // Find pré-edital (is_default = true)
        const preEditalData = rawEditals.find(e => e.is_default);

        // Pós-editais are all non-default editals
        const posEditalsData = rawEditals.filter(e => !e.is_default);

        // Pré-edital does NOT have schools - disciplines come from edital_disciplines
        // Schools are only for pós-editais
        const posEditalsWithSchools = posEditalsData.map(edital => ({
          ...edital,
          schools: schools.filter(s => s.edital_id === edital.id)
        }));

        if (cancelled) return;

        if (preEditalData) {
          setPreEdital({
            ...preEditalData,
            schools: [] // Pré-edital has no schools - uses edital_disciplines directly
          });
        }

        setPosEditals(posEditalsWithSchools);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
    // Intencional: carregar dados só uma vez no mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (didAutoSelectRef.current) return;
    
    // BLOQUEIO: Se há parâmetros de URL OU já existe seleção, NÃO auto-seleciona
    if (hasUrlParamsRef.current) {
      console.log('[SchoolSelector] Auto-select BLOCKED: URL params present');
      didAutoSelectRef.current = true;
      return;
    }
    
    // BLOQUEIO: Se já há seleção (restaurada do localStorage ou passada via props), não sobrescreve
    if (selectedSchoolId || selectedEditalId) {
      console.log('[SchoolSelector] Auto-select BLOCKED: Selection already exists', { selectedSchoolId, selectedEditalId });
      didAutoSelectRef.current = true;
      return;
    }

    // Só auto-seleciona no carregamento inicial e APENAS se ainda não houver seleção.
    if (!selectedSchoolId && !selectedEditalId && preEdital?.id) {
      didAutoSelectRef.current = true;
      console.log('[SchoolSelector] Auto-selecting Pré-Edital (no prior selection)');
      onSelect(null, true, preEdital.id);
    }
  }, [loading, preEdital, onSelect, selectedSchoolId, selectedEditalId]);



  const handlePreEditalSelect = () => {
    if (preEdital) {
      // Pré-edital always uses edital directly (no schools)
      onSelect(null, true, preEdital.id);
      setViewMode('categories');
      setSelectedEdital(null);
    }
  };

  const handlePosEditalClick = () => {
    setViewMode('editals');
  };

  const handleEditalSelect = (edital: Edital) => {
    setSelectedEdital(edital);
    
    if (edital.schools.length === 0) {
      // No schools - select edital directly
      onSelect(null, false, edital.id);
      setViewMode('categories');
      setSelectedEdital(null);
    } else if (edital.schools.length === 1) {
      // Only one school - select it directly
      onSelect(edital.schools[0].id, false, edital.id);
      setViewMode('categories');
      setSelectedEdital(null);
    } else {
      // Multiple schools - show school selection with option for "all"
      setViewMode('schools');
    }
  };

  const handleSchoolSelect = (school: School | null, edital: Edital, isPre: boolean = false) => {
    if (school === null) {
      // User selected "All disciplines from edital" (no specific school)
      onSelect(null, isPre, edital.id);
    } else {
      onSelect(school.id, isPre, edital.id);
    }
    setViewMode('categories');
    setSelectedEdital(null);
  };

  const handleBack = () => {
    if (viewMode === 'schools') {
      setViewMode('editals');
      setSelectedEdital(null);
    } else if (viewMode === 'editals') {
      setViewMode('categories');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalSchools = allSchools.length;
  const hasEditals = posEditals.length > 0 || preEdital !== null;
  if (totalSchools === 0 && !hasEditals) return null;

  // Get current selection display
  const getSelectionDisplay = () => {
    if (isPreEditalSelected) {
      const preSchool = preEdital?.schools.find(s => s.id === selectedSchoolId);
      if (preSchool) {
        return `Pré-Edital → ${preSchool.name}`;
      }
      return "Pré-Edital";
    }
    if (selectedSchool && selectedPosEdital) {
      return `${selectedPosEdital.name} → ${selectedSchool.name}`;
    }
    if (selectedPosEdital && !selectedSchoolId) {
      return `${selectedPosEdital.name} (Todas as disciplinas)`;
    }
    return null;
  };

  const selectionDisplay = getSelectionDisplay();

  return (
    <div className="space-y-4">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                {viewMode === 'categories' && 'Selecione a Categoria'}
                {viewMode === 'editals' && 'Selecione o Edital'}
                {viewMode === 'schools' && `Escolas - ${selectedEdital?.name}`}
              </CardTitle>
              <CardDescription>
                {viewMode === 'categories' && 'Escolha entre Pré-Edital ou Pós-Edital'}
                {viewMode === 'editals' && 'Escolha o edital do concurso'}
                {viewMode === 'schools' && 'Escolha a escola/cargo desejado ou todas as disciplinas'}
              </CardDescription>
            </div>
            {viewMode !== 'categories' && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
          </div>
          {selectionDisplay && viewMode === 'categories' && (
            <div className="mt-2 text-sm text-primary font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              Selecionado: {selectionDisplay}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {/* Categories View: Pré-Edital | Pós-Edital */}
            {viewMode === 'categories' && (
              <motion.div
                key="categories"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-4"
              >
                {/* Pré-Edital Box */}
                {preEdital && (
                  <button
                    onClick={handlePreEditalSelect}
                    className={cn(
                      "h-[120px] p-5 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all group",
                      isPreEditalSelected 
                        ? "bg-primary border-primary text-primary-foreground shadow-lg" 
                        : "bg-card border-border hover:border-muted-foreground/50 hover:bg-accent"
                    )}
                  >
                    <BookOpen className={cn(
                      "w-8 h-8 mb-3",
                      isPreEditalSelected ? "text-primary-foreground" : "text-foreground"
                    )} />
                    <span className={cn(
                      "font-semibold text-lg",
                      isPreEditalSelected ? "text-primary-foreground" : "text-foreground"
                    )}>Pré-Edital</span>
                    <span className={cn(
                      "text-xs mt-1",
                      isPreEditalSelected ? "text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {preEdital.schools.length > 0 
                        ? `${preEdital.schools.length} escola(s)`
                        : "Conteúdo base por disciplinas"}
                    </span>
                    {isPreEditalSelected && (
                      <Check className="w-5 h-5 mt-2" />
                    )}
                  </button>
                )}

                {/* Pós-Edital Box */}
                {posEditals.length > 0 && (
                  <button
                    onClick={handlePosEditalClick}
                    className={cn(
                      "h-[120px] p-5 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all group",
                      selectedPosEdital 
                        ? "bg-primary border-primary text-primary-foreground shadow-lg" 
                        : "bg-card border-border hover:border-muted-foreground/50 hover:bg-accent"
                    )}
                  >
                    <FileText className={cn(
                      "w-8 h-8 mb-3",
                      selectedPosEdital ? "text-primary-foreground" : "text-foreground"
                    )} />
                    <span className={cn(
                      "font-semibold text-lg",
                      selectedPosEdital ? "text-primary-foreground" : "text-foreground"
                    )}>Pós-Edital</span>
                    <span className={cn(
                      "text-xs mt-1",
                      selectedPosEdital ? "text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {selectedPosEdital 
                        ? selectedPosEdital.name 
                        : `${posEditals.length} edital(is) disponível(is)`}
                    </span>
                    {selectedPosEdital ? (
                      <Check className="w-5 h-5 mt-2" />
                    ) : (
                      <ChevronRight className="w-5 h-5 mt-2 text-muted-foreground" />
                    )}
                  </button>
                )}
              </motion.div>
            )}

            {/* Editals View */}
            {viewMode === 'editals' && (
              <motion.div
                key="editals"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {posEditals.map((edital, index) => {
                  const hasSelectedSchool = edital.schools.some(s => s.id === selectedSchoolId);
                  const isDirectlySelected = edital.id === selectedEditalId && !selectedSchoolId;
                  const isSelected = hasSelectedSchool || isDirectlySelected;
                  
                  return (
                    <motion.button
                      key={edital.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleEditalSelect(edital)}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 flex items-center justify-between text-left transition-all",
                        isSelected 
                          ? "bg-primary/10 border-primary" 
                          : "bg-card border-border hover:border-muted-foreground/50 hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <span className={cn(
                            "font-semibold block",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {edital.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {edital.schools.length === 0 
                              ? 'Acesso direto às disciplinas' 
                              : `${edital.schools.length} escola(s) disponível(is)`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && <Check className="w-5 h-5 text-primary" />}
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {/* Schools View */}
            {viewMode === 'schools' && selectedEdital && (() => {
              const isPreEditalSchools = preEdital?.id === selectedEdital.id;
              return (
              <motion.div
                key="schools"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {/* Option: All disciplines (no specific school) */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  onClick={() => handleSchoolSelect(null, selectedEdital, isPreEditalSchools)}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 flex items-center justify-between text-left transition-all",
                    (selectedEditalId === selectedEdital.id && !selectedSchoolId)
                      ? "bg-primary/10 border-primary" 
                      : "bg-card border-border hover:border-muted-foreground/50 hover:bg-accent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      (selectedEditalId === selectedEdital.id && !selectedSchoolId) ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <List className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={cn(
                        "font-semibold block",
                        (selectedEditalId === selectedEdital.id && !selectedSchoolId) ? "text-primary" : "text-foreground"
                      )}>
                        Todas as disciplinas
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Acessar todas as disciplinas do edital
                      </span>
                    </div>
                  </div>
                  {(selectedEditalId === selectedEdital.id && !selectedSchoolId) && <Check className="w-5 h-5 text-primary" />}
                </motion.button>

                {/* Individual schools */}
                {selectedEdital.schools.map((school, index) => {
                  const isSelected = school.id === selectedSchoolId;
                  
                  return (
                    <motion.button
                      key={school.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (index + 1) * 0.05 }}
                      onClick={() => handleSchoolSelect(school, selectedEdital, isPreEditalSchools)}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 flex items-center justify-between text-left transition-all",
                        isSelected 
                          ? "bg-primary/10 border-primary" 
                          : "bg-card border-border hover:border-muted-foreground/50 hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                          <span className={cn(
                            "font-semibold block",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {school.name}
                          </span>
                          {school.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {school.description}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-primary" />}
                    </motion.button>
                  );
                })}
              </motion.div>
              );
            })()}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
