/**
 * API Services - Camada de abstração para backend Laravel
 * 
 * Este módulo exporta todos os serviços de API que substituem o Supabase.
 * Configure a variável de ambiente VITE_API_URL para apontar para seu Laravel.
 * 
 * Exemplo de .env:
 * VITE_API_URL=http://localhost:8000/api
 * 
 * Uso:
 * import { authService, db, storage } from '@/services/api';
 * 
 * // Autenticação
 * await authService.login({ email, password });
 * 
 * // Queries de banco (API similar ao Supabase)
 * const { data } = await db.from('users').select('*').eq('is_active', true);
 * 
 * // Storage
 * await storage.from('avatars').upload('path/file.jpg', file);
 */

export { apiRequest, setAuthToken, getAuthToken, buildQueryString } from './client';
export { authService, type User, type Session, type AuthResponse } from './auth';
export { databaseService, db, type QueryOptions, type MutationResult } from './database';
export { storage, type FileObject, type UploadOptions } from './storage';
