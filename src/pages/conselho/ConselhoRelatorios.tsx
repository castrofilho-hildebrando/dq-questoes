import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Download, Loader2, Calendar } from 'lucide-react';
import ConselhoThemeWrapper from '@/components/ConselhoThemeWrapper';
import imgBgTexture from '@/assets/conselho/bg-texture.jpg';
import logoDqIcon from '@/assets/logo-dq-icon.png';

interface Report {
  id: string;
  title: string;
  week_start: string;
  week_end: string;
  pdf_url: string;
  created_at: string;
}

export default function ConselhoRelatorios() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate('/auth'); return; }

    const fetch = async () => {
      if (!user) return;
      const { data } = await (supabase.from('conselho_weekly_reports') as any)
        .select('id, title, week_start, week_end, pdf_url, created_at')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false });

      setReports(data || []);
      setLoading(false);
    };

    if (user) fetch();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#141418] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <ConselhoThemeWrapper>
      <div className="min-h-screen bg-[#1a1a20] text-white overflow-x-hidden relative">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={imgBgTexture} alt="" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-[#1a1a20]/35" />
        </div>

        <header className="relative z-20 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <button onClick={() => navigate('/conselho-if')} className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>
            <div className="flex items-center gap-2.5">
              <img src={logoDqIcon} alt="DQ" className="w-8 h-8 rounded-lg" />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">Relatórios Semanais</h1>
                <p className="text-[11px] text-white/40 font-medium tracking-wide uppercase">Conselho IF</p>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {reports.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <p className="text-white/40 text-lg">Nenhum relatório disponível ainda</p>
              <p className="text-white/25 text-sm mt-1">Seus relatórios semanais aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report, idx) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur-sm p-5 flex items-center justify-between gap-4 hover:border-amber-500/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{report.title}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3 text-white/30" />
                        <p className="text-xs text-white/40">
                          {new Date(report.week_start).toLocaleDateString('pt-BR')} — {new Date(report.week_end).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <a
                    href={report.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/70 text-sm font-semibold hover:bg-white/10 transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </a>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </ConselhoThemeWrapper>
  );
}
