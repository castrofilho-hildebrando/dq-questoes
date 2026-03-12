import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Loader2,
  Database,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HardDrive,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface TableMeta {
  table_name: string;
  estimated_rows: number;
}

interface ExportLog {
  table: string;
  status: 'pending' | 'exporting' | 'done' | 'error';
  rows?: number;
  error?: string;
}

const PAGE_SIZE = 1000;

export function AdminFullDatabaseExport() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [logs, setLogs] = useState<ExportLog[]>([]);
  const abortRef = useRef(false);

  const updateLog = (table: string, update: Partial<ExportLog>) => {
    setLogs(prev =>
      prev.map(l => (l.table === table ? { ...l, ...update } : l))
    );
  };

  const fetchAllRows = async (tableName: string): Promise<any[]> => {
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore && !abortRef.current) {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .range(from, from + PAGE_SIZE - 1) as any;

      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows.push(...data);
        from += PAGE_SIZE;
        if (data.length < PAGE_SIZE) hasMore = false;
      }
    }

    return allRows;
  };

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    abortRef.current = false;

    try {
      // 1. Get list of all tables with row estimates
      const { data: tablesRaw } = await supabase.rpc('get_public_tables_with_counts' as any);

      // Fallback: use information_schema
      let tables: TableMeta[] = [];
      if (tablesRaw && Array.isArray(tablesRaw)) {
        tables = tablesRaw;
      } else {
        // Build list from known types
        const { data: tableNames } = await supabase
          .from('pg_stat_user_tables' as any)
          .select('relname, n_live_tup') as any;

        if (!tableNames) {
          // Last resort: use hardcoded list from types
          const typeKeys = Object.keys(
            (supabase as any).rest?.schema?.definitions || {}
          );
          // Use the tables we know from the generated types
          const knownTables = getKnownTables();
          tables = knownTables.map(t => ({ table_name: t, estimated_rows: 0 }));
        } else {
          tables = tableNames.map((t: any) => ({
            table_name: t.relname,
            estimated_rows: t.n_live_tup || 0,
          }));
        }
      }

      // If tables is still empty, use known tables
      if (tables.length === 0) {
        tables = getKnownTables().map(t => ({ table_name: t, estimated_rows: 0 }));
      }

      // Sort: smaller tables first for quicker feedback
      tables.sort((a, b) => a.estimated_rows - b.estimated_rows);

      // Initialize logs
      setLogs(tables.map(t => ({ table: t.table_name, status: 'pending' })));

      const zip = new JSZip();
      const schemaFolder = zip.folder('schema')!;
      const dataFolder = zip.folder('data')!;

      // 2. Export schema (column definitions for all tables)
      setCurrentTable('Extraindo schema...');

      // Get all columns
      const { data: allColumns } = await supabase
        .rpc('execute_readonly_query' as any, {
          query_text: `
            SELECT table_name, column_name, ordinal_position, data_type, udt_name,
                   character_maximum_length, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
          `
        }) as { data: any[] | null };

      // Get indexes
      const { data: allIndexes } = await supabase
        .rpc('execute_readonly_query' as any, {
          query_text: `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`
        }) as { data: any[] | null };

      // Get foreign keys
      const { data: allFKs } = await supabase
        .rpc('execute_readonly_query' as any, {
          query_text: `
            SELECT tc.table_name, tc.constraint_name, kcu.column_name,
                   ccu.table_schema || '.' || ccu.table_name || '(' || ccu.column_name || ')' as references_to
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_name
          `
        }) as { data: any[] | null };

      // Save schema info
      const schemaInfo: Record<string, any> = {};
      if (allColumns) {
        for (const col of allColumns) {
          if (!schemaInfo[col.table_name]) {
            schemaInfo[col.table_name] = { columns: [], indexes: [], foreign_keys: [] };
          }
          schemaInfo[col.table_name].columns.push(col);
        }
      }
      if (allIndexes) {
        schemaFolder.file('indexes.json', JSON.stringify(allIndexes, null, 2));
      }
      if (allFKs) {
        for (const fk of allFKs) {
          if (schemaInfo[fk.table_name]) {
            schemaInfo[fk.table_name].foreign_keys.push(fk);
          }
        }
      }

      schemaFolder.file('tables_schema.json', JSON.stringify(schemaInfo, null, 2));

      // 3. Export data table by table
      let completed = 0;
      const totalTables = tables.length;
      const errors: string[] = [];

      for (const table of tables) {
        if (abortRef.current) break;

        setCurrentTable(table.table_name);
        updateLog(table.table_name, { status: 'exporting' });

        try {
          const rows = await fetchAllRows(table.table_name);
          dataFolder.file(
            `${table.table_name}.json`,
            JSON.stringify(rows, null, 2)
          );
          updateLog(table.table_name, { status: 'done', rows: rows.length });
        } catch (err: any) {
          const msg = err?.message || 'Unknown error';
          errors.push(`${table.table_name}: ${msg}`);
          updateLog(table.table_name, { status: 'error', error: msg });
        }

        completed++;
        setProgress(Math.round((completed / totalTables) * 100));
      }

      if (abortRef.current) {
        toast.info('Exportação cancelada.');
        return;
      }

      // 4. Add metadata
      const metadata = {
        exported_at: new Date().toISOString(),
        total_tables: totalTables,
        tables_exported: completed - errors.length,
        tables_with_errors: errors.length,
        errors,
        table_summary: tables.map(t => {
          const log = logs.find(l => l.table === t.table_name);
          return {
            table: t.table_name,
            estimated_rows: t.estimated_rows,
            exported_rows: log?.rows ?? 'unknown',
          };
        }),
      };
      zip.file('_metadata.json', JSON.stringify(metadata, null, 2));

      // 5. Generate and download ZIP
      setCurrentTable('Gerando arquivo ZIP...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dq-full-backup-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
      toast.success(`Backup completo baixado! (${sizeMB} MB, ${completed - errors.length} tabelas)`);

      if (errors.length > 0) {
        toast.warning(`${errors.length} tabela(s) com erro — veja o log abaixo.`);
      }
    } catch (error: any) {
      console.error('Full export error:', error);
      toast.error('Erro crítico na exportação: ' + (error?.message || 'desconhecido'));
    } finally {
      setExporting(false);
      setCurrentTable('');
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
  };

  const completedCount = logs.filter(l => l.status === 'done').length;
  const errorCount = logs.filter(l => l.status === 'error').length;
  const totalRows = logs.reduce((sum, l) => sum + (l.rows || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Backup Completo do Banco de Dados
        </CardTitle>
        <CardDescription>
          Exporta <strong>todas as tabelas</strong> com schema completo (colunas, indexes, foreign keys) e <strong>todos os dados</strong> em formato JSON, empacotado em um ZIP para disaster recovery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        {logs.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="gap-1">
              <Database className="w-3 h-3" />
              {logs.length} tabelas
            </Badge>
            {completedCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                {completedCount} exportadas
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                {errorCount} erros
              </Badge>
            )}
            {totalRows > 0 && (
              <Badge variant="outline">
                {totalRows.toLocaleString('pt-BR')} registros
              </Badge>
            )}
          </div>
        )}

        {/* Progress */}
        {exporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate max-w-xs">
                {currentTable}
              </span>
              <span className="font-mono text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Log */}
        {logs.length > 0 && (
          <ScrollArea className="h-48 rounded-md border p-3">
            <div className="space-y-1 text-xs font-mono">
              {logs.map(log => (
                <div key={log.table} className="flex items-center gap-2">
                  {log.status === 'pending' && (
                    <span className="w-4 h-4 text-muted-foreground">○</span>
                  )}
                  {log.status === 'exporting' && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  {log.status === 'done' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {log.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                  <span className={log.status === 'error' ? 'text-destructive' : ''}>
                    {log.table}
                  </span>
                  {log.rows !== undefined && (
                    <span className="text-muted-foreground">
                      ({log.rows.toLocaleString('pt-BR')} rows)
                    </span>
                  )}
                  {log.error && (
                    <span className="text-destructive truncate max-w-xs">
                      — {log.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Warning */}
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
          <p>
            <strong>Atenção:</strong> Tabelas grandes (100k+ linhas) podem levar vários minutos.
            O download será um arquivo ZIP com JSONs individuais por tabela + schema completo.
          </p>
          <p className="mt-1 text-muted-foreground">
            Limitação: não inclui auth.users, storage ou funções PL/pgSQL (use o DDL Export para isso).
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            onClick={handleExport}
            disabled={exporting}
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
                Exportar Backup Completo
              </>
            )}
          </Button>
          {exporting && (
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Returns known public table names from the generated Supabase types.
 * This is used as a fallback when we can't query pg_stat_user_tables.
 */
function getKnownTables(): string[] {
  return [
    'admin_notebook_folders',
    'admin_notebook_questions',
    'admin_question_notebooks',
    'ai_config',
    'areas',
    'auth_error_logs',
    'authorized_emails',
    'backup_cronograma_tasks_ghost_fix_20260124',
    'backup_cronograma_tasks_legislacao_to_fundamentos_20260126',
    'backup_duplicate_goals_20260125',
    'backup_duplicate_goals_20260218',
    'backup_duplicate_tasks_20260127',
    'backup_orphan_questions_cleanup_20260124',
    'backup_phantom_notebooks_20260124',
    'backup_study_topics_ghost_fix_20260124',
    'backup_study_topics_source_fix_20260124',
    'backup_topic_goals_ghost_fix_20260124',
    'backup_topic_goals_standardization_20260126',
    'bancas',
    'cronograma_health_daily',
    'cronograma_health_events',
    'discipline_replacement_batches',
    'dissertative_course_disciplines',
    'dissertative_courses',
    'dissertative_exam_contexts',
    'dissertative_modules',
    'dissertative_prompt_templates',
    'dissertative_questions',
    'dissertative_submissions',
    'dissertative_topics',
    'edital_disciplines',
    'edital_topic_bank_mappings',
    'edital_topic_mappings',
    'editals',
    'email_templates',
    'feature_flags',
    'gateway_card_user_access',
    'gateway_cards_config',
    'import_batches',
    'mentor_cronograma_changes',
    'notebook_questions',
    'offer_webhooks',
    'orgaos',
    'pdf_material_folders',
    'pdf_material_topic_links',
    'pdf_material_versions',
    'pdf_materials',
    'platform_config',
    'positions',
    'profiles',
    'provas',
    'provas_if',
    'question_comment_reports',
    'question_comment_votes',
    'question_comments',
    'question_disciplines',
    'question_duplicates',
    'question_error_reports',
    'question_merge_history',
    'question_notes',
    'question_topics',
    'questions',
    'robot_areas',
    'robot_conversations',
    'robot_messages',
    'robots',
    'school_discipline_pending_config',
    'school_disciplines',
    'schools',
    'study_disciplines',
    'study_notebooks',
    'study_topics',
    'subjects',
    'subtopics',
    'token_usage',
    'topic_goals',
    'topic_revisions',
    'topics',
    'trial_registrations',
    'tutorial_video_folders',
    'tutorial_videos',
    'user_answers',
    'user_areas',
    'user_cronograma_tasks',
    'user_cronogramas',
    'user_mentoring_notes',
    'user_pdf_progress',
    'user_performance_reports',
    'user_roles',
    'webhook_email_fields',
    'webhook_logs',
  ];
}
