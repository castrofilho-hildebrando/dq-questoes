/**
 * Storage API Service - Substitui Supabase Storage
 * 
 * Endpoints Laravel esperados:
 * POST   /api/storage/{bucket}/upload    - Upload de arquivo
 * GET    /api/storage/{bucket}/{path}    - Download de arquivo
 * DELETE /api/storage/{bucket}/{path}    - Deletar arquivo
 * GET    /api/storage/{bucket}           - Listar arquivos
 */

import { getAuthToken } from './client';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface FileObject {
  id: string;
  name: string;
  bucket_id: string;
  owner?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface UploadOptions {
  cacheControl?: string;
  contentType?: string;
  upsert?: boolean;
}

class StorageService {
  private bucket: string = '';

  from(bucket: string) {
    this.bucket = bucket;
    return this;
  }

  /**
   * Upload de arquivo
   */
  async upload(
    path: string,
    file: File | Blob,
    options?: UploadOptions
  ): Promise<{ data: { path: string } | null; error: string | null }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    
    if (options?.upsert) {
      formData.append('upsert', 'true');
    }

    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/storage/${this.bucket}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.message || 'Erro ao fazer upload' };
      }

      return { data: { path: data.path || path }, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  /**
   * Download de arquivo
   */
  async download(path: string): Promise<{ data: Blob | null; error: string | null }> {
    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${BASE_URL}/storage/${this.bucket}/${encodeURIComponent(path)}`,
        { headers }
      );

      if (!response.ok) {
        return { data: null, error: `Erro ${response.status}` };
      }

      const blob = await response.blob();
      return { data: blob, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  /**
   * Obter URL pública do arquivo
   */
  getPublicUrl(path: string): { data: { publicUrl: string } } {
    const publicUrl = `${BASE_URL}/storage/${this.bucket}/public/${encodeURIComponent(path)}`;
    return { data: { publicUrl } };
  }

  /**
   * Criar URL assinada (temporária)
   */
  async createSignedUrl(
    path: string,
    expiresIn: number
  ): Promise<{ data: { signedUrl: string } | null; error: string | null }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/storage/${this.bucket}/signed-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ path, expires_in: expiresIn }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.message || 'Erro ao criar URL' };
      }

      return { data: { signedUrl: data.signed_url }, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  /**
   * Remover arquivo
   */
  async remove(paths: string[]): Promise<{ error: string | null }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/storage/${this.bucket}/delete`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ paths }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.message || 'Erro ao remover arquivo' };
      }

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  /**
   * Listar arquivos em um diretório
   */
  async list(
    path?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ data: FileObject[] | null; error: string | null }> {
    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const params = new URLSearchParams();
      if (path) params.append('path', path);
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));

      const queryString = params.toString();
      const url = `${BASE_URL}/storage/${this.bucket}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.message || 'Erro ao listar arquivos' };
      }

      return { data: data.files || data, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  /**
   * Mover arquivo
   */
  async move(
    fromPath: string,
    toPath: string
  ): Promise<{ error: string | null }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/storage/${this.bucket}/move`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ from: fromPath, to: toPath }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.message || 'Erro ao mover arquivo' };
      }

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  /**
   * Copiar arquivo
   */
  async copy(
    fromPath: string,
    toPath: string
  ): Promise<{ error: string | null }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/storage/${this.bucket}/copy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ from: fromPath, to: toPath }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.message || 'Erro ao copiar arquivo' };
      }

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }
}

export const storage = new StorageService();
