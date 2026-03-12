import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO, isAfter, isBefore, isEqual, startOfDay } from "date-fns";
import { cronogramaLogger } from "@/lib/cronograma/cronogramaLogger";

// ============ CONSTANTS ============
// CORREÇÃO WDRR: Teto por ciclo = MIN_TASK_BLOCK para distribuição PROPORCIONAL
// Antes era 60, forçando 60min/disciplina/ciclo mesmo com cargas desiguais.
// Com 30, cada "slot" é atômico e a disciplina com mais carga ganha mais slots.
const MIN_TASK_BLOCK = 30;          // Bloco mínimo de 30 min (TAMBÉM usado como teto por ciclo)
const MAX_DISCIPLINE_PER_CYCLE = MIN_TASK_BLOCK;  // 30min por alocação - força granularidade
const REVISION_DURATION = 30;       // Revisões sempre 30 min
const DEFAULT_QUESTIONS_PER_HOUR = 10; // Valor padrão: 10 questões/hora = 6 min/questão
const MIN_GOAL_DURATION = 30;       // Mínimo 30 min para uma meta

// ============ LIMITES POR TÓPICO ============
const MAX_CONSECUTIVE_DAYS_PER_TOPIC = 2;  // Máximo de dias consecutivos para um tópico
const MIN_REST_DAYS_AFTER_CONSECUTIVE = 2; // Dias de descanso obrigatório após consecutivos

// ============ LIMITES DE SEGURANÇA ============
const MAX_CYCLES_PER_DAY = 20;      // Segurança: máximo de ciclos por dia para evitar loops infinitos

// ============ INTERFACES ============
interface GoalToSchedule {
  goalId: string;
  topicId: string;
  disciplineId: string;
  disciplineName: string;
  topicName: string;
  goalName: string;
  totalDuration: number;
  remainingDuration: number;
  goalType: string | null;
  /** display_order da meta no banco (quando existir) */
  displayOrder?: number | null;
  /** display_order do tópico no banco (definido no AdminDisciplines) */
  topicDisplayOrder?: number | null;
}

interface ScheduledTask {
  cronograma_id: string;
  user_id: string;
  goal_id: string | null;
  source_topic_id: string | null;
  scheduled_date: string;
  duration_minutes: number;
  is_revision: boolean;
  revision_number: number | null;
  part_number: number | null;
  total_parts: number | null;
}

interface DayAllocation {
  date: string;
  totalMinutes: number;
  usedMinutes: number;
  disciplineTime: Map<string, number>; // disciplineId -> minutes used today
  tasks: ScheduledTask[];
}

interface RevisionConfig {
  topicId: string;
  revisionDays: number[];
}

interface TopicCompletion {
  topicId: string;
  completionDate: string;
}

// Interface para controle de cooldown por tópico
interface TopicCooldownTracker {
  consecutiveDays: number;       // Quantos dias consecutivos este tópico já apareceu
  lastScheduledDate: string | null; // Última data em que o tópico foi agendado
  cooldownUntil: string | null;  // Data até quando o tópico está em cooldown (inclusive)
}

// ============ HELPER FUNCTIONS ============

/**
 * Arredonda para múltiplos de 30 minutos
 * 
 * CORREÇÃO CRÍTICA: Usar Math.floor para NUNCA estourar o limite disponível
 * Exemplo anterior (BUG): 45min → 60min (estourava o dia/ciclo)
 * Agora: 45min → 30min (respeita limites)
 */
function roundToValidBlock(minutes: number): number {
  // Abaixo de 30 minutos → não agenda (bloco mínimo não atingido)
  if (minutes < MIN_TASK_BLOCK) return 0;
  // Arredondar para BAIXO para nunca exceder o disponível
  return Math.floor(minutes / MIN_TASK_BLOCK) * MIN_TASK_BLOCK;
}

/**
 * Compacta tarefas equivalentes dentro de um dia.
 * 
 * CORREÇÃO IMPORTANTE: As tarefas chegam INTERCALADAS pelo WDRR (ex: Física, Português, Física...).
 * Por isso, primeiro agrupamos por chave (goal_id + source_topic_id + is_revision + revision_number)
 * e depois consolidamos cada grupo em uma única tarefa.
 * 
 * REGRA: Tarefas são "equivalentes" e podem ser unificadas quando:
 * - Mesmo scheduled_date
 * - Mesmo goal_id (ou ambas null para revisões)
 * - Mesmo source_topic_id (para revisões sem goal_id)
 * - Mesmo is_revision e revision_number (não misturar revisão com estudo)
 * 
 * O resultado: soma duration_minutes e reseta part_number/total_parts para 1/1
 */
