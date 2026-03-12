import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/admin";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isModerator: boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const checkProfileActive = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await (supabase.from("profiles") as any)
        .select("is_active")
        .eq("user_id", userId)
        .single();
      if (error) {
        console.error("Error checking profile active:", error);
        return true; // Em caso de erro, não bloqueia
      }
      return data?.is_active !== false;
    } catch (e) {
      console.error("Error checking profile:", e);
      return true;
    }
  }, []);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      setRoles((data || []).map((r) => r.role as AppRole));
    } catch (e) {
      // Mantém as roles atuais se houver falha de rede momentânea
      console.error("Error fetching user roles:", e);
    }
  }, []);

  // Atualiza last_access_at quando usuário acessa
  const updateLastAccess = useCallback(async (userId: string) => {
    try {
      await supabase
        .from("profiles")
        .update({ last_access_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch (e) {
      console.error("Error updating last access:", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveAuth = (nextSession: Session | null, event?: string) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession?.user) {
        // Verifica se o perfil está ativo antes de permitir acesso
        checkProfileActive(nextSession.user.id).then((isActive) => {
          if (!isActive) {
            console.warn("Usuário desativado, realizando logout automático.");
            supabase.auth.signOut();
            return;
          }
          fetchUserRoles(nextSession.user.id);
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            updateLastAccess(nextSession.user.id);
          }
        });
      } else {
        setRoles([]);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      resolveAuth(nextSession, event);
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn("Session error:", error.message);
          resolveAuth(null);
          return;
        }
        resolveAuth(data.session);
      })
      .catch((err) => {
        console.warn("Failed to get session:", err);
        resolveAuth(null);
      });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserRoles, updateLastAccess, checkProfileActive]);

  const isAdmin = roles.includes("admin");
  const isModerator = roles.includes("moderator") || isAdmin;

  const refreshRoles = useCallback(async () => {
    if (!user?.id) return;
    await fetchUserRoles(user.id);
  }, [fetchUserRoles, user?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRoles([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      roles,
      isAdmin,
      isModerator,
      refreshRoles,
      signOut,
    }),
    [user, session, loading, roles, isAdmin, isModerator, refreshRoles, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
