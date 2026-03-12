import { describe, it, expect } from 'vitest';
import { normalizeCronogramaConfig, validateCronogramaConfig } from '../normalizeCronogramaConfig';

describe('normalizeCronogramaConfig', () => {
  it('remove IDs fantasmas de discipline_order', () => {
    const result = normalizeCronogramaConfig({
      selected_disciplines: ['disc-1', 'disc-2'],
      discipline_order: ['disc-ghost', 'disc-1', 'disc-2', 'disc-phantom'],
    });
    
    expect(result.discipline_order).toEqual(['disc-1', 'disc-2']);
    expect(result.discipline_order).not.toContain('disc-ghost');
    expect(result.discipline_order).not.toContain('disc-phantom');
  });

  it('adiciona disciplinas faltantes ao final de discipline_order', () => {
    const result = normalizeCronogramaConfig({
      selected_disciplines: ['disc-1', 'disc-2', 'disc-3'],
      discipline_order: ['disc-2'], // Faltam disc-1 e disc-3
    });
    
    expect(result.discipline_order).toEqual(['disc-2', 'disc-1', 'disc-3']);
  });

  it('remove duplicatas', () => {
    const result = normalizeCronogramaConfig({
      selected_disciplines: ['disc-1', 'disc-1', 'disc-2'],
      discipline_order: ['disc-1', 'disc-1', 'disc-2', 'disc-2'],
    });
    
    expect(result.selected_disciplines).toEqual(['disc-1', 'disc-2']);
    expect(result.discipline_order).toEqual(['disc-1', 'disc-2']);
  });

  it('remove disciplinas fantasmas de selected_topics', () => {
    const result = normalizeCronogramaConfig({
      selected_disciplines: ['disc-1'],
      selected_topics: {
        'disc-1': ['topic-1'],
        'disc-ghost': ['topic-2'], // Disciplina fantasma
      },
    });
    
    expect(result.selected_topics).toEqual({ 'disc-1': ['topic-1'] });
    expect(result.selected_topics['disc-ghost']).toBeUndefined();
  });

  it('remove disciplinas fantasmas de topic_order', () => {
    const result = normalizeCronogramaConfig({
      selected_disciplines: ['disc-1'],
      topic_order: {
        'disc-1': ['topic-1'],
        'disc-ghost': ['topic-2'],
      },
    });
    
    expect(result.topic_order).toEqual({ 'disc-1': ['topic-1'] });
  });

  it('lida com inputs vazios/null', () => {
    const result = normalizeCronogramaConfig({
      selected_disciplines: [],
      discipline_order: null,
      selected_topics: null,
      topic_order: null,
    });
    
    expect(result.selected_disciplines).toEqual([]);
    expect(result.discipline_order).toEqual([]);
    expect(result.selected_topics).toEqual({});
    expect(result.topic_order).toEqual({});
  });
});

describe('validateCronogramaConfig', () => {
  it('retorna válido para configuração correta', () => {
    const result = validateCronogramaConfig({
      selected_disciplines: ['disc-1', 'disc-2'],
      discipline_order: ['disc-1', 'disc-2'],
      selected_topics: { 'disc-1': ['topic-1'] },
      topic_order: { 'disc-1': ['topic-1'] },
    });
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detecta ID fantasma em discipline_order', () => {
    const result = validateCronogramaConfig({
      selected_disciplines: ['disc-1'],
      discipline_order: ['disc-1', 'disc-ghost'],
      selected_topics: {},
      topic_order: {},
    });
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('fantasma'))).toBe(true);
  });

  it('detecta disciplina faltando em discipline_order', () => {
    const result = validateCronogramaConfig({
      selected_disciplines: ['disc-1', 'disc-2'],
      discipline_order: ['disc-1'], // Falta disc-2
      selected_topics: {},
      topic_order: {},
    });
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('não está em discipline_order'))).toBe(true);
  });
});
