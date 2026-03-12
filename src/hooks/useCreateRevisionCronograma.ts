/**
 * Hook para criar cronograma de revisão a partir de um cronograma 100% concluído.
 * 
 * Fluxo:
 * 1. Valida que o cronograma original está 100% concluído
 * 2. Congela o cronograma original (is_frozen = true)
 * 3. Cria novo cronograma copiando configs do original (cronograma_type = 'revision_only')
 * 4. Gera tarefas de revisão distribuídas linearmente (sem espaçamento temporal)
 * 
 * IMPORTANTE: Este hook NÃO modifica nenhuma lógica existente de geração.
 * É um caminho completamente separado.
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, parseISO, startOfDay, isAfter, isBefore, isEqual } from "date-fns";

const REVISION_DURATION = 30; // Cada tarefa de revisão = 30 min

interface RevisionCronogramaResult {
  success: boolean;
  newCronogramaId?: string;
  tasksCreated?: number;
  error?: string;
}

/**
 * Busca as configurações de revisão dos tópicos do cronograma original
 */
export async function fetchRevisionTasksForCronograma(
  originalCronogramaId: string,
  userId: string
): Promise<{
  topicId: string;
  topicName: string;
  disciplineId: string;
  disciplineName: string;
  revisionCycles: number; // Quantos ciclos de revisão existem para este tópico
}[]> {
  // 1. Buscar tópicos que foram usados no cronograma original (via tarefas)
  const { data: tasks, error: tasksError } = await supabase
    .from("user_cronograma_tasks")
    .select("source_topic_id, goal_id")
    .eq("cronograma_id", originalCronogramaId)
    .eq("user_id", userId);

  if (tasksError) throw tasksError;

  // Coletar todos os topic_ids únicos (de source_topic_id e de goal->topic)
  const topicIdsFromTasks = new Set<string>();
  
  // source_topic_id (revisões)
  for (const t of tasks || []) {
    if (t.source_topic_id) topicIdsFromTasks.add(t.source_topic_id);
  }

  // goal_id -> topic_id (tarefas normais)
  const goalIds = (tasks || []).filter(t => t.goal_id).map(t => t.goal_id!);
  if (goalIds.length > 0) {
    const uniqueGoalIds = [...new Set(goalIds)];
    const { data: goals } = await supabase
      .from("topic_goals")
      .select("topic_id")
      .in("id", uniqueGoalIds);

    for (const g of goals || []) {
      if (g.topic_id) topicIdsFromTasks.add(g.topic_id);
    }
  }

  const topicIds = [...topicIdsFromTasks];
  if (topicIds.length === 0) return [];

  // 2. Buscar revisões ativas para esses tópicos
  const { data: revisions, error: revError } = await supabase
    .from("topic_revisions")
    .select("topic_id, revision_1_days, revision_2_days, revision_3_days, revision_4_days, revision_5_days, revision_6_days")
    .in("topic_id", topicIds)
    .eq("is_active", true);

  if (revError) throw revError;

  // 3. Buscar info dos tópicos
  const revTopicIds = (revisions || []).map(r => r.topic_id);
  if (revTopicIds.length === 0) return [];

  const { data: topics } = await supabase
    .from("study_topics")
    .select("id, name, study_discipline_id")
    .in("id", revTopicIds);

  const disciplineIds = [...new Set((topics || []).map(t => t.study_discipline_id))];
  const { data: disciplines } = await supabase
    .from("study_disciplines")
    .select("id, name")
    .in("id", disciplineIds);

  const discMap = new Map((disciplines || []).map(d => [d.id, d.name]));
  const topicMap = new Map((topics || []).map(t => [t.id, t]));

  // 4. Montar resultado
  const result: {
    topicId: string;
    topicName: string;
    disciplineId: string;
    disciplineName: string;
    revisionCycles: number;
  }[] = [];

  for (const rev of revisions || []) {
    const topic = topicMap.get(rev.topic_id);
    if (!topic) continue;

    // Contar ciclos ativos (revision_X_days > 0)
    let cycles = 0;
    if (rev.revision_1_days && rev.revision_1_days > 0) cycles++;
    if (rev.revision_2_days && rev.revision_2_days > 0) cycles++;
    if (rev.revision_3_days && rev.revision_3_days > 0) cycles++;
    if (rev.revision_4_days && rev.revision_4_days > 0) cycles++;
    if (rev.revision_5_days && rev.revision_5_days > 0) cycles++;
    if (rev.revision_6_days && rev.revision_6_days > 0) cycles++;

    if (cycles > 0) {
      result.push({
        topicId: rev.topic_id,
        topicName: topic.name,
        disciplineId: topic.study_discipline_id,
        disciplineName: discMap.get(topic.study_discipline_id) || "Desconhecida",
        revisionCycles: cycles,
      });
    }
  }

  return result;
}

/**
 * Gera dias disponíveis baseado na configuração
 */
