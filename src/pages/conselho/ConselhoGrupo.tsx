import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, ExternalLink, Loader2, Crown } from 'lucide-react';
import ConselhoThemeWrapper from '@/components/ConselhoThemeWrapper';
import imgBgTexture from '@/assets/conselho/bg-texture.jpg';
import logoDqIcon from '@/assets/logo-dq-icon.png';

export default function ConselhoGrupo() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<{ group_name: string; group_link: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    const fetch = async () => {
      if (!user) return;
      const { data, error } = await (supabase
        .from('conselho_student_groups') as any)
        .select('group_name, group_link')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) setGroup(data);
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
            <button
              onClick={() => navigate('/conselho-if')}
              className="w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>
            <div className="flex items-center gap-2.5">
              <img src={logoDqIcon} alt="DQ" className="w-8 h-8 rounded-lg" />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">Grupo Individual</h1>
                <p className="text-[11px] text-white/40 font-medium tracking-wide uppercase">Conselho IF</p>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          {!group || !group.group_link ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <Users className="w-14 h-14 mx-auto mb-4 text-white/15" />
              <h2 className="text-xl font-bold text-white/70 mb-2">Grupo ainda não configurado</h2>
              <p className="text-white/40">Seu grupo individual será disponibilizado em breve pelo seu mentor.</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-6"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Crown className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white mb-2">{group.group_name}</h2>
                <p className="text-white/50">Acesse seu grupo exclusivo de mentoria</p>
              </div>
              <a
                href={group.group_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-lg font-bold hover:bg-amber-500/20 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                Acessar Grupo
              </a>
            </motion.div>
          )}
        </main>
      </div>
    </ConselhoThemeWrapper>
  );
}
