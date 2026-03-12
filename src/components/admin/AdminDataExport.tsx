import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  FileCode,
  Loader2, 
  Users, 
  CheckCircle2,
  Calendar,
  BookOpen,
  StickyNote,
  Database,
  GraduationCap,
  Target,
  School,
  FileText,
  Link,
  Layers
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  table: string;
  columns?: string;
  category: 'user' | 'structure';
}

const exportOptions: ExportOption[] = [
  // User data
  {
    id: 'profiles',
    label: 'Usuários',
    description: 'Perfis de usuários (email, nome, data de criação)',
    icon: <Users className="w-4 h-4" />,
    table: 'profiles',
    columns: 'id, user_id, email, full_name, avatar_url, created_at, updated_at, last_access_at, is_active',
    category: 'user'
  },
  {
    id: 'user_answers',
    label: 'Respostas',
    description: 'Histórico de respostas de questões',
    icon: <CheckCircle2 className="w-4 h-4" />,
    table: 'user_answers',
    columns: 'id, user_id, question_id, selected_answer, is_correct, answered_at',
    category: 'user'
  },
  {
    id: 'user_cronogramas',
    label: 'Cronogramas',
    description: 'Cronogramas de estudo dos usuários',
    icon: <Calendar className="w-4 h-4" />,
    table: 'user_cronogramas',
    columns: 'id, user_id, school_id, name, start_date, end_date, hours_per_day, available_days, selected_disciplines, is_active, created_at, updated_at',
    category: 'user'
  },
  {
    id: 'user_cronograma_tasks',
    label: 'Tarefas do Cronograma',
    description: 'Tarefas e progresso nos cronogramas',
    icon: <Calendar className="w-4 h-4" />,
    table: 'user_cronograma_tasks',
    columns: 'id, cronograma_id, user_id, goal_id, scheduled_date, duration_minutes, is_completed, completed_at, is_revision, revision_number, notes, created_at',
    category: 'user'
  },
  {
    id: 'study_notebooks',
    label: 'Cadernos de Questões',
    description: 'Cadernos criados pelos usuários',
    icon: <BookOpen className="w-4 h-4" />,
    table: 'study_notebooks',
    columns: 'id, user_id, name, description, is_active, created_at, updated_at',
    category: 'user'
  },
  {
    id: 'notebook_questions',
    label: 'Questões dos Cadernos',
    description: 'Questões adicionadas aos cadernos',
    icon: <BookOpen className="w-4 h-4" />,
    table: 'notebook_questions',
    columns: 'id, notebook_id, question_id, display_order, created_at',
    category: 'user'
  },
  {
    id: 'question_notes',
    label: 'Anotações',
    description: 'Anotações dos usuários em questões',
    icon: <StickyNote className="w-4 h-4" />,
    table: 'question_notes',
    columns: 'id, user_id, question_id, content, discipline_id, discipline_name, topic_id, topic_name, created_at, updated_at',
    category: 'user'
  },
  // Structure data
  {
    id: 'study_disciplines',
    label: 'Disciplinas',
    description: 'Disciplinas de estudo (fonte e derivadas)',
    icon: <GraduationCap className="w-4 h-4" />,
    table: 'study_disciplines',
    category: 'structure'
  },
  {
    id: 'study_topics',
    label: 'Tópicos',
    description: 'Tópicos das disciplinas',
    icon: <Layers className="w-4 h-4" />,
    table: 'study_topics',
    category: 'structure'
  },
  {
    id: 'topic_goals',
    label: 'Metas dos Tópicos',
    description: 'Metas de estudo por tópico',
    icon: <Target className="w-4 h-4" />,
    table: 'topic_goals',
    category: 'structure'
  },
  {
    id: 'schools',
    label: 'Escolas',
    description: 'Escolas (concurso + disciplina)',
    icon: <School className="w-4 h-4" />,
    table: 'schools',
    category: 'structure'
  },
  {
    id: 'school_disciplines',
    label: 'Disciplinas das Escolas',
    description: 'Vínculo escola ↔ disciplina',
    icon: <Link className="w-4 h-4" />,
    table: 'school_disciplines',
    category: 'structure'
  },
  {
    id: 'questions',
    label: 'Questões',
    description: 'Banco de questões (enunciado, alternativas, gabarito)',
    icon: <FileText className="w-4 h-4" />,
    table: 'questions',
    category: 'structure'
  },
  {
    id: 'question_topics',
    label: 'Tópicos das Questões',
    description: 'Vínculo questão ↔ tópico',
    icon: <Link className="w-4 h-4" />,
    table: 'question_topics',
    category: 'structure'
  },
  {
    id: 'admin_question_notebooks',
    label: 'Cadernos Admin',
    description: 'Cadernos de questões administrativos',
    icon: <BookOpen className="w-4 h-4" />,
    table: 'admin_question_notebooks',
    category: 'structure'
  },
  {
    id: 'admin_notebook_questions',
    label: 'Questões dos Cadernos Admin',
    description: 'Vínculo caderno admin ↔ questão',
    icon: <Link className="w-4 h-4" />,
    table: 'admin_notebook_questions',
    category: 'structure'
  },
  {
    id: 'pdf_materials',
    label: 'Materiais PDF',
    description: 'Materiais dissecados em PDF',
    icon: <FileText className="w-4 h-4" />,
    table: 'pdf_materials',
    category: 'structure'
  },
  {
    id: 'pdf_material_topic_links',
    label: 'Vínculos PDF ↔ Tópico',
    description: 'Vínculo material PDF ↔ tópico de estudo',
    icon: <Link className="w-4 h-4" />,
    table: 'pdf_material_topic_links',
    category: 'structure'
  },
];

