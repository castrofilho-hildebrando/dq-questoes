import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Download, 
  Save, 
  Loader2, 
  ExternalLink, 
  FileText, 
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Calendar,
  Building2,
  GraduationCap,
  FileCheck,
  ListOrdered
} from "lucide-react";
import { toast } from "sonner";
import { AdminProvasQueue } from "./AdminProvasQueue";

interface ProvaResult {
  titulo: string;
  ano: string;
  orgao: string;
  instituicao: string;
  nivel: string;
  url: string;
  pdfLinks?: { titulo: string; url: string }[];
  loadingPdfs?: boolean;
  selected?: boolean;
}

interface SavedProva {
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
  created_at: string;
  is_active: boolean;
}

interface Area {
  id: string;
  name: string;
}

interface ProvaGroup {
  id: string;
  prova: SavedProva | null;
  gabarito: SavedProva | null;
  ano: string | null;
  orgao: string | null;
  banca: string | null;
  areaId: string | null;
  nome: string;
}

export function AdminProvasScraper() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ProvaResult[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Filters for saved provas
  const [filterAreaId, setFilterAreaId] = useState<string>("all");
  const [filterAno, setFilterAno] = useState<string>("all");
  const [filterOrgao, setFilterOrgao] = useState<string>("all");
  const [filterBanca, setFilterBanca] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  
  // Selection for bulk delete
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Fetch areas for selection
  const { data: areas } = useQuery({
    queryKey: ["areas-for-provas"],
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

  // Fetch saved provas - need to paginate due to Supabase 1000 row limit
  const { data: savedProvas, isLoading: loadingSaved } = useQuery({
    queryKey: ["saved-provas-if"],
    queryFn: async () => {
      const allProvas: SavedProva[] = [];
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
          allProvas.push(...(data as SavedProva[]));
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allProvas;
    },
  });

  // Group provas by group_id
  const groupedProvas = useMemo(() => {
    if (!savedProvas) return [];
    
    const groupMap = new Map<string, ProvaGroup>();
    
    savedProvas.forEach(prova => {
      const groupId = prova.group_id || prova.id;
      
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          prova: null,
          gabarito: null,
          ano: prova.ano,
          orgao: prova.orgao,
          banca: prova.banca,
          areaId: prova.area_id,
          nome: prova.nome_prova,
        });
      }
      
      const group = groupMap.get(groupId)!;
      
      const isGabarito = prova.pdf_type === 'gabarito' || 
        prova.nome_prova.toLowerCase().includes('gabarito') ||
        prova.nome_prova.toLowerCase().includes('gab.');
      
      if (isGabarito) {
        group.gabarito = prova;
      } else {
        group.prova = prova;
        group.ano = prova.ano;
        group.orgao = prova.orgao;
        group.banca = prova.banca;
        group.areaId = prova.area_id;
        group.nome = prova.nome_prova.replace(/\s*-\s*prova\s*$/i, '').trim();
      }
    });
    
    return Array.from(groupMap.values());
  }, [savedProvas]);

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
      if (filterSearch) {
        const search = filterSearch.toLowerCase();
        const matchesSearch = 
          group.nome.toLowerCase().includes(search) ||
          group.orgao?.toLowerCase().includes(search) ||
          group.banca?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }
      
      // Area filter
      if (filterAreaId !== "all" && group.areaId !== filterAreaId) return false;
      
      // Year filter
      if (filterAno !== "all" && group.ano !== filterAno) return false;
      
      // Orgao filter
      if (filterOrgao !== "all" && group.orgao !== filterOrgao) return false;
      
      // Banca filter
      if (filterBanca !== "all" && group.banca !== filterBanca) return false;
      
      return true;
    });
  }, [groupedProvas, filterSearch, filterAreaId, filterAno, filterOrgao, filterBanca]);

  // Group by area
  const groupsByArea = useMemo(() => {
    const grouped: Record<string, { area: Area | null; groups: ProvaGroup[] }> = {};
    
    areas?.forEach(area => {
      grouped[area.id] = { area, groups: [] };
    });
    
    filteredGroups.forEach(group => {
      const areaId = group.areaId || "sem-area";
      if (!grouped[areaId]) {
        grouped[areaId] = { area: null, groups: [] };
      }
      grouped[areaId].groups.push(group);
    });
    
    return Object.entries(grouped)
      .filter(([_, data]) => data.groups.length > 0)
      .sort((a, b) => {
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
    setFilterSearch("");
    setFilterAreaId("all");
    setFilterAno("all");
    setFilterOrgao("all");
    setFilterBanca("all");
  };

  const hasActiveFilters = filterSearch || filterAreaId !== "all" || filterAno !== "all" || filterOrgao !== "all" || filterBanca !== "all";

  // Search provas
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Digite um termo de busca");
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-provas", {
        body: { searchTerm },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setResults(data.data.map((p: ProvaResult) => ({ ...p, selected: true })));
      toast.success(`${data.count} provas encontradas`);
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao buscar provas");
    } finally {
      setIsSearching(false);
    }
  };

  // Load PDF links for a prova and return the links (for save workflow)
  const loadPdfLinksAsync = async (url: string): Promise<{ titulo: string; url: string }[]> => {
    try {
      const { data, error } = await supabase.functions.invoke("scrape-prova-details", {
        body: { url },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.data || [];
    } catch (error) {
      console.error("Load PDFs error:", error);
      return [];
    }
  };

  // Load PDF links for a prova (for UI)
  const loadPdfLinks = async (index: number) => {
    const prova = results[index];
    if (prova.pdfLinks) return;

    setResults(prev => prev.map((p, i) => 
      i === index ? { ...p, loadingPdfs: true } : p
    ));

    try {
      const pdfLinks = await loadPdfLinksAsync(prova.url);
      setResults(prev => prev.map((p, i) => 
        i === index ? { ...p, pdfLinks, loadingPdfs: false } : p
      ));
    } catch (error) {
      setResults(prev => prev.map((p, i) => 
        i === index ? { ...p, loadingPdfs: false } : p
      ));
    }
  };

  // Save selected provas
  const handleSaveAll = async () => {
    if (!selectedAreaId) {
      toast.error("Selecione uma área primeiro");
      return;
    }

    const selectedResults = results.filter(r => r.selected);
    if (selectedResults.length === 0) {
      toast.error("Nenhuma prova selecionada");
      return;
    }

    setIsSavingAll(true);
    let totalSaved = 0;

    try {
      const provasToSave: Array<{
        nome_prova: string;
        ano?: string;
        banca?: string;  // Instituição do PCI → banca no banco
        orgao?: string;
        url_pdf: string;
        url_origem?: string;
        area_id?: string;
      }> = [];

      for (const prova of selectedResults) {
        setResults(prev => prev.map(p => 
          p.url === prova.url ? { ...p, loadingPdfs: true } : p
        ));

        const pdfLinks = prova.pdfLinks || await loadPdfLinksAsync(prova.url);
        
        setResults(prev => prev.map(p => 
          p.url === prova.url ? { ...p, pdfLinks, loadingPdfs: false } : p
        ));

        if (pdfLinks && pdfLinks.length > 0) {
          pdfLinks.forEach(pdf => {
            provasToSave.push({
              nome_prova: `${prova.titulo} - ${pdf.titulo}`,
              ano: prova.ano,
              banca: prova.instituicao,  // PCI "Instituição" → banco "banca"
              orgao: prova.orgao,        // PCI "Órgão" → banco "orgao"
              url_pdf: pdf.url,
              url_origem: prova.url,
              area_id: selectedAreaId,
            });
          });
        }
      }

      console.log(`Total PDFs to save: ${provasToSave.length}`);

      if (provasToSave.length === 0) {
        toast.error("Nenhum PDF encontrado para salvar");
        return;
      }

      const { data, error } = await supabase.functions.invoke("save-provas", {
        body: { provas: provasToSave },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      totalSaved = data.saved;
      toast.success(`${totalSaved} provas salvas em ${data.groups} grupos!`);
      await queryClient.invalidateQueries({ queryKey: ["saved-provas-if"] });
      
      // Auto-expand the area where provas were saved so user sees them immediately
      if (selectedAreaId) {
        setExpandedAreas(prev => new Set([...prev, selectedAreaId]));
        setFilterAreaId(selectedAreaId); // Also filter to that area
      }
      
      setResults([]);
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao salvar provas");
    } finally {
      setIsSavingAll(false);
    }
  };

  // Delete a saved prova group via edge function (bypasses RLS)
  const deleteMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.functions.invoke("delete-provas-if", {
        body: { groupIds: [groupId] },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prova removida");
      setSelectedGroups(prev => {
        const next = new Set(prev);
        next.clear();
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["saved-provas-if"] });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao remover");
    },
  });

  // Bulk delete selected groups via edge function (bypasses RLS)
  const handleBulkDelete = async () => {
    if (selectedGroups.size === 0) {
      toast.error("Selecione provas para excluir");
      return;
    }
    
    setIsDeletingBulk(true);
    try {
      const groupIds = Array.from(selectedGroups);
      
      const { error } = await supabase.functions.invoke("delete-provas-if", {
        body: { groupIds },
      });
      
      if (error) throw error;
      
      toast.success(`${groupIds.length} provas removidas`);
      setSelectedGroups(new Set());
      queryClient.invalidateQueries({ queryKey: ["saved-provas-if"] });
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao remover provas");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Toggle group selection
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Select all visible groups
  const toggleSelectAllGroups = () => {
    const visibleGroupIds = filteredGroups.map(g => g.id);
    const allSelected = visibleGroupIds.every(id => selectedGroups.has(id));
    
    if (allSelected) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(visibleGroupIds));
    }
  };

  // Toggle selection
  const toggleSelection = (index: number) => {
    setResults(prev => prev.map((p, i) => 
      i === index ? { ...p, selected: !p.selected } : p
    ));
  };

  // Select all / none
  const toggleSelectAll = () => {
    const allSelected = results.every(r => r.selected);
    setResults(prev => prev.map(p => ({ ...p, selected: !allSelected })));
  };

  return (
    <Tabs defaultValue="queue" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 max-w-md">
        <TabsTrigger value="queue" className="gap-2">
          <ListOrdered className="w-4 h-4" />
          Fila Automática
        </TabsTrigger>
        <TabsTrigger value="manual" className="gap-2">
          <Search className="w-4 h-4" />
          Busca Manual
        </TabsTrigger>
      </TabsList>

      {/* Queue Tab */}
      <TabsContent value="queue" className="space-y-6">
        <AdminProvasQueue />
      </TabsContent>

      {/* Manual Search Tab */}
      <TabsContent value="manual" className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar Provas no PCI Concursos
          </CardTitle>
          <CardDescription>
            Busque provas de concursos para Institutos Federais e salve no banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Ex: IFAL, Instituto Federal Alagoas, TAE..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Buscar
              </Button>
            </div>
            {results.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Para salvar, selecione a área:</span>
                <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas?.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Search Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={results.every(r => r.selected)}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {results.filter(r => r.selected).length} de {results.length} selecionadas
                  </span>
                </div>
                <Button onClick={handleSaveAll} disabled={isSavingAll || !selectedAreaId}>
                  {isSavingAll ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Selecionadas
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Prova</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Órgão</TableHead>
                      <TableHead>Banca</TableHead>
                      <TableHead className="text-right">PDFs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((prova, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Checkbox
                            checked={prova.selected}
                            onCheckedChange={() => toggleSelection(index)}
                          />
                        </TableCell>
                        <TableCell>
                          <a
                            href={prova.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {prova.titulo.substring(0, 60)}
                            {prova.titulo.length > 60 && "..."}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{prova.ano || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {prova.orgao || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {prova.instituicao || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {prova.loadingPdfs ? (
                            <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                          ) : prova.pdfLinks ? (
                            <div className="flex items-center justify-end gap-2">
                              <Badge variant="secondary">{prova.pdfLinks.length}</Badge>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => loadPdfLinks(index)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Provas Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Provas Salvas
          </CardTitle>
          <CardDescription>
            {filteredGroups.length} provas no banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, instituição, órgão ou banca..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Area/Discipline Filter */}
              <Select value={filterAreaId} onValueChange={setFilterAreaId}>
                <SelectTrigger className="w-[180px]">
                  <BookOpen className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as disciplinas</SelectItem>
                  {areas?.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Year Filter */}
              <Select value={filterAno} onValueChange={setFilterAno}>
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
              <Select value={filterOrgao} onValueChange={setFilterOrgao}>
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
              <Select value={filterBanca} onValueChange={setFilterBanca}>
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
          </div>

          {loadingSaved ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : groupsByArea.length > 0 ? (
            <div className="space-y-4">
              {/* Stats and controls */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={filteredGroups.length > 0 && filteredGroups.every(g => selectedGroups.has(g.id))}
                      onCheckedChange={toggleSelectAllGroups}
                    />
                    <FileText className="w-4 h-4" />
                    {filteredGroups.length} provas em {groupsByArea.length} disciplinas
                  </div>
                  {selectedGroups.size > 0 && (
                    <Badge variant="secondary">
                      {selectedGroups.size} selecionadas
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedGroups.size > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleBulkDelete}
                      disabled={isDeletingBulk}
                    >
                      {isDeletingBulk ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Excluir selecionadas
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={toggleExpandAll}>
                    {expandedAreas.size === groupsByArea.length ? "Recolher todas" : "Expandir todas"}
                  </Button>
                </div>
              </div>

              {/* Provas grouped by area */}
              {groupsByArea.map(([areaId, data]) => {
                const isExpanded = expandedAreas.has(areaId);
                const areaName = data.area?.name || "Sem área definida";
                
                return (
                  <Collapsible key={areaId} open={isExpanded} onOpenChange={() => toggleArea(areaId)}>
                    <Card>
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="py-3 hover:bg-muted/50 transition-colors cursor-pointer">
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
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12"></TableHead>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Ano</TableHead>
                                  <TableHead>Órgão</TableHead>
                                  <TableHead>Banca</TableHead>
                                  <TableHead>Arquivos</TableHead>
                                  <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data.groups.map((group) => (
                                  <TableRow key={group.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedGroups.has(group.id)}
                                        onCheckedChange={() => toggleGroupSelection(group.id)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm font-medium">
                                        {group.nome.substring(0, 50)}
                                        {group.nome.length > 50 && "..."}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{group.ano || "-"}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {group.orgao || "-"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {group.banca || "-"}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        {group.prova && (
                                          <Button size="sm" variant="outline" asChild>
                                            <a
                                              href={group.prova.url_pdf}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              <FileText className="w-3 h-3 mr-1" />
                                              Prova
                                            </a>
                                          </Button>
                                        )}
                                        {group.gabarito && (
                                          <Button size="sm" variant="outline" asChild>
                                            <a
                                              href={group.gabarito.url_pdf}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              <FileCheck className="w-3 h-3 mr-1" />
                                              Gabarito
                                            </a>
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteMutation.mutate(group.id)}
                                        disabled={deleteMutation.isPending}
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma prova salva ainda</p>
              <p className="text-sm">Use a busca acima para encontrar e salvar provas</p>
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>
    </Tabs>
  );
}
