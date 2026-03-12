import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { RequireUserAreas } from "@/components/RequireUserAreas";
import { RequireCardAccess } from "@/components/auth/RequireCardAccess";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { BuildInfo } from "@/components/BuildInfo";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Gateway from "./pages/Gateway";
import StudentWelcome from "./pages/StudentWelcome";
import QuestionsDashboard from "./pages/QuestionsDashboard";
import Cadernos from "./pages/Cadernos";
import Anotacoes from "./pages/Anotacoes";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import BancoQuestoes from "./pages/modules/BancoQuestoes";
import CadernoQuestoes from "./pages/modules/CadernoQuestoes";
import TrialRegistration from "./pages/TrialRegistration";
import CodigoIF from "./pages/CodigoIF";
import ConselhoIF from "./pages/ConselhoIF";
import ConselhoSessoes from "./pages/conselho/ConselhoSessoes";
import ConselhoGrupo from "./pages/conselho/ConselhoGrupo";
import ConselhoMentor from "./pages/conselho/ConselhoMentor";
import EncontrosAoVivo from "./pages/EncontrosAoVivo";
import GravacaoPlayer from "./pages/encontros/GravacaoPlayer";
import ConselhoRelatorios from "./pages/conselho/ConselhoRelatorios";
import CronogramaHome from "./pages/cronograma/CronogramaHome";
import CronogramaCriar from "./pages/cronograma/CronogramaCriar";
import CronogramaEstudo from "./pages/cronograma/CronogramaEstudo";
import CronogramaVisaoGeral from "./pages/cronograma/CronogramaVisaoGeral";
import CronogramaDashboard from "./pages/cronograma/CronogramaDashboard";
import CronogramaMaterial from "./pages/cronograma/CronogramaMaterial";
import TutorDashboard from "./pages/tutor/TutorDashboard";
import TutorChat from "./pages/tutor/TutorChat";
import TutorAdmin from "./pages/tutor/TutorAdmin";
import MateriaisDissecados from "./pages/MateriaisDissecados";
import MapaDasQuestoes from "./pages/MapaDasQuestoes";
import DissertativaCourses from "./pages/dissertativa/DissertativaCourses";
import DissertativaCourse from "./pages/dissertativa/DissertativaCourse";
import DissertativaDiscipline from "./pages/dissertativa/DissertativaDiscipline";
import DissertativaQuestion from "./pages/dissertativa/DissertativaQuestion";
import DissertativaMateriais from "./pages/dissertativa/DissertativaMateriais";
import DissertativaMaterialPlayer from "./pages/dissertativa/DissertativaMaterialPlayer";
import DidaticaHome from "./pages/didatica/DidaticaHome";
import DidaticaPlayer from "./pages/didatica/DidaticaPlayer";
import TutoriaisHome from "./pages/tutoriais/TutoriaisHome";
import TutoriaisPlayer from "./pages/tutoriais/TutoriaisPlayer";
import Comunidades from "./pages/Comunidades";

const queryClient = new QueryClient();

// Limpeza única de localStorage legado (persistência de filtros removida)
const CLEANUP_KEY = "question_bank_legacy_cleanup_v1";
function cleanupLegacyStorage() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(CLEANUP_KEY)) return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("question_bank_state_") || key === "question_bank_audit_log")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(CLEANUP_KEY, Date.now().toString());
    if (keysToRemove.length > 0) {
      console.log(`[App] Cleaned up ${keysToRemove.length} legacy localStorage keys`);
    }
  } catch (e) {
    console.warn("[App] Failed to cleanup legacy storage:", e);
  }
}

