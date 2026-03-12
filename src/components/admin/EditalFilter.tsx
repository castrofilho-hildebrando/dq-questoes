import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Loader2, RefreshCw, School } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';

interface Edital {
  id: string;
  name: string;
  is_default: boolean;
  discipline_count?: number;
}

interface SchoolOption {
  id: string;
  name: string;
  edital_id: string | null;
  discipline_count?: number;
  question_count?: number;
}

// Props for the dual filter (Edital + School)
interface EditalSchoolFilterProps {
  editalValue: string;
  schoolValue: string;
  onEditalChange: (editalId: string) => void;
  onSchoolChange: (schoolId: string) => void;
  showLabels?: boolean;
  showQuestionCount?: boolean;
  className?: string;
}

// Cache for question counts per school
const schoolQuestionCountCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// New component with dual Edital + School filter
export function EditalSchoolFilter({ 
  editalValue,
  schoolValue,
  onEditalChange,
  onSchoolChange,
  showLabels = true, 
  showQuestionCount = true,
  className = '' 
}: EditalSchoolFilterProps) {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const countsLoadedRef = useRef(false);
  const loadingCountsRef = useRef(false);

  // Fetch question counts using optimized RPC - only when dropdown opens
  const fetchQuestionCounts = useCallback(async (schoolsList: SchoolOption[]) => {
    if (loadingCountsRef.current || schoolsList.length === 0) return;
    
    const now = Date.now();
    const allCached = schoolsList.every(s => {
      const cached = schoolQuestionCountCache.get(s.id);
      return cached && (now - cached.timestamp) < CACHE_TTL;
    });

    if (allCached) {
      const updatedSchools = schoolsList.map(school => ({
        ...school,
        question_count: schoolQuestionCountCache.get(school.id)?.count
      }));
      setSchools(updatedSchools);
      countsLoadedRef.current = true;
      return;
    }

    loadingCountsRef.current = true;
    setLoadingCounts(true);

    try {
      const schoolIds = schoolsList.map(s => s.id);
      
      const { data: countsData, error } = await supabase.rpc('get_edital_question_counts', {
        edital_ids: schoolIds
      });

      if (error) {
        console.error('Error fetching school question counts:', error);
        setLoadingCounts(false);
        loadingCountsRef.current = false;
        return;
      }

      const countMap: Record<string, number> = {};
      (countsData || []).forEach((item: { edital_id: string; question_count: number }) => {
        countMap[item.edital_id] = item.question_count || 0;
        schoolQuestionCountCache.set(item.edital_id, { 
          count: item.question_count || 0, 
          timestamp: Date.now() 
        });
      });

      const updatedSchools = schoolsList.map(school => ({
        ...school,
        question_count: countMap[school.id] ?? 0
      }));

      setSchools(updatedSchools);
      countsLoadedRef.current = true;
    } catch (error) {
      console.error('Error in fetchQuestionCounts:', error);
    } finally {
      setLoadingCounts(false);
      loadingCountsRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchEditais();
  }, []);

  useEffect(() => {
    if (editalValue && editalValue !== 'all') {
      fetchSchools(editalValue);
    } else {
      setSchools([]);
      onSchoolChange('');
    }
  }, [editalValue]);

  useEffect(() => {
    if (schoolDropdownOpen && showQuestionCount && schools.length > 0 && !countsLoadedRef.current) {
      fetchQuestionCounts(schools);
    }
  }, [schoolDropdownOpen, showQuestionCount, schools, fetchQuestionCounts]);

  const fetchEditais = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name, is_default')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEditais(data || []);
      setLoading(false);
      
      if (!editalValue && data && data.length > 0) {
        const defaultEdital = data.find(e => e.is_default);
        if (defaultEdital) {
          onEditalChange(defaultEdital.id);
        }
      }
    } catch (error) {
      console.error('Error fetching editais:', error);
      setLoading(false);
    }
  };

  const fetchSchools = async (editalId: string) => {
    setLoadingSchools(true);
    countsLoadedRef.current = false;
    try {
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name, edital_id')
        .eq('edital_id', editalId)
        .eq('is_active', true)
        .order('name');

      if (schoolsError) throw schoolsError;

      if (schoolsData && schoolsData.length > 0) {
        const schoolIds = schoolsData.map(s => s.id);
        const { data: countsData } = await supabase
          .from('school_disciplines')
          .select('school_id')
          .in('school_id', schoolIds)
          .eq('is_active', true);

        const countMap: Record<string, number> = {};
        (countsData || []).forEach((item: { school_id: string }) => {
          countMap[item.school_id] = (countMap[item.school_id] || 0) + 1;
        });

        const schoolsWithCounts = schoolsData.map(school => ({
          ...school,
          discipline_count: countMap[school.id] || 0,
          question_count: schoolQuestionCountCache.get(school.id)?.count
        }));

        setSchools(schoolsWithCounts);
      } else {
        setSchools([]);
      }
    } catch (error) {
      console.error('Error fetching schools:', error);
    } finally {
      setLoadingSchools(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace('.0', '')}k`;
    }
    return count.toString();
  };

  const formatExactCount = (count: number): string => {
    return count.toLocaleString('pt-BR');
  };

  const handleForceRefresh = useCallback(() => {
    schoolQuestionCountCache.clear();
    countsLoadedRef.current = false;
    fetchQuestionCounts(schools);
  }, [schools, fetchQuestionCounts]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Select disabled>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Carregando..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  const selectedEdital = editais.find(e => e.id === editalValue);
  const selectedSchool = schools.find(s => s.id === schoolValue);

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-4 flex-wrap ${className}`}>
        {/* Edital Select */}
        <div className="flex items-center gap-2">
          {showLabels && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <FileText className="w-4 h-4" />
              <Label>Edital:</Label>
            </div>
          )}
          <Select value={editalValue} onValueChange={(val) => {
            onEditalChange(val);
            onSchoolChange('');
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione um edital">
                {selectedEdital?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Editais</SelectItem>
              {editais.map((edital) => (
                <SelectItem key={edital.id} value={edital.id}>
                  {edital.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* School Select */}
        {editalValue && editalValue !== 'all' && (
          <div className="flex items-center gap-2">
            {showLabels && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <School className="w-4 h-4" />
                <Label>Escola:</Label>
              </div>
            )}
            <Select 
              value={schoolValue} 
              onValueChange={onSchoolChange}
              onOpenChange={setSchoolDropdownOpen}
              disabled={loadingSchools}
            >
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder={loadingSchools ? "Carregando..." : "Selecione uma escola"}>
                  {selectedSchool && (
                    <div className="flex items-center gap-2">
                      <span className="truncate">{selectedSchool.name}</span>
                      {showQuestionCount && selectedSchool.question_count !== undefined && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {formatCount(selectedSchool.question_count)} questões
                        </Badge>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Escolas</SelectItem>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="truncate">{school.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {showQuestionCount && (
                          <>
                            {loadingCounts ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : school.question_count !== undefined ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="text-xs cursor-help">
                                    {formatCount(school.question_count)} questões
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Total exato: {formatExactCount(school.question_count)} questões</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                ...
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showQuestionCount && schools.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleForceRefresh}
                    disabled={loadingCounts}
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingCounts ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Atualizar contadores</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// LEGACY SUPPORT - EditalFilter that filters SCHOOLS (grouped by Edital)
// This shows schools grouped under their parent edital for clarity
// =============================================================================

interface EditalWithSchools {
  id: string;
  name: string;
  schools: SchoolOption[];
}

interface LegacyEditalFilterProps {
  value: string;
  onChange: (schoolId: string) => void;
  showLabel?: boolean;
  showDisciplineCount?: boolean;
  showQuestionCount?: boolean;
  className?: string;
}

export function EditalFilter({ 
  value, 
  onChange, 
  showLabel = true, 
  showDisciplineCount = false,
  showQuestionCount = true,
  className = '' 
}: LegacyEditalFilterProps) {
  const [editaisWithSchools, setEditaisWithSchools] = useState<EditalWithSchools[]>([]);
  const [allSchools, setAllSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const countsLoadedRef = useRef(false);
  const loadingCountsRef = useRef(false);

  const fetchQuestionCounts = useCallback(async (schoolsList: SchoolOption[]) => {
    if (loadingCountsRef.current || schoolsList.length === 0) return;
    
    const now = Date.now();
    const allCached = schoolsList.every(s => {
      const cached = schoolQuestionCountCache.get(s.id);
      return cached && (now - cached.timestamp) < CACHE_TTL;
    });

    if (allCached) {
      const updatedSchools = schoolsList.map(school => ({
        ...school,
        question_count: schoolQuestionCountCache.get(school.id)?.count
      }));
      updateSchoolsInEditais(updatedSchools);
      countsLoadedRef.current = true;
      return;
    }

    loadingCountsRef.current = true;
    setLoadingCounts(true);

    try {
      const schoolIds = schoolsList.map(s => s.id);
      
      const { data: countsData, error } = await supabase.rpc('get_edital_question_counts', {
        edital_ids: schoolIds
      });

      if (error) {
        console.error('Error fetching school question counts:', error);
        setLoadingCounts(false);
        loadingCountsRef.current = false;
        return;
      }

      const countMap: Record<string, number> = {};
      (countsData || []).forEach((item: { edital_id: string; question_count: number }) => {
        countMap[item.edital_id] = item.question_count || 0;
        schoolQuestionCountCache.set(item.edital_id, { 
          count: item.question_count || 0, 
          timestamp: Date.now() 
        });
      });

      const updatedSchools = schoolsList.map(school => ({
        ...school,
        question_count: countMap[school.id] ?? 0
      }));

      updateSchoolsInEditais(updatedSchools);
      countsLoadedRef.current = true;
    } catch (error) {
      console.error('Error in fetchQuestionCounts:', error);
    } finally {
      setLoadingCounts(false);
      loadingCountsRef.current = false;
    }
  }, []);

  const updateSchoolsInEditais = (updatedSchools: SchoolOption[]) => {
    setAllSchools(updatedSchools);
    setEditaisWithSchools(prev => prev.map(edital => ({
      ...edital,
      schools: edital.schools.map(school => {
        const updated = updatedSchools.find(s => s.id === school.id);
        return updated || school;
      })
    })));
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (dropdownOpen && showQuestionCount && allSchools.length > 0 && !countsLoadedRef.current) {
      fetchQuestionCounts(allSchools);
    }
  }, [dropdownOpen, showQuestionCount, allSchools, fetchQuestionCounts]);

  const fetchData = async () => {
    try {
      // Fetch editals
      const { data: editaisData, error: editaisError } = await supabase
        .from('editals')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (editaisError) throw editaisError;

      // Fetch schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name, edital_id')
        .eq('is_active', true)
        .order('name');

      if (schoolsError) throw schoolsError;

      // Fetch discipline counts
      const { data: countsData, error: countsError } = await supabase
        .from('school_disciplines')
        .select('school_id')
        .eq('is_active', true);

      if (countsError) throw countsError;

      const countMap: Record<string, number> = {};
      (countsData || []).forEach((item: { school_id: string }) => {
        countMap[item.school_id] = (countMap[item.school_id] || 0) + 1;
      });

      const schoolsWithCounts: SchoolOption[] = (schoolsData || []).map(school => ({
        ...school,
        discipline_count: countMap[school.id] || 0,
        question_count: schoolQuestionCountCache.get(school.id)?.count
      }));

      setAllSchools(schoolsWithCounts);

      // Group schools by edital
      const grouped: EditalWithSchools[] = (editaisData || []).map(edital => ({
        id: edital.id,
        name: edital.name,
        schools: schoolsWithCounts.filter(s => s.edital_id === edital.id)
      })).filter(e => e.schools.length > 0);

      setEditaisWithSchools(grouped);
      setLoading(false);
      
      // Auto-select first school if no value
      if (!value && schoolsWithCounts.length > 0) {
        onChange(schoolsWithCounts[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace('.0', '')}k`;
    }
    return count.toString();
  };

  const formatExactCount = (count: number): string => {
    return count.toLocaleString('pt-BR');
  };

  const handleForceRefresh = useCallback(() => {
    schoolQuestionCountCache.clear();
    countsLoadedRef.current = false;
    fetchQuestionCounts(allSchools);
  }, [allSchools, fetchQuestionCounts]);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className || "w-[200px]"}>
          <SelectValue placeholder="Carregando..." />
        </SelectTrigger>
      </Select>
    );
  }

  const selectedSchool = allSchools.find(s => s.id === value);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {showLabel && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <School className="w-4 h-4" />
            <span>Escola:</span>
          </div>
        )}
        <Select 
          value={value} 
          onValueChange={onChange}
          onOpenChange={setDropdownOpen}
        >
          <SelectTrigger className={className || "w-[320px]"}>
            <SelectValue placeholder="Selecione uma escola">
              {selectedSchool && (
                <div className="flex items-center gap-2">
                  <span className="truncate">{selectedSchool.name}</span>
                  {showQuestionCount && selectedSchool.question_count !== undefined && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs shrink-0 cursor-help">
                          {formatCount(selectedSchool.question_count)} questões
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total exato: {formatExactCount(selectedSchool.question_count)} questões</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Escolas</SelectItem>
            {editaisWithSchools.map((edital) => (
              <div key={edital.id}>
                {/* Edital header - not selectable */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-t border-b mt-1">
                  {edital.name}
                </div>
                {/* Schools under this edital */}
                {edital.schools.map((school) => (
                  <SelectItem key={school.id} value={school.id} className="pl-4">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="truncate">{school.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {showDisciplineCount && (
                          <Badge variant="outline" className="text-xs">
                            {school.discipline_count} disc
                          </Badge>
                        )}
                        {showQuestionCount && (
                          <>
                            {loadingCounts ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : school.question_count !== undefined ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="text-xs cursor-help">
                                    {formatCount(school.question_count)} questões
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Total exato: {formatExactCount(school.question_count)} questões</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                ...
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        {showQuestionCount && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleForceRefresh}
                disabled={loadingCounts}
              >
                <RefreshCw className={`h-4 w-4 ${loadingCounts ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Atualizar contadores</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// Hook to get editals (real editals from editals table)
// =============================================================================

export function useEditalFilter() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEditais = async () => {
    try {
      const { data, error } = await supabase
        .from('editals')
        .select('id, name, is_default')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Also fetch discipline counts via schools
      if (data && data.length > 0) {
        const { data: schoolsData } = await supabase
          .from('schools')
          .select('id, edital_id')
          .eq('is_active', true);

        const { data: disciplineCounts } = await supabase
          .from('school_disciplines')
          .select('school_id')
          .eq('is_active', true);

        // Count disciplines per edital (via schools)
        const schoolDisciplineCount: Record<string, number> = {};
        (disciplineCounts || []).forEach((item: { school_id: string }) => {
          schoolDisciplineCount[item.school_id] = (schoolDisciplineCount[item.school_id] || 0) + 1;
        });

        const editalDisciplineCount: Record<string, number> = {};
        (schoolsData || []).forEach((school: { id: string; edital_id: string | null }) => {
          if (school.edital_id) {
            editalDisciplineCount[school.edital_id] = (editalDisciplineCount[school.edital_id] || 0) + 
              (schoolDisciplineCount[school.id] || 0);
          }
        });

        const editaisWithCounts = data.map(edital => ({
          ...edital,
          discipline_count: editalDisciplineCount[edital.id] || 0
        }));

        setEditais(editaisWithCounts);
      } else {
        setEditais(data || []);
      }
    } catch (error) {
      console.error('Error fetching editais:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditais();
  }, []);

  return { editais, loading, refresh: fetchEditais };
}

// Function to invalidate cache externally
export function invalidateSchoolQuestionCountCache() {
  schoolQuestionCountCache.clear();
}
