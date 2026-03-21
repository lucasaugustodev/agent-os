# Agent OS - Threads

## O que é uma Thread

Uma Thread é um workspace persistente de uma tarefa. Quando o usuario pede algo, o sistema cria uma Thread que registra TUDO:

- Mensagens do usuario
- Decisoes do gestor (routing)
- Comunicacao entre agentes (ACPX messages)
- Cada tool call (Write, Terminal, Read, etc)
- Arquivos criados/modificados
- Erros e correcoes
- Tempo de cada operacao

## Exemplo Visual

```
THREADS (app no sidebar)
├── 🟢 Landing Page Imobiliaria (ativa)
│   ├── 17:33 User: "cria um site de imobiliaria"
│   ├── 17:33 Gestor → Claude Code (routing)
│   ├── 17:33 Llama: "Vou encaminhar pro Claude Code..."
│   ├── 17:34 Claude: [tool] Terminal: ls -la /home/claude/
│   ├── 17:34 Claude: [tool] Terminal: mkdir real-estate-landing
│   ├── 17:34 Claude: [tool] Write: real-estate-landing/index.html (+803 lines)
│   ├── 17:35 Claude: "Pronto! Landing page criada em..."
│   ├── 17:35 Llama: "O Claude criou uma landing page completa..."
│   ├── 17:36 User: "adiciona um formulario de contato"
│   ├── 17:36 Gestor → Claude Code (routing)
│   └── ...
│
├── ⚪ Jogo Snake HTML (completa)
│   ├── 17:20 User: "cria um jogo snake em html"
│   └── ... (10 eventos)
│
├── ⚪ Query VMs Supabase (completa)
│   ├── 17:15 User: "quais colunas tem a tabela vms"
│   ├── 17:15 Gestor → SQL Agent (routing)
│   └── 17:15 SQL: {"action":"sql","sql":"SELECT column_name..."}
│
└── ⚪ Explicacao Agent OS (completa)
    ├── 17:10 User: "como funciona o agent os?"
    └── 17:10 Gestor: "O Agent OS é um sistema..."
```

## Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,                -- uuid
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',       -- 'active', 'completed', 'archived'
  created_by TEXT DEFAULT 'user',     -- quem criou
  primary_agent_id TEXT,              -- agente principal da thread
  project_id TEXT,                    -- projeto vinculado
  tags TEXT DEFAULT '[]',
  summary TEXT,                       -- resumo gerado pelo Llama
  file_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thread_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT REFERENCES threads(id),
  type TEXT NOT NULL,                 -- tipos abaixo
  agent_id TEXT,                      -- qual agente gerou
  content TEXT,                       -- conteudo principal
  metadata TEXT DEFAULT '{}',         -- JSON com dados extras
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tipos de eventos:
-- 'user_message'     - mensagem do usuario
-- 'routing'          - decisao do gestor (agent, reason)
-- 'agent_intro'      - llama dizendo o que vai fazer
-- 'agent_response'   - resposta final do agente
-- 'agent_summary'    - llama resumindo resultado
-- 'tool_call'        - tool usada (Write, Terminal, Read, etc)
-- 'tool_result'      - resultado da tool
-- 'error'            - erro que aconteceu
-- 'error_resolved'   - erro corrigido
-- 'file_created'     - arquivo criado
-- 'file_modified'    - arquivo modificado
-- 'acpx_message'     - mensagem raw do protocolo ACP
-- 'status'           - mudanca de status da thread
-- 'note'             - anotacao manual do usuario

CREATE TABLE IF NOT EXISTS thread_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT REFERENCES threads(id),
  event_id INTEGER REFERENCES thread_events(id),
  file_path TEXT NOT NULL,
  action TEXT,                        -- 'created', 'modified', 'deleted'
  size_bytes INTEGER,
  diff_lines INTEGER,                 -- +/- lines changed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Como funciona

### 1. Criacao automatica

Quando o usuario manda uma mensagem no Agent OS:

```
User: "cria um site de loja de tenis"
  │
  ├─ Thread auto-criada: {title: "Site de loja de tenis", status: "active"}
  ├─ Event: {type: "user_message", content: "cria um site..."}
  ├─ Routing acontece
  ├─ Event: {type: "routing", metadata: {agent: "claude", reason: "coding task"}}
  ├─ Llama intro
  ├─ Event: {type: "agent_intro", content: "Vou encaminhar pro Claude..."}
  ├─ Claude trabalha
  ├─ Event: {type: "tool_call", metadata: {tool: "Terminal", input: "mkdir..."}}
  ├─ Event: {type: "tool_call", metadata: {tool: "Write", input: {file: "index.html"}}}
  ├─ Event: {type: "file_created", metadata: {path: "/home/claude/loja/index.html", lines: 200}}
  ├─ Claude responde
  ├─ Event: {type: "agent_response", content: "Criado o site..."}
  ├─ Llama resume
  └─ Event: {type: "agent_summary", content: "Foi criado um site completo..."}
```

### 2. Continuacao na thread

O usuario pode clicar na thread e continuar conversando:

```
User (na thread "Site de loja de tenis"):
  "adiciona um carrinho de compras"
  │
  ├─ Event: {type: "user_message", content: "adiciona um carrinho..."}
  ├─ Routing: Claude Code (mesmo agente)
  ├─ Claude modifica os arquivos existentes
  ├─ Event: {type: "file_modified", metadata: {path: "index.html", diff: "+50 lines"}}
  └─ Event: {type: "agent_summary", content: "Adicionei carrinho..."}
```

### 3. Multi-agente na mesma thread

```
User: "agora consulta quantos produtos tem no supabase"
  │
  ├─ Routing: SQL Agent (troca de agente na mesma thread)
  ├─ Event: {type: "routing", metadata: {agent: "sql", reason: "database query"}}
  ├─ SQL Agent responde
  └─ Event: {type: "agent_response", agent: "sql", content: "{action: sql...}"}
```

### 4. Titulo automatico

O Llama gera o titulo da thread baseado na primeira mensagem:
- "cria um site de tenis" → "Site de Loja de Tenis"
- "quais tabelas tem no supabase" → "Consulta Tabelas Supabase"
- "como funciona o routing" → "Explicacao sobre Routing"

## API

```
GET    /api/threads                    - Lista threads (paginado)
GET    /api/threads/:id                - Thread com resumo
GET    /api/threads/:id/events         - Todos os eventos da thread
GET    /api/threads/:id/files          - Arquivos da thread
POST   /api/threads                    - Criar thread manual
POST   /api/threads/:id/events         - Adicionar evento
POST   /api/threads/:id/message        - Mandar mensagem (user continua conversa)
PATCH  /api/threads/:id                - Atualizar (title, status, tags)
DELETE /api/threads/:id                - Arquivar thread
```

## UI (app Threads no sidebar)

```
┌─────────────────────────────────────────────────┐
│ Threads                              🔍 [+ New] │
├─────────────────────────────────────────────────┤
│ Lista de threads (esquerda)  │  Thread aberta   │
│                              │  (direita)       │
│ 🟢 Landing Page Imobiliaria │  Timeline de      │
│    Claude Code · 12 events  │  eventos com      │
│    17:33 - 17:45             │  cada tool call,  │
│                              │  mensagem, etc    │
│ ⚪ Jogo Snake HTML          │                   │
│    Claude Code · 8 events   │  [input de msg]   │
│    17:20 - 17:25            │  pra continuar    │
│                              │  nessa thread     │
│ ⚪ Query VMs Supabase       │                   │
│    SQL Agent · 3 events     │                   │
│                              │                   │
└─────────────────────────────────────────────────┘
```