export function generateRevisionAvailableDays(
  fromDate: Date,
  availableDays: string[],
  hoursPerWeekday: Record<string, number>,
  defaultHoursPerDay: number,
  maxDays: number = 365
): { date: string; totalMinutes: number }[] {
  const ptCodes = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const enCodes = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  
  const days: { date: string; totalMinutes: number }[] = [];
  let currentDate = fromDate;
  const end = addDays(fromDate, maxDays);

  while (isBefore(currentDate, end) || isEqual(currentDate, end)) {
    const dayIndex = currentDate.getDay();
    const ptCode = ptCodes[dayIndex];
    const enCode = enCodes[dayIndex];

    if (availableDays.includes(ptCode) || availableDays.includes(enCode)) {
      const matchedCode = availableDays.includes(ptCode) ? ptCode : enCode;
      const hoursForDay = hoursPerWeekday[matchedCode] ?? defaultHoursPerDay;
      const minutesForDay = Math.round(hoursForDay * 60);

      days.push({
        date: format(currentDate, "yyyy-MM-dd"),
        totalMinutes: minutesForDay,
      });
    }

    currentDate = addDays(currentDate, 1);
    if (days.length >= maxDays) break;
  }

  return days;
}

/**
 * Distribui tarefas de revisão linearmente nos dias disponíveis (sem espaçamento temporal)
 */
export function distributeRevisionTasks(
  revisionTopics: {
    topicId: string;
    disciplineId: string;
    revisionCycles: number;
  }[],
  days: { date: string; totalMinutes: number }[],
  cronogramaId: string,
  userId: string
): { tasks: Array<{
  cronograma_id: string;
  user_id: string;
  goal_id: null;
  source_topic_id: string;
  scheduled_date: string;
  duration_minutes: number;
  is_revision: boolean;
  revision_number: number;
  part_number: number;
  total_parts: number;
}>; tasksExcluded: number } {
  // Criar lista plana de todas as tarefas de revisão
  // Ordem: disciplina por disciplina, tópico por tópico, ciclo por ciclo
  const allRevisionSlots: { topicId: string; disciplineId: string; revisionNumber: number }[] = [];

  // Agrupar por disciplina para distribuir de forma balanceada
  const byDiscipline = new Map<string, typeof revisionTopics>();
  for (const topic of revisionTopics) {
    const existing = byDiscipline.get(topic.disciplineId) || [];
    existing.push(topic);
    byDiscipline.set(topic.disciplineId, existing);
  }

  // Intercalar disciplinas (Round Robin simples)
  const disciplineIds = [...byDiscipline.keys()];
  const disciplineQueues = new Map<string, { topicId: string; revisionNumber: number }[]>();

  for (const [discId, topics] of byDiscipline) {
    const queue: { topicId: string; revisionNumber: number }[] = [];
    for (const topic of topics) {
      for (let cycle = 1; cycle <= topic.revisionCycles; cycle++) {
        queue.push({ topicId: topic.topicId, revisionNumber: cycle });
      }
    }
    disciplineQueues.set(discId, queue);
  }

  // Intercalar: pegar 1 de cada disciplina por vez
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const discId of disciplineIds) {
      const queue = disciplineQueues.get(discId)!;
      if (queue.length > 0) {
        const item = queue.shift()!;
        allRevisionSlots.push({ ...item, disciplineId: discId });
        hasMore = hasMore || queue.length > 0;
      }
    }
    // Verificar se ainda sobrou em alguma disciplina
    if (!hasMore) {
      for (const queue of disciplineQueues.values()) {
        if (queue.length > 0) { hasMore = true; break; }
      }
    }
  }

  // Distribuir nos dias disponíveis respeitando carga horária
  const tasks: Array<{
    cronograma_id: string;
    user_id: string;
    goal_id: null;
    source_topic_id: string;
    scheduled_date: string;
    duration_minutes: number;
    is_revision: boolean;
    revision_number: number;
    part_number: number;
    total_parts: number;
  }> = [];

  let dayIndex = 0;
  let usedMinutesOnDay = 0;
  let tasksExcluded = 0;

  for (const slot of allRevisionSlots) {
    // Encontrar próximo dia com espaço
    while (dayIndex < days.length && usedMinutesOnDay + REVISION_DURATION > days[dayIndex].totalMinutes) {
      dayIndex++;
      usedMinutesOnDay = 0;
    }

    if (dayIndex >= days.length) {
      // Não há mais dias disponíveis
      tasksExcluded++;
      continue;
    }

    tasks.push({
      cronograma_id: cronogramaId,
      user_id: userId,
      goal_id: null,
      source_topic_id: slot.topicId,
      scheduled_date: days[dayIndex].date,
      duration_minutes: REVISION_DURATION,
      is_revision: true,
      revision_number: slot.revisionNumber,
      part_number: 1,
      total_parts: 1,
    });

    usedMinutesOnDay += REVISION_DURATION;
  }

  return { tasks, tasksExcluded };
}

