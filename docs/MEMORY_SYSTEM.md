# Agent OS - Sistema de Memoria e Conhecimento

## Visao Geral

Tres camadas de memoria que trabalham juntas:

```
CAMADA 1: Banco Local (SQLite)
  Historico bruto - tudo que acontece no sistema
  Conversas, mensagens, erros, arquivos criados
  Automatico, sem custo, consulta rapida

CAMADA 2: Basic Memory (MCP)
  Conhecimento organizado - markdown + semantic search
  Erros resolvidos, decisoes, padroes aprendidos
  LLM organiza automaticamente

CAMADA 3: Skills vinculadas aos Agentes
  Capacidades especificas de cada agente
  Instrucoes, exemplos, restricoes
  Agente consulta antes de agir
```

## Camada 1: Auto-Save (SQLite)

Tudo que acontece no sistema e salvo automaticamente:

```
Usuario manda mensagem
  → salva em messages (role=user)
  → orquestrador roteia
  → salva routing decision
  → agente responde
  → salva em messages (role=assistant, agent_id, model_id, duration_ms)
  → se criou arquivo → salva em agent_files
  → se deu erro → salva em agent_errors
  → se corrigiu erro → salva correcao vinculada ao erro
```

### Tabelas adicionais no SQLite

```sql
-- Erros e correcoes (base pro conhecimento)
CREATE TABLE agent_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id),
  message_id INTEGER REFERENCES messages(id),
  agent_id TEXT,
  error_type TEXT,           -- 'runtime', 'auth', 'timeout', 'logic', 'syntax'
  error_message TEXT,
  stack_trace TEXT,
  resolved BOOLEAN DEFAULT 0,
  resolution TEXT,           -- como foi resolvido
  knowledge_id TEXT,         -- link pro Basic Memory quando virar conhecimento
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Skills dos agentes
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,             -- 'code', 'sql', 'deploy', 'debug', 'text'
  instructions TEXT,         -- instrucoes detalhadas
  examples TEXT,             -- JSON com exemplos de uso
  restrictions TEXT,         -- o que NAO fazer
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vinculo skill <-> agente (N:N)
CREATE TABLE agent_skills (
  agent_id TEXT REFERENCES agents(id),
  skill_id TEXT REFERENCES skills(id),
  priority INTEGER DEFAULT 0,
  PRIMARY KEY (agent_id, skill_id)
);

-- Contexto de projeto (qual projeto o agente ta trabalhando)
CREATE TABLE project_contexts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,                 -- /home/claude/meu-projeto
  description TEXT,
  tech_stack TEXT,            -- JSON: ["react", "node", "supabase"]
  conventions TEXT,           -- regras do projeto
  active BOOLEAN DEFAULT 1
);
```

## Camada 2: Basic Memory (MCP)

### Instalacao

```bash
pip install basic-memory
basic-memory init /opt/agent-os/memory
```

### Estrutura de memoria

```
/opt/agent-os/memory/
  knowledge/
    errors/
      auth-acpx-session-expired.md      # erro + solucao
      merge-q4-corrupted-weights.md     # erro + solucao
      hf-token-hardcoded-blocked.md     # erro + solucao
    decisions/
      use-acpx-exec-not-sessions.md     # decisao arquitetural
      llama-70b-as-gestor.md            # porque escolhemos
    patterns/
      sql-information-schema-first.md   # padrao aprendido
      stream-sse-flush-headers.md       # padrao aprendido
    agents/
      gestor-routing-rules.md           # regras do gestor
      sql-agent-limitations.md          # limitacoes conhecidas
    projects/
      agent-os/
        architecture.md
        api-reference.md
      cloud-hub/
        schema.md
        conventions.md
```

### Formato dos documentos

```markdown
---
title: ACPX Session Expired Error
type: error-resolution
tags: [acpx, session, auth, error]
agent: coder
severity: medium
created: 2026-03-21
---

## Erro
[error] ACPX session not found - sessions expire after TTL (600s)

## Causa
Sessions ACPX persistentes expiram. Quando o orquestrador tenta usar
uma session expirada, retorna exit code 4.

## Solucao
Usar `acpx exec` em vez de sessions persistentes. O exec cria session
temporaria automatica sem gerenciamento.

## Relacionado
[[acpx-exec-mode]] [[orquestrador-claude-integration]]
```

