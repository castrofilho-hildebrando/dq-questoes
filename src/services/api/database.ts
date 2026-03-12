/**
 * Database API Service - Substitui Supabase Database
 * 
 * Este serviço abstrai as chamadas de banco de dados.
 * Configure os endpoints no seu Laravel para cada recurso.
 * 
 * Padrão de endpoints Laravel esperados:
 * GET    /api/{resource}           - Listar (com filtros via query string)
 * GET    /api/{resource}/{id}      - Buscar um
 * POST   /api/{resource}           - Criar
 * PUT    /api/{resource}/{id}      - Atualizar
 * DELETE /api/{resource}/{id}      - Deletar
 */

import { apiRequest, buildQueryString } from './client';

export interface QueryOptions {
  select?: string;
  filters?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  single?: boolean;
}

export interface MutationResult<T> {
  data: T | null;
  error: string | null;
}

class DatabaseService {
  /**
   * Busca registros de uma tabela/recurso
   */
  async query<T>(
    resource: string,
    options: QueryOptions = {}
  ): Promise<{ data: T[] | T | null; error: string | null; count?: number }> {
    const params: Record<string, unknown> = {
      ...options.filters,
    };

    if (options.select) {
      params.select = options.select;
    }

    if (options.order) {
      params.order_by = options.order.column;
      params.order_direction = options.order.ascending ? 'asc' : 'desc';
    }

    if (options.limit) {
      params.limit = options.limit;
    }

    if (options.offset) {
      params.offset = options.offset;
    }

    const queryString = buildQueryString(params);
    const { data, error, count } = await apiRequest<T[]>(`/${resource}${queryString}`);

    if (options.single && Array.isArray(data)) {
      return { data: data[0] || null, error, count };
    }

    return { data, error, count };
  }

  /**
   * Busca um registro por ID
   */
  async findById<T>(resource: string, id: string): Promise<MutationResult<T>> {
    const { data, error } = await apiRequest<T>(`/${resource}/${id}`);
    return { data, error };
  }

  /**
   * Cria um novo registro
   */
  async create<T>(resource: string, payload: Partial<T>): Promise<MutationResult<T>> {
    const { data, error } = await apiRequest<T>(`/${resource}`, {
      method: 'POST',
      body: payload,
    });
    return { data, error };
  }

  /**
   * Atualiza um registro existente
   */
  async update<T>(
    resource: string,
    id: string,
    payload: Partial<T>
  ): Promise<MutationResult<T>> {
    const { data, error } = await apiRequest<T>(`/${resource}/${id}`, {
      method: 'PUT',
      body: payload,
    });
    return { data, error };
  }

  /**
   * Atualiza múltiplos registros com base em filtros
   */
  async updateWhere<T>(
    resource: string,
    filters: Record<string, unknown>,
    payload: Partial<T>
  ): Promise<MutationResult<T[]>> {
    const { data, error } = await apiRequest<T[]>(`/${resource}/batch-update`, {
      method: 'PUT',
      body: { filters, data: payload },
    });
    return { data, error };
  }

  /**
   * Deleta um registro
   */
  async delete(resource: string, id: string): Promise<{ error: string | null }> {
    const { error } = await apiRequest(`/${resource}/${id}`, {
      method: 'DELETE',
    });
    return { error };
  }

  /**
   * Deleta múltiplos registros com base em filtros
   */
  async deleteWhere(
    resource: string,
    filters: Record<string, unknown>
  ): Promise<{ error: string | null }> {
    const { error } = await apiRequest(`/${resource}/batch-delete`, {
      method: 'DELETE',
      body: { filters },
    });
    return { error };
  }

  /**
   * Upsert - Cria ou atualiza
   */
  async upsert<T>(
    resource: string,
    payload: Partial<T>,
    conflictColumns?: string[]
  ): Promise<MutationResult<T>> {
    const { data, error } = await apiRequest<T>(`/${resource}/upsert`, {
      method: 'POST',
      body: { data: payload, conflict_columns: conflictColumns },
    });
    return { data, error };
  }

