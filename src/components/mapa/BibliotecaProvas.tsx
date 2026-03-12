import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Search, 
  Download, 
  FileText, 
  ChevronDown,
  ChevronRight,
  BookOpen,
  Calendar,
  Building2,
  GraduationCap,
  FileCheck
} from "lucide-react";

interface ProvaIF {
  id: string;
  nome_prova: string;
  ano: string | null;
  orgao: string | null;
  banca: string | null;
  url_pdf: string;
  url_origem: string | null;
  area_id: string | null;
  group_id: string | null;
  pdf_type: string | null;
}

interface Area {
  id: string;
  name: string;
}

interface ProvaGroup {
  id: string;
  prova: ProvaIF | null;
  gabarito: ProvaIF | null;
  ano: string | null;
  orgao: string | null;
  banca: string | null;
  nome: string;
}

interface BibliotecaProvasProps {
  userAreaId?: string;
}

export function BibliotecaProvas({ userAreaId }: BibliotecaProvasProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAno, setSelectedAno] = useState<string>("all");
  const [selectedOrgao, setSelectedOrgao] = useState<string>("all");
  const [selectedBanca, setSelectedBanca] = useState<string>("all");
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  // Fetch areas
  const { data: areas } = useQuery({
    queryKey: ["areas-biblioteca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Area[];
    },
  });

  // Fetch all provas - need to paginate due to Supabase 1000 row limit
  const { data: provas, isLoading } = useQuery({
    queryKey: ["provas-biblioteca-all"],
    queryFn: async () => {
      const allProvas: ProvaIF[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data, error } = await supabase
          .from("provas_if")
          .select("*")
          .eq("is_active", true)
          .order("ano", { ascending: false })
          .order("nome_prova")
          .range(from, to);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allProvas.push(...(data as ProvaIF[]));
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allProvas;
    },
  });

  // Group provas by group_id, pairing provas with gabaritos
  const groupedProvas = useMemo(() => {
    if (!provas) return [];
    
    const groupMap = new Map<string, ProvaGroup>();
    
    provas.forEach(prova => {
      const groupId = prova.group_id || prova.id; // Use id as fallback for ungrouped
      
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          prova: null,
          gabarito: null,
          ano: prova.ano,
          orgao: prova.orgao,
          banca: prova.banca,
          nome: prova.nome_prova,
        });
      }
      
      const group = groupMap.get(groupId)!;
      
      // Determine if this is a prova or gabarito
      const isGabarito = prova.pdf_type === 'gabarito' || 
        prova.nome_prova.toLowerCase().includes('gabarito') ||
        prova.nome_prova.toLowerCase().includes('gab.');
      
      if (isGabarito) {
        group.gabarito = prova;
      } else {
        group.prova = prova;
        // Update group info from the main prova
        group.ano = prova.ano;
        group.orgao = prova.orgao;
        group.banca = prova.banca;
        // Clean up the name to remove "- Prova" suffix
        group.nome = prova.nome_prova.replace(/\s*-\s*prova\s*$/i, '').trim();
      }
    });
    
    return Array.from(groupMap.values());
  }, [provas]);

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    if (!groupedProvas.length) return { years: [], orgaos: [], bancas: [] };
    
    const years = [...new Set(groupedProvas.map(g => g.ano).filter(Boolean) as string[])].sort().reverse();
    const orgaos = [...new Set(groupedProvas.map(g => g.orgao).filter(Boolean) as string[])].sort();
    const bancas = [...new Set(groupedProvas.map(g => g.banca).filter(Boolean) as string[])].sort();
    
    return { years, orgaos, bancas };
  }, [groupedProvas]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groupedProvas.filter(group => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          group.nome.toLowerCase().includes(search) ||
          group.orgao?.toLowerCase().includes(search) ||
          group.banca?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }
      
      // Year filter
      if (selectedAno !== "all" && group.ano !== selectedAno) return false;
      
      // Orgao filter
      if (selectedOrgao !== "all" && group.orgao !== selectedOrgao) return false;
      
      // Banca filter
      if (selectedBanca !== "all" && group.banca !== selectedBanca) return false;
      
      return true;
    });
  }, [groupedProvas, searchTerm, selectedAno, selectedOrgao, selectedBanca]);

  // Group by area (discipline)
  const groupsByArea = useMemo(() => {
    const grouped: Record<string, { area: Area | null; groups: ProvaGroup[] }> = {};
    
    // Initialize with areas
    areas?.forEach(area => {
      grouped[area.id] = { area, groups: [] };
    });
    
    // Assign groups to areas
    filteredGroups.forEach(group => {
      // Get area_id from prova or gabarito
      const areaId = group.prova?.area_id || group.gabarito?.area_id || "sem-area";
      if (!grouped[areaId]) {
        grouped[areaId] = { area: null, groups: [] };
      }
      grouped[areaId].groups.push(group);
    });
    
    // Filter out empty groups and sort
    return Object.entries(grouped)
      .filter(([_, data]) => data.groups.length > 0)
      .sort((a, b) => {
        // "Sem área" goes last
        if (!a[1].area) return 1;
        if (!b[1].area) return -1;
        return a[1].area.name.localeCompare(b[1].area.name);
      });
  }, [filteredGroups, areas]);

  // Toggle area expansion
  const toggleArea = (areaId: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  // Expand all / collapse all
  const toggleExpandAll = () => {
    if (expandedAreas.size === groupsByArea.length) {
      setExpandedAreas(new Set());
    } else {
      setExpandedAreas(new Set(groupsByArea.map(([id]) => id)));
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedAno("all");
    setSelectedOrgao("all");
    setSelectedBanca("all");
  };

  const hasActiveFilters = searchTerm || selectedAno !== "all" || selectedOrgao !== "all" || selectedBanca !== "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Biblioteca de Provas Anteriores
          </CardTitle>
          <CardDescription>
            Consulte e baixe provas anteriores dos Institutos Federais organizadas por disciplina
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, instituição, órgão ou banca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3">
            {/* Year Filter */}
            <Select value={selectedAno} onValueChange={setSelectedAno}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {filterOptions.years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Orgao Filter */}
            <Select value={selectedOrgao} onValueChange={setSelectedOrgao}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Órgão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os órgãos</SelectItem>
                {filterOptions.orgaos.map((orgao) => (
                  <SelectItem key={orgao} value={orgao}>
                    {orgao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Banca Filter */}
            <Select value={selectedBanca} onValueChange={setSelectedBanca}>
              <SelectTrigger className="w-[180px]">
                <GraduationCap className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Banca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as bancas</SelectItem>
                {filterOptions.bancas.map((banca) => (
                  <SelectItem key={banca} value={banca}>
                    {banca}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : groupsByArea.length > 0 ? (
        <div className="space-y-4">
          {/* Stats and controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {filteredGroups.length} provas em {groupsByArea.length} disciplinas
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleExpandAll}>
              {expandedAreas.size === groupsByArea.length ? "Recolher todas" : "Expandir todas"}
            </Button>
          </div>

          {/* Provas grouped by area/discipline */}
          {groupsByArea.map(([areaId, data]) => {
            const isExpanded = expandedAreas.has(areaId);
            const areaName = data.area?.name || "Sem área definida";
            
            return (
              <Collapsible key={areaId} open={isExpanded} onOpenChange={() => toggleArea(areaId)}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="py-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                          <BookOpen className="w-5 h-5 text-primary" />
                          <span className="font-semibold">{areaName}</span>
                        </div>
                        <Badge variant="secondary">
                          {data.groups.length} {data.groups.length === 1 ? 'prova' : 'provas'}
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {data.groups.map((group) => (
                          <div
                            key={group.id}
                            className="border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
                          >
                            <div className="space-y-3">
                              {/* Title and metadata */}
                              <div>
                                <h4 className="font-medium text-sm line-clamp-2">
                                  {group.nome}
                                </h4>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {group.ano && (
                                    <Badge variant="outline" className="text-xs">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      {group.ano}
                                    </Badge>
                                  )}
                                  {group.orgao && (
                                    <Badge variant="outline" className="text-xs">
                                      <Building2 className="w-3 h-3 mr-1" />
                                      {group.orgao}
                                    </Badge>
                                  )}
                                  {group.banca && (
                                    <Badge variant="secondary" className="text-xs">
                                      {group.banca}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Download buttons */}
                              <div className="flex gap-2 pt-2 border-t">
                                {group.prova && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    asChild
                                  >
                                    <a
                                      href={group.prova.url_pdf}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <FileText className="w-4 h-4 mr-1" />
                                      Prova
                                    </a>
                                  </Button>
                                )}
                                {group.gabarito && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    asChild
                                  >
                                    <a
                                      href={group.gabarito.url_pdf}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <FileCheck className="w-4 h-4 mr-1" />
                                      Gabarito
                                    </a>
                                  </Button>
                                )}
                                {/* Fallback if neither prova nor gabarito is properly typed */}
                                {!group.prova && !group.gabarito && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    asChild
                                  >
                                    <a
                                      href={(provas?.find(p => p.group_id === group.id || p.id === group.id))?.url_pdf || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Download className="w-4 h-4 mr-1" />
                                      Baixar
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma prova encontrada</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "Tente ajustar os filtros de busca"
                : "Ainda não há provas cadastradas"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