const App = () => {
  useEffect(() => {
    cleanupLegacyStorage();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="conselho-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <RequireUserAreas>
                <Toaster />
                <Sonner />
                <UpdatePrompt />
                <BuildInfo showInProduction={true} />
                <BrowserRouter>
                  <Routes>
                    {/* ── Rotas públicas (sem guard de produto) ── */}
                    <Route path="/" element={<Gateway />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/trial" element={<TrialRegistration />} />

                    {/* Admin — guard de role existente na própria página */}
                    <Route path="/admin" element={<Admin />} />

                    {/* ── Dossiê IF — acessível a qualquer produto ── */}
                    <Route
                      path="/dossie-if"
                      element={
                        <RequireCardAccess cardId="dossie-if">
                          <StudentWelcome />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Banco de Questões ── */}
                    <Route
                      path="/banco-questoes"
                      element={
                        <RequireCardAccess cardId="banco-questoes">
                          <BancoQuestoes />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/banco-questoes/dashboard"
                      element={
                        <RequireCardAccess cardId="banco-questoes">
                          <QuestionsDashboard />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/cadernos"
                      element={
                        <RequireCardAccess cardId="banco-questoes">
                          <Cadernos />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/caderno-questoes"
                      element={
                        <RequireCardAccess cardId="banco-questoes">
                          <CadernoQuestoes />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/anotacoes"
                      element={
                        <RequireCardAccess cardId="banco-questoes">
                          <Anotacoes />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Mapa das Questões ── */}
                    <Route
                      path="/mapa-das-questoes"
                      element={
                        <RequireCardAccess cardId="mapa-questoes">
                          <MapaDasQuestoes />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Cronograma — exclusivo Dossiê IF ── */}
                    <Route
                      path="/cronograma"
                      element={
                        <RequireCardAccess cardId="cronograma">
                          <CronogramaHome />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/cronograma/dashboard"
                      element={
                        <RequireCardAccess cardId="cronograma">
                          <CronogramaDashboard />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/encontros-ao-vivo"
                      element={
                        <RequireCardAccess cardId="dossie-if">
                          <EncontrosAoVivo />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/encontros-ao-vivo/:moduleId"
                      element={
                        <RequireCardAccess cardId="dossie-if">
                          <GravacaoPlayer />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/cronograma/criar"
                      element={
                        <RequireCardAccess cardId="cronograma">
                          <CronogramaCriar />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/cronograma/:id"
                      element={
                        <RequireCardAccess cardId="cronograma">
                          <CronogramaEstudo />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/cronograma/:id/configurar"
                      element={
                        <RequireCardAccess cardId="cronograma">
                          <CronogramaCriar />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/cronograma/:id/visao-geral"
                      element={
                        <RequireCardAccess cardId="cronograma">
                          <CronogramaVisaoGeral />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/cronograma/material/:materialId"
                      element={
                        <RequireCardAccess cardId="cronograma">
                          <CronogramaMaterial />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Robô Tutor — exclusivo Dossiê IF ── */}
                    <Route
                      path="/tutor"
                      element={
                        <RequireCardAccess cardId="robo-tutor">
                          <TutorDashboard />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/tutor/chat/:robotId"
                      element={
                        <RequireCardAccess cardId="robo-tutor">
                          <TutorChat />
                        </RequireCardAccess>
                      }
                    />
                    {/* TutorAdmin mantém guard de role interno */}
                    <Route path="/tutor/admin" element={<TutorAdmin />} />

                    {/* ── Dissertativa — exclusivo Dossiê IF ── */}
                    <Route
                      path="/dissertativa"
                      element={
                        <RequireCardAccess cardId="dissecando-dissertativa">
                          <DissertativaCourses />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/dissertativa/:courseId"
                      element={
                        <RequireCardAccess cardId="dissecando-dissertativa">
                          <DissertativaCourse />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/dissertativa/:courseId/materiais"
                      element={
                        <RequireCardAccess cardId="dissecando-dissertativa">
                          <DissertativaMateriais />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/dissertativa/:courseId/materiais/:moduleId"
                      element={
                        <RequireCardAccess cardId="dissecando-dissertativa">
                          <DissertativaMaterialPlayer />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/dissertativa/:courseId/:disciplineId"
                      element={
                        <RequireCardAccess cardId="dissecando-dissertativa">
                          <DissertativaDiscipline />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/dissertativa/:courseId/:disciplineId/:questionId"
                      element={
                        <RequireCardAccess cardId="dissecando-dissertativa">
                          <DissertativaQuestion />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Materiais Dissecados — exclusivo Dossiê IF ── */}
                    <Route
                      path="/materiais-dissecados"
                      element={
                        <RequireCardAccess cardId="materiais-dissecados">
                          <MateriaisDissecados />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Código IF — exclusivo Código IF ── */}
                    <Route
                      path="/codigo-if"
                      element={
                        <RequireCardAccess cardId="codigo-if">
                          <CodigoIF />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Conselho IF — mentoria premium ── */}
                    <Route
                      path="/conselho-if"
                      element={
                        <RequireCardAccess cardId="conselho-if">
                          <ConselhoIF />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/conselho-if/sessoes"
                      element={
                        <RequireCardAccess cardId="conselho-if">
                          <ConselhoSessoes />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/conselho-if/grupo"
                      element={
                        <RequireCardAccess cardId="conselho-if">
                          <ConselhoGrupo />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/conselho-if/mentor"
                      element={
                        <RequireCardAccess cardId="conselho-if">
                          <ConselhoMentor />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/conselho-if/relatorios"
                      element={
                        <RequireCardAccess cardId="conselho-if">
                          <ConselhoRelatorios />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Dissecando a Didática ── */}
                    <Route
                      path="/didatica"
                      element={
                        <RequireCardAccess cardId="dissecando-didatica">
                          <DidaticaHome />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/didatica/:moduleId"
                      element={
                        <RequireCardAccess cardId="dissecando-didatica">
                          <DidaticaPlayer />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Tutoriais ── */}
                    <Route
                      path="/tutoriais"
                      element={
                        <RequireCardAccess cardId="dossie-if">
                          <TutoriaisHome />
                        </RequireCardAccess>
                      }
                    />
                    <Route
                      path="/tutoriais/:moduleId"
                      element={
                        <RequireCardAccess cardId="dossie-if">
                          <TutoriaisPlayer />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Comunidades ── */}
                    <Route
                      path="/comunidades"
                      element={
                        <RequireCardAccess cardId="comunidades-dissecadores">
                          <Comunidades />
                        </RequireCardAccess>
                      }
                    />

                    {/* ── Redirects legados ── */}
                    <Route path="/questoes" element={<Navigate to="/banco-questoes" replace />} />
                    <Route path="/dashboard" element={<Navigate to="/" replace />} />

                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </RequireUserAreas>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
