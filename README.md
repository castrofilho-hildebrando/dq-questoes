# 📚 DQ Questões - Plataforma de Estudos para Concursos IF

> Sistema completo de preparação para concursos dos Institutos Federais

**URL de Produção:** https://dq-questoes.lovable.app

---

## 🎯 Visão Geral

Plataforma educacional focada em preparação para concursos públicos dos **Institutos Federais (IF)**, oferecendo:

| Módulo | Descrição |
|--------|-----------|
| **Banco de Questões** | +40.000 questões categorizadas por disciplina, tópico, banca, ano |
| **Cronograma Inteligente** | Plano de estudos personalizado com revisões espaçadas |
| **Baú de Provas** | Biblioteca de provas anteriores em PDF |
| **Tutor IA** | Robôs especializados para tirar dúvidas |
| **Materiais Dissecados** | PDFs de estudo organizados por tópico |

---

## 🏗️ Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 18.3.1 | UI Library |
| TypeScript | Latest | Tipagem |
| Vite | Latest | Build Tool |
| Tailwind CSS | Latest | Estilização |
| shadcn/ui | Latest | Componentes |
| TanStack Query | 5.83.0 | Cache/Estado |
| React Router | 6.30.1 | Navegação |

### Backend (Lovable Cloud)
| Componente | Tecnologia |
|------------|------------|
| Database | PostgreSQL 15+ |
| Auth | Supabase Auth |
| Edge Functions | Deno (TypeScript) |
| Storage | Supabase Storage |
| AI | OpenAI + Gemini via OpenRouter |

---

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── admin/           # Painel administrativo
│   ├── cronograma/      # Componentes do cronograma
│   ├── mapa/            # Biblioteca de provas
│   ├── questions/       # Cards, filtros, paginação
│   ├── tutor/           # Chat IA
│   └── ui/              # shadcn/ui components
├── hooks/
│   ├── useAuth.ts       # Autenticação
│   ├── useQuestions*.ts # Busca de questões
│   ├── useCronograma*.ts # Lógica do cronograma
│   └── useTutorChat.ts  # Chat com robôs
├── pages/
│   ├── Admin.tsx        # Hub administrativo
│   ├── cronograma/      # Wizard e visualização
│   └── modules/         # Banco, Cadernos
└── lib/
    └── cronograma/      # Algoritmo de alocação

supabase/functions/
├── import-questions-batch/  # Importação em chunks
├── openai-tutor/            # Chat IA
├── scrape-provas/           # Scraping PCI Concursos
└── map-edital-topics/       # Mapeamento IA
```

---

## 🔑 Conceitos Fundamentais

### Fonte vs Derivado

O sistema distingue entre entidades **fonte** e **derivadas**:

| Tipo | Características | Exemplo |
|------|-----------------|---------|
| **Fonte** | `is_source=true`, `generation_type='zip_import'` | Disciplinas importadas do ZIP |
| **Derivado** | `is_source=false`, `generation_type='edital_mapping'` | Disciplinas mapeadas para editais |

**Regra crítica:** Entidades derivadas SEMPRE referenciam fontes via `source_discipline_id` e `source_topic_id`.

### Limite de 1000 Linhas

O Supabase/PostgREST limita queries a 1000 linhas por padrão. Para tabelas grandes (questions, provas_if), usamos paginação com `.range()`:

```typescript
while (hasMore) {
  const { data } = await supabase.from("table").select("*").range(from, to);
  allData.push(...data);
  hasMore = data.length === 1000;
}
```

---

## 📖 Documentação Adicional

| Arquivo | Conteúdo |
|---------|----------|
| `ARQUITETURA_FONTE_VERDADE.md` | RPCs, triggers, fontes de verdade por módulo |
| `CRONOGRAMA_INTELIGENTE_DOCS.md` | Algoritmo de geração, revisões, estatísticas |
| `AUDITORIA_DADOS_PRODUCAO.md` | Histórico de correções do banco |
| `PLANO_CORRECOES_BANCO_DADOS.md` | Plano de ação para inconsistências |

---

## 🚀 Desenvolvimento Local

```bash
# Clonar repositório
git clone <URL_DO_REPO>
cd <NOME_DO_PROJETO>

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

---

## ⚠️ Problemas Conhecidos (Histórico)

| Problema | Status | Solução |
|----------|--------|---------|
| Dados truncados (>1000 linhas) | ✅ Resolvido | Paginação com `.range()` |
| Tarefas fantasmas no cronograma | ✅ Resolvido | Trigger `prevent_orphan_cronograma_tasks` |
| Duplicatas de questões | ✅ Resolvido | Hash SHA-256 na importação |
| Cadernos sem questões | ✅ Resolvido | Notebooks criados após INSERT |
| Herança quebrada (source_topic_id) | ✅ Resolvido | Migração de 625 tópicos |

---

## 🔒 Arquivos Protegidos (Não Editar)

```
src/integrations/supabase/types.ts  # Auto-gerado
src/integrations/supabase/client.ts # Auto-gerado
supabase/config.toml                # Configuração Supabase
.env                                 # Variáveis de ambiente
```

---

## 📞 Suporte

Para dúvidas técnicas, consulte a documentação interna ou entre em contato com a equipe de desenvolvimento.

---

*Última atualização: Fevereiro 2026*
