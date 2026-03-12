import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  Wand2, 
  ArrowRight, 
  FileWarning,
  Image,
  Type,
  Hash,
  Loader2,
  ExternalLink,
  Edit
} from "lucide-react";

interface EnunciadoIssue {
  report_id: string;
  question_id: string;
  code: string;
  discipline_name: string | null;
  discipline_id: string | null;
  details: string;
  question: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  is_active: boolean;
  // Analysis results
  issue_type: 'missing_figure' | 'truncated_text' | 'typo' | 'missing_symbol' | 'missing_item' | 'unknown';
  can_auto_fix: boolean;
  suggested_fix: string | null;
  original_text: string | null;
  fixed_text: string | null;
}

// Patterns for detecting specific issues
const analyzeIssue = (details: string, question: string, options: (string | null)[]): Partial<EnunciadoIssue> => {
  const detailsLower = details.toLowerCase();
  
  // Missing figure/image
  if (detailsLower.includes('figura') || detailsLower.includes('imagem') || detailsLower.includes('foto')) {
    return {
      issue_type: 'missing_figure',
      can_auto_fix: false,
      suggested_fix: 'Questão requer imagem que não foi importada. Considere desativar.',
    };
  }
  
  // Truncated/incomplete text
  if (detailsLower.includes('cortado') || detailsLower.includes('incompleto') || detailsLower.includes('faltando')) {
    return {
      issue_type: 'truncated_text',
      can_auto_fix: false,
      suggested_fix: 'Texto incompleto. Requer revisão manual ou desativação.',
    };
  }
  
  // Item numbering issues (II instead of III, etc.)
  const itemMatch = detailsLower.match(/item\s+(i{1,4}v?|v?i{1,3})/i);
  if (itemMatch || detailsLower.includes('numeração') || detailsLower.includes('item iv') || detailsLower.includes('item iii')) {
    return {
      issue_type: 'missing_item',
      can_auto_fix: false,
      suggested_fix: 'Numeração de itens incorreta. Requer verificação do enunciado original.',
    };
  }
  
  // Typo detection (common patterns)
  if (detailsLower.includes('erro de digitação') || detailsLower.includes('escrit') || detailsLower.includes('carga') || detailsLower.includes('cargo')) {
    // Check for common typos we can detect
    const typoPatterns = [
      { wrong: /\ba carga\b/gi, correct: 'o cargo', field: 'question' },
      { wrong: /\bempresário\b/gi, correct: 'empregado', field: 'question' },
      { wrong: /\bocorre um grupo\b/gi, correct: 'ocorre a posse', field: 'option_c' },
    ];
    
    for (const pattern of typoPatterns) {
      if (question && pattern.wrong.test(question)) {
        return {
          issue_type: 'typo',
          can_auto_fix: true,
          original_text: question.match(pattern.wrong)?.[0] || null,
          fixed_text: pattern.correct,
          suggested_fix: `Substituir "${question.match(pattern.wrong)?.[0]}" por "${pattern.correct}"`,
        };
      }
    }
    
    return {
      issue_type: 'typo',
      can_auto_fix: false,
      suggested_fix: 'Possível erro de digitação detectado. Requer análise manual.',
    };
  }
  
  // Missing symbols (arrows, etc.)
  if (detailsLower.includes('seta') || detailsLower.includes('símbolo') || detailsLower.includes('→') || detailsLower.includes('reação')) {
    return {
      issue_type: 'missing_symbol',
      can_auto_fix: false,
      suggested_fix: 'Símbolos ou setas faltando. Comum em questões de Química/Física.',
    };
  }
  
  // Check alternatives
  if (detailsLower.includes('alternativa')) {
    return {
      issue_type: 'truncated_text',
      can_auto_fix: false,
      suggested_fix: 'Problema nas alternativas reportado.',
    };
  }
  
  return {
    issue_type: 'unknown',
    can_auto_fix: false,
    suggested_fix: 'Problema não categorizado. Requer análise manual.',
  };
};

