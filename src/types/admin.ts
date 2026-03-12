export type AppRole = 'admin' | 'moderator' | 'user';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  cpf: string | null;
  avatar_url: string | null;
  is_active: boolean;
  download_unlocked: boolean;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface UserWithRoles extends Profile {
  roles: AppRole[];
}
