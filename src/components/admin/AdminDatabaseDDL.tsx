import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Loader2, 
  Database,
  Table,
  Key,
  Shield,
  Zap,
  FileCode
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AdminDatabaseDDL() {
  const [exporting, setExporting] = useState(false);
  const [exportingFull, setExportingFull] = useState(false);
  const [progress, setProgress] = useState('');

  const handleExportDDL = async () => {
    setExporting(true);
    setProgress('Chamando export_functions_and_triggers_ddl...');

    try {
      const { data, error } = await supabase.rpc('export_functions_and_triggers_ddl' as any);

      if (error) throw error;

      const rows = data as { ddl_type: string; object_name: string; ddl_sql: string }[];

      const functions = rows.filter(r => r.ddl_type === 'function');
      const triggers = rows.filter(r => r.ddl_type === 'trigger');

      const ddlParts: string[] = [];
      ddlParts.push('-- ===========================================');
      ddlParts.push('-- DQ QUESTÕES - FUNCTIONS & TRIGGERS DDL');
      ddlParts.push(`-- Generated: ${new Date().toISOString()}`);
      ddlParts.push(`-- Functions: ${functions.length} | Triggers: ${triggers.length}`);
      ddlParts.push('-- ===========================================\n');

      ddlParts.push('-- ===========================================');
      ddlParts.push('-- FUNCTIONS');
      ddlParts.push('-- ===========================================\n');
      for (const fn of functions) {
        ddlParts.push(`-- Function: ${fn.object_name}`);
        ddlParts.push(fn.ddl_sql);
        ddlParts.push('');
      }

      ddlParts.push('\n-- ===========================================');
      ddlParts.push('-- TRIGGERS');
      ddlParts.push('-- ===========================================\n');
      for (const tr of triggers) {
        ddlParts.push(`-- Trigger: ${tr.object_name}`);
        ddlParts.push(tr.ddl_sql);
        ddlParts.push('');
      }

      setProgress('Gerando arquivo...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([ddlParts.join('\n')], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dq-functions-triggers-ddl-${timestamp}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`DDL exportado: ${functions.length} functions + ${triggers.length} triggers`);
      setProgress('');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar DDL');
    } finally {
      setExporting(false);
    }
  };

  const handleExportFullDDL = async () => {
    const backupSecret = prompt('Digite o BACKUP_SECRET para autenticar:');
    if (!backupSecret) return;

    setExportingFull(true);
    setProgress('Gerando DDL completo via edge function...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/export-schema-ddl`, {
        method: 'GET',
        headers: {
          'x-backup-secret': backupSecret,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const ddlContent = await response.text();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([ddlContent], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dq-full-schema-ddl-${timestamp}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const lines = ddlContent.split('\n').length;
      toast.success(`DDL completo exportado: ${lines} linhas (formato pg_dump)`);
      setProgress('');
    } catch (error) {
      console.error('Full DDL export error:', error);
      toast.error('Erro ao exportar DDL completo: ' + (error as Error).message);
    } finally {
      setExportingFull(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="w-5 h-5" />
          Exportação DDL
        </CardTitle>
        <CardDescription>
          Exporta a estrutura do banco como SQL executável no formato pg_dump.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <Database className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">DDL COMPLETO</div>
              <div className="text-xs text-muted-foreground">Tabelas, constraints, indexes, RLS, functions, triggers, views, grants</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <Zap className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">FUNCTIONS & TRIGGERS</div>
              <div className="text-xs text-muted-foreground">Apenas funções e triggers (exportação rápida)</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {progress || 'Pronto para exportar'}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportFullDDL}
              disabled={exporting || exportingFull}
              className="gap-2"
              variant="default"
            >
              {exportingFull ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando DDL...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  DDL Completo (pg_dump)
                </>
              )}
            </Button>
            <Button
              onClick={handleExportDDL}
              disabled={exporting || exportingFull}
              className="gap-2"
              variant="outline"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Functions & Triggers
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