const issueTypeConfig = {
  missing_figure: { label: 'Figura Faltando', icon: Image, color: 'bg-red-100 text-red-700' },
  truncated_text: { label: 'Texto Incompleto', icon: Type, color: 'bg-orange-100 text-orange-700' },
  typo: { label: 'Erro de Digitação', icon: FileWarning, color: 'bg-yellow-100 text-yellow-700' },
  missing_symbol: { label: 'Símbolo Faltando', icon: Hash, color: 'bg-purple-100 text-purple-700' },
  missing_item: { label: 'Item Faltando', icon: AlertTriangle, color: 'bg-blue-100 text-blue-700' },
  unknown: { label: 'Não Categorizado', icon: AlertTriangle, color: 'bg-gray-100 text-gray-700' },
};

export function AdminEnunciadoAnalysis() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<EnunciadoIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<EnunciadoIssue | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleViewInQuestionBank = (code: string) => {
    navigate(`/admin?tab=questoes&search=${encodeURIComponent(code)}`);
  };

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('question_error_reports')
        .select(`
          id,
          question_id,
          details,
          question:questions!question_error_reports_question_id_fkey(
            id,
            code,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            option_e,
            is_active
          )
        `)
        .eq('error_type', 'enunciado')
        .eq('status', 'pending');

      if (error) throw error;

      // Get disciplines for these questions
      const questionIds = (data || []).map(d => (d.question as any).id);
      
      const { data: disciplines } = await supabase
        .from('question_disciplines')
        .select(`
          question_id,
          study_discipline:study_disciplines!inner(id, name, is_source)
        `)
        .in('question_id', questionIds)
        .is('deleted_at', null);

      // Create discipline map (prefer source disciplines)
      const disciplineMap = new Map<string, { id: string; name: string }>();
      (disciplines || []).forEach(d => {
        const disc = d.study_discipline as any;
        if (disc?.is_source && !disciplineMap.has(d.question_id)) {
          disciplineMap.set(d.question_id, { id: disc.id, name: disc.name });
        }
      });

      // Filter only active questions and analyze issues
      const analyzedIssues: EnunciadoIssue[] = (data || [])
        .filter(d => (d.question as any).is_active)
        .map(d => {
          const q = d.question as any;
          const disc = disciplineMap.get(q.id);
          const analysis = analyzeIssue(
            d.details,
            q.question,
            [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
          );

          return {
            report_id: d.id,
            question_id: q.id,
            code: q.code,
            discipline_name: disc?.name || null,
            discipline_id: disc?.id || null,
            details: d.details,
            question: q.question,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            option_e: q.option_e,
            is_active: q.is_active,
            issue_type: analysis.issue_type || 'unknown',
            can_auto_fix: analysis.can_auto_fix || false,
            suggested_fix: analysis.suggested_fix || null,
            original_text: analysis.original_text || null,
            fixed_text: analysis.fixed_text || null,
          };
        });

      setIssues(analyzedIssues);
    } catch (error) {
      console.error('Error fetching issues:', error);
      toast.error("Erro ao carregar questões com problemas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  // Stats by issue type
  const stats = useMemo(() => {
    const byType = issues.reduce((acc, issue) => {
      acc[issue.issue_type] = (acc[issue.issue_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: issues.length,
      autoFixable: issues.filter(i => i.can_auto_fix).length,
      byType,
    };
  }, [issues]);

  // Group by discipline
  const groupedByDiscipline = useMemo(() => {
    const groups = new Map<string, EnunciadoIssue[]>();
    issues.forEach(issue => {
      const key = issue.discipline_name || 'Sem Disciplina';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(issue);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [issues]);

  const handleAcceptFix = async (issue: EnunciadoIssue) => {
    if (!issue.can_auto_fix || !issue.original_text || !issue.fixed_text) {
      toast.error("Esta questão não pode ser corrigida automaticamente");
      return;
    }

    setProcessingId(issue.report_id);
    try {
      // Apply the fix to the question text
      const fixedQuestion = issue.question.replace(
        new RegExp(issue.original_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        issue.fixed_text
      );

      const { error: updateError } = await supabase
        .from('questions')
        .update({ question: fixedQuestion })
        .eq('id', issue.question_id);

      if (updateError) throw updateError;

      // Mark report as resolved
      const { error: reportError } = await supabase
        .from('question_error_reports')
        .update({
          status: 'resolved',
          admin_notes: `Correção automática aplicada: "${issue.original_text}" → "${issue.fixed_text}"`,
        })
        .eq('id', issue.report_id);

      if (reportError) throw reportError;

      toast.success(`Questão ${issue.code} corrigida!`);
      fetchIssues();
    } catch (error) {
      console.error('Error applying fix:', error);
      toast.error("Erro ao aplicar correção");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeactivate = async (issue: EnunciadoIssue) => {
    setProcessingId(issue.report_id);
    try {
      // Deactivate the question
      const { error: updateError } = await supabase
        .from('questions')
        .update({ is_active: false })
        .eq('id', issue.question_id);

      if (updateError) throw updateError;

      // Mark report as resolved
      const { error: reportError } = await supabase
        .from('question_error_reports')
        .update({
          status: 'resolved',
          admin_notes: `Questão desativada devido a: ${issue.details}`,
        })
        .eq('id', issue.report_id);

      if (reportError) throw reportError;

      toast.success(`Questão ${issue.code} desativada!`);
      fetchIssues();
    } catch (error) {
      console.error('Error deactivating:', error);
      toast.error("Erro ao desativar questão");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (issue: EnunciadoIssue) => {
    setProcessingId(issue.report_id);
    try {
      const { error } = await supabase
        .from('question_error_reports')
        .update({
          status: 'dismissed',
          admin_notes: 'Relatório descartado pelo admin - não procede.',
        })
        .eq('id', issue.report_id);

      if (error) throw error;

      toast.success("Relatório descartado");
      fetchIssues();
    } catch (error) {
      console.error('Error dismissing:', error);
      toast.error("Erro ao descartar relatório");
    } finally {
      setProcessingId(null);
    }
  };

  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-orange-500" />
              Análise de Enunciados Reportados
            </CardTitle>
            <CardDescription>
              {stats.total} questões ativas com problemas de enunciado reportados
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchIssues} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-4">
          <div className="bg-slate-100 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-slate-700">{stats.total}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-green-600">{stats.autoFixable}</div>
            <div className="text-xs text-green-500">Auto-corrigível</div>
          </div>
          {Object.entries(issueTypeConfig).map(([type, config]) => (
            <div key={type} className={`rounded-lg p-2 text-center ${config.color.replace('text-', 'bg-').replace('-700', '-50')}`}>
              <div className={`text-xl font-bold ${config.color.split(' ')[1]}`}>
                {stats.byType[type] || 0}
              </div>
              <div className={`text-xs ${config.color.split(' ')[1].replace('-700', '-500')}`}>
                {config.label.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Analisando questões...
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            Nenhuma questão ativa com problema de enunciado pendente
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {groupedByDiscipline.map(([disciplineName, disciplineIssues]) => (
              <AccordionItem key={disciplineName} value={disciplineName}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{disciplineName}</span>
                    <Badge variant="secondary">{disciplineIssues.length}</Badge>
                    {disciplineIssues.some(i => i.can_auto_fix) && (
                      <Badge className="bg-green-100 text-green-700">
                        <Wand2 className="h-3 w-3 mr-1" />
                        {disciplineIssues.filter(i => i.can_auto_fix).length} auto-corrigível
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Código</TableHead>
                          <TableHead className="w-[120px]">Tipo</TableHead>
                          <TableHead>Problema Reportado</TableHead>
                          <TableHead className="w-[200px]">Correção Sugerida</TableHead>
                          <TableHead className="text-right w-[180px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disciplineIssues.map((issue) => {
                          const TypeConfig = issueTypeConfig[issue.issue_type];
                          const TypeIcon = TypeConfig.icon;
                          const isProcessing = processingId === issue.report_id;

                          return (
                            <TableRow key={issue.report_id}>
                              <TableCell>
                                <span className="font-mono text-sm">{issue.code}</span>
                              </TableCell>
                              <TableCell>
                                <Badge className={`gap-1 ${TypeConfig.color}`}>
                                  <TypeIcon className="h-3 w-3" />
                                  <span className="hidden sm:inline">{TypeConfig.label.split(' ')[0]}</span>
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {issue.details.slice(0, 80)}{issue.details.length > 80 ? '...' : ''}
                              </TableCell>
                              <TableCell>
                                {issue.can_auto_fix ? (
                                  <div className="text-xs space-y-1">
                                    <div className="flex items-center gap-1 text-red-600 line-through">
                                      {issue.original_text}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <ArrowRight className="h-3 w-3 text-green-600" />
                                      <span className="text-green-600 font-medium">{issue.fixed_text}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {issue.suggested_fix?.slice(0, 50)}...
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedIssue(issue)}
                                    title="Ver detalhes"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewInQuestionBank(issue.code)}
                                    title="Editar no Banco de Questões"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {issue.can_auto_fix && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleAcceptFix(issue)}
                                      disabled={isProcessing}
                                      className="text-green-600 hover:text-green-700"
                                      title="Aplicar correção"
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <CheckCircle className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeactivate(issue)}
                                    disabled={isProcessing}
                                    className="text-red-600 hover:text-red-700"
                                    title="Desativar questão"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Análise: {selectedIssue?.code}
                {selectedIssue && (
                  <Badge className={issueTypeConfig[selectedIssue.issue_type].color}>
                    {issueTypeConfig[selectedIssue.issue_type].label}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedIssue?.discipline_name || 'Sem disciplina'}
              </DialogDescription>
            </DialogHeader>

            {selectedIssue && (
              <div className="space-y-4 py-4">
                {/* Problem reported */}
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Problema Reportado:</span>
                  <p className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {selectedIssue.details}
                  </p>
                </div>

                {/* Suggested fix */}
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Análise:</span>
                  <p className="mt-1 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    {selectedIssue.suggested_fix}
                  </p>
                </div>

                {/* Before/After for auto-fixable */}
                {selectedIssue.can_auto_fix && selectedIssue.original_text && selectedIssue.fixed_text && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-red-600">Antes:</span>
                      <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm line-through">{selectedIssue.original_text}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-green-600">Depois:</span>
                      <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium">{selectedIssue.fixed_text}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Question preview */}
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Enunciado Atual:</span>
                  <ScrollArea className="h-[200px] mt-1 p-3 bg-slate-50 border rounded-lg">
                    <div 
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedIssue.question }}
                    />
                  </ScrollArea>
                </div>

                {/* Options */}
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Alternativas:</span>
                  <div className="mt-1 space-y-1">
                    {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                      const optKey = `option_${letter.toLowerCase()}` as keyof EnunciadoIssue;
                      const opt = selectedIssue[optKey];
                      if (!opt) return null;
                      return (
                        <div key={letter} className="flex gap-2 text-sm p-2 bg-slate-50 rounded">
                          <span className="font-bold text-slate-500">{letter})</span>
                          <span dangerouslySetInnerHTML={{ __html: String(opt).slice(0, 200) }} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Links */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewInQuestionBank(selectedIssue.code)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Editar no Admin
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/banco-questoes?search=${selectedIssue.code}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver no Banco
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSelectedIssue(null)}>
                Fechar
              </Button>
              <Button
                variant="outline"
                onClick={() => selectedIssue && handleDismiss(selectedIssue)}
                disabled={processingId === selectedIssue?.report_id}
              >
                Descartar Relatório
              </Button>
              {selectedIssue?.can_auto_fix && (
                <Button
                  onClick={() => selectedIssue && handleAcceptFix(selectedIssue)}
                  disabled={processingId === selectedIssue.report_id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processingId === selectedIssue.report_id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Aplicar Correção
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => selectedIssue && handleDeactivate(selectedIssue)}
                disabled={processingId === selectedIssue?.report_id}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Desativar Questão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
