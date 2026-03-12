import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Verify admin
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
    }
  }

  const { batch_size = 200, offset = 0 } = await req.json().catch(() => ({}));

  try {
    const { data: pendingTopics, error: queryError } = await supabase.rpc(
      'get_derived_topics_for_sync',
      { p_limit: batch_size, p_offset: offset }
    );

    if (queryError) {
      console.error('RPC error:', queryError);
      return new Response(JSON.stringify({ error: 'RPC get_derived_topics_for_sync failed: ' + queryError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const topics = (pendingTopics || []) as Array<{ id: string; name: string; source_notebook_id: string }>;

    const results = [];
    for (const topic of topics) {
      const result = await syncTopicFromSource(supabase, topic);
      results.push(result);
    }

    return new Response(JSON.stringify({
      processed: topics.length,
      results,
      offset,
      batch_size,
      has_more: topics.length === batch_size
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function syncTopicFromSource(
  supabase: any,
  topic: { id: string; name: string; source_notebook_id: string }
) {
  const { id: topicId, name: topicName, source_notebook_id: sourceNotebookId } = topic;

  try {
    // 1. Get ALL question_ids from source notebook
    const allQuestionIds: string[] = [];
    let qtOffset = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('admin_notebook_questions')
        .select('question_id')
        .eq('notebook_id', sourceNotebookId)
        .is('deleted_at', null)
        .range(qtOffset, qtOffset + PAGE - 1);

      if (error || !data || data.length === 0) break;
      data.forEach((r: any) => allQuestionIds.push(r.question_id));
      if (data.length < PAGE) break;
      qtOffset += PAGE;
    }

    if (allQuestionIds.length === 0) {
      return { topicId, topicName: topicName.substring(0, 50), status: 'skipped', reason: 'source_empty' };
    }

    const uniqueIds = [...new Set(allQuestionIds)];

    // 2. Find or create own notebook (NON-DESTRUCTIVE: never delete existing questions)
    const { data: existingNbs } = await supabase
      .from('admin_question_notebooks')
      .select('id, name')
      .eq('study_topic_id', topicId)
      .eq('is_active', true);

    let notebookId: string;

    if (existingNbs && existingNbs.length > 0) {
      notebookId = existingNbs[0].id;
      // DO NOT clear existing entries — only add missing ones below
    } else {
      // Get source notebook's folder_id to maintain folder hierarchy
      const { data: sourceNb } = await supabase
        .from('admin_question_notebooks')
        .select('folder_id')
        .eq('id', sourceNotebookId)
        .single();

      const { data: newNb, error: nbError } = await supabase
        .from('admin_question_notebooks')
        .insert({
          name: topicName.substring(0, 200),
          description: `Caderno derivado - ${uniqueIds.length} questões da fonte`,
          study_topic_id: topicId,
          is_active: true,
          question_count: 0,
          folder_id: sourceNb?.folder_id || null
        })
        .select('id')
        .single();

      if (nbError) throw nbError;
      notebookId = newNb.id;
    }

    // 3. Get existing question_ids in this notebook to avoid duplicates
    const existingQuestionIds = new Set<string>();
    let existingOffset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('admin_notebook_questions')
        .select('question_id')
        .eq('notebook_id', notebookId)
        .is('deleted_at', null)
        .range(existingOffset, existingOffset + PAGE - 1);

      if (error || !data || data.length === 0) break;
      data.forEach((r: any) => existingQuestionIds.add(r.question_id));
      if (data.length < PAGE) break;
      existingOffset += PAGE;
    }

    // 4. Only insert questions that don't already exist
    const newQuestionIds = uniqueIds.filter(id => !existingQuestionIds.has(id));

    if (newQuestionIds.length === 0) {
      return {
        topicId,
        topicName: topicName.substring(0, 50),
        status: 'skipped',
        reason: 'already_synced',
        questionsCount: existingQuestionIds.size
      };
    }

    const startOrder = existingQuestionIds.size;
    const BATCH = 500;
    for (let i = 0; i < newQuestionIds.length; i += BATCH) {
      const batch = newQuestionIds.slice(i, i + BATCH).map((qId, idx) => ({
        notebook_id: notebookId,
        question_id: qId,
        display_order: startOrder + i + idx
      }));

      const { error: insError } = await supabase
        .from('admin_notebook_questions')
        .insert(batch);

      if (insError) {
        console.error(`Batch insert error for topic ${topicId}:`, insError);
      }
    }

    // 5. Update notebook question_count with total (existing + new)
    const totalCount = existingQuestionIds.size + newQuestionIds.length;
    await supabase
      .from('admin_question_notebooks')
      .update({ question_count: totalCount, updated_at: new Date().toISOString() })
      .eq('id', notebookId);

    // 6. Update the active topic_goal's question_notebook_ids — ONLY add notebook ref, never overwrite duration/description
    const { data: activeGoal } = await supabase
      .from('topic_goals')
      .select('id, question_notebook_ids')
      .eq('topic_id', topicId)
      .eq('goal_type', 'questions')
      .eq('is_active', true)
      .limit(1)
      .single();

    let goalUpdated = false;
    if (activeGoal) {
      const existingIds: string[] = activeGoal.question_notebook_ids || [];
      if (!existingIds.includes(notebookId)) {
        const updatedIds = [...existingIds, notebookId];
        await supabase
          .from('topic_goals')
          .update({
            question_notebook_ids: updatedIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', activeGoal.id);
        goalUpdated = true;
      }
    }

    return {
      topicId,
      topicName: topicName.substring(0, 50),
      status: 'synced',
      questionsCount: newQuestionIds.length,
      notebookId,
      goalUpdated
    };

  } catch (error) {
    return {
      topicId,
      topicName: topicName.substring(0, 50),
      status: 'error',
      error: (error as Error).message
    };
  }
}
