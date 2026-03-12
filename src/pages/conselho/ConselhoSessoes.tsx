import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { ArrowLeft, PlayCircle, FileText, Crown, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConselhoThemeWrapper from '@/components/ConselhoThemeWrapper';
import imgBgTexture from '@/assets/conselho/bg-texture.jpg';
import logoDqIcon from '@/assets/logo-dq-icon.png';

interface ConselhoSession {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  thumbnail_url: string | null;
  display_order: number;
}

export default function ConselhoSessoes() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<ConselhoSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    const fetchSessions = async () => {
      const { data, error } = await (supabase
        .from('conselho_sessions') as any)
        .select('id, title, description, video_url, pdf_url, thumbnail_url, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error) setSessions(data || []);
      setLoading(false);
    };

    if (user) fetchSessions();
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
        {/* Paper texture */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={imgBgTexture} alt="" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-[#1a1a20]/35" />
        </div>

        {/* Header */}
        <header className="relative z-20 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/conselho-if')}
              className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>
            <div className="flex items-center gap-2.5">
              <img src={logoDqIcon} alt="DQ" className="w-8 h-8 rounded-lg" />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Sessões Gravadas
                </h1>
                <p className="text-[11px] text-white/40 font-medium tracking-wide uppercase">
                  Conselho IF
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {sessions.length === 0 ? (
            <div className="text-center py-20">
              <PlayCircle className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <p className="text-white/40 text-lg">Nenhuma sessão disponível ainda</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session, idx) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.35 }}
                  className="group rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur-sm overflow-hidden hover:border-amber-500/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    {session.thumbnail_url && (
                      <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                        <img
                          src={session.thumbnail_url}
                          alt={session.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 p-5 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white mb-1">{session.title}</h3>
                        {session.description && (
                          <p className="text-sm text-white/50 line-clamp-2">{session.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        {session.video_url && (
                          <a
                            href={session.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 transition-colors"
                          >
                            <PlayCircle className="w-4 h-4" />
                            Assistir
                          </a>
                        )}
                        {session.pdf_url && (
                          <a
                            href={session.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/70 text-sm font-semibold hover:bg-white/10 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </ConselhoThemeWrapper>
  );
}