function compactDayTasks(tasks: ScheduledTask[]): ScheduledTask[] {
  if (tasks.length <= 1) return tasks;
  
  // Agrupar por chave de equivalência (não precisa ser consecutivo!)
  const groups = new Map<string, ScheduledTask[]>();
  const groupOrder: string[] = []; // Para manter ordem de primeira aparição
  
  for (const task of tasks) {
    // Chave composta: goal_id + source_topic_id + revision status
    const key = `${task.goal_id ?? 'NULL'}|${task.source_topic_id ?? 'NULL'}|${task.is_revision}|${task.revision_number ?? 'NULL'}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key)!.push(task);
  }
  
  // Consolidar cada grupo em uma única tarefa
  const result: ScheduledTask[] = [];
  
  for (const key of groupOrder) {
    const groupTasks = groups.get(key)!;
    
    if (groupTasks.length === 1) {
      // Única tarefa - manter como está mas resetar part_number se existir
      const task = { ...groupTasks[0] };
      task.part_number = 1;
      task.total_parts = 1;
      result.push(task);
    } else {
      // Múltiplas tarefas - consolidar
      const first = { ...groupTasks[0] };
      const totalDuration = groupTasks.reduce((sum, t) => sum + t.duration_minutes, 0);
      
      first.duration_minutes = totalDuration;
      first.part_number = 1;
      first.total_parts = 1;
      result.push(first);
    }
  }
  
  // Log se houve compactação
  if (result.length < tasks.length) {
    console.log(`[compactDayTasks] Compacted ${tasks.length} tasks into ${result.length} for date ${tasks[0]?.scheduled_date}`);
  }
  
  return result;
}

/**
 * Compacta todas as tarefas agrupando por dia primeiro
 */
function compactAllTasks(tasks: ScheduledTask[]): ScheduledTask[] {
  if (tasks.length === 0) return [];
  
  // Agrupar por data
  const byDate = new Map<string, ScheduledTask[]>();
  for (const task of tasks) {
    const dateKey = task.scheduled_date;
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey)!.push(task);
  }
  
  // Compactar cada dia e juntar resultado
  const result: ScheduledTask[] = [];
  const sortedDates = Array.from(byDate.keys()).sort();
  
  for (const date of sortedDates) {
    const dayTasks = byDate.get(date)!;
    const compacted = compactDayTasks(dayTasks);
    result.push(...compacted);
  }
  
  const totalBefore = tasks.length;
  const totalAfter = result.length;
  if (totalAfter < totalBefore) {
    console.log(`[compactAllTasks] Total compaction: ${totalBefore} → ${totalAfter} tasks (${totalBefore - totalAfter} merged)`);
  }
  
  return result;
}

/**
 * Aloca tempo respeitando limites do CICLO e dia
 * NOTA: O limite agora é POR CICLO, não por dia. Múltiplos ciclos podem ocorrer no mesmo dia.
 * 
 * CORREÇÃO: Clamp final para garantir que nunca exceda limites originais
 */
function allocateTimeForCycle(
  goalRemainingMinutes: number,
  dayRemainingMinutes: number,
  disciplineTimeUsedThisCycle: number
): number {
  const disciplineRemainingThisCycle = Math.max(0, MAX_DISCIPLINE_PER_CYCLE - disciplineTimeUsedThisCycle);
  const maxPossible = Math.min(goalRemainingMinutes, dayRemainingMinutes, disciplineRemainingThisCycle);
  const rounded = roundToValidBlock(maxPossible);
  // CLAMP final: nunca pode exceder os limites originais após arredondamento
  return Math.min(rounded, dayRemainingMinutes, disciplineRemainingThisCycle);
}

/**
 * Define prioridade de tipo de meta dentro do tópico.
 * Regra: estudo (pdf/vídeo/teoria etc.) antes de questões.
 */
function goalTypeRank(goalType: string | null | undefined): number {
  if (goalType === "questions") return 1;
  if (goalType === "review") return 2;
  return 0;
}

/**
 * Mapeia dia da semana para TODOS os códigos usados no sistema.
 * Retorna tanto o código PT ("seg") quanto o EN ("monday") para compatibilidade
 * entre o formulário do aluno (PT) e o formulário do admin (EN).
 */
function getDayCodes(date: Date): string[] {
  const ptCodes = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const enCodes = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIndex = date.getDay();
  return [ptCodes[dayIndex], enCodes[dayIndex]];
}

/**
 * Agrupa metas por tópico dentro de cada disciplina
 * Retorna: Map<disciplineId, Array<Array<GoalToSchedule>>> onde cada array interno
 * representa todas as metas de um tópico (já ordenadas: estudo antes de questões)
 */
function groupGoalsByTopic(goalsByDiscipline: Map<string, GoalToSchedule[]>): Map<string, GoalToSchedule[][]> {
  const result = new Map<string, GoalToSchedule[][]>();

  for (const [disciplineId, goals] of goalsByDiscipline) {
    // Agrupar por tópico, preservando a ordem dos tópicos (conforme goals já ordenados)
    const topicGroups = new Map<string, GoalToSchedule[]>();
    const topicOrder: string[] = [];

    for (const goal of goals) {
      if (!topicGroups.has(goal.topicId)) {
        topicGroups.set(goal.topicId, []);
        topicOrder.push(goal.topicId);
      }
      topicGroups.get(goal.topicId)!.push(goal);
    }

    // Dentro do tópico: forçar regra estudo -> questões (independente do display_order cadastrado)
    const groupedGoals: GoalToSchedule[][] = topicOrder.map((topicId) => {
      const list = [...(topicGroups.get(topicId) || [])];
      list.sort((a, b) => {
        const typeCmp = goalTypeRank(a.goalType) - goalTypeRank(b.goalType);
        if (typeCmp !== 0) return typeCmp;

        const aOrder = a.displayOrder ?? 9999;
        const bOrder = b.displayOrder ?? 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;

        const nameCmp = a.goalName.localeCompare(b.goalName);
        if (nameCmp !== 0) return nameCmp;
        return a.goalId.localeCompare(b.goalId);
      });
      return list;
    });

    result.set(disciplineId, groupedGoals);
  }

  return result;
}

/**
 * Cria lista intercalada de metas por disciplina, agrupando por TÓPICO.
 * Intercala tópicos entre disciplinas, e dentro de cada tópico mantém a ordem
 * (estudo antes de questões).
 * Ex: D1-Tópico1-Estudo, D1-Tópico1-Questões, D2-Tópico1-Estudo, D2-Tópico1-Questões,
 *     D1-Tópico2-Estudo, D1-Tópico2-Questões, D2-Tópico2-Estudo, D2-Tópico2-Questões...
 */
function interleaveGoals(goalsByDiscipline: Map<string, GoalToSchedule[]>): GoalToSchedule[] {
  const interleaved: GoalToSchedule[] = [];
  const disciplineIds = Array.from(goalsByDiscipline.keys());
  
  if (disciplineIds.length === 0) return [];
  
  // Agrupar metas por tópico para cada disciplina
  const groupedByTopic = groupGoalsByTopic(goalsByDiscipline);
  
  // Encontra o máximo de TÓPICOS em qualquer disciplina
  let maxTopics = 0;
  for (const topicGroups of groupedByTopic.values()) {
    maxTopics = Math.max(maxTopics, topicGroups.length);
  }
  
  // Intercalar por TÓPICO (não por meta individual)
  for (let topicIndex = 0; topicIndex < maxTopics; topicIndex++) {
    for (const disciplineId of disciplineIds) {
      const topicGroups = groupedByTopic.get(disciplineId) || [];
      if (topicIndex < topicGroups.length) {
        // Adiciona TODAS as metas do tópico (estudo + questões) na ordem correta
        for (const goal of topicGroups[topicIndex]) {
          interleaved.push(goal);
        }
      }
    }
  }
  
  return interleaved;
}

// ============ MAIN GENERATOR CLASS ============

export class CronogramaTaskGenerator {
  private cronogramaId: string;
  private userId: string;
  private schoolId: string;
  private startDate: string;
  private endDate: string | null;
  private availableDays: string[];
  private defaultHoursPerDay: number;
  private selectedDisciplines: string[];
  private hoursPerWeekday: Record<string, number>;
  private disciplineOrder: string[];
  private selectedTopics: Record<string, string[]>;
  private topicOrder: Record<string, string[]>;

  // Constante para fallback de horas diárias
  private static readonly DEFAULT_HOURS_PER_DAY = 2;

  constructor(cronograma: {
    id: string;
    user_id: string;
    school_id: string;
    start_date: string;
    end_date: string | null;
    available_days: string[];
    hours_per_day?: number; // Campo legado, pode não existir
    selected_disciplines: string[];
    hours_per_weekday?: Record<string, number>;
    discipline_order?: string[];
    selected_topics?: Record<string, string[]>;
    topic_order?: Record<string, string[]>;
  }) {
    this.cronogramaId = cronograma.id;
    this.userId = cronograma.user_id;
    this.schoolId = cronograma.school_id;
    this.startDate = cronograma.start_date;
    this.endDate = cronograma.end_date;
    this.availableDays = cronograma.available_days || [];
    
    // CORREÇÃO: Calcular default hours a partir de hours_per_weekday se disponível
    // Caso contrário, usar hours_per_day legado ou fallback de 2h
    const weekdayHours = cronograma.hours_per_weekday || {};
    const weekdayValues = Object.values(weekdayHours).filter((v): v is number => typeof v === 'number' && v > 0);
    if (weekdayValues.length > 0) {
      // Usar a média das horas configuradas por dia
      this.defaultHoursPerDay = weekdayValues.reduce((a, b) => a + b, 0) / weekdayValues.length;
    } else {
      this.defaultHoursPerDay = cronograma.hours_per_day || CronogramaTaskGenerator.DEFAULT_HOURS_PER_DAY;
    }
    
    this.selectedDisciplines = cronograma.selected_disciplines || [];
    this.hoursPerWeekday = weekdayHours;
    // CORREÇÃO: Sempre usar selected_disciplines como fonte de verdade
    // discipline_order pode conter UUIDs fantasmas de disciplinas antigas
    this.disciplineOrder = cronograma.selected_disciplines || [];
    this.selectedTopics = cronograma.selected_topics || {};
    this.topicOrder = cronograma.topic_order || {};
  }

  /**
   * Busca questions_per_hour por disciplina
   */
  private async fetchDisciplineQuestionsPerHour(): Promise<Map<string, number>> {
    const { data: disciplines, error } = await supabase
      .from("study_disciplines")
      .select("id, questions_per_hour")
      .in("id", this.selectedDisciplines);

    if (error) {
      console.error("Error fetching discipline questions_per_hour:", error);
      return new Map();
    }

    const qphMap = new Map<string, number>();
    for (const disc of disciplines || []) {
      // Use configured value or default (10 questions/hour)
      qphMap.set(disc.id, disc.questions_per_hour || DEFAULT_QUESTIONS_PER_HOUR);
    }
    return qphMap;
  }

  /**
   * Busca contagem de questões por tópico E o discipline_id de cada tópico
   */
  private async fetchQuestionCountsByTopic(): Promise<{ counts: Map<string, number>; topicToDiscipline: Map<string, string> }> {
    // Buscar tópicos das disciplinas selecionadas
    const { data: topics, error: topicsError } = await supabase
      .from("study_topics")
      .select("id, study_discipline_id")
      .in("study_discipline_id", this.selectedDisciplines)
      .eq("is_active", true);

    if (topicsError || !topics || topics.length === 0) {
      console.error("Error fetching topics for question counts:", topicsError);
      return { counts: new Map(), topicToDiscipline: new Map() };
    }

    const topicIds = topics.map(t => t.id);
    const topicToDiscipline = new Map<string, string>();
    for (const t of topics) {
      topicToDiscipline.set(t.id, t.study_discipline_id);
    }
    
    // Buscar contagem de questões por tópico
    const { data: counts, error: countsError } = await supabase
      .rpc("get_topic_question_counts", { topic_ids: topicIds });

    if (countsError) {
      console.error("Error fetching question counts:", countsError);
      return { counts: new Map(), topicToDiscipline };
    }

    const countMap = new Map<string, number>();
    for (const item of counts || []) {
      countMap.set(item.topic_id, Number(item.question_count) || 0);
    }
    return { counts: countMap, topicToDiscipline };
  }

  /**
   * Calcula duração baseada no número de questões do tópico e questions_per_hour da disciplina
   */
  private calculateDurationFromQuestions(
    questionCount: number, 
    questionsPerHour: number = DEFAULT_QUESTIONS_PER_HOUR
  ): number {
    if (questionCount === 0) return 0;
    
    // Calcula minutos por questão baseado no questions_per_hour da disciplina
    const minutesPerQuestion = 60 / questionsPerHour;
    
    // Arredondar para múltiplos de 30
    let durationMinutes = Math.ceil(questionCount * minutesPerQuestion);
    durationMinutes = Math.max(durationMinutes, MIN_GOAL_DURATION);
    durationMinutes = Math.ceil(durationMinutes / 30) * 30;
    return durationMinutes;
  }

  /**
   * Busca todas as metas dos tópicos das disciplinas selecionadas.
   * NOVA LÓGICA: Usa herança dinâmica - tópicos derivados (pós-edital) herdam automaticamente
   * as metas dos tópicos fonte (pré-edital) quando não têm metas próprias.
   * IMPORTANTE: Se duration_minutes for null, calcula baseado nas questões do tópico e questions_per_hour da disciplina
   */
  private async fetchGoals(): Promise<GoalToSchedule[]> {
    // PRIMEIRO: Buscar contagem de questões para TODOS os tópicos
    const { counts: questionCounts, topicToDiscipline } = await this.fetchQuestionCountsByTopic();
    
    // Buscar questions_per_hour de cada disciplina
    const disciplineQPH = await this.fetchDisciplineQuestionsPerHour();
    
    // Buscar todos os tópicos das disciplinas selecionadas (para obter source_topic_id)
    const { data: allTopics, error: topicsError } = await supabase
      .from("study_topics")
      .select("id, name, study_discipline_id, source_topic_id")
      .in("study_discipline_id", this.selectedDisciplines)
      .eq("is_active", true);
    
    if (topicsError) {
      console.error("Error fetching topics:", topicsError);
      throw topicsError;
    }
    
    const topicIds = (allTopics || []).map(t => t.id);
    
    if (topicIds.length === 0) {
      console.log("No topics found for selected disciplines");
      return [];
    }
    
    // Usar a nova função RPC que implementa herança dinâmica de metas
    const { data: goalsWithInheritance, error: goalsError } = await supabase
      .rpc("get_topic_goals_with_inheritance", { p_topic_ids: topicIds });
    
    if (goalsError) {
      console.error("Error fetching goals with inheritance:", goalsError);
      throw goalsError;
    }
    
    const goals: GoalToSchedule[] = (goalsWithInheritance || []).map((goal: any) => {
      const topicId = goal.topic_id;
      const disciplineId = goal.discipline_id;
      // Para metas herdadas, usar a contagem de questões do tópico derivado, não do fonte
      const questionCount = questionCounts.get(topicId) || 0;
      const questionsPerHour = disciplineQPH.get(disciplineId) || DEFAULT_QUESTIONS_PER_HOUR;

      const isQuestionsGoal = goal.goal_type === "questions";
      const isInherited = goal.is_inherited;

      // Para metas de QUESTÕES, o tempo é calculado a partir do nº de questões e questions_per_hour
      let duration = goal.duration_minutes as number | null | undefined;

      if (isQuestionsGoal) {
        let computed = this.calculateDurationFromQuestions(questionCount, questionsPerHour);
        
        // Cap de 600min removido - duração integral calculada dinamicamente
        
        if (goal.duration_minutes !== null && goal.duration_minutes !== undefined && computed !== goal.duration_minutes) {
          console.log(
            `Goal "${goal.goal_name}" duration overridden: ${goal.duration_minutes} -> ${computed} (questions=${questionCount}, qph=${questionsPerHour})`
          );
        }
        duration = computed;
      } else if (duration === null || duration === undefined) {
        duration = this.calculateDurationFromQuestions(questionCount, questionsPerHour);
        console.log(
          `Goal "${goal.goal_name}" has no duration, calculated ${duration} min from ${questionCount} questions at ${questionsPerHour} q/h`
        );
      }
      
      if (isInherited) {
        console.log(`[INHERITANCE] Goal "${goal.goal_name}" inherited from source topic for derived topic "${goal.topic_name}"`);
      }
      
      return {
        goalId: goal.goal_id,
        topicId: topicId,
        disciplineId: disciplineId,
        disciplineName: goal.discipline_name,
        topicName: goal.topic_name,
        goalName: goal.goal_name,
        totalDuration: duration,
        remainingDuration: duration,
        goalType: goal.goal_type,
        displayOrder: goal.display_order ?? null,
        topicDisplayOrder: goal.topic_display_order ?? 0,
      };
    });

    // Verificar quais tópicos têm metas (diretas ou herdadas)
    const topicsWithGoals = new Set(goals.map(g => g.topicId));
    const inheritedCount = (goalsWithInheritance || []).filter((g: any) => g.is_inherited).length;
    
    console.log(`Found ${goals.length} goals from ${topicsWithGoals.size} topics (${inheritedCount} inherited from source topics)`);


    // --- Filtrar: respeitar tópicos selecionados ---
    // Regra: somente metas de "questions" dependem de haver questões no tópico.
    // Metas de PDF / vídeo / teoria etc. devem aparecer mesmo se o tópico tiver 0 questões.
    const selectedTopicIds = new Set(Object.values(this.selectedTopics || {}).flat());
    const hasSelection = selectedTopicIds.size > 0;

    const filteredGoals = goals.filter((g) => {
      const isQuestionsGoal = g.goalType === "questions";
      const count = questionCounts.get(g.topicId) || 0;

      // Excluir metas de questões sem questões
      if (isQuestionsGoal && count <= 0) return false;

      // Excluir metas com duração inválida (ex.: 0)
      if (!g.totalDuration || g.totalDuration <= 0) return false;

      // Respeitar seleção de tópicos
      if (hasSelection && !selectedTopicIds.has(g.topicId)) return false;

      return true;
    });

    // Ordenar por disciplina (usando selected_disciplines como fonte de verdade), tópico e tipo de meta
    // Regra: estudo (pdf/vídeo/teoria) antes de questões.
    filteredGoals.sort((a, b) => {
      // CORREÇÃO: Usar SEMPRE selected_disciplines (discipline_order pode ter UUIDs fantasmas)
      const orderArray = this.selectedDisciplines;
      const discOrderA = orderArray.indexOf(a.disciplineId);
      const discOrderB = orderArray.indexOf(b.disciplineId);
      const discOrder = (discOrderA === -1 ? 999 : discOrderA) - (discOrderB === -1 ? 999 : discOrderB);
      if (discOrder !== 0) return discOrder;

      // PRIORIDADE 1: Usar topicOrder do cronograma se disponível (ordem definida pelo aluno/mentor)
      const topicOrderForDiscipline = this.topicOrder[a.disciplineId] || [];
      if (topicOrderForDiscipline.length > 0) {
        const topicOrderA = topicOrderForDiscipline.indexOf(a.topicId);
        const topicOrderB = topicOrderForDiscipline.indexOf(b.topicId);
        const topicOrderCmp = (topicOrderA === -1 ? 999 : topicOrderA) - (topicOrderB === -1 ? 999 : topicOrderB);
        if (topicOrderCmp !== 0) return topicOrderCmp;
      }

      // PRIORIDADE 2: Usar topicDisplayOrder do banco (ordem definida no AdminDisciplines)
      const topicDisplayOrderA = a.topicDisplayOrder ?? 9999;
      const topicDisplayOrderB = b.topicDisplayOrder ?? 9999;
      if (topicDisplayOrderA !== topicDisplayOrderB) {
        return topicDisplayOrderA - topicDisplayOrderB;
      }

      // Fallback: Garantir agrupamento por tópico por nome
      const topicNameCmp = a.topicName.localeCompare(b.topicName);
      if (topicNameCmp !== 0) return topicNameCmp;
      const topicIdCmp = a.topicId.localeCompare(b.topicId);
      if (topicIdCmp !== 0) return topicIdCmp;

      // Dentro do MESMO tópico: estudo antes de questões
      const typeCmp = goalTypeRank(a.goalType) - goalTypeRank(b.goalType);
      if (typeCmp !== 0) return typeCmp;

      // Dentro do mesmo tipo: respeitar display_order da meta quando existir
      const aOrder = a.displayOrder ?? 9999;
      const bOrder = b.displayOrder ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      // Desempate determinístico
      const nameCmp = a.goalName.localeCompare(b.goalName);
      if (nameCmp !== 0) return nameCmp;
      return a.goalId.localeCompare(b.goalId);
    });

    // Log total estimated time
    const totalMinutes = filteredGoals.reduce((sum, g) => sum + g.totalDuration, 0);
    console.log(`Generated ${filteredGoals.length} goals with ${(totalMinutes / 60).toFixed(1)} hours total (${goals.length - filteredGoals.length} excluded)`);

    return filteredGoals;
  }

  /**
   * Busca tarefas já concluídas para cálculo de tempo restante
   */
  private async fetchCompletedTasks(): Promise<Map<string, number>> {
    const { data, error } = await supabase
      .from("user_cronograma_tasks")
      .select("goal_id, duration_minutes")
      .eq("cronograma_id", this.cronogramaId)
      .eq("is_completed", true)
      .not("goal_id", "is", null);

    if (error) {
      console.error("Error fetching completed tasks:", error);
      return new Map();
    }

    const completedTimeByGoal = new Map<string, number>();
    for (const task of data || []) {
      if (task.goal_id) {
        const current = completedTimeByGoal.get(task.goal_id) || 0;
        completedTimeByGoal.set(task.goal_id, current + task.duration_minutes);
      }
    }
    return completedTimeByGoal;
  }

  /**
   * Busca configurações de revisão por tópico
   */
  private async fetchRevisionConfigs(): Promise<Map<string, number[]>> {
    const { data, error } = await supabase
      .from("topic_revisions")
      .select("topic_id, revision_1_days, revision_2_days, revision_3_days, revision_4_days, revision_5_days, revision_6_days")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching revision configs:", error);
      return new Map();
    }

    const configs = new Map<string, number[]>();
    for (const rev of data || []) {
      const days: number[] = [];
      if (rev.revision_1_days) days.push(rev.revision_1_days);
      if (rev.revision_2_days) days.push(rev.revision_2_days);
      if (rev.revision_3_days) days.push(rev.revision_3_days);
      if (rev.revision_4_days) days.push(rev.revision_4_days);
      if (rev.revision_5_days) days.push(rev.revision_5_days);
      if (rev.revision_6_days) days.push(rev.revision_6_days);
      if (days.length > 0) {
        configs.set(rev.topic_id, days);
      }
    }
    return configs;
  }

  /**
   * Gera lista de datas disponíveis baseado na configuração
   * IMPORTANTE: Sempre gera dias suficientes para TODAS as metas, ignorando endDate aqui.
   * O corte por endDate é feito DEPOIS da alocação completa.
   */
  private generateAvailableDates(fromDate: Date, maxDays: number = 730): DayAllocation[] {
    const days: DayAllocation[] = [];
    let currentDate = fromDate;
    const end = addDays(fromDate, maxDays); // Sempre gerar até 2 anos

    while (isBefore(currentDate, end) || isEqual(currentDate, end)) {
      const dayCodes = getDayCodes(currentDate);
      
      if (dayCodes.some(code => this.availableDays.includes(code))) {
        // Encontrar qual código corresponde ao formato usado
        const matchedCode = dayCodes.find(code => this.availableDays.includes(code)) || dayCodes[0];
        // Usa horas específicas do dia ou padrão
        const hoursForDay = this.hoursPerWeekday[matchedCode] ?? this.defaultHoursPerDay;
        // Evitar flutuações de float quando o usuário usa frações (ex.: 0.5)
        const minutesForDay = Math.round(hoursForDay * 60);
        
        days.push({
          date: format(currentDate, "yyyy-MM-dd"),
          totalMinutes: minutesForDay,
          usedMinutes: 0,
          disciplineTime: new Map(),
          tasks: [],
        });
      }
      
      currentDate = addDays(currentDate, 1);
      
      // Limite de segurança
      if (days.length >= maxDays) break;
    }

    return days;
  }

  /**
   * Algoritmo principal de alocação integrado: revisões têm prioridade sobre tarefas normais.
   * Para cada dia, primeiro aloca revisões agendadas, depois tarefas normais.
   */
  /**
   * Algoritmo principal de alocação integrado: Weighted Deficit Round-Robin.
   * 
   * MUDANÇA PRINCIPAL: Substituímos o Round-Robin igualitário por um algoritmo
   * que considera o "trabalho restante" de cada disciplina para decidir qual
   * recebe tempo a seguir. Isso evita que disciplinas pequenas "desapareçam"
   * cedo enquanto as grandes ficam sobrando para o final.
   * 
   * Mecânica:
   * - Cada disciplina acumula "crédito" proporcional ao seu trabalho restante
   * - A disciplina com mais crédito é selecionada para receber tempo
   * - Ao alocar, o crédito é "gasto" proporcionalmente ao tempo alocado
   * - Isso força a frequência de aparição ser proporcional à carga total
   */
  private allocateTasksWithRevisions(
    goals: GoalToSchedule[],
    days: DayAllocation[],
    completedTime: Map<string, number>,
    revisionConfigs: Map<string, number[]>
  ): { tasks: ScheduledTask[]; revisionTasks: ScheduledTask[] } {
    const allNormalTasks: ScheduledTask[] = [];
    const allRevisionTasks: ScheduledTask[] = [];
    const goalParts = new Map<string, { parts: ScheduledTask[]; totalDuration: number }>();

    // Revisões pendentes: topicId -> lista de {revisionNumber, idealDate}
    const pendingRevisions: Map<string, { revisionNumber: number; idealDate: string }[]> = new Map();

    // ============ COOLDOWN TRACKER POR TÓPICO ============
    const topicCooldown: Map<string, TopicCooldownTracker> = new Map();
    
    const initCooldownTracker = (topicId: string) => {
      if (!topicCooldown.has(topicId)) {
        topicCooldown.set(topicId, {
          consecutiveDays: 0,
          lastScheduledDate: null,
          cooldownUntil: null,
        });
      }
    };

    // Verifica se uma data é consecutiva a outra (diferença de 1 dia)
    const isConsecutiveDay = (prevDate: string, currentDate: string): boolean => {
      const prev = parseISO(prevDate);
      const curr = parseISO(currentDate);
      const nextDay = addDays(prev, 1);
      return format(nextDay, "yyyy-MM-dd") === currentDate;
    };

    // Verifica se o tópico está em cooldown para uma data específica
    const isTopicInCooldown = (topicId: string, date: string): boolean => {
      const tracker = topicCooldown.get(topicId);
      if (!tracker || !tracker.cooldownUntil) return false;
      return date <= tracker.cooldownUntil;
    };

    // Atualiza o tracker após alocar tarefa para um tópico
    const updateCooldownAfterAllocation = (topicId: string, date: string) => {
      initCooldownTracker(topicId);
      const tracker = topicCooldown.get(topicId)!;
      
      // Se é o mesmo dia, não incrementa contador (múltiplas tarefas no mesmo dia)
      if (tracker.lastScheduledDate === date) {
        return;
      }
      
      // Se é dia consecutivo, incrementa contador
      if (tracker.lastScheduledDate && isConsecutiveDay(tracker.lastScheduledDate, date)) {
        tracker.consecutiveDays++;
      } else {
        // Não é consecutivo - reseta contador
        tracker.consecutiveDays = 1;
        tracker.cooldownUntil = null;
      }
      
      tracker.lastScheduledDate = date;
      
      // Se atingiu o limite de dias consecutivos, entra em cooldown
      if (tracker.consecutiveDays >= MAX_CONSECUTIVE_DAYS_PER_TOPIC) {
        const cooldownEnd = addDays(parseISO(date), MIN_REST_DAYS_AFTER_CONSECUTIVE);
        tracker.cooldownUntil = format(cooldownEnd, "yyyy-MM-dd");
        console.log(
          `[COOLDOWN] Tópico "${topicId}" entrou em cooldown até ${tracker.cooldownUntil} (${tracker.consecutiveDays}/${MAX_CONSECUTIVE_DAYS_PER_TOPIC} dias consecutivos)`
        );
      }
    };

    // Reseta o cooldown quando o gap natural já passou
    const checkAndResetCooldown = (topicId: string, date: string) => {
      const tracker = topicCooldown.get(topicId);
      if (!tracker) return;
      
      // Se a data atual é após o cooldownUntil, reseta
      if (tracker.cooldownUntil && date > tracker.cooldownUntil) {
        tracker.consecutiveDays = 0;
        tracker.cooldownUntil = null;
      }
      
      // Se houve gap natural de 2+ dias, também reseta
      if (tracker.lastScheduledDate) {
        const lastDate = parseISO(tracker.lastScheduledDate);
        const currentDate = parseISO(date);
        const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > MIN_REST_DAYS_AFTER_CONSECUTIVE) {
          tracker.consecutiveDays = 0;
          tracker.cooldownUntil = null;
        }
      }
    };

    // Ajustar tempo restante baseado no que já foi concluído
    for (const goal of goals) {
      const completed = completedTime.get(goal.goalId) || 0;
      goal.remainingDuration = Math.max(0, goal.totalDuration - completed);
    }

    // Organizar metas por disciplina (mantendo a ordem que veio de fetchGoals)
    const goalsByDiscipline = new Map<string, GoalToSchedule[]>();
    for (const goal of goals) {
      if (goal.remainingDuration <= 0) continue;
      const existing = goalsByDiscipline.get(goal.disciplineId) || [];
      existing.push(goal);
      goalsByDiscipline.set(goal.disciplineId, existing);
    }

    // CORREÇÃO CRÍTICA: Usar SEMPRE selected_disciplines como fonte de verdade
    // discipline_order pode estar desatualizado (com UUIDs fantasmas de disciplinas antigas)
    // Filtrar apenas disciplinas que existem E têm goals
    const disciplineIds = this.selectedDisciplines.filter((id) => goalsByDiscipline.has(id));
    
    // Log de debug para identificar disciplinas faltantes
    const missingDisciplines = this.selectedDisciplines.filter((id) => !goalsByDiscipline.has(id));
    if (missingDisciplines.length > 0) {
      console.warn(
        `[GEN] Disciplinas sem metas: ${missingDisciplines.join(", ")}. ` +
        `Verifique se os tópicos têm goals configurados.`
      );
    }

    // Transformar metas em "blocos" por TÓPICO (POR DISCIPLINA).
    // Regra forte: dentro de um tópico, só pode executar a próxima meta na sequência
    // (estudo -> questões). E, ao terminar o estudo, as questões vêm imediatamente
    // na próxima oportunidade dessa disciplina (não podem "se perder" no cronograma).
    type TopicBlock = {
      disciplineId: string;
      topicId: string;
      goals: GoalToSchedule[];
      cursor: number; // índice da próxima meta do tópico a executar
    };

    const groupedByTopic = groupGoalsByTopic(goalsByDiscipline);

    // Fila de tópicos POR DISCIPLINA (isso evita que, ao bater 120min/dia, o tópico vá
    // para o fim de uma fila global e só volte meses depois).
    const disciplineQueues = new Map<string, TopicBlock[]>();
    for (const disciplineId of disciplineIds) {
      const topicGroups = groupedByTopic.get(disciplineId) || [];
      const blocks: TopicBlock[] = [];
      for (const tg of topicGroups) {
        if (!tg || tg.length === 0) continue;
        blocks.push({
          disciplineId,
          topicId: tg[0].topicId,
          goals: tg,
          cursor: 0,
        });
        // Inicializa tracker de cooldown para cada tópico
        initCooldownTracker(tg[0].topicId);
      }
      disciplineQueues.set(disciplineId, blocks);
    }

    // Para validação pós-geração (garantia para qualquer escola/edital)
    const topicGoalOrderIndex = new Map<string, Map<string, number>>();
    for (const blocks of disciplineQueues.values()) {
      for (const block of blocks) {
        const idxMap = new Map<string, number>();
        block.goals.forEach((g, idx) => idxMap.set(g.goalId, idx));
        topicGoalOrderIndex.set(block.topicId, idxMap);
      }
    }

    const completedTopics = new Set<string>();

    const getCurrentGoal = (block: TopicBlock): GoalToSchedule | null => {
      while (block.cursor < block.goals.length && block.goals[block.cursor].remainingDuration <= 0) {
        block.cursor++;
      }
      if (block.cursor >= block.goals.length) return null;
      return block.goals[block.cursor];
    };

    const scheduleRevisionsForTopic = (topicId: string, completionDateStr: string) => {
      if (completedTopics.has(topicId)) return;
      completedTopics.add(topicId);

      const config = revisionConfigs.get(topicId);
      if (!config || config.length === 0) return;

      const completionDate = parseISO(completionDateStr);
      const revisions: { revisionNumber: number; idealDate: string }[] = [];
      for (let i = 0; i < config.length; i++) {
        const revDate = addDays(completionDate, config[i]);
        revisions.push({
          revisionNumber: i + 1,
          idealDate: format(revDate, "yyyy-MM-dd"),
        });
      }
      pendingRevisions.set(topicId, revisions);
    };

    const hasNormalWorkLeft = () => {
      for (const disciplineId of disciplineIds) {
        const q = disciplineQueues.get(disciplineId);
        if (q && q.length > 0) return true;
      }
      return false;
    };

    // ============ WEIGHTED DEFICIT ROUND-ROBIN: PRÉ-COMPUTAÇÃO ============
    // Computar trabalho restante por disciplina (1x antes do loop de dias)
    const remainingByDiscipline = new Map<string, number>();
    let totalRemaining = 0;

    for (const discId of disciplineIds) {
      let sum = 0;
      const queue = disciplineQueues.get(discId) || [];
      for (const block of queue) {
        for (let i = block.cursor; i < block.goals.length; i++) {
          sum += block.goals[i].remainingDuration;
        }
      }
      remainingByDiscipline.set(discId, sum);
      totalRemaining += sum;
    }

    // Créditos para weighted scheduling (persistem entre ciclos/dias)
    const credit = new Map<string, number>();
    for (const discId of disciplineIds) {
      credit.set(discId, 0);
    }
    
    // Tie-breaker rotation (substitui roundRobinIndex/dailyStartIndex)
    let lastPickIdx = 0;

    // Processar dia a dia
    for (const day of days) {
      const dayRemaining = () => day.totalMinutes - day.usedMinutes;

      // ========== FASE 1: ALOCAR REVISÕES PARA ESTE DIA (PRIORIDADE) ==========
      const revisionsForToday: { topicId: string; revisionNumber: number }[] = [];

      for (const [topicId, revisions] of pendingRevisions) {
        for (const rev of revisions) {
          if (rev.idealDate <= day.date) {
            revisionsForToday.push({ topicId, revisionNumber: rev.revisionNumber });
          }
        }
      }

      revisionsForToday.sort((a, b) => a.revisionNumber - b.revisionNumber);

      for (const rev of revisionsForToday) {
        if (dayRemaining() < REVISION_DURATION) break;

        const task: ScheduledTask = {
          cronograma_id: this.cronogramaId,
          user_id: this.userId,
          goal_id: null,
          source_topic_id: rev.topicId,
          scheduled_date: day.date,
          duration_minutes: REVISION_DURATION,
          is_revision: true,
          revision_number: rev.revisionNumber,
          part_number: null,
          total_parts: null,
        };

        allRevisionTasks.push(task);
        day.tasks.push(task);
        day.usedMinutes += REVISION_DURATION;

        // Remover esta revisão da lista pendente
        const topicRevisions = pendingRevisions.get(rev.topicId);
        if (topicRevisions) {
          const idx = topicRevisions.findIndex(
            (r) => r.revisionNumber === rev.revisionNumber && r.idealDate <= day.date
          );
          if (idx !== -1) {
            topicRevisions.splice(idx, 1);
            if (topicRevisions.length === 0) {
              pendingRevisions.delete(rev.topicId);
            }
          }
        }
      }

      // ========== FASE 2: WDRR PROPORCIONAL (SEM CICLOS FORÇADOS) ==========
      // CORREÇÃO: Removemos a lógica de "ciclos com teto de 60min por disciplina".
      // Agora cada slot de 30min é alocado para a disciplina com maior score WDRR.
      // O crédito persiste durante TODO o dia (não reseta por ciclo).
      
      let slotCount = 0;
      const maxSlotsPerDay = Math.ceil(day.totalMinutes / MIN_TASK_BLOCK) + 10; // Segurança
      let consecutiveSkips = 0;
      
      // Obter disciplinas ativas (com queue e trabalho restante)
      const getActiveDisciplines = () => disciplineIds.filter(id => {
        const queue = disciplineQueues.get(id);
        const remaining = remainingByDiscipline.get(id) || 0;
        return queue && queue.length > 0 && remaining > 0;
      });
      
      let activeDisciplines = getActiveDisciplines();
      
      if (activeDisciplines.length === 0) {
        console.log(`[GEN] Dia ${day.date}: Sem disciplinas ativas, pulando`);
      }
      
      const maxConsecutiveSkips = Math.max(activeDisciplines.length * 4, 20);
      
      // Loop principal: aloca 1 slot por iteração
      while (dayRemaining() >= MIN_TASK_BLOCK && slotCount < maxSlotsPerDay && consecutiveSkips < maxConsecutiveSkips) {
        slotCount++;
        
        // Atualizar lista de disciplinas ativas
        activeDisciplines = getActiveDisciplines();
        if (activeDisciplines.length === 0) break;
        
        // WDRR: Adicionar crédito proporcional ao trabalho restante (ANTES de escolher)
        // O crédito acumula ao longo do dia, garantindo proporcionalidade
        for (const discId of activeDisciplines) {
          const rem = remainingByDiscipline.get(discId) || 0;
          if (rem <= 0) continue;
          
          // Peso = proporção do trabalho restante desta disciplina
          const w = rem / Math.max(1, totalRemaining);
          credit.set(discId, (credit.get(discId) || 0) + w);
        }
          
        // Selecionar disciplina com maior score WDRR (crédito acumulado)
        // Candidato deve: ter queue, ter tópico elegível (cooldown), poder alocar >=30
        let bestDisc: string | null = null;
        let bestScore = -Infinity;
        let bestAlloc = 0;
        let bestBlockIndex = -1;
        let bestGoalRef: GoalToSchedule | null = null;
        
        // Iterar em ordem rotacionada para evitar empates sempre pro mesmo
        for (let i = 0; i < activeDisciplines.length; i++) {
          const idx = (lastPickIdx + i) % activeDisciplines.length;
          const discId = activeDisciplines[idx];
          
          const queue = disciplineQueues.get(discId);
          if (!queue || queue.length === 0) continue;
          
          // Verificar se disciplina tem apenas 1 tópico (relaxar cooldown)
          const disciplineHasSingleTopic = queue.length === 1;
          
          // Procurar próximo tópico elegível (não em cooldown)
          let eligibleBlockIndex = -1;
          
          for (let j = 0; j < queue.length; j++) {
            const block = queue[j];
            checkAndResetCooldown(block.topicId, day.date);
            
            // Se disciplina tem apenas 1 tópico, ignora cooldown
            if (disciplineHasSingleTopic) {
              eligibleBlockIndex = j;
              break;
            }
            
            // Verificar se tópico está em cooldown
            if (!isTopicInCooldown(block.topicId, day.date)) {
              eligibleBlockIndex = j;
              break;
            }
          }
          
          // Se nenhum tópico elegível e ainda há tópicos, relaxar regra
          if (eligibleBlockIndex === -1 && queue.length > 0) {
            eligibleBlockIndex = 0;
          }
          
          if (eligibleBlockIndex === -1) continue;
          
          const block = queue[eligibleBlockIndex];
          const goal = getCurrentGoal(block);
          
          if (!goal || !goal.goalId) {
            // Avançar cursor/shift para evitar task órfã
            if (goal && !goal.goalId) {
              console.warn(`[BUG-PREVENTION] Goal sem goalId: "${goal.goalName}" - pulando`);
              block.cursor++;
            }
            if (!getCurrentGoal(block)) {
              queue.splice(eligibleBlockIndex, 1);
            }
            continue;
          }
          
          // Verificar quanto poderia alocar (bloco fixo de 30min)
          const goalRemaining = goal.remainingDuration;
          const dayRem = dayRemaining();
          const alloc = Math.min(MIN_TASK_BLOCK, goalRemaining, dayRem);
          if (alloc < MIN_TASK_BLOCK) continue;
          
          const score = credit.get(discId) || 0;
          if (score > bestScore) {
            bestScore = score;
            bestDisc = discId;
            bestAlloc = alloc; // Sempre 30min (ou menos se é o fim da meta)
            bestBlockIndex = eligibleBlockIndex;
            bestGoalRef = goal;
          }
        }
        
        if (bestDisc === null || bestGoalRef === null) {
          // Nenhuma alocação elegível encontrada nesta iteração
          consecutiveSkips++;
          cronogramaLogger.timeBlockSkipped(dayRemaining(), "no eligible discipline/topic (cooldown/limits)");
          continue;
        }
        
        // Executar alocação para bestDisc
        consecutiveSkips = 0;
        lastPickIdx = (activeDisciplines.indexOf(bestDisc) + 1) % activeDisciplines.length;
        
        // Mover tópico elegível para frente da fila se necessário
        const queue = disciplineQueues.get(bestDisc)!;
        if (bestBlockIndex > 0) {
          const [eligibleBlock] = queue.splice(bestBlockIndex, 1);
          queue.unshift(eligibleBlock);
        }
        
        const block = queue[0];
        const currentGoal = bestGoalRef;
        
        const task: ScheduledTask = {
          cronograma_id: this.cronogramaId,
          user_id: this.userId,
          goal_id: currentGoal.goalId,
          source_topic_id: currentGoal.topicId,
          scheduled_date: day.date,
          duration_minutes: bestAlloc,
          is_revision: false,
          revision_number: null,
          part_number: null,
          total_parts: null,
        };
        
        day.tasks.push(task);
        day.usedMinutes += bestAlloc;
        day.disciplineTime.set(bestDisc, (day.disciplineTime.get(bestDisc) || 0) + bestAlloc);
        
        // Atualizar remaining
        currentGoal.remainingDuration -= bestAlloc;
        remainingByDiscipline.set(bestDisc, (remainingByDiscipline.get(bestDisc) || 0) - bestAlloc);
        totalRemaining -= bestAlloc;
        
        // Gastar crédito proporcional ao slot alocado
        // Disciplinas com mais carga terão mais crédito acumulado, então gastarão mais
        const creditSpent = 1; // Cada slot custa 1 crédito
        credit.set(bestDisc, (credit.get(bestDisc) || 0) - creditSpent);
        
        // Atualizar tracker de cooldown após alocação
        updateCooldownAfterAllocation(block.topicId, day.date);
        
        // Rastrear partes por meta
        if (!goalParts.has(currentGoal.goalId)) {
          goalParts.set(currentGoal.goalId, { parts: [], totalDuration: currentGoal.totalDuration });
        }
        goalParts.get(currentGoal.goalId)!.parts.push(task);
        
        // Se completou a meta, avança dentro do tópico (mantendo estudo -> questões colado)
        if (currentGoal.remainingDuration <= 0) {
          block.cursor++;
          
          // Se o tópico acabou, remove o bloco e agenda revisões
          if (!getCurrentGoal(block)) {
            queue.shift();
            scheduleRevisionsForTopic(block.topicId, day.date);
          }
        }
      }
      
      // Log de diagnóstico para o dia com breakdown por disciplina
      const allocatedMinutes = day.usedMinutes;
      const configuredMinutes = day.totalMinutes;
      const fillPercentage = configuredMinutes > 0 ? Math.round((allocatedMinutes / configuredMinutes) * 100) : 0;
      
      // Breakdown por disciplina
      const discBreakdown: string[] = [];
      for (const [discId, mins] of day.disciplineTime) {
        const discName = goals.find(g => g.disciplineId === discId)?.disciplineName || discId.slice(0, 8);
        discBreakdown.push(`${discName}:${mins}min`);
      }
      
      if (allocatedMinutes < configuredMinutes) {
        const remaining = configuredMinutes - allocatedMinutes;
        if (remaining >= MIN_TASK_BLOCK && hasNormalWorkLeft()) {
          console.warn(`[GEN-WARNING] Dia ${day.date}: ${allocatedMinutes}/${configuredMinutes}min (${fillPercentage}%) [${discBreakdown.join(', ')}] - ${remaining}min não alocados`);
        } else if (remaining >= MIN_TASK_BLOCK) {
          console.log(`[GEN] Dia ${day.date}: ${allocatedMinutes}/${configuredMinutes}min (${fillPercentage}%) [${discBreakdown.join(', ')}] - goals esgotados`);
        } else {
          console.log(`[GEN] Dia ${day.date}: ${allocatedMinutes}/${configuredMinutes}min (${fillPercentage}%) [${discBreakdown.join(', ')}]`);
        }
      } else {
        console.log(`[GEN] Dia ${day.date}: ${allocatedMinutes}/${configuredMinutes}min (${fillPercentage}%) [${discBreakdown.join(', ')}] - ${slotCount} slots`);
      }

      // Se não há mais blocos e não há revisões pendentes, pode encerrar
      if (!hasNormalWorkLeft() && pendingRevisions.size === 0) {
        break;
      }
    }

    // Atualizar part_number e total_parts
    for (const [, data] of goalParts) {
      const totalParts = data.parts.length;
      if (totalParts > 1) {
        data.parts.forEach((task, index) => {
          task.part_number = index + 1;
          task.total_parts = totalParts;
        });
      }
    }

    // Coletar todas as tarefas normais
    for (const day of days) {
      for (const task of day.tasks) {
        if (!task.is_revision) {
          allNormalTasks.push(task);
        }
      }
    }

    // Validação: garante que, dentro do tópico, as metas seguem a ordem (estudo -> questões)
    const byDate = [...allNormalTasks].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    const lastSeenIndexByTopic = new Map<string, number>();
    const orderingViolations: { topicId: string; goalId: string; prevIndex: number; newIndex: number }[] = [];

    for (const task of byDate) {
      const topicId = task.source_topic_id || "";
      const goalId = task.goal_id;
      if (!topicId || !goalId) continue;

      const idxMap = topicGoalOrderIndex.get(topicId);
      const idx = idxMap?.get(goalId);
      if (idx === undefined) continue;

      const last = lastSeenIndexByTopic.get(topicId) ?? -1;
      if (idx < last) {
        orderingViolations.push({ topicId, goalId, prevIndex: last, newIndex: idx });
      } else {
        lastSeenIndexByTopic.set(topicId, idx);
      }
    }

    if (orderingViolations.length > 0) {
      console.warn(
        `[CronogramaTaskGenerator] Detected ${orderingViolations.length} ordering violations (topic study->questions). Sample:`,
        orderingViolations.slice(0, 5)
      );
    }

    // Log revisões não alocadas
    if (pendingRevisions.size > 0) {
      let totalPending = 0;
      for (const revs of pendingRevisions.values()) {
        totalPending += revs.length;
      }
      console.log(`Warning: ${totalPending} revisions could not be allocated within available days`);
    }

    return { tasks: allNormalTasks, revisionTasks: allRevisionTasks };
  }

  /**
   * Compacta revisões finais quando todas as metas normais já foram alocadas
   * e restam apenas revisões espalhadas com gaps de mais de 2 dias disponíveis
   */
  private compactFinalRevisions(
    normalTasks: ScheduledTask[],
    revisionTasks: ScheduledTask[],
    days: DayAllocation[]
  ): ScheduledTask[] {
    if (revisionTasks.length === 0) return revisionTasks;

    // 1. Encontrar a última data com tarefa normal
    const normalDates = normalTasks.map(t => t.scheduled_date).sort();
    const lastNormalDate = normalDates.length > 0 ? normalDates[normalDates.length - 1] : null;

    if (!lastNormalDate) {
      // Se não há tarefas normais, não há o que compactar
      return revisionTasks;
    }

    // 2. Separar revisões: antes/durante tarefas normais vs após última tarefa normal
    const revisionsBeforeOrDuring: ScheduledTask[] = [];
    const revisionsAfterNormal: ScheduledTask[] = [];

    for (const rev of revisionTasks) {
      if (rev.scheduled_date <= lastNormalDate) {
        revisionsBeforeOrDuring.push(rev);
      } else {
        revisionsAfterNormal.push(rev);
      }
    }

    // Se não há revisões após as tarefas normais, nada a compactar
    if (revisionsAfterNormal.length === 0) {
      return revisionTasks;
    }

    // 3. Ordenar revisões após normal por data original
    revisionsAfterNormal.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    // 4. Obter dias disponíveis após a última tarefa normal
    const availableDaysAfterNormal = days
      .filter(d => d.date > lastNormalDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (availableDaysAfterNormal.length === 0) {
      return revisionTasks;
    }

    // 5. Verificar se há gaps de mais de 2 dias disponíveis consecutivos sem tarefas
    const datesWithRevisions = new Set(revisionsAfterNormal.map(r => r.scheduled_date));
    let consecutiveEmptyDays = 0;
    let hasSignificantGap = false;

    for (const day of availableDaysAfterNormal) {
      if (!datesWithRevisions.has(day.date)) {
        consecutiveEmptyDays++;
        if (consecutiveEmptyDays > 2) {
          hasSignificantGap = true;
          break;
        }
      } else {
        consecutiveEmptyDays = 0;
      }
    }

    // Se não há gaps significativos, manter revisões originais
    if (!hasSignificantGap) {
      console.log("No significant gaps found in final revisions, keeping original schedule");
      return revisionTasks;
    }

    // 6. Compactar: reagendar revisões para dias consecutivos disponíveis
    console.log(`Compacting ${revisionsAfterNormal.length} final revisions (gap detected after ${lastNormalDate})`);

    // Agrupar revisões por data original para manter ordem
    const compactedRevisions: ScheduledTask[] = [];
    let dayIndex = 0;

    // Processar revisões na ordem cronológica original
    for (const revision of revisionsAfterNormal) {
      if (dayIndex >= availableDaysAfterNormal.length) {
        // Não há mais dias disponíveis, manter data original
        compactedRevisions.push(revision);
        continue;
      }

      // Atribuir ao próximo dia disponível consecutivo
      const newDate = availableDaysAfterNormal[dayIndex].date;
      
      // Verificar se já há muitas revisões neste dia (limite de tempo)
      const revisionsOnThisDay = compactedRevisions.filter(r => r.scheduled_date === newDate);
      const timeUsedOnDay = revisionsOnThisDay.reduce((sum, r) => sum + r.duration_minutes, 0);
      const dayTotalMinutes = availableDaysAfterNormal[dayIndex].totalMinutes;

      if (timeUsedOnDay + revision.duration_minutes <= dayTotalMinutes) {
        // Cabe neste dia
        compactedRevisions.push({
          ...revision,
          scheduled_date: newDate,
        });
      } else {
        // Dia cheio, avançar para próximo
        dayIndex++;
        if (dayIndex < availableDaysAfterNormal.length) {
          compactedRevisions.push({
            ...revision,
            scheduled_date: availableDaysAfterNormal[dayIndex].date,
          });
        } else {
          // Não há mais dias, manter original
          compactedRevisions.push(revision);
        }
      }
    }

    // Avançar para próximo dia após cada conjunto de revisões do mesmo dia original
    // (para garantir distribuição, não colocar tudo num dia só)
    // Já está implícito no algoritmo acima que respeita o limite de tempo

    const oldLastDate = revisionsAfterNormal[revisionsAfterNormal.length - 1].scheduled_date;
    const newLastDate = compactedRevisions.length > 0 
      ? compactedRevisions.sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0].scheduled_date
      : oldLastDate;
    
    console.log(`Compaction result: ${oldLastDate} -> ${newLastDate} (saved ${
      Math.round((parseISO(oldLastDate).getTime() - parseISO(newLastDate).getTime()) / (1000 * 60 * 60 * 24))
    } days)`);

    return [...revisionsBeforeOrDuring, ...compactedRevisions];
  }

  /**
   * Deleta tarefas não concluídas para recálculo
   */
  private async deleteUncompletedTasks(): Promise<void> {
    const { error } = await supabase
      .from("user_cronograma_tasks")
      .delete()
      .eq("cronograma_id", this.cronogramaId)
      .eq("is_completed", false);

    if (error) {
      console.error("Error deleting uncompleted tasks:", error);
      throw error;
    }
  }

  /**
   * Insere tarefas no banco de dados, evitando duplicatas com tarefas existentes.
   * 
   * A constraint uq_cronograma_task_identity impede duplicatas baseadas em:
   * (cronograma_id, goal_id, scheduled_date, revision_number, part_number)
   * 
   * Este método busca apenas tarefas COMPLETADAS no período relevante para evitar conflitos.
   * Tarefas pendentes já foram deletadas antes de chamar este método.
   * 
   * Race conditions são tratadas graciosamente - erros de constraint são logados e ignorados.
   */
  private async insertTasks(tasks: ScheduledTask[]): Promise<void> {
    if (tasks.length === 0) return;

    // Determinar o range de datas das tarefas a inserir para otimizar a query
    const taskDates = tasks.map(t => t.scheduled_date).sort();
    const minDate = taskDates[0];
    const maxDate = taskDates[taskDates.length - 1];

    // 1. Buscar apenas tarefas COMPLETADAS no período relevante para evitar duplicatas
    // Pendentes já foram deletadas, então só precisamos evitar conflito com completadas
    let query = supabase
      .from("user_cronograma_tasks")
      .select("goal_id, scheduled_date, revision_number, part_number")
      .eq("cronograma_id", this.cronogramaId)
      .eq("is_completed", true)
      .not("goal_id", "is", null)
      .gte("scheduled_date", minDate)
      .lte("scheduled_date", maxDate);

    const { data: existingTasks, error: fetchError } = await query;

    if (fetchError) {
      console.error("[insertTasks] Error fetching existing completed tasks for dedup:", fetchError);
      // Não abortar - continuar sem dedup (pior caso: constraint error tratado abaixo)
    }

    // 2. Criar set de chaves existentes para O(1) lookup
    const existingKeys = new Set(
      (existingTasks || []).map(t => 
        `${t.goal_id}|${t.scheduled_date}|${t.revision_number ?? 0}|${t.part_number ?? 1}`
      )
    );

    // 3. Filtrar novas tarefas que não conflitam
    const tasksToInsert = tasks.filter(task => {
      const key = `${task.goal_id}|${task.scheduled_date}|${task.revision_number ?? 0}|${task.part_number ?? 1}`;
      return !existingKeys.has(key);
    });

    const skipped = tasks.length - tasksToInsert.length;
    if (skipped > 0) {
      console.log(`[insertTasks] Skipped ${skipped} duplicate tasks (conflict with completed)`);
    }

    if (tasksToInsert.length === 0) {
      console.log("[insertTasks] No new tasks to insert after deduplication");
      return;
    }

    // 4. Inserir em lotes de 100, tratando race conditions graciosamente
    const batchSize = 100;
    let insertedCount = 0;
    let conflictCount = 0;

    for (let i = 0; i < tasksToInsert.length; i += batchSize) {
      const batch = tasksToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from("user_cronograma_tasks")
        .insert(batch);

      if (error) {
        // Verificar se é erro de constraint de unicidade (race condition)
        const isUniqueConstraintError = 
          error.code === "23505" || 
          error.message?.includes("uq_cronograma_task_identity") ||
          error.message?.includes("duplicate key");

        if (isUniqueConstraintError) {
          // Race condition: outra transação inseriu antes. Logar e continuar.
          console.warn(`[insertTasks] Batch ${i / batchSize + 1}: Duplicate key conflict (race condition), continuing...`);
          conflictCount += batch.length;
          continue;
        }

        // Outro erro - logar mas não abortar o recálculo
        console.error(`[insertTasks] Batch ${i / batchSize + 1}: Error inserting tasks:`, error);
        // Para outros erros, ainda tentamos continuar para não perder todo o progresso
        continue;
      }

      insertedCount += batch.length;
    }

    console.log(`[insertTasks] Summary: ${insertedCount} inserted, ${skipped} pre-filtered, ${conflictCount} conflict-skipped`);
  }

  /**
   * Executa a geração completa de tarefas
   */
  async generate(): Promise<{ 
    success: boolean; 
    tasksCreated: number; 
    tasksExcluded?: number;
    minutesExcluded?: number;
    estimatedEndDate?: string; 
    error?: string 
  }> {
    try {
      // 1. Buscar dados necessários
      const [goals, completedTime, revisionConfigs] = await Promise.all([
        this.fetchGoals(),
        this.fetchCompletedTasks(),
        this.fetchRevisionConfigs(),
      ]);

      if (goals.length === 0) {
        return { success: false, tasksCreated: 0, error: "Nenhuma meta encontrada para as disciplinas selecionadas" };
      }

      // 2. Gerar dias disponíveis a partir de hoje (SEMPRE gera dias suficientes para TODAS as metas)
      const startDate = parseISO(this.startDate);
      const today = new Date();
      const effectiveStart = isAfter(today, startDate) ? today : startDate;
      const days = this.generateAvailableDates(effectiveStart);

      if (days.length === 0) {
        return { success: false, tasksCreated: 0, error: "Nenhum dia disponível configurado" };
      }

      // 3. Deletar tarefas não concluídas (recálculo)
      await this.deleteUncompletedTasks();

      // 4. Alocar tarefas normais E revisões de forma integrada (revisões têm prioridade)
      const { tasks, revisionTasks } = this.allocateTasksWithRevisions(goals, days, completedTime, revisionConfigs);

      // 5. Compactar revisões finais (quando só restam revisões após última tarefa normal)
      const compactedRevisions = this.compactFinalRevisions(tasks, revisionTasks, days);

      // 6. Combinar todas as tarefas e COMPACTAR blocos fragmentados
      let allTasks = compactAllTasks([...tasks, ...compactedRevisions]);
      
      // 7. Se há data final definida, CORTAR tarefas além dela
      let tasksExcluded = 0;
      let minutesExcluded = 0;
      
      if (this.endDate) {
        const endDateStr = this.endDate;
        const tasksWithinDate = allTasks.filter(t => t.scheduled_date <= endDateStr);
        const tasksOutsideDate = allTasks.filter(t => t.scheduled_date > endDateStr);
        
        tasksExcluded = tasksOutsideDate.length;
        minutesExcluded = tasksOutsideDate.reduce((sum, t) => sum + t.duration_minutes, 0);
        
        if (tasksExcluded > 0) {
          console.log(`Cutting ${tasksExcluded} tasks (${(minutesExcluded / 60).toFixed(1)}h) beyond end date ${endDateStr}`);
        }
        
        allTasks = tasksWithinDate;
      }

      // 8. Inserir tarefas que cabem no período
      await this.insertTasks(allTasks);

      // 9. Calcular data final estimada (última data com tarefa)
      let estimatedEndDate: string | undefined;
      if (allTasks.length > 0) {
        const sortedDates = allTasks.map(t => t.scheduled_date).sort();
        estimatedEndDate = sortedDates[sortedDates.length - 1];
        
        // Atualizar cronograma com a data estimada se não tiver data final definida
        if (!this.endDate && estimatedEndDate) {
          await supabase
            .from("user_cronogramas")
            .update({ end_date: estimatedEndDate })
            .eq("id", this.cronogramaId);
        }
      }

      return { 
        success: true, 
        tasksCreated: allTasks.length, 
        tasksExcluded,
        minutesExcluded,
        estimatedEndDate 
      };
    } catch (error: any) {
      console.error("Error generating tasks:", error);
      const errorMessage = error?.message || error?.details || (typeof error === 'string' ? error : JSON.stringify(error));
      return { success: false, tasksCreated: 0, error: errorMessage };
    }
  }

  /**
   * Recalcula as tarefas preservando progresso (método padrão)
   */
  async recalculate(): Promise<{ 
    success: boolean; 
    tasksCreated: number; 
    tasksExcluded?: number;
    minutesExcluded?: number;
    estimatedEndDate?: string; 
    error?: string 
  }> {
    return this.generate();
  }

  /**
   * Busca tasks existentes do cronograma
   */
  private async fetchExistingTasks(): Promise<{
    goalId: string | null;
    durationMinutes: number;
    isCompleted: boolean;
    scheduledDate: string;
  }[]> {
    const { data, error } = await supabase
      .from("user_cronograma_tasks")
      .select("goal_id, duration_minutes, is_completed, scheduled_date")
      .eq("cronograma_id", this.cronogramaId);

    if (error) {
      console.error("Error fetching existing tasks:", error);
      return [];
    }

    return (data || []).map(t => ({
      goalId: t.goal_id,
      durationMinutes: t.duration_minutes,
      isCompleted: t.is_completed,
      scheduledDate: t.scheduled_date
    }));
  }

  /**
   * Recálculo INCREMENTAL: Adiciona tasks faltantes SEM deletar as existentes.
   * 
   * Este método é SEGURO para usar após correção de cadernos fantasmas pois:
   * 1. NÃO deleta tasks pendentes existentes (preserva scheduled_date do aluno)
   * 2. NÃO modifica tasks completadas
   * 3. APENAS adiciona tasks para goals que agora têm questões (após correção)
   * 
   * Use este método quando quiser adicionar conteúdo novo sem perder referências.
   */
  async recalculateIncremental(): Promise<{ 
    success: boolean; 
    tasksCreated: number; 
    tasksSkipped?: number;
    estimatedEndDate?: string; 
    error?: string 
  }> {
    try {
      // 1. Buscar tasks EXISTENTES (completadas + pendentes)
      const existingTasks = await this.fetchExistingTasks();
      
      // 2. Calcular tempo já coberto por goal (completadas + pendentes)
      const coveredMinutes = new Map<string, number>();
      for (const task of existingTasks) {
        if (task.goalId) {
          const current = coveredMinutes.get(task.goalId) || 0;
          coveredMinutes.set(task.goalId, current + task.durationMinutes);
        }
      }

      // 3. Buscar goals atuais (com cadernos corrigidos)
      const goals = await this.fetchGoals();
      
      if (goals.length === 0) {
        return { success: false, tasksCreated: 0, error: "Nenhuma meta encontrada para as disciplinas selecionadas" };
      }

      // 4. Filtrar goals que precisam de mais tasks
      const goalsWithGaps = goals.filter(g => {
        const covered = coveredMinutes.get(g.goalId) || 0;
        return covered < g.totalDuration;
      }).map(g => ({
        ...g,
        remainingDuration: g.totalDuration - (coveredMinutes.get(g.goalId) || 0)
      }));

      // 5. Se não há gaps, nada a fazer
      if (goalsWithGaps.length === 0) {
        console.log("No gaps to fill - all goals are fully covered");
        return { 
          success: true, 
          tasksCreated: 0, 
          tasksSkipped: goals.length,
          error: undefined 
        };
      }

      console.log(`Found ${goalsWithGaps.length} goals with gaps to fill`);

      // 6. Encontrar última data de task existente
      let lastExistingDateMs = 0;
      for (const task of existingTasks) {
        const dateMs = new Date(task.scheduledDate).getTime();
        if (dateMs > lastExistingDateMs) {
          lastExistingDateMs = dateMs;
        }
      }
      
      // CORREÇÃO: Se não há tasks, usar effectiveStart (mesma lógica do generate())
      // Antes usava "new Date()" sempre, criando inconsistência
      // PADRONIZAÇÃO: Usar startOfDay para evitar problemas de timezone
      const startDate = startOfDay(parseISO(this.startDate));
      const today = startOfDay(new Date());
      const effectiveStart = isAfter(today, startDate) ? today : startDate;
      
      const startFromDate = lastExistingDateMs > 0 
        ? addDays(startOfDay(new Date(lastExistingDateMs)), 1) // Dia seguinte à última task
        : effectiveStart; // Respeita start_date do cronograma

      // Log para debugging
      const dateSource = lastExistingDateMs > 0 ? 'lastTask' : (isAfter(today, startDate) ? 'today' : 'config');
      cronogramaLogger.incrementalRecalc(this.cronogramaId, format(startFromDate, 'yyyy-MM-dd'), dateSource);

      // 7. Gerar dias disponíveis a partir da última data
      const days = this.generateAvailableDates(startFromDate);

      if (days.length === 0) {
        return { success: false, tasksCreated: 0, error: "Nenhum dia disponível após as tasks existentes" };
      }

      // 8. Alocar tasks APENAS para os gaps (não deleta nada!)
      const revisionConfigs = await this.fetchRevisionConfigs();
      const { tasks } = this.allocateTasksWithRevisions(
        goalsWithGaps, 
        days, 
        new Map(), // Não considerar tempo completado, já ajustamos remainingDuration
        revisionConfigs
      );

      // 9. Compactar tarefas fragmentadas antes de filtrar
      let finalTasks = compactAllTasks(tasks);
      
      // 10. Se há data final definida, filtrar tasks além dela
      if (this.endDate) {
        const endDateStr = this.endDate;
        finalTasks = finalTasks.filter(t => t.scheduled_date <= endDateStr);
      }

      // 10. Inserir APENAS as novas tasks
      await this.insertTasks(finalTasks);

      // 11. Calcular data final estimada
      let estimatedEndDate: string | undefined;
      const allDates = [...existingTasks.map(t => t.scheduledDate), ...finalTasks.map(t => t.scheduled_date)].sort();
      if (allDates.length > 0) {
        estimatedEndDate = allDates[allDates.length - 1];
      }

      return { 
        success: true, 
        tasksCreated: finalTasks.length,
        tasksSkipped: goals.length - goalsWithGaps.length,
        estimatedEndDate 
      };
    } catch (error: any) {
      console.error("Error in incremental recalculation:", error);
      const errorMessage = error?.message || error?.details || (typeof error === 'string' ? error : JSON.stringify(error));
      return { success: false, tasksCreated: 0, error: errorMessage };
    }
  }
}

/**
 * Hook para usar o gerador de tarefas
 */
interface CronogramaConfig {
  id: string;
  user_id: string;
  school_id: string;
  start_date: string;
  end_date: string | null;
  available_days: string[];
  hours_per_day: number;
  selected_disciplines: string[];
  hours_per_weekday?: Record<string, number>;
  discipline_order?: string[];
  selected_topics?: Record<string, string[]>;
  topic_order?: Record<string, string[]>;
}

export function useCronogramaTaskGenerator() {
  const generateTasks = async (cronograma: CronogramaConfig) => {
    const generator = new CronogramaTaskGenerator(cronograma);
    return generator.generate();
  };

  const recalculateTasks = async (cronograma: CronogramaConfig) => {
    const generator = new CronogramaTaskGenerator(cronograma);
    return generator.recalculate();
  };

  /**
   * Recálculo incremental: adiciona tasks faltantes SEM deletar as existentes.
   * Útil após correção de cadernos fantasmas para preservar datas do aluno.
   */
  const recalculateTasksIncremental = async (cronograma: CronogramaConfig) => {
    const generator = new CronogramaTaskGenerator(cronograma);
    return generator.recalculateIncremental();
  };

  return { generateTasks, recalculateTasks, recalculateTasksIncremental };
}
