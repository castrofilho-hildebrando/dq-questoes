import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VERSION_KEY = 'app_version';

// Keys to ALWAYS preserve during update (allowlist approach)
const PRESERVE_PREFIXES = ['sb-']; // Supabase auth tokens (dynamic)
const PRESERVE_EXACT = [
  'conselho-theme',         // Theme preference
  'question_bank_legacy_cleanup_v1', // Cleanup flag
];

function shouldPreserveKey(key: string): boolean {
  if (PRESERVE_EXACT.includes(key)) return true;
  return PRESERVE_PREFIXES.some(prefix => key.startsWith(prefix));
}

export function useAppVersion() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMandatory, setIsMandatory] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const { data: config } = await supabase
          .from('platform_config')
          .select('value')
          .eq('id', 'min_app_version')
          .maybeSingle();
        
        if (!config?.value) return;

        const requiredVersion = config.value;
        setCurrentVersion(requiredVersion);
        
        const storedVersion = localStorage.getItem(VERSION_KEY);
        
        if (!storedVersion) {
          localStorage.setItem(VERSION_KEY, requiredVersion);
          return;
        }
        
        if (compareVersions(storedVersion, requiredVersion) < 0) {
          setNeedsUpdate(true);
          setIsMandatory(true);
        }
      } catch (error) {
        console.warn('[useAppVersion] Failed to check version:', error);
      }
    };

    checkVersion();
  }, []);

  const performUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // CORRECTION 1: Fetch FRESH version from DB at the moment of click
      // This prevents stale state from causing infinite loops
      let freshVersion = currentVersion;
      try {
        const { data: freshConfig } = await supabase
          .from('platform_config')
          .select('value')
          .eq('id', 'min_app_version')
          .maybeSingle();
        if (freshConfig?.value) {
          freshVersion = freshConfig.value;
        }
      } catch {
        // Fallback to state version if fetch fails (offline scenario)
        console.warn('[useAppVersion] Could not fetch fresh version, using cached');
      }

      // 1. Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // 2. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // CORRECTION 2+5: Selective localStorage cleanup with dynamic auth preservation
      // Instead of localStorage.clear(), only remove non-essential keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !shouldPreserveKey(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Save the FRESH version (not stale state)
      if (freshVersion) {
        localStorage.setItem(VERSION_KEY, freshVersion);
      }

      // Clear sessionStorage
      sessionStorage.clear();

      // Force reload from server with cache-busting query param
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString());
      window.location.replace(url.toString());
    } catch (error) {
      console.error('Error during update:', error);
      // Fallback: save version and simple reload
      if (currentVersion) {
        localStorage.setItem(VERSION_KEY, currentVersion);
      }
      window.location.replace(window.location.pathname + '?_v=' + Date.now());
    }
  };

  const dismissUpdate = () => {
    if (!isMandatory) {
      setNeedsUpdate(false);
    }
  };

  return {
    needsUpdate,
    isUpdating,
    isMandatory,
    performUpdate,
    dismissUpdate,
    currentVersion: currentVersion || 'Carregando...'
  };
}

// Compare version strings (YYYY.MM.DD.patch format)
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}
