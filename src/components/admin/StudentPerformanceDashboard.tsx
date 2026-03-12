import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  PieChartIcon,
  Activity,
  Calendar,
  Brain,
  FileDown,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface DisciplineStats {
  name: string;
  total: number;
  correct: number;
}

interface TopicStats {
  name: string;
  discipline: string;
  total: number;
  correct: number;
}

interface NotebookData {
  id: string;
  name: string;
  created_at: string;
  notebook_questions: { count: number }[] | null;
}

interface DailyProgress {
  date: string;
  total: number;
  correct: number;
}

interface StudentPerformanceDashboardProps {
  studentName: string;
  studentEmail: string;
  periodLabel: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracyRate: number;
  disciplineStats: Record<string, DisciplineStats>;
  topicStats: Record<string, TopicStats>;
  notebooksData: NotebookData[];
  dailyProgress: DailyProgress[];
  includeNotebooks: boolean;
}

const COLORS = [
  'hsl(185, 100%, 50%)',
  'hsl(270, 60%, 60%)',
  'hsl(160, 60%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 62%, 45%)',
  'hsl(200, 80%, 50%)',
  'hsl(340, 70%, 55%)',
  'hsl(120, 50%, 45%)',
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
} as const;

const numberVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 15,
    },
  },
};

export function StudentPerformanceDashboard({
  studentName,
  studentEmail,
  periodLabel,
  totalQuestions,
  correctAnswers,
  wrongAnswers,
  accuracyRate,
  disciplineStats,
  topicStats,
  notebooksData,
  dailyProgress,
  includeNotebooks,
}: StudentPerformanceDashboardProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Prepare data for charts
  const pieData = useMemo(() => [
    { name: 'Acertos', value: correctAnswers, color: 'hsl(160, 60%, 45%)' },
    { name: 'Erros', value: wrongAnswers, color: 'hsl(0, 62%, 45%)' },
  ], [correctAnswers, wrongAnswers]);

  const disciplineChartData = useMemo(() => 
    Object.values(disciplineStats)
      .map((d) => ({
        name: d.name.length > 20 ? d.name.substring(0, 17) + '...' : d.name,
        fullName: d.name,
        total: d.total,
        acertos: d.correct,
        erros: d.total - d.correct,
        taxa: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    [disciplineStats]
  );

  const topicChartData = useMemo(() =>
    Object.values(topicStats)
      .map((t) => ({
        name: t.name.length > 25 ? t.name.substring(0, 22) + '...' : t.name,
        fullName: t.name,
        discipline: t.discipline,
        total: t.total,
        acertos: t.correct,
        erros: t.total - t.correct,
        taxa: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    [topicStats]
  );

  const progressChartData = useMemo(() =>
    dailyProgress.map((d) => ({
      date: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
      total: d.total,
      acertos: d.correct,
      taxa: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
    })),
    [dailyProgress]
  );

  // Calculate performance indicators
  const bestDiscipline = useMemo(() => {
    const disciplines = Object.values(disciplineStats).filter(d => d.total >= 5);
    if (disciplines.length === 0) return null;
    return disciplines.reduce((best, curr) => {
      const bestRate = best.total > 0 ? best.correct / best.total : 0;
      const currRate = curr.total > 0 ? curr.correct / curr.total : 0;
      return currRate > bestRate ? curr : best;
    });
  }, [disciplineStats]);

  const worstDiscipline = useMemo(() => {
    const disciplines = Object.values(disciplineStats).filter(d => d.total >= 5);
    if (disciplines.length === 0) return null;
    return disciplines.reduce((worst, curr) => {
      const worstRate = worst.total > 0 ? worst.correct / worst.total : 0;
      const currRate = curr.total > 0 ? curr.correct / curr.total : 0;
      return currRate < worstRate ? curr : worst;
    });
  }, [disciplineStats]);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;

    setIsExporting(true);
    toast.info('Gerando PDF, aguarde...');

    try {
      // Wait a bit for animations to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const element = dashboardRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0a0f1a',
        windowHeight: element.scrollHeight,
        height: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;

      // Calculate how many pages we need
      const scaledImgHeight = imgHeight * ratio;
      const totalPages = Math.ceil(scaledImgHeight / pdfHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          imgData,
          'PNG',
          imgX,
          -(page * pdfHeight),
          imgWidth * ratio,
          imgHeight * ratio
        );
      }

      const fileName = `relatorio_${studentName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);

      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{payload[0]?.payload?.fullName || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (totalQuestions === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Brain className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">Sem dados disponíveis</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Este aluno ainda não respondeu questões no período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Export Button */}
      <div className="sticky top-0 z-10 flex justify-end mb-4 bg-background/80 backdrop-blur-sm py-2">
        <Button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="gap-2"
          variant="outline"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </>
          )}
        </Button>
      </div>

      <ScrollArea className="h-[75vh] pr-4">
        <div ref={dashboardRef} className="bg-background p-4">
          <motion.div
            className="space-y-6 pb-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header */}
            <motion.div variants={itemVariants} className="text-center border-b border-border pb-6">
              <h2 className="text-2xl font-bold text-foreground">{studentName || 'Aluno'}</h2>
              <p className="text-sm text-muted-foreground">{studentEmail}</p>
              <Badge variant="outline" className="mt-2">
                <Calendar className="w-3 h-3 mr-1" />
                {periodLabel}
              </Badge>
            </motion.div>

        {/* Main Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="pt-6 text-center">
              <motion.div variants={numberVariants} className="text-3xl font-bold text-primary">
                {totalQuestions}
              </motion.div>
              <p className="text-sm text-muted-foreground mt-1">Total de Questões</p>
              <BookOpen className="w-5 h-5 mx-auto mt-2 text-primary" />
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6 text-center">
              <motion.div variants={numberVariants} className="text-3xl font-bold text-success">
                {correctAnswers}
              </motion.div>
              <p className="text-sm text-muted-foreground mt-1">Acertos</p>
              <CheckCircle2 className="w-5 h-5 mx-auto mt-2 text-success" />
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6 text-center">
              <motion.div variants={numberVariants} className="text-3xl font-bold text-destructive">
                {wrongAnswers}
              </motion.div>
              <p className="text-sm text-muted-foreground mt-1">Erros</p>
              <XCircle className="w-5 h-5 mx-auto mt-2 text-destructive" />
            </CardContent>
          </Card>

          <Card className="stat-card border-primary/30">
            <CardContent className="pt-6 text-center">
              <motion.div
                variants={numberVariants}
                className={`text-3xl font-bold ${
                  accuracyRate >= 70 ? 'text-success' : accuracyRate >= 50 ? 'text-warning' : 'text-destructive'
                }`}
              >
                {accuracyRate}%
              </motion.div>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Acerto</p>
              <Target className="w-5 h-5 mx-auto mt-2 text-primary" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Accuracy Pie Chart & Performance Highlights */}
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-primary" />
                  Distribuição de Resultados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1000}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="glass-card h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Destaques de Desempenho
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bestDiscipline && (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium text-success">Melhor Desempenho</span>
                    </div>
                    <p className="font-medium text-foreground">{bestDiscipline.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress 
                        value={bestDiscipline.total > 0 ? (bestDiscipline.correct / bestDiscipline.total) * 100 : 0} 
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-medium text-success">
                        {bestDiscipline.total > 0 ? Math.round((bestDiscipline.correct / bestDiscipline.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                )}

                {worstDiscipline && worstDiscipline.name !== bestDiscipline?.name && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">Precisa Atenção</span>
                    </div>
                    <p className="font-medium text-foreground">{worstDiscipline.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress 
                        value={worstDiscipline.total > 0 ? (worstDiscipline.correct / worstDiscipline.total) * 100 : 0} 
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-medium text-destructive">
                        {worstDiscipline.total > 0 ? Math.round((worstDiscipline.correct / worstDiscipline.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                )}

                {Object.keys(disciplineStats).length > 0 && (
                  <div className="text-sm text-muted-foreground pt-2">
                    <span className="font-medium">{Object.keys(disciplineStats).length}</span> disciplinas estudadas
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Progress Over Time */}
        {progressChartData.length > 1 && (
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Evolução no Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressChartData}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(185, 100%, 50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(185, 100%, 50%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAcertos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 20%, 18%)" />
                      <XAxis dataKey="date" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                      <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="Total"
                        stroke="hsl(185, 100%, 50%)"
                        fill="url(#colorTotal)"
                        strokeWidth={2}
                        animationDuration={1500}
                      />
                      <Area
                        type="monotone"
                        dataKey="acertos"
                        name="Acertos"
                        stroke="hsl(160, 60%, 45%)"
                        fill="url(#colorAcertos)"
                        strokeWidth={2}
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Discipline Performance */}
        {disciplineChartData.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Desempenho por Disciplina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={disciplineChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 20%, 18%)" />
                      <XAxis type="number" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                        stroke="hsl(215, 15%, 55%)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="acertos"
                        name="Acertos"
                        stackId="a"
                        fill="hsl(160, 60%, 45%)"
                        radius={[0, 0, 0, 0]}
                        animationDuration={1000}
                      />
                      <Bar
                        dataKey="erros"
                        name="Erros"
                        stackId="a"
                        fill="hsl(0, 62%, 45%)"
                        radius={[0, 4, 4, 0]}
                        animationDuration={1000}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Topic Performance */}
        {topicChartData.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Top 10 Tópicos Mais Estudados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topicChartData.map((topic, index) => (
                    <motion.div
                      key={topic.fullName}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{topic.fullName}</span>
                          <span className={`text-sm font-medium ${
                            topic.taxa >= 70 ? 'text-success' : topic.taxa >= 50 ? 'text-warning' : 'text-destructive'
                          }`}>
                            {topic.taxa}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={topic.taxa} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {topic.acertos}/{topic.total}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Notebooks */}
        {includeNotebooks && notebooksData.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Cadernos de Questões ({notebooksData.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {notebooksData.map((notebook, index) => (
                    <motion.div
                      key={notebook.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <p className="font-medium text-sm truncate">{notebook.name}</p>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {notebook.notebook_questions?.[0]?.count || 0} questões
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(notebook.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div variants={itemVariants} className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          Relatório gerado em {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
        </motion.div>
      </motion.div>
    </div>
  </ScrollArea>
</div>
  );
}