export function useCreateRevisionCronograma() {
  const [isCreating, setIsCreating] = useState(false);

  const createRevisionCronograma = async (
    originalCronogramaId: string,
    userId: string
  ): Promise<RevisionCronogramaResult> => {
    setIsCreating(true);

    try {
      // 1. Buscar cronograma original completo
      const { data: original, error: origError } = await supabase
        .from("user_cronogramas")
        .select("*")
        .eq("id", originalCronogramaId)
        .single();

      if (origError || !original) {
        return { success: false, error: "Cronograma original não encontrado" };
      }

      // Verificar se já está congelado
      if ((original as any).is_frozen) {
        return { success: false, error: "Este cronograma já foi congelado" };
      }

      // 2. Verificar que está 100% concluído
      const { data: taskStats } = await supabase
        .from("user_cronograma_tasks")
        .select("is_completed")
        .eq("cronograma_id", originalCronogramaId)
        .eq("user_id", userId);

      const totalTasks = taskStats?.length || 0;
      const completedTasks = taskStats?.filter(t => t.is_completed).length || 0;

      if (totalTasks === 0 || completedTasks < totalTasks) {
        return {
          success: false,
          error: `O cronograma não está 100% concluído (${completedTasks}/${totalTasks} tarefas)`,
        };
      }

      // 3. Buscar revisões configuradas para os tópicos do cronograma
      const revisionTopics = await fetchRevisionTasksForCronograma(originalCronogramaId, userId);

      if (revisionTopics.length === 0) {
        return {
          success: false,
          error: "Nenhuma revisão configurada para os tópicos deste cronograma",
        };
      }

      const totalSlots = revisionTopics.reduce((sum, t) => sum + t.revisionCycles, 0);
      console.log(`[RevisionCronograma] ${revisionTopics.length} tópicos com revisão, ${totalSlots} slots totais (${totalSlots * 30}min)`);

      // 4. Congelar cronograma original
      const { error: freezeError } = await supabase
        .from("user_cronogramas")
        .update({ is_frozen: true } as any)
        .eq("id", originalCronogramaId);

      if (freezeError) {
        return { success: false, error: "Erro ao congelar cronograma original" };
      }

      // 5. Criar novo cronograma de revisão
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      const availableDays = original.available_days || [];
      const hoursPerWeekday = (original as any).hours_per_weekday || {};
      const defaultHours = (original as any).hours_per_day || 2;

      // Calcular end_date estimada
      const days = generateRevisionAvailableDays(
        startOfDay(new Date()),
        availableDays,
        hoursPerWeekday,
        defaultHours
      );

      const { tasks: revTasks, tasksExcluded } = distributeRevisionTasks(
        revisionTopics,
        days,
        "PLACEHOLDER", // será atualizado após criar o cronograma
        userId
      );

      const lastTaskDate = revTasks.length > 0
        ? revTasks[revTasks.length - 1].scheduled_date
        : null;

      const { data: newCronograma, error: createError } = await supabase
        .from("user_cronogramas")
        .insert({
          user_id: userId,
          name: `${original.name} — Revisão`,
          school_id: original.school_id,
          start_date: today,
          end_date: lastTaskDate,
          available_days: availableDays,
          hours_per_day: defaultHours,
          hours_per_weekday: hoursPerWeekday,
          selected_disciplines: original.selected_disciplines || [],
          discipline_order: original.selected_disciplines || [],
          selected_topics: (original as any).selected_topics || {},
          topic_order: (original as any).topic_order || {},
          is_active: true,
          cronograma_type: "revision_only",
          revision_source_id: originalCronogramaId,
        } as any)
        .select("id")
        .single();

      if (createError || !newCronograma) {
        // Reverter congelamento
        await supabase
          .from("user_cronogramas")
          .update({ is_frozen: false } as any)
          .eq("id", originalCronogramaId);
        return { success: false, error: "Erro ao criar cronograma de revisão" };
      }

      // 6. Atualizar tasks com o ID correto e inserir
      const finalTasks = revTasks.map(t => ({
        ...t,
        cronograma_id: newCronograma.id,
      }));

      if (finalTasks.length > 0) {
        // Inserir em lotes de 100
        for (let i = 0; i < finalTasks.length; i += 100) {
          const batch = finalTasks.slice(i, i + 100);
          const { error: insertError } = await supabase
            .from("user_cronograma_tasks")
            .insert(batch);

          if (insertError) {
            console.error("[RevisionCronograma] Error inserting batch:", insertError);
          }
        }
      }

      if (tasksExcluded > 0) {
        console.warn(`[RevisionCronograma] ${tasksExcluded} tarefas não couberam nos dias disponíveis`);
      }

      console.log(`[RevisionCronograma] Sucesso: ${finalTasks.length} tarefas criadas no cronograma ${newCronograma.id}`);

      return {
        success: true,
        newCronogramaId: newCronograma.id,
        tasksCreated: finalTasks.length,
      };
    } catch (error: any) {
      console.error("[RevisionCronograma] Error:", error);
      return {
        success: false,
        error: error?.message || "Erro desconhecido ao criar cronograma de revisão",
      };
    } finally {
      setIsCreating(false);
    }
  };

  return { createRevisionCronograma, isCreating };
}
