import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Profile, 
  UserRole, 
  UserWithRoles,
  AppRole,
} from '@/types/admin';
import { toast } from 'sonner';

export function useAdminData() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    await fetchUsers();
    setLoading(false);
  };

  const fetchUsers = async () => {
    // Use explicit column list including download_unlocked which may not be in generated types yet
    const { data: profiles, error: profilesError } = await (supabase
      .from('profiles') as any)
      .select('id, user_id, email, full_name, cpf, avatar_url, is_active, download_unlocked, last_access_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast.error('Erro ao carregar usuários');
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      toast.error('Erro ao carregar roles');
      return;
    }


    const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile: any) => ({
      ...profile,
      download_unlocked: profile.download_unlocked ?? false,
      roles: (roles || [])
        .filter(r => r.user_id === profile.user_id)
        .map(r => r.role as AppRole),
    }));

    setUsers(usersWithRoles);
  };

  // User management
  const createUser = async (email: string, password: string, fullName?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email, password, fullName }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Usuário criado com sucesso');
      await fetchUsers();
      return true;
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar usuário');
      return false;
    }
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('user_id', userId);

    if (error) {
      toast.error('Erro ao atualizar usuário');
      return false;
    }

    toast.success(isActive ? 'Usuário ativado' : 'Usuário desativado');
    await fetchUsers();
    return true;
  };

  const updateUserRole = async (userId: string, role: AppRole, add: boolean) => {
    if (add) {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) {
        toast.error('Erro ao adicionar role');
        return false;
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) {
        toast.error('Erro ao remover role');
        return false;
      }
    }

    toast.success('Role atualizado');
    await fetchUsers();
    return true;
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return {
    users,
    loading,
    fetchAll,
    fetchUsers,
    createUser,
    toggleUserActive,
    updateUserRole,
  };
}
