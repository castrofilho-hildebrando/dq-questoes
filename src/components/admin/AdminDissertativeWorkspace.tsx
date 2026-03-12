import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Save, Sparkles, RefreshCw, Check, Upload,
  FileText, ChevronRight, Eye, EyeOff, Trash2, ClipboardList, AlertTriangle
} from "lucide-react";

interface Course { id: string; title: string; image_url: string | null; }
interface Discipline { id: string; name: string; }
interface Topic {
  id: string; course_id: string; discipline_id: string;
  title: string; source_pdf_url: string | null;
  display_order: number; is_active: boolean;
}
interface Question {
  id: string; course_id: string; discipline_id: string; topic_id: string | null;
  statement: string; answer_key: string; model_answer: string | null;
  status: string; version: number; is_active: boolean; display_order: number;
}

export function AdminDissertativeWorkspace() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [topicQuestions, setTopicQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"text" | "pdf">("text");
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [topicFilter, setTopicFilter] = useState<"all" | "no_question" | "draft" | "published">("all");
  const [bulkMode, setBulkMode] = useState<"question_only" | "full_pipeline">("full_pipeline");
  const [bulkResults, setBulkResults] = useState<Array<{
    topicId: string; topicTitle: string; step: string;
    status: "success" | "error"; error?: string; questionId?: string;
  }>>([]);
  const [bulkStepLabel, setBulkStepLabel] = useState("");
  const [bulkRepairing, setBulkRepairing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [multiDisciplineRunning, setMultiDisciplineRunning] = useState(false);
  const [multiDisciplineProgress, setMultiDisciplineProgress] = useState({ discipline: "", topic: "", dIdx: 0, dTotal: 0, tIdx: 0, tTotal: 0, step: "" });
  const [multiDisciplineResults, setMultiDisciplineResults] = useState<Array<{ discipline: string; topicTitle: string; step: string; status: "success" | "error"; error?: string }>>([]);
  const [showMultiDisciplineDialog, setShowMultiDisciplineDialog] = useState(false);
  const [multiDisciplineCandidates, setMultiDisciplineCandidates] = useState<{ id: string; name: string; topicCount?: number }[]>([]);
  const [multiDisciplineSelected, setMultiDisciplineSelected] = useState<Set<string>>(new Set());
  const [multiDisciplineLoading, setMultiDisciplineLoading] = useState(false);

  const AI_MODELS = [
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", group: "Google" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", group: "Google" },
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", group: "Google" },
    { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", group: "Google" },
    { value: "openai/gpt-5", label: "GPT-5", group: "OpenAI" },
    { value: "openai/gpt-5-mini", label: "GPT-5 Mini", group: "OpenAI" },
    { value: "openai/gpt-5.2", label: "GPT-5.2", group: "OpenAI" },
  ];

  // Fetch courses on mount
  useEffect(() => {
    supabase.from("dissertative_courses").select("id, title, image_url").order("title")
      .then(({ data }) => setCourses((data as Course[]) || []));
  }, []);

  // Fetch disciplines when course changes - show ALL linked disciplines (no mandatory filter)
  useEffect(() => {
    if (!selectedCourse) { setDisciplines([]); return; }
    (async () => {
      const { data } = await supabase
        .from("dissertative_course_disciplines")
        .select("discipline_id, study_disciplines:discipline_id(id, name)")
        .eq("course_id", selectedCourse)
        .eq("is_active", true)
        .order("display_order");

      const allDisciplines = (data || []).map((d: any) => d.study_disciplines).filter(Boolean);
      setDisciplines(allDisciplines);
    })();
    setSelectedDiscipline("");
    setSelectedTopic(null);
    setSelectedQuestion(null);
  }, [selectedCourse]);

  // State for manual discipline addition
  const [addDisciplineOpen, setAddDisciplineOpen] = useState(false);
  const [allStudyDisciplines, setAllStudyDisciplines] = useState<Discipline[]>([]);
  const [manualDisciplineName, setManualDisciplineName] = useState("");
  const [addingDiscipline, setAddingDiscipline] = useState(false);
  const [disciplineSearchQuery, setDisciplineSearchQuery] = useState("");

  const fetchAllStudyDisciplines = async () => {
    const { data } = await supabase
      .from("study_disciplines")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setAllStudyDisciplines((data as Discipline[]) || []);
  };

  const handleAddExistingDiscipline = async (disciplineId: string) => {
    if (!selectedCourse) return;
    // Check if already linked
    const existing = disciplines.find(d => d.id === disciplineId);
    if (existing) { toast.error("Disciplina já vinculada a este curso"); return; }
    setAddingDiscipline(true);
    const maxOrder = disciplines.length;
    const { error } = await supabase.from("dissertative_course_disciplines").insert({
      course_id: selectedCourse,
      discipline_id: disciplineId,
      display_order: maxOrder,
      is_active: true,
    });
    if (error) { toast.error(error.message); setAddingDiscipline(false); return; }
    // Refresh disciplines
    const { data } = await supabase
      .from("dissertative_course_disciplines")
      .select("discipline_id, study_disciplines:discipline_id(id, name)")
      .eq("course_id", selectedCourse)
      .eq("is_active", true)
      .order("display_order");
    setDisciplines((data || []).map((d: any) => d.study_disciplines).filter(Boolean));
    toast.success("Disciplina vinculada ao curso!");
    setAddingDiscipline(false);
    setAddDisciplineOpen(false);
    setDisciplineSearchQuery("");
  };

  // Fetch topics when discipline changes
  const fetchTopics = useCallback(async () => {
    if (!selectedCourse || !selectedDiscipline) { setTopics([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("dissertative_topics")
      .select("*")
      .eq("course_id", selectedCourse)
      .eq("discipline_id", selectedDiscipline)
      .order("display_order");
    setTopics((data as Topic[]) || []);
    setLoading(false);
  }, [selectedCourse, selectedDiscipline]);

  useEffect(() => {
    fetchTopics();
    setSelectedTopic(null);
    setSelectedQuestion(null);
    setSelectedTopicIds(new Set());
  }, [fetchTopics]);

  // Fetch questions for selected topic
  const fetchTopicQuestions = useCallback(async (topicId: string) => {
    const { data } = await supabase
      .from("dissertative_questions")
      .select("*")
      .eq("topic_id", topicId)
      .order("version", { ascending: false });
    setTopicQuestions((data as Question[]) || []);
    if (data && data.length > 0) setSelectedQuestion(data[0] as Question);
    else setSelectedQuestion(null);
  }, []);

  useEffect(() => {
    if (selectedTopic) fetchTopicQuestions(selectedTopic.id);
    else { setTopicQuestions([]); setSelectedQuestion(null); }
  }, [selectedTopic, fetchTopicQuestions]);

  // Get topic status
  const getTopicStatus = (topicId: string): "no_question" | "draft" | "published" => {
    // We need to check questions for each topic - for perf, we'll fetch all at once
    return "no_question"; // Will be overridden below
  };

  // Fetch all questions for current discipline to show status
  const [allDisciplineQuestions, setAllDisciplineQuestions] = useState<Question[]>([]);
  useEffect(() => {
    if (!selectedCourse || !selectedDiscipline) { setAllDisciplineQuestions([]); return; }
    supabase
      .from("dissertative_questions")
      .select("id, topic_id, status, is_active")
      .eq("course_id", selectedCourse)
      .eq("discipline_id", selectedDiscipline)
      .then(({ data }) => setAllDisciplineQuestions((data as Question[]) || []));
  }, [selectedCourse, selectedDiscipline, topicQuestions]);

  const topicStatusMap: Record<string, "no_question" | "draft" | "published"> = {};
  topics.forEach(t => {
    const qs = allDisciplineQuestions.filter(q => q.topic_id === t.id);
    if (qs.length === 0) topicStatusMap[t.id] = "no_question";
    else if (qs.some(q => q.is_active)) topicStatusMap[t.id] = "published";
    else topicStatusMap[t.id] = "draft";
  });

  const filteredTopics = topics.filter(t => {
    if (topicFilter === "all") return true;
    return topicStatusMap[t.id] === topicFilter;
  });

  // Merge broken lines from PDF paste: lines not starting with a number/bullet are continuations
  const mergeTopicLines = (raw: string): string[] => {
    const rawLines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const merged: string[] = [];
    const startsNewTopic = /^(\d+[\.\)\-–—]?\s|[•\-–—]\s|[a-zA-Z][\.\)]\s|[IVXLCDM]+[\.\)]\s)/;

    for (const line of rawLines) {
      if (merged.length === 0 || startsNewTopic.test(line)) {
        merged.push(line);
      } else {
        // Continuation of previous topic
        merged[merged.length - 1] += " " + line;
      }
    }
    // Clean numbering prefixes
    return merged.map(l => l.replace(/^\d+[\.\)\-–—]?\s*/, "").replace(/^[•\-–—]\s*/, "").trim()).filter(Boolean);
  };

  // Import topics
  const handleImportTopics = async () => {
    if (!selectedCourse || !selectedDiscipline) {
      toast.error("Selecione curso e disciplina");
      return;
    }
    const lines = mergeTopicLines(importText);
    if (lines.length === 0) { toast.error("Nenhum tópico informado"); return; }

    // Remove duplicates
    const unique = [...new Set(lines)];
    const existingTitles = topics.map(t => t.title.toLowerCase());
    const newTopics = unique.filter(t => !existingTitles.includes(t.toLowerCase()));

    if (newTopics.length === 0) { toast.error("Todos os tópicos já existem"); return; }

    const maxOrder = topics.length > 0 ? Math.max(...topics.map(t => t.display_order)) : -1;
    const payload = newTopics.map((title, i) => ({
      course_id: selectedCourse,
      discipline_id: selectedDiscipline,
      title,
      display_order: maxOrder + 1 + i,
    }));

    const { error } = await supabase.from("dissertative_topics").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newTopics.length} tópicos importados`);
    setImportOpen(false);
    setImportText("");
    fetchTopics();
  };

  // Delete selected topics and their questions
  const handleDeleteSelectedTopics = async () => {
    if (selectedTopicIds.size === 0) return;
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${selectedTopicIds.size} tópico(s) e todas as suas questões? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    const ids = Array.from(selectedTopicIds);
    try {
      // Delete questions linked to these topics first
      const { error: qErr } = await supabase
        .from("dissertative_questions")
        .delete()
        .in("topic_id", ids);
      if (qErr) throw qErr;

      // Delete topics
      const { error: tErr } = await supabase
        .from("dissertative_topics")
        .delete()
        .in("id", ids);
      if (tErr) throw tErr;

      toast.success(`${ids.length} tópico(s) excluído(s)`);
      setSelectedTopicIds(new Set());
      if (selectedTopic && ids.includes(selectedTopic.id)) {
        setSelectedTopic(null);
        setSelectedQuestion(null);
      }
      fetchTopics();
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  };

  const [pdfExtracting, setPdfExtracting] = useState(false);

  // Cover image upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCourse) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `covers/${selectedCourse}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("dissertative-materials").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("dissertative-materials").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("dissertative_courses")
        .update({ image_url: urlData.publicUrl })
        .eq("id", selectedCourse);
      if (dbErr) throw dbErr;
      setCourses(prev => prev.map(c => c.id === selectedCourse ? { ...c, image_url: urlData.publicUrl } : c));
      toast.success("Capa atualizada!");
    } catch (err: any) {
      toast.error("Erro ao enviar capa: " + err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  // PDF upload + AI extraction
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${selectedCourse}/${selectedDiscipline}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("dissertative-pdfs").upload(path, file);
    if (error) { toast.error("Erro no upload: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("dissertative-pdfs").getPublicUrl(path);
    toast.success("PDF enviado! Extraindo tópicos com IA...");

    // Call AI to extract topics from uploaded PDF
    setPdfExtracting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-dissertative", {
        body: { action: "extract_topics", pdf_url: urlData.publicUrl },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (data?.topics) {
        setImportText(data.topics);
        setImportMode("text");
        toast.success("Tópicos extraídos com sucesso! Revise e salve.");
      }
    } catch (err: any) {
      toast.error("Erro ao extrair tópicos: " + (err.message || "Erro desconhecido"));
    } finally {
      setPdfExtracting(false);
    }
  };

  // Generate question for topic
  const handleGenerate = async (actionType: string, questionId?: string) => {
    setGenerating(actionType);
    try {
      const body: any = { action: actionType, model: selectedModel };
      if (actionType === "generate_question") {
        body.course_id = selectedCourse;
        body.discipline_id = selectedDiscipline;
        body.topic_id = selectedTopic?.id;
      } else {
        body.question_id = questionId || selectedQuestion?.id;
      }

      const { data, error } = await supabase.functions.invoke("generate-dissertative", { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Gerado com sucesso!");
      if (selectedTopic) fetchTopicQuestions(selectedTopic.id);
    } catch (err: any) {
      toast.error(err.message || "Erro na geração");
    } finally {
      setGenerating(null);
    }
  };

  // Regenerate entire question (full pipeline for single topic)
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const handleRegenerateAll = async () => {
    if (!selectedTopic || !selectedCourse || !selectedDiscipline) return;
    const confirmed = window.confirm(
      "Isso irá re-gerar Enunciado, Gabarito e Resposta-Modelo do zero. Continuar?"
    );
    if (!confirmed) return;
    setRegeneratingAll(true);
    try {
      // Step 1: Generate question
      setGenerating("generate_question");
      const { data: qData, error: qErr } = await supabase.functions.invoke("generate-dissertative", {
        body: { action: "generate_question", course_id: selectedCourse, discipline_id: selectedDiscipline, topic_id: selectedTopic.id, model: selectedModel },
      });
      if (qErr) throw new Error(qErr.message);
      if (qData?.error) throw new Error(qData.error);
      const questionId = qData?.question_id;
      if (!questionId) throw new Error("Nenhum question_id retornado");

      // Step 2: Generate answer key
      setGenerating("generate_answer_key");
      const { data: akData, error: akErr } = await supabase.functions.invoke("generate-dissertative", {
        body: { action: "generate_answer_key", question_id: questionId, model: selectedModel },
      });
      if (akErr) throw new Error(akErr.message);
      if (akData?.error) throw new Error(akData.error);

      // Step 3: Generate model answer
      setGenerating("generate_model_answer");
      const { data: maData, error: maErr } = await supabase.functions.invoke("generate-dissertative", {
        body: { action: "generate_model_answer", question_id: questionId, model: selectedModel },
      });
      if (maErr) throw new Error(maErr.message);
      if (maData?.error) throw new Error(maData.error);

      toast.success("Questão completa re-gerada com sucesso!");
      fetchTopicQuestions(selectedTopic.id);
    } catch (err: any) {
      toast.error("Erro ao re-gerar: " + (err.message || "Erro desconhecido"));
    } finally {
      setGenerating(null);
      setRegeneratingAll(false);
    }
  };

  // Save manual edits
  const handleSaveQuestion = async () => {
    if (!selectedQuestion) return;
    const { error } = await supabase
      .from("dissertative_questions")
      .update({
        statement: selectedQuestion.statement,
        answer_key: selectedQuestion.answer_key,
        model_answer: selectedQuestion.model_answer,
        status: selectedQuestion.status,
        is_active: selectedQuestion.is_active,
      })
      .eq("id", selectedQuestion.id);
    if (error) toast.error(error.message);
    else toast.success("Questão salva");
  };

  // Bulk generate - supports question-only or full pipeline (all 4 steps)
  const handleBulkGenerate = async () => {
    if (selectedTopicIds.size === 0) { toast.error("Selecione tópicos"); return; }
    setBulkGenerating(true);
    setBulkResults([]);
    const topicsList = filteredTopics.filter(t => selectedTopicIds.has(t.id));
    setBulkProgress({ current: 0, total: topicsList.length });
    let successCount = 0;
    const results: typeof bulkResults = [];

    for (let i = 0; i < topicsList.length; i++) {
      const topic = topicsList[i];
      setBulkProgress({ current: i + 1, total: topicsList.length });

      // Step 1: Generate question
      setBulkStepLabel(`${topic.title} — Questão`);
      let questionId: string | null = null;
      try {
        const { data, error } = await supabase.functions.invoke("generate-dissertative", {
          body: { action: "generate_question", course_id: selectedCourse, discipline_id: selectedDiscipline, topic_id: topic.id, model: selectedModel },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        questionId = data?.question_id;
        results.push({ topicId: topic.id, topicTitle: topic.title, step: "Questão", status: "success", questionId: questionId || undefined });
      } catch (err: any) {
        results.push({ topicId: topic.id, topicTitle: topic.title, step: "Questão", status: "error", error: err.message });
        setBulkResults([...results]);
        continue; // skip remaining steps for this topic
      }

      if (bulkMode === "full_pipeline" && questionId) {
        // Step 2: Generate answer key
        setBulkStepLabel(`${topic.title} — Gabarito`);
        try {
          const { data, error } = await supabase.functions.invoke("generate-dissertative", {
            body: { action: "generate_answer_key", question_id: questionId, model: selectedModel },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          results.push({ topicId: topic.id, topicTitle: topic.title, step: "Gabarito", status: "success", questionId });
        } catch (err: any) {
          results.push({ topicId: topic.id, topicTitle: topic.title, step: "Gabarito", status: "error", error: err.message, questionId });
          setBulkResults([...results]);
          continue;
        }

        // Step 3: Generate model answer
        setBulkStepLabel(`${topic.title} — Resposta-Modelo`);
        try {
          const { data, error } = await supabase.functions.invoke("generate-dissertative", {
            body: { action: "generate_model_answer", question_id: questionId, model: selectedModel },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          results.push({ topicId: topic.id, topicTitle: topic.title, step: "Resposta-Modelo", status: "success", questionId });
        } catch (err: any) {
          results.push({ topicId: topic.id, topicTitle: topic.title, step: "Resposta-Modelo", status: "error", error: err.message, questionId });
          setBulkResults([...results]);
          continue;
        }

        // Step 4: Auto-publish
        setBulkStepLabel(`${topic.title} — Publicando`);
        try {
          const { error } = await supabase
            .from("dissertative_questions")
            .update({ is_active: true, status: "published", updated_at: new Date().toISOString() })
            .eq("id", questionId);
          if (error) throw new Error(error.message);
          results.push({ topicId: topic.id, topicTitle: topic.title, step: "Publicação", status: "success", questionId });
          successCount++;
        } catch (err: any) {
          results.push({ topicId: topic.id, topicTitle: topic.title, step: "Publicação", status: "error", error: err.message, questionId });
        }
      } else {
        successCount++;
      }

      setBulkResults([...results]);
    }

    setBulkGenerating(false);
    setBulkStepLabel("");
    toast.success(`${successCount}/${topicsList.length} tópicos processados`);
    fetchTopics();
    setSelectedTopicIds(new Set());
    if (selectedTopic) fetchTopicQuestions(selectedTopic.id);
  };

  // Bulk repair: re-generate missing fields for all questions with problems
  const handleBulkRepair = async () => {
    if (!selectedCourse || !selectedDiscipline) { toast.error("Selecione curso e disciplina"); return; }
    setBulkRepairing(true);
    setBulkResults([]);
    const results: typeof bulkResults = [];

    // Fetch all questions for this discipline
    const { data: allQuestions } = await supabase
      .from("dissertative_questions")
      .select("id, topic_id, statement, answer_key, model_answer, status, is_active")
      .eq("course_id", selectedCourse)
      .eq("discipline_id", selectedDiscipline);

    if (!allQuestions || allQuestions.length === 0) {
      toast.error("Nenhuma questão encontrada");
      setBulkRepairing(false);
      return;
    }

    // Find questions with problems
    const problemQuestions = allQuestions.filter(q =>
      !q.statement || !q.answer_key || !q.model_answer || q.status === "draft"
    );

    if (problemQuestions.length === 0) {
      toast.success("Todas as questões estão completas! Nenhum reparo necessário.");
      setBulkRepairing(false);
      return;
    }

    setBulkProgress({ current: 0, total: problemQuestions.length });
    let successCount = 0;

    for (let i = 0; i < problemQuestions.length; i++) {
      const q = problemQuestions[i];
      const topicTitle = topics.find(t => t.id === q.topic_id)?.title || q.topic_id || "?";
      setBulkProgress({ current: i + 1, total: problemQuestions.length });

      // Re-generate missing answer_key
      if (q.statement && !q.answer_key) {
        setBulkStepLabel(`${topicTitle} — Gabarito`);
        try {
          const { data, error } = await supabase.functions.invoke("generate-dissertative", {
            body: { action: "generate_answer_key", question_id: q.id, model: selectedModel },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          results.push({ topicId: q.topic_id || "", topicTitle, step: "Gabarito", status: "success", questionId: q.id });
        } catch (err: any) {
          results.push({ topicId: q.topic_id || "", topicTitle, step: "Gabarito", status: "error", error: err.message, questionId: q.id });
          setBulkResults([...results]);
          continue;
        }
      }

      // Re-generate missing model_answer
      if (q.statement && !q.model_answer) {
        setBulkStepLabel(`${topicTitle} — Resposta-Modelo`);
        try {
          const { data, error } = await supabase.functions.invoke("generate-dissertative", {
            body: { action: "generate_model_answer", question_id: q.id, model: selectedModel },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          results.push({ topicId: q.topic_id || "", topicTitle, step: "Resposta-Modelo", status: "success", questionId: q.id });
        } catch (err: any) {
          results.push({ topicId: q.topic_id || "", topicTitle, step: "Resposta-Modelo", status: "error", error: err.message, questionId: q.id });
          setBulkResults([...results]);
          continue;
        }
      }

      // Auto-publish if all fields are now present
      if (q.status === "draft" || !q.is_active) {
        setBulkStepLabel(`${topicTitle} — Publicando`);
        try {
          const { error } = await supabase
            .from("dissertative_questions")
            .update({ is_active: true, status: "published", updated_at: new Date().toISOString() })
            .eq("id", q.id);
          if (error) throw new Error(error.message);
          results.push({ topicId: q.topic_id || "", topicTitle, step: "Publicação", status: "success", questionId: q.id });
          successCount++;
        } catch (err: any) {
          results.push({ topicId: q.topic_id || "", topicTitle, step: "Publicação", status: "error", error: err.message, questionId: q.id });
        }
      } else {
        successCount++;
      }

      setBulkResults([...results]);
    }

    setBulkRepairing(false);
    setBulkStepLabel("");
    toast.success(`${successCount}/${problemQuestions.length} questões reparadas`);
    fetchTopics();
    if (selectedTopic) fetchTopicQuestions(selectedTopic.id);
  };

  // Multi-discipline bulk pipeline: generates full pipeline for all disciplines without questions
  const handleOpenMultiDisciplineDialog = async () => {
    if (!selectedCourse) { toast.error("Selecione um curso primeiro"); return; }
    setMultiDisciplineLoading(true);
    setShowMultiDisciplineDialog(true);
    setMultiDisciplineCandidates([]);
    setMultiDisciplineSelected(new Set());
    setMultiDisciplineResults([]);

    const { data: courseDiscs } = await supabase
      .from("dissertative_course_disciplines")
      .select("discipline_id, study_disciplines:discipline_id(id, name)")
      .eq("course_id", selectedCourse)
      .eq("is_active", true)
      .order("display_order");

    if (!courseDiscs || courseDiscs.length === 0) { toast.error("Nenhuma disciplina encontrada"); setMultiDisciplineLoading(false); return; }

    const candidates: typeof multiDisciplineCandidates = [];
    for (const dc of courseDiscs) {
      const disc = (dc as any).study_disciplines;
      if (!disc) continue;
      const { count } = await supabase
        .from("dissertative_questions")
        .select("id", { count: "exact", head: true })
        .eq("course_id", selectedCourse)
        .eq("discipline_id", disc.id)
        .eq("is_active", true);
      const { count: topicCount } = await supabase
        .from("dissertative_topics")
        .select("id", { count: "exact", head: true })
        .eq("course_id", selectedCourse)
        .eq("discipline_id", disc.id)
        .eq("is_active", true);
      if ((count || 0) === 0) {
        candidates.push({ id: disc.id, name: disc.name, topicCount: topicCount || 0 });
      }
    }

    setMultiDisciplineCandidates(candidates);
    setMultiDisciplineSelected(new Set(candidates.map(c => c.id)));
    setMultiDisciplineLoading(false);

    if (candidates.length === 0) {
      toast.success("Todas as disciplinas já possuem questões!");
    }
  };

  const handleStartMultiDisciplinePipeline = async () => {
    const selectedDiscs = multiDisciplineCandidates.filter(c => multiDisciplineSelected.has(c.id));
    if (selectedDiscs.length === 0) { toast.error("Selecione ao menos uma disciplina"); return; }

    setMultiDisciplineRunning(true);
    const results: typeof multiDisciplineResults = [];
    let totalSuccess = 0;

    for (let dIdx = 0; dIdx < selectedDiscs.length; dIdx++) {
      const disc = selectedDiscs[dIdx];

      // Fetch topics for this discipline
      const { data: discTopics } = await supabase
        .from("dissertative_topics")
        .select("id, title")
        .eq("course_id", selectedCourse)
        .eq("discipline_id", disc.id)
        .eq("is_active", true)
        .order("display_order");

      if (!discTopics || discTopics.length === 0) {
        results.push({ discipline: disc.name, topicTitle: "(sem tópicos)", step: "Skip", status: "error", error: "Nenhum tópico cadastrado" });
        setMultiDisciplineResults([...results]);
        continue;
      }

      for (let tIdx = 0; tIdx < discTopics.length; tIdx++) {
        const topic = discTopics[tIdx];
        setMultiDisciplineProgress({
          discipline: disc.name, topic: topic.title,
          dIdx: dIdx + 1, dTotal: selectedDiscs.length,
          tIdx: tIdx + 1, tTotal: discTopics.length,
          step: "Questão"
        });

        // Step 1: Generate question
        let questionId: string | null = null;
        try {
          const { data, error } = await supabase.functions.invoke("generate-dissertative", {
            body: { action: "generate_question", course_id: selectedCourse, discipline_id: disc.id, topic_id: topic.id, model: selectedModel },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          questionId = data?.question_id;
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Questão", status: "success" });
        } catch (err: any) {
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Questão", status: "error", error: err.message });
          setMultiDisciplineResults([...results]);
          continue;
        }

        if (!questionId) continue;

        // Step 2: Generate answer key
        setMultiDisciplineProgress(p => ({ ...p, step: "Gabarito" }));
        try {
          const { data, error } = await supabase.functions.invoke("generate-dissertative", {
            body: { action: "generate_answer_key", question_id: questionId, model: selectedModel },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Gabarito", status: "success" });
        } catch (err: any) {
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Gabarito", status: "error", error: err.message });
          setMultiDisciplineResults([...results]);
          continue;
        }

        // Step 3: Generate model answer
        setMultiDisciplineProgress(p => ({ ...p, step: "Resposta-Modelo" }));
        try {
          const { data, error } = await supabase.functions.invoke("generate-dissertative", {
            body: { action: "generate_model_answer", question_id: questionId, model: selectedModel },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Resposta-Modelo", status: "success" });
        } catch (err: any) {
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Resposta-Modelo", status: "error", error: err.message });
          setMultiDisciplineResults([...results]);
          continue;
        }

        // Step 4: Publish
        setMultiDisciplineProgress(p => ({ ...p, step: "Publicação" }));
        try {
          const { error } = await supabase
            .from("dissertative_questions")
            .update({ is_active: true, status: "published", updated_at: new Date().toISOString() })
            .eq("id", questionId);
          if (error) throw new Error(error.message);
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Publicação", status: "success" });
          totalSuccess++;
        } catch (err: any) {
          results.push({ discipline: disc.name, topicTitle: topic.title, step: "Publicação", status: "error", error: err.message });
        }

        setMultiDisciplineResults([...results]);
      }
    }

    setMultiDisciplineRunning(false);
    toast.success(`Pipeline concluído: ${totalSuccess} questões geradas e publicadas`);
  };

  // Toggle topic selection
  const toggleTopicSelect = (id: string) => {
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllTopics = () => {
    if (selectedTopicIds.size === filteredTopics.length) {
      setSelectedTopicIds(new Set());
    } else {
      setSelectedTopicIds(new Set(filteredTopics.map(t => t.id)));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Pipeline de Questões Dissertativas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
          {/* Column A: Context Selection */}
          <div className="lg:col-span-3 space-y-3">
            <div>
              <Label className="text-xs font-medium">Curso</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Cover image upload */}
            {selectedCourse && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Capa do Curso</Label>
                {(() => {
                  const currentCourse = courses.find(c => c.id === selectedCourse);
                  return currentCourse?.image_url ? (
                    <div className="relative group">
                      <img
                        src={currentCourse.image_url}
                        alt="Capa"
                        className="w-full h-24 object-cover rounded-md border"
                      />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md cursor-pointer">
                        <span className="text-white text-xs font-medium">Trocar capa</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                      {uploadingCover ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Upload da capa</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
                    </label>
                  );
                })()}
              </div>
            )}
            <div>
              <Label className="text-xs font-medium">Disciplina</Label>
              <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline} disabled={!selectedCourse}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {disciplines.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedCourse && (
                <Button
                  variant="ghost" size="sm"
                  className="w-full mt-1 text-xs text-muted-foreground hover:text-primary h-7"
                  onClick={() => { fetchAllStudyDisciplines(); setAddDisciplineOpen(true); }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar disciplina manualmente
                </Button>
              )}
            </div>

            {/* Dialog: Add discipline manually */}
            <Dialog open={addDisciplineOpen} onOpenChange={setAddDisciplineOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar Disciplina ao Curso</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Buscar disciplina existente</Label>
                    <Input
                      placeholder="Filtrar por nome..."
                      value={disciplineSearchQuery}
                      onChange={e => setDisciplineSearchQuery(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <ScrollArea className="h-60 border rounded-md p-2">
                    {allStudyDisciplines
                      .filter(d => !disciplineSearchQuery || d.name.toLowerCase().includes(disciplineSearchQuery.toLowerCase()))
                      .map(d => {
                        const alreadyLinked = disciplines.some(ld => ld.id === d.id);
                        return (
                          <button
                            key={d.id}
                            className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors ${alreadyLinked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            disabled={alreadyLinked || addingDiscipline}
                            onClick={() => handleAddExistingDiscipline(d.id)}
                          >
                            <span>{d.name}</span>
                            {alreadyLinked && <Badge variant="secondary" className="ml-2 text-[10px]">já vinculada</Badge>}
                          </button>
                        );
                      })}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
            <div>
              <Label className="text-xs font-medium">Modelo de IA</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      <span className="text-muted-foreground mr-1">{m.group}</span> {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Button
                variant="outline" size="sm" className="w-full justify-start"
                disabled={!selectedCourse || !selectedDiscipline}
                onClick={() => setImportOpen(true)}
              >
                <Upload className="w-4 h-4 mr-2" /> Importar Tópicos
              </Button>
              <Button
                variant="outline" size="sm" className="w-full justify-start text-left whitespace-normal h-auto min-h-[2rem] py-1.5"
                disabled={!selectedCourse || !selectedDiscipline || bulkRepairing || bulkGenerating}
                onClick={handleBulkRepair}
              >
                {bulkRepairing ? (
                  <><Loader2 className="w-4 h-4 mr-2 shrink-0 animate-spin" /> Reparando {bulkProgress.current}/{bulkProgress.total}</>
                ) : (
                  <><AlertTriangle className="w-4 h-4 mr-2 shrink-0" /> Re-gerar campos com problemas</>
                )}
              </Button>
              {bulkRepairing && bulkStepLabel && (
                <p className="text-xs text-muted-foreground animate-pulse truncate">{bulkStepLabel}</p>
              )}
              <Button
                variant="outline" size="sm" className="w-full justify-start text-left whitespace-normal h-auto min-h-[2rem] py-1.5 border-primary/30 text-primary"
                disabled={!selectedCourse || multiDisciplineRunning || bulkGenerating || bulkRepairing}
                onClick={handleOpenMultiDisciplineDialog}
              >
                {multiDisciplineRunning ? (
                  <><Loader2 className="w-4 h-4 mr-2 shrink-0 animate-spin" /> Pipeline multi-disciplinas em andamento...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2 shrink-0" /> Pipeline Multi-Disciplinas</>
                )}
              </Button>
            </div>

            {/* Bulk actions */}
            {selectedTopicIds.size > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">{selectedTopicIds.size} selecionados</p>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio" name="bulkMode" value="full_pipeline"
                      checked={bulkMode === "full_pipeline"}
                      onChange={() => setBulkMode("full_pipeline")}
                      className="accent-primary"
                    />
                    Pipeline completo (4 etapas)
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio" name="bulkMode" value="question_only"
                      checked={bulkMode === "question_only"}
                      onChange={() => setBulkMode("question_only")}
                      className="accent-primary"
                    />
                    Apenas questão
                  </label>
                </div>
                <Button
                  variant="default" size="sm" className="w-full"
                  onClick={handleBulkGenerate}
                  disabled={bulkGenerating}
                >
                  {bulkGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {bulkProgress.current}/{bulkProgress.total}</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> {bulkMode === "full_pipeline" ? "Gerar pipeline completo" : "Gerar questões"}</>
                  )}
                </Button>
                <Button
                  variant="destructive" size="sm" className="w-full"
                  onClick={handleDeleteSelectedTopics}
                  disabled={bulkGenerating || bulkRepairing}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir selecionados
                </Button>
                {bulkGenerating && bulkStepLabel && (
                  <p className="text-xs text-muted-foreground animate-pulse truncate">{bulkStepLabel}</p>
                )}
              </div>
            )}
          </div>

          {/* Column B: Topics List */}
          <div className="lg:col-span-4 border rounded-lg">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Tópicos</h3>
                <Badge variant="secondary" className="text-xs">{filteredTopics.length}</Badge>
              </div>
              <Select value={topicFilter} onValueChange={v => setTopicFilter(v as any)}>
                <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="no_question">Sem questão</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedCourse && selectedDiscipline && filteredTopics.length > 0 && (
              <div className="px-3 py-1 border-b">
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={selectAllTopics}>
                  <Checkbox checked={selectedTopicIds.size === filteredTopics.length && filteredTopics.length > 0} className="mr-1.5 h-3 w-3" />
                  Selecionar todos
                </Button>
              </div>
            )}
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredTopics.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  {!selectedCourse || !selectedDiscipline ? "Selecione curso e disciplina" : "Nenhum tópico encontrado"}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredTopics.map(topic => {
                    const status = topicStatusMap[topic.id] || "no_question";
                    return (
                      <div
                        key={topic.id}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${selectedTopic?.id === topic.id ? "bg-primary/10" : ""}`}
                        onClick={() => setSelectedTopic(topic)}
                      >
                        <Checkbox
                          checked={selectedTopicIds.has(topic.id)}
                          onCheckedChange={() => toggleTopicSelect(topic.id)}
                          onClick={e => e.stopPropagation()}
                          className="h-3.5 w-3.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{topic.title}</p>
                        </div>
                        <Badge
                          variant={status === "published" ? "default" : status === "draft" ? "outline" : "secondary"}
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {status === "published" ? "✓" : status === "draft" ? "Rascunho" : "—"}
                        </Badge>
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Column C: Question Pipeline */}
          <div className="lg:col-span-5 border rounded-lg">
            <div className="p-3 border-b">
              <h3 className="text-sm font-medium">
                {selectedTopic ? `Pipeline: ${selectedTopic.title}` : "Selecione um tópico"}
              </h3>
            </div>
            {selectedTopic ? (
              <ScrollArea className="h-[500px]">
                <div className="p-4 space-y-4">
                   {/* Re-generate all button */}
                   <div className="flex justify-end">
                     <Button
                       size="sm"
                       variant="destructive"
                       onClick={handleRegenerateAll}
                       disabled={regeneratingAll || !!generating}
                     >
                       {regeneratingAll ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                       Re-gerar Tudo (Questão Completa)
                     </Button>
                   </div>

                   {/* Step 1: Question */}
                   <PipelineStep
                    step={1}
                    title="Questão (Enunciado)"
                    content={selectedQuestion?.statement || ""}
                    onContentChange={v => setSelectedQuestion(prev => prev ? { ...prev, statement: v } : null)}
                    onGenerate={() => handleGenerate("generate_question")}
                    onRegenerate={() => handleGenerate("generate_question")}
                    generating={generating === "generate_question"}
                    hasContent={!!selectedQuestion?.statement}
                    version={selectedQuestion?.version}
                  />

                  {/* Step 2: Answer Key */}
                  <PipelineStep
                    step={2}
                    title="Gabarito Comentado"
                    content={selectedQuestion?.answer_key || ""}
                    onContentChange={v => setSelectedQuestion(prev => prev ? { ...prev, answer_key: v } : null)}
                    onGenerate={() => handleGenerate("generate_answer_key")}
                    onRegenerate={() => handleGenerate("generate_answer_key")}
                    generating={generating === "generate_answer_key"}
                    hasContent={!!selectedQuestion?.answer_key}
                    disabled={!selectedQuestion?.statement}
                  />

                  {/* Step 3: Model Answer */}
                  <PipelineStep
                    step={3}
                    title="Resposta-Modelo"
                    content={selectedQuestion?.model_answer || ""}
                    onContentChange={v => setSelectedQuestion(prev => prev ? { ...prev, model_answer: v } : null)}
                    onGenerate={() => handleGenerate("generate_model_answer")}
                    onRegenerate={() => handleGenerate("generate_model_answer")}
                    generating={generating === "generate_model_answer"}
                    hasContent={!!selectedQuestion?.model_answer}
                    disabled={!selectedQuestion?.answer_key}
                  />

                  {/* Step 4: Publish */}
                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">4</Badge>
                      <span className="text-sm font-medium">Publicação</span>
                    </div>
                    {selectedQuestion ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={selectedQuestion.is_active}
                            onCheckedChange={v => setSelectedQuestion(prev => prev ? { ...prev, is_active: v } : null)}
                          />
                          <Label className="text-sm">{selectedQuestion.is_active ? "Ativo (visível ao aluno)" : "Inativo"}</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveQuestion}>
                            <Save className="w-4 h-4 mr-1" /> Salvar tudo
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Status: <Badge variant="outline" className="text-xs">{selectedQuestion.status}</Badge>
                          {" · "}Versão {selectedQuestion.version}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Gere uma questão primeiro.</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground text-sm">
                Selecione um tópico à esquerda
              </div>
            )}
          </div>
        </div>

        {/* Bulk Results Panel */}
        {bulkResults.length > 0 && (
          <div className="mt-4 border rounded-lg">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Resultado da Geração em Massa
              </h3>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-xs">
                  ✓ {bulkResults.filter(r => r.status === "success").length}
                </Badge>
                {bulkResults.some(r => r.status === "error") && (
                  <Badge variant="destructive" className="text-xs">
                    ✗ {bulkResults.filter(r => r.status === "error").length}
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setBulkResults([])}>
                  Limpar
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {/* Show errors first, then successes */}
                {[...bulkResults]
                  .sort((a, b) => (a.status === "error" ? -1 : 1) - (b.status === "error" ? -1 : 1))
                  .map((result, idx) => (
                  <div key={idx} className={`px-3 py-2 flex items-center gap-3 text-xs ${result.status === "error" ? "bg-destructive/5" : ""}`}>
                    <span className={`shrink-0 ${result.status === "error" ? "text-destructive" : "text-green-500"}`}>
                      {result.status === "error" ? "✗" : "✓"}
                    </span>
                    <span className="font-medium truncate flex-1 min-w-0">{result.topicTitle}</span>
                    <Badge variant={result.status === "error" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                      {result.step}
                    </Badge>
                    {result.status === "error" && result.error && (
                      <span className="text-destructive truncate max-w-[200px]" title={result.error}>
                        {result.error}
                      </span>
                    )}
                    {result.status === "error" && result.questionId && (
                      <Button
                        variant="outline" size="sm" className="h-5 text-[10px] px-2 shrink-0"
                        onClick={() => {
                          // Find the topic and select it to retry from the pipeline
                          const topic = topics.find(t => t.id === result.topicId);
                          if (topic) setSelectedTopic(topic);
                        }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Reprocessar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar Tópicos</DialogTitle>
            </DialogHeader>
            <Tabs value={importMode} onValueChange={v => setImportMode(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">Colar Lista</TabsTrigger>
                <TabsTrigger value="pdf" className="flex-1">Upload PDF</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="space-y-3 mt-3">
                <Label className="text-xs">1 tópico por linha</Label>
                <Textarea
                  rows={12}
                  placeholder={"Tópico 1\nTópico 2\nTópico 3"}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
                {importText && (
                  <p className="text-xs text-muted-foreground">
                    {mergeTopicLines(importText).length} tópicos detectados (com merge automático de linhas quebradas)
                  </p>
                )}
              </TabsContent>
              <TabsContent value="pdf" className="space-y-3 mt-3">
                <Label>Upload do PDF do Edital</Label>
                <Input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={pdfExtracting} />
                {pdfExtracting ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extraindo tópicos do PDF com IA... Aguarde.
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    O PDF será enviado para a IA extrair automaticamente os tópicos. Após extração, revise na aba "Colar Lista".
                  </p>
                )}
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button onClick={handleImportTopics} disabled={!importText.trim()}>
                <Save className="w-4 h-4 mr-1" /> Salvar Tópicos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Multi-discipline pipeline dialog */}
        <Dialog open={showMultiDisciplineDialog} onOpenChange={v => { if (!multiDisciplineRunning) setShowMultiDisciplineDialog(v); }}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Pipeline Multi-Disciplinas
              </DialogTitle>
            </DialogHeader>

            {/* Selection phase */}
            {!multiDisciplineRunning && multiDisciplineResults.length === 0 && (
              <>
                {multiDisciplineLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Carregando disciplinas...</span>
                  </div>
                ) : multiDisciplineCandidates.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Todas as disciplinas já possuem questões!</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs text-muted-foreground">{multiDisciplineSelected.size} de {multiDisciplineCandidates.length} selecionadas</p>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                        if (multiDisciplineSelected.size === multiDisciplineCandidates.length) setMultiDisciplineSelected(new Set());
                        else setMultiDisciplineSelected(new Set(multiDisciplineCandidates.map(c => c.id)));
                      }}>
                        {multiDisciplineSelected.size === multiDisciplineCandidates.length ? "Desmarcar todas" : "Selecionar todas"}
                      </Button>
                    </div>
                    <ScrollArea className="max-h-[40vh]">
                      <div className="space-y-1">
                        {multiDisciplineCandidates.map(disc => (
                          <label key={disc.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                            <Checkbox
                              checked={multiDisciplineSelected.has(disc.id)}
                              onCheckedChange={(checked) => {
                                setMultiDisciplineSelected(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(disc.id); else next.delete(disc.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="text-sm flex-1">{disc.name}</span>
                            <Badge variant="outline" className="text-[10px]">{disc.topicCount} tópicos</Badge>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                    <DialogFooter>
                      <Button variant="outline" size="sm" onClick={() => setShowMultiDisciplineDialog(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleStartMultiDisciplinePipeline} disabled={multiDisciplineSelected.size === 0}>
                        <Sparkles className="w-4 h-4 mr-2" /> Iniciar Pipeline ({multiDisciplineSelected.size})
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </>
            )}

            {/* Progress phase */}
            {multiDisciplineRunning && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{multiDisciplineProgress.discipline}</span>
                  <Badge variant="secondary">Disciplina {multiDisciplineProgress.dIdx}/{multiDisciplineProgress.dTotal}</Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{multiDisciplineProgress.topic}</span>
                  <span>Tópico {multiDisciplineProgress.tIdx}/{multiDisciplineProgress.tTotal} — {multiDisciplineProgress.step}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: multiDisciplineProgress.dTotal > 0
                        ? `${(((multiDisciplineProgress.dIdx - 1) * multiDisciplineProgress.tTotal + multiDisciplineProgress.tIdx) / (multiDisciplineProgress.dTotal * multiDisciplineProgress.tTotal)) * 100}%`
                        : "0%"
                    }}
                  />
                </div>
              </div>
            )}

            {/* Results */}
            {multiDisciplineResults.length > 0 && (
              <ScrollArea className="max-h-[50vh]">
                <div className="divide-y">
                  {multiDisciplineResults
                    .slice()
                    .reverse()
                    .filter(r => r.step === "Publicação" || r.status === "error")
                    .map((result, idx) => (
                    <div key={idx} className={`px-3 py-2 flex items-center gap-3 text-xs ${result.status === "error" ? "bg-destructive/5" : ""}`}>
                      <span className={`shrink-0 ${result.status === "error" ? "text-destructive" : "text-green-500"}`}>
                        {result.status === "error" ? "✗" : "✓"}
                      </span>
                      <span className="text-muted-foreground shrink-0 w-32 truncate">{result.discipline}</span>
                      <span className="font-medium truncate flex-1 min-w-0">{result.topicTitle}</span>
                      <Badge variant={result.status === "error" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                        {result.step}
                      </Badge>
                      {result.status === "error" && result.error && (
                        <span className="text-destructive truncate max-w-[200px]" title={result.error}>
                          {result.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {!multiDisciplineRunning && multiDisciplineResults.length > 0 && (
              <DialogFooter>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="secondary" className="text-xs">
                    ✓ {multiDisciplineResults.filter(r => r.step === "Publicação" && r.status === "success").length} publicadas
                  </Badge>
                  <Badge variant="destructive" className="text-xs">
                    ✗ {multiDisciplineResults.filter(r => r.status === "error").length} erros
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowMultiDisciplineDialog(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Pipeline Step Component
function PipelineStep({
  step, title, content, onContentChange, onGenerate, onRegenerate,
  generating, hasContent, disabled, version,
}: {
  step: number; title: string; content: string;
  onContentChange: (v: string) => void;
  onGenerate: () => void; onRegenerate: () => void;
  generating: boolean; hasContent: boolean;
  disabled?: boolean; version?: number;
}) {
  return (
    <div className={`border rounded-lg p-3 space-y-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={hasContent ? "default" : "outline"} className="text-xs">{step}</Badge>
          <span className="text-sm font-medium">{title}</span>
          {version && <span className="text-xs text-muted-foreground">v{version}</span>}
        </div>
        <div className="flex gap-1">
          {!hasContent ? (
            <Button size="sm" variant="default" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
              Gerar
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onRegenerate} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Re-gerar
            </Button>
          )}
        </div>
      </div>
      <Textarea
        rows={6}
        value={content}
        onChange={e => onContentChange(e.target.value)}
        placeholder={disabled ? "Complete a etapa anterior" : "Conteúdo aparecerá aqui após geração..."}
        className="text-xs"
      />
    </div>
  );
}