// Helper to fetch all rows using pagination (bypasses 1000 row limit)
async function fetchAllRows(table: string, columns?: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table as any)
      .select(columns || '*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }
  }

  return allData;
}

function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function generateInsertSQL(tableName: string, rows: any[]): string {
  if (!rows || rows.length === 0) return `-- No data for ${tableName}\n`;
  
  const columns = Object.keys(rows[0]);
  const lines: string[] = [];
  lines.push(`-- Table: ${tableName} (${rows.length} rows)`);
  lines.push(`-- Generated: ${new Date().toISOString()}\n`);
  
  // Batch inserts in groups of 50 for performance
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    lines.push(`INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES`);
    const valueLines = batch.map(row => {
      const values = columns.map(col => escapeSQL(row[col]));
      return `  (${values.join(', ')})`;
    });
    lines.push(valueLines.join(',\n') + '\nON CONFLICT DO NOTHING;\n');
  }
  
  return lines.join('\n');
}

export function AdminDataExport() {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'sql'>('json');

  // Fetch counts for each table in real-time
  const { data: tableCounts, isLoading: loadingCounts } = useQuery({
    queryKey: ['export-table-counts'],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      
      await Promise.all(
        exportOptions.map(async (option) => {
          const { count, error } = await supabase
            .from(option.table as any)
            .select('*', { count: 'exact', head: true });
          
          if (!error && count !== null) {
            counts[option.id] = count;
          }
        })
      );
      
      return counts;
    },
    refetchInterval: 30000,
  });

  const toggleTable = (tableId: string) => {
    setSelectedTables(prev =>
      prev.includes(tableId)
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
    );
  };

  const selectAll = () => {
    if (selectedTables.length === exportOptions.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(exportOptions.map(o => o.id));
    }
  };

  const selectCategory = (category: 'user' | 'structure') => {
    const categoryIds = exportOptions.filter(o => o.category === category).map(o => o.id);
    const allSelected = categoryIds.every(id => selectedTables.includes(id));
    if (allSelected) {
      setSelectedTables(prev => prev.filter(id => !categoryIds.includes(id)));
    } else {
      setSelectedTables(prev => [...new Set([...prev, ...categoryIds])]);
    }
  };

  const convertToCSV = (data: any[], tableName: string): string => {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast.error('Selecione pelo menos uma tabela para exportar');
      return;
    }

    setExporting(true);
    
    try {
      const exportData: Record<string, any[]> = {};
      const errors: string[] = [];

      await Promise.all(
        selectedTables.map(async (tableId) => {
          const option = exportOptions.find(o => o.id === tableId);
          if (!option) return;

          try {
            const data = await fetchAllRows(option.table, option.columns);
            exportData[option.table] = data;
          } catch (error: any) {
            errors.push(`${option.label}: ${error.message}`);
          }
        })
      );

      if (errors.length > 0) {
        toast.error(`Erros ao exportar: ${errors.join(', ')}`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      if (exportFormat === 'json') {
        const jsonContent = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dq-questoes-export-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'csv') {
        Object.entries(exportData).forEach(([tableName, data]) => {
          const csvContent = convertToCSV(data, tableName);
          if (csvContent) {
            zip.file(`${tableName}.csv`, csvContent);
          }
        });
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dq-questoes-export-${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'sql') {
        // SQL format - INSERT statements in a ZIP
        const header = [
          '-- ===========================================',
          '-- DQ QUESTÕES - DATABASE EXPORT (SQL INSERTs)',
          `-- Generated: ${new Date().toISOString()}`,
          `-- Tables: ${Object.keys(exportData).join(', ')}`,
          `-- Total records: ${Object.values(exportData).reduce((acc, arr) => acc + arr.length, 0)}`,
          '-- ===========================================',
          '',
          'BEGIN;',
          ''
        ].join('\n');

        const footer = '\nCOMMIT;\n';

        Object.entries(exportData).forEach(([tableName, data]) => {
          const sqlContent = header + generateInsertSQL(tableName, data) + footer;
          zip.file(`${tableName}.sql`, sqlContent);
        });
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dq-questoes-sql-export-${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      const totalRecords = Object.values(exportData).reduce((acc, arr) => acc + arr.length, 0);
      toast.success(`Exportação concluída! ${totalRecords.toLocaleString()} registros em ${Object.keys(exportData).length} tabelas.`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  const userOptions = exportOptions.filter(o => o.category === 'user');
  const structureOptions = exportOptions.filter(o => o.category === 'structure');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Exportação de Dados
        </CardTitle>
        <CardDescription>
          Exporte dados completos da plataforma para migração ou backup. Os contadores são atualizados em tempo real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Formato de exportação</Label>
          <div className="flex gap-4">
            <Button
              variant={exportFormat === 'json' ? 'default' : 'outline'}
              onClick={() => setExportFormat('json')}
              className="flex items-center gap-2"
            >
              <FileJson className="w-4 h-4" />
              JSON
            </Button>
            <Button
              variant={exportFormat === 'csv' ? 'default' : 'outline'}
              onClick={() => setExportFormat('csv')}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV (ZIP)
            </Button>
            <Button
              variant={exportFormat === 'sql' ? 'default' : 'outline'}
              onClick={() => setExportFormat('sql')}
              className="flex items-center gap-2"
            >
              <FileCode className="w-4 h-4" />
              SQL (ZIP)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {exportFormat === 'json' 
              ? 'Arquivo único contendo todos os dados estruturados'
              : exportFormat === 'csv'
              ? 'Múltiplos arquivos CSV compactados em ZIP'
              : 'Arquivos SQL com INSERTs compactados em ZIP (ideal para restauração)'
            }
          </p>
        </div>

        {/* Table Selection - User Data */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">📊 Dados de Usuários</Label>
            <Button variant="ghost" size="sm" onClick={() => selectCategory('user')}>
              {userOptions.every(o => selectedTables.includes(o.id)) ? 'Desmarcar' : 'Selecionar'}
            </Button>
          </div>
          
          <div className="grid gap-3 md:grid-cols-2">
            {userOptions.map((option) => (
              <div
                key={option.id}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedTables.includes(option.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleTable(option.id)}
              >
                <Checkbox
                  id={option.id}
                  checked={selectedTables.includes(option.id)}
                  onCheckedChange={() => toggleTable(option.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <Label htmlFor={option.id} className="font-medium cursor-pointer">
                      {option.label}
                    </Label>
                    <Badge variant="secondary" className="ml-auto">
                      {loadingCounts ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        (tableCounts?.[option.id] || 0).toLocaleString()
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Selection - Structure Data */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">🏗️ Dados Estruturais</Label>
            <Button variant="ghost" size="sm" onClick={() => selectCategory('structure')}>
              {structureOptions.every(o => selectedTables.includes(o.id)) ? 'Desmarcar' : 'Selecionar'}
            </Button>
          </div>
          
          <div className="grid gap-3 md:grid-cols-2">
            {structureOptions.map((option) => (
              <div
                key={option.id}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedTables.includes(option.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleTable(option.id)}
              >
                <Checkbox
                  id={option.id}
                  checked={selectedTables.includes(option.id)}
                  onCheckedChange={() => toggleTable(option.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <Label htmlFor={option.id} className="font-medium cursor-pointer">
                      {option.label}
                    </Label>
                    <Badge variant="secondary" className="ml-auto">
                      {loadingCounts ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        (tableCounts?.[option.id] || 0).toLocaleString()
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Select All */}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {selectedTables.length === exportOptions.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
        </div>

        {/* Export Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedTables.length === 0 ? (
              'Nenhuma tabela selecionada'
            ) : (
              <>
                <span className="font-medium">{selectedTables.length}</span> tabela(s) selecionada(s)
                {!loadingCounts && tableCounts && (
                  <span className="ml-2">
                    (~{selectedTables.reduce((acc, id) => acc + (tableCounts[id] || 0), 0).toLocaleString()} registros)
                  </span>
                )}
              </>
            )}
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting || selectedTables.length === 0}
            className="gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