### LLM que organiza automaticamente

Quando um erro e resolvido ou uma decisao e tomada:

```
1. Evento acontece (erro corrigido, decisao tomada)
2. Sistema coleta contexto (conversa, erro, correcao)
3. LLM (Llama 70B gratis) recebe:
   "Organize este evento como conhecimento. Gere um markdown
    com titulo, tipo, tags, descricao, causa, solucao, relacionados."
4. Arquivo salvo no Basic Memory
5. SQLite atualizado com knowledge_id
6. Indice semantico atualizado (vector embeddings)
```

### Agentes consultam via MCP

Antes de agir, o agente pode buscar conhecimento relevante:

```
Agente recebe tarefa: "configura ACPX com Claude"
  → Busca semantica: "acpx claude auth configuracao"
  → Encontra: auth-acpx-session-expired.md, acpx-exec-mode.md
  → Agente ja sabe: usar exec, nao sessions
  → Nao repete o erro
```

## Camada 3: Skills

Skills sao instrucoes pre-definidas que os agentes seguem.

### Exemplos de Skills

```json
{
  "id": "sql-query-safe",
  "name": "SQL Query Segura",
  "category": "sql",
  "instructions": "Sempre use information_schema primeiro para descobrir colunas. Nunca assuma nomes de colunas. Use LIMIT em SELECTs. Nao faca DELETE ou DROP sem confirmacao.",
  "examples": [
    {"input": "quais colunas tem tabela X", "output": "information_schema query"},
    {"input": "lista dados da tabela X", "output": "SELECT * FROM X LIMIT 50"}
  ],
  "restrictions": "Nunca executar DROP, TRUNCATE ou DELETE sem confirmacao explicita do usuario"
}
```

```json
{
  "id": "file-creation",
  "name": "Criacao de Arquivos",
  "category": "code",
  "instructions": "Criar arquivos em /home/claude/ por padrao. Usar subdiretorios para projetos. Sempre confirmar caminho antes de criar.",
  "restrictions": "Nunca criar arquivos fora de /home/claude/. Nunca sobrescrever sem avisar."
}
```

### Vinculo Skill -> Agente

```
SQL Agent:
  - sql-query-safe (prioridade 1)
  - supabase-conventions (prioridade 2)

Claude Code:
  - file-creation (prioridade 1)
  - code-review (prioridade 2)
  - git-conventions (prioridade 3)

Gestor:
  - routing-rules (prioridade 1)
  - user-communication (prioridade 2)
```

## Fluxo Completo

```
1. Usuario pede: "cria uma API de usuarios"

2. Auto-save: mensagem salva no SQLite

3. Gestor consulta memoria:
   - Busca: "api usuarios projeto atual"
   - Encontra: projeto usa Express + Supabase
   - Encontra: erro anterior com auth middleware

4. Gestor roteia pro Claude Code com contexto enriquecido:
   "Cria API de usuarios.
    Contexto: projeto usa Express + Supabase.
    Atencao: evitar erro X no auth middleware (ver knowledge/errors/auth-middleware.md)"

5. Claude Code consulta skills:
   - file-creation: criar em /home/claude/projeto/
   - code-review: seguir convenções do projeto

6. Claude Code executa

7. Auto-save: resposta + arquivos no SQLite

8. LLM organiza: se foi algo novo/importante, cria doc no Basic Memory

9. Resultado: usuario recebe resposta + sistema aprendeu
```

## Implementacao

### Fase 1 (agora): Auto-save no SQLite
- Middleware no orquestrador que salva cada interacao
- Tabelas de erros e skills
- API pra consultar historico

### Fase 2: Basic Memory
- Instalar basic-memory no server
- Configurar MCP server
- Script que converte erros resolvidos em docs

### Fase 3: LLM Organizador
- Llama 70B (gratis) processa eventos e gera docs
- Trigger automatico quando erro e resolvido
- Trigger quando decisao arquitetural e tomada

### Fase 4: Consulta pelos agentes
- Antes de cada task, buscar conhecimento relevante
- Injetar contexto no prompt do agente
- Skills carregadas automaticamente baseado no agent_id
