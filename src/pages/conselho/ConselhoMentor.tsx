import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Loader2, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import ConselhoThemeWrapper from '@/components/ConselhoThemeWrapper';
import imgBgTexture from '@/assets/conselho/bg-texture.jpg';
import logoDqIcon from '@/assets/logo-dq-icon.png';

interface MentorSlot {
  id?: string;
  slot_number: number;
  booking_link: string;
  status: 'disponivel' | 'agendado' | 'realizado';
  scheduled_at: string | null;
  notes: string | null;
}

const statusConfig = {
  disponivel: { label: 'Disponível', icon: Calendar, borderClass: 'border-white/[0.08]', bgClass: 'bg-white/[0.03]' },
  agendado: { label: 'Agendado', icon: Clock, borderClass: 'border-amber-500/30', bgClass: 'bg-amber-500/[0.06]' },
  realizado: { label: 'Realizado', icon: CheckCircle2, borderClass: 'border-green-500/30', bgClass: 'bg-green-500/[0.06]' },
};

export default function ConselhoMentor() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [slots, setSlots] = useState<MentorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalLink, setGlobalLink] = useState('');
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [updatingSlot, setUpdatingSlot] = useState(false);
  const calendlyContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: configData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('id', 'calendly_conselho_link')
      .single();
    setGlobalLink(configData?.value || '');

    const { data } = await (supabase.from('conselho_mentor_slots') as any)
      .select('id, slot_number, booking_link, status, scheduled_at, notes')
      .eq('user_id', user.id)
      .order('slot_number', { ascending: true });

    setSlots(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { navigate('/auth'); return; }
    if (user) fetchData();
  }, [user, authLoading, navigate, fetchData]);

  // Listen for Calendly event_scheduled message
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      if (e.data?.event === 'calendly.event_scheduled' && activeSlot !== null && user) {
        setUpdatingSlot(true);

        const existingSlot = slots.find(s => s.slot_number === activeSlot);

        if (existingSlot?.id) {
          await (supabase.from('conselho_mentor_slots') as any)
            .update({
              status: 'agendado',
              scheduled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSlot.id);
        } else {
          await (supabase.from('conselho_mentor_slots') as any)
            .insert({
              user_id: user.id,
              slot_number: activeSlot,
              booking_link: globalLink,
              status: 'agendado',
              scheduled_at: new Date().toISOString(),
            });
        }

        setActiveSlot(null);
        setUpdatingSlot(false);
        await fetchData();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeSlot, user, slots, globalLink, fetchData]);

  // Load Calendly widget script
  useEffect(() => {
    const scriptSrc = 'https://assets.calendly.com/assets/external/widget.js';
    if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Initialize Calendly widget when activeSlot changes
  useEffect(() => {
    if (activeSlot === null || !globalLink) return;

    const initWidget = () => {
      const container = document.getElementById('calendly-embed-container');
      if (!container) return;
      // Clear previous widget
      container.innerHTML = '';

      (window as any).Calendly?.initInlineWidget({
        url: `${globalLink}?hide_gdpr_banner=1&background_color=1a1a1a&text_color=ffcb3b&primary_color=ffcb3b`,
        parentElement: container,
      });
    };

    // Wait for script to load
    if ((window as any).Calendly) {
      initWidget();
    } else {
      const interval = setInterval(() => {
        if ((window as any).Calendly) {
          clearInterval(interval);
          initWidget();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [activeSlot, globalLink]);

  // Fill missing slots
  const allSlots: MentorSlot[] = [];
  for (let i = 1; i <= 5; i++) {
    const existing = slots.find(s => s.slot_number === i);
    allSlots.push(existing || { slot_number: i, booking_link: globalLink, status: 'disponivel', scheduled_at: null, notes: null });
  }

  const getBookingLink = (slot: MentorSlot) => slot.booking_link || globalLink;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#141418] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const realizados = allSlots.filter(s => s.status === 'realizado').length;

  const openCalendlyEmbed = (slotNumber: number) => {
    setActiveSlot(slotNumber);
    // Scroll to embed after a tick
    setTimeout(() => {
      calendlyContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

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
                <h1 className="text-lg font-bold tracking-tight text-white">Marque com o Mentor</h1>
                <p className="text-[11px] text-white/40 font-medium tracking-wide uppercase">Conselho IF</p>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Progress */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <p className="text-white/50 text-sm mb-2">Encontros realizados</p>
            <div className="flex items-center justify-center gap-2">
              {allSlots.map((s) => {
                const cfg = statusConfig[s.status];
                return (
                  <div
                    key={s.slot_number}
                    className={`w-10 h-10 rounded-xl border-2 ${cfg.borderClass} ${cfg.bgClass} flex items-center justify-center transition-all`}
                  >
                    <cfg.icon className={`w-4 h-4 ${
                      s.status === 'realizado' ? 'text-green-400' :
                      s.status === 'agendado' ? 'text-amber-400' :
                      'text-white/20'
                    }`} />
                  </div>
                );
              })}
              <span className="text-white/60 text-sm ml-3 font-medium">{realizados}/5</span>
            </div>
          </motion.div>

          {/* Slot cards */}
          <div className="space-y-3">
            {allSlots.map((slot, idx) => {
              const cfg = statusConfig[slot.status];
              const bookingLink = getBookingLink(slot);
              const hasLink = !!bookingLink;
              const isActive = activeSlot === slot.slot_number;

              return (
                <motion.div
                  key={slot.slot_number}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`rounded-xl border ${isActive ? 'border-amber-500/40 ring-1 ring-amber-500/20' : cfg.borderClass} ${cfg.bgClass} backdrop-blur-sm p-5 flex items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl border ${cfg.borderClass} flex items-center justify-center text-lg font-bold ${
                      slot.status === 'realizado' ? 'text-green-400' :
                      slot.status === 'agendado' ? 'text-amber-400' :
                      'text-white/30'
                    }`}>
                      {slot.slot_number}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Encontro {slot.slot_number}</h3>
                      <p className="text-xs text-white/40">
                        {slot.status === 'realizado' && slot.scheduled_at
                          ? `Realizado em ${new Date(slot.scheduled_at).toLocaleDateString('pt-BR')}`
                          : slot.status === 'agendado' && slot.scheduled_at
                          ? `Agendado para ${new Date(slot.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                          : cfg.label
                        }
                      </p>
                      {slot.notes && (
                        <p className="text-xs text-white/30 mt-0.5">{slot.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Disponível → botão Agendar */}
                  {slot.status === 'disponivel' && hasLink && (
                    <button
                      onClick={() => openCalendlyEmbed(slot.slot_number)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors shrink-0 ${
                        isActive
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      {isActive ? 'Agendando...' : 'Agendar'}
                    </button>
                  )}

                  {/* Agendado → botão Reagendar */}
                  {slot.status === 'agendado' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                        Agendado
                      </span>
                      {hasLink && (
                        <button
                          onClick={() => openCalendlyEmbed(slot.slot_number)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/50 text-xs font-medium hover:bg-white/[0.1] hover:text-white/70 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reagendar
                        </button>
                      )}
                    </div>
                  )}

                  {slot.status === 'realizado' && (
                    <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-xs font-semibold shrink-0">
                      ✓ Concluído
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Calendly Inline Embed */}
          {activeSlot !== null && globalLink && (
            <motion.div
              ref={calendlyContainerRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-xl border border-amber-500/20 bg-white overflow-hidden"
            >
              {updatingSlot && (
                <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-2 text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Atualizando...</span>
                  </div>
                </div>
              )}
              <div className="bg-[#1a1a20] border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-white/70 font-medium">
                  📅 Agendando Encontro {activeSlot}
                </p>
                <button
                  onClick={() => setActiveSlot(null)}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  Cancelar
                </button>
              </div>
              <div
                id="calendly-embed-container"
                style={{ minWidth: '320px', height: '700px' }}
              />
            </motion.div>
          )}
        </main>
      </div>
    </ConselhoThemeWrapper>
  );
}
