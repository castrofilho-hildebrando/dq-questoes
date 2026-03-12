/**
 * Auth API Service - Substitui Supabase Auth
 * 
 * Endpoints Laravel esperados:
 * POST /api/auth/login      - Login com email/password
 * POST /api/auth/register   - Registro de novo usuário
 * POST /api/auth/logout     - Logout
 * GET  /api/auth/me         - Dados do usuário logado
 * POST /api/auth/refresh    - Refresh token
 * POST /api/auth/forgot-password - Solicitar reset de senha
 * POST /api/auth/reset-password  - Resetar senha
 */

import { apiRequest, setAuthToken, getAuthToken } from './client';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: User;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  full_name?: string;
}

class AuthService {
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data, error } = await apiRequest<{ user: User; token: string; refresh_token?: string }>(
      '/auth/login',
      { method: 'POST', body: credentials }
    );

    if (error || !data) {
      return { user: null, session: null, error: error || 'Erro ao fazer login' };
    }

    const session: Session = {
      access_token: data.token,
      refresh_token: data.refresh_token,
      user: data.user,
    };

    setAuthToken(data.token);
    this.currentUser = data.user;
    this.currentSession = session;
    this.notifyListeners();

    return { user: data.user, session, error: null };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { data, error } = await apiRequest<{ user: User; token: string }>(
      '/auth/register',
      { method: 'POST', body: credentials }
    );

    if (error || !data) {
      return { user: null, session: null, error: error || 'Erro ao registrar' };
    }

    const session: Session = {
      access_token: data.token,
      user: data.user,
    };

    setAuthToken(data.token);
    this.currentUser = data.user;
    this.currentSession = session;
    this.notifyListeners();

    return { user: data.user, session, error: null };
  }

  async logout(): Promise<void> {
    await apiRequest('/auth/logout', { method: 'POST' });
    setAuthToken(null);
    this.currentUser = null;
    this.currentSession = null;
    this.notifyListeners();
  }

  async getCurrentUser(): Promise<User | null> {
    const token = getAuthToken();
    if (!token) return null;

    const { data, error } = await apiRequest<User>('/auth/me');
    
    if (error || !data) {
      setAuthToken(null);
      this.currentUser = null;
      this.currentSession = null;
      return null;
    }

    this.currentUser = data;
    return data;
  }

  async getSession(): Promise<Session | null> {
    const token = getAuthToken();
    if (!token) return null;

    const user = await this.getCurrentUser();
    if (!user) return null;

    this.currentSession = {
      access_token: token,
      user,
    };

    return this.currentSession;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const { data, error } = await apiRequest<{ roles: string[] }>(`/users/${userId}/roles`);
    
    if (error || !data) {
      return [];
    }

    return data.roles || [];
  }

  async forgotPassword(email: string): Promise<{ error: string | null }> {
    const { error } = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });

    return { error };
  }

  async resetPassword(token: string, password: string): Promise<{ error: string | null }> {
    const { error } = await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    });

    return { error };
  }

  // Observadores para mudanças de estado de autenticação
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.add(callback);
    
    // Chama imediatamente com o estado atual
    callback(this.currentUser);

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  getUser() {
    return this.currentUser;
  }
}

export const authService = new AuthService();