  /**
   * Executa uma função/procedure do banco
   */
  async rpc<T>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<MutationResult<T>> {
    const { data, error } = await apiRequest<T>(`/rpc/${functionName}`, {
      method: 'POST',
      body: params,
    });
    return { data, error };
  }
}

export const databaseService = new DatabaseService();

/**
 * Helper para criar queries fluentes (similar ao Supabase)
 * 
 * Exemplo de uso:
 * const { data } = await db.from('users').select('*').eq('is_active', true).limit(10);
 */
class QueryBuilder<T = unknown> {
  private resource: string;
  private options: QueryOptions = {};
  private eqFilters: Record<string, unknown> = {};
  private inFilters: Record<string, unknown[]> = {};

  constructor(resource: string) {
    this.resource = resource;
  }

  select(columns: string = '*') {
    this.options.select = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.eqFilters[column] = value;
    return this;
  }

  neq(column: string, value: unknown) {
    this.eqFilters[`${column}__neq`] = value;
    return this;
  }

  gt(column: string, value: unknown) {
    this.eqFilters[`${column}__gt`] = value;
    return this;
  }

  gte(column: string, value: unknown) {
    this.eqFilters[`${column}__gte`] = value;
    return this;
  }

  lt(column: string, value: unknown) {
    this.eqFilters[`${column}__lt`] = value;
    return this;
  }

  lte(column: string, value: unknown) {
    this.eqFilters[`${column}__lte`] = value;
    return this;
  }

  like(column: string, pattern: string) {
    this.eqFilters[`${column}__like`] = pattern;
    return this;
  }

  ilike(column: string, pattern: string) {
    this.eqFilters[`${column}__ilike`] = pattern;
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters[column] = values;
    return this;
  }

  is(column: string, value: null | boolean) {
    this.eqFilters[`${column}__is`] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.options.order = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.options.limit = count;
    return this;
  }

  range(from: number, to: number) {
    this.options.offset = from;
    this.options.limit = to - from + 1;
    return this;
  }

  single() {
    this.options.single = true;
    return this;
  }

  maybeSingle() {
    this.options.single = true;
    return this;
  }

  async then<TResult>(
    onfulfilled?: (value: { data: T[] | T | null; error: string | null; count?: number }) => TResult
  ): Promise<TResult> {
    this.options.filters = {
      ...this.eqFilters,
      ...Object.fromEntries(
        Object.entries(this.inFilters).map(([k, v]) => [`${k}__in`, v])
      ),
    };

    const result = await databaseService.query<T>(this.resource, this.options);
    return onfulfilled ? onfulfilled(result as { data: T[] | T | null; error: string | null; count?: number }) : result as TResult;
  }

  // Para insert
  async insert(data: Partial<T> | Partial<T>[]) {
    if (Array.isArray(data)) {
      const results = await Promise.all(
        data.map(item => databaseService.create<T>(this.resource, item))
      );
      const errors = results.filter(r => r.error);
      return {
        data: results.map(r => r.data).filter(Boolean) as T[],
        error: errors.length > 0 ? errors[0].error : null,
      };
    }
    return databaseService.create<T>(this.resource, data);
  }

  // Para update
  async update(data: Partial<T>) {
    const filters = { ...this.eqFilters };
    return databaseService.updateWhere<T>(this.resource, filters, data);
  }

  // Para delete
  async delete() {
    const filters = { ...this.eqFilters };
    return databaseService.deleteWhere(this.resource, filters);
  }

  // Para upsert
  async upsert(data: Partial<T>, options?: { onConflict?: string }) {
    const conflictColumns = options?.onConflict?.split(',').map(c => c.trim());
    return databaseService.upsert<T>(this.resource, data, conflictColumns);
  }
}

/**
 * Objeto principal de acesso ao banco - API similar ao Supabase
 */
export const db = {
  from: <T = unknown>(resource: string) => new QueryBuilder<T>(resource),
  rpc: <T = unknown>(fn: string, params?: Record<string, unknown>) => 
    databaseService.rpc<T>(fn, params),
};
