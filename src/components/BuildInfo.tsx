import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const buildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : null;

interface BuildInfoProps {
  className?: string;
  showInProduction?: boolean;
}

/**
 * Exibe a versão do build para debugging.
 * Mostra tanto a versão do banco quanto o build ID real do deploy.
 */
export function BuildInfo({ className = '', showInProduction = false }: BuildInfoProps) {
  const [version, setVersion] = useState<string | null>(null);
  const isDev = import.meta.env.DEV;
  
  useEffect(() => {
    const fetchVersion = async () => {
      const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('id', 'min_app_version')
        .maybeSingle();
      
      if (data?.value) {
        setVersion(data.value);
      }
    };
    
    fetchVersion();
  }, []);
  
  if (!isDev && !showInProduction) return null;
  if (!version && !buildId) return null;
  
  const label = buildId 
    ? `v${version || '?'} · build ${new Date(buildId).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
    : `v${version}`;
  
  return (
    <div 
      className={`fixed bottom-2 right-2 text-[10px] text-muted-foreground/50 font-mono z-50 pointer-events-none select-none ${className}`}
      title={`Build: ${buildId || 'unknown'}`}
    >
      {label}
    </div>
  );
}

/**
 * Versão inline para usar em footers ou painéis admin.
 * Sempre visível, ideal para debugging em produção.
 */
export function BuildVersion({ className = '' }: { className?: string }) {
  const [version, setVersion] = useState<string>('...');
  
  useEffect(() => {
    const fetchVersion = async () => {
      const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('id', 'min_app_version')
        .maybeSingle();
      
      if (data?.value) {
        setVersion(data.value);
      }
    };
    
    fetchVersion();
  }, []);
  
  return (
    <span className={`text-[10px] text-muted-foreground/60 font-mono ${className}`}>
      v{version}
    </span>
  );
}
