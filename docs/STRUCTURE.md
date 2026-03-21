# Agent OS - Estruturacao Base do Sistema

## 1. Banco de Dados Local (SQLite)

SQLite local no server - sem dependencia externa, rapido, suficiente pra tudo.

### Schema

```sql
-- Provedores de IA (autenticacao)
CREATE TABLE providers (
  id TEXT PRIMARY KEY,                -- 'anthropic', 'google', 'openai', 'huggingface', 'local'
  name TEXT NOT NULL,                 -- 'Anthropic', 'Google AI', 'OpenAI', 'HuggingFace', 'Local'
  auth_type TEXT NOT NULL,            -- 'api_key', 'oauth', 'cli_login', 'none'
  auth_value TEXT,                    -- API key encriptada ou token OAuth
  auth_status TEXT DEFAULT 'pending', -- 'authenticated', 'pending', 'expired', 'error'
  base_url TEXT,                      -- URL base da API (null = default)
  config JSON,                        -- Config extra (headers, gateway, etc)
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Modelos disponiveis
CREATE TABLE models (
  id TEXT PRIMARY KEY,                -- 'claude-opus-4-6', 'llama-3.3-70b', 'agent-os-1.5b'
  provider_id TEXT REFERENCES providers(id),
  name TEXT NOT NULL,                 -- 'Claude Opus 4.6'
  model_id TEXT NOT NULL,             -- ID real da API: 'claude-opus-4-6', 'llama-3.3-70b-versatile'
  type TEXT DEFAULT 'cloud',          -- 'cloud', 'local', 'inference_endpoint'
  endpoint TEXT,                      -- URL do endpoint (local llama-server, HF endpoint, etc)
  capabilities JSON,                  -- ["code", "text", "sql", "vision"]
  config JSON,                        -- temperature, max_tokens, etc
  active BOOLEAN DEFAULT 1
);

-- Agentes (slots plugaveis)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,                -- 'coder', 'sql', 'gestor', 'frontend'
  name TEXT NOT NULL,                 -- 'Coding Agent'
  description TEXT,
  model_id TEXT REFERENCES models(id),
  agent_type TEXT DEFAULT 'smol',     -- 'smol', 'claude_cli', 'gemini_cli', 'acpx', 'api'
  acpx_command TEXT,                  -- Comando ACPX: 'npx -y @zed-industries/claude-agent-acp'
  system_prompt TEXT,                 -- System prompt do agente
  capabilities JSON,                  -- ["code", "analysis", "planning"]
  config JSON,                        -- Config extra (permissions, timeout, etc)
  icon TEXT DEFAULT 'bot',
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Apps do desktop
CREATE TABLE apps (
  id TEXT PRIMARY KEY,                -- 'browser', 'terminal', 'smolchat'
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  agent_id TEXT REFERENCES agents(id), -- Agente vinculado (null = sem agente)
  config JSON,                        -- defaultSize, minSize, allowMultiple, etc
  dock_pinned BOOLEAN DEFAULT 0,
  active BOOLEAN DEFAULT 1
);

-- Historico de conversas
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  session_id TEXT,                    -- ACPX session ID ou custom
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mensagens de cada conversa
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id),
  role TEXT NOT NULL,                 -- 'user', 'assistant', 'system', 'tool'
  content TEXT NOT NULL,
  agent_id TEXT,                      -- Qual agente respondeu
  model_id TEXT,                      -- Qual modelo foi usado
  routing JSON,                       -- Info de routing do gestor
  tokens_input INTEGER,
  tokens_output INTEGER,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Arquivos criados pelos agentes
CREATE TABLE agent_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id),
  message_id INTEGER REFERENCES messages(id),
  file_path TEXT NOT NULL,
  action TEXT,                        -- 'created', 'modified', 'deleted'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 2. App Registry vs Agent Registry

**Juntos, mas com vinculo opcional.**

Um App pode existir sem agente (Browser puro) e um agente pode existir sem app (agente de background). Mas qualquer app pode ter um agente vinculado.

```
Apps                          Agents
+--------+                   +---------+
|Browser |----(vinculo)------>|Web Agent|  (agente que navega)
|Terminal|----(vinculo)------>|Claude   |  (claude cli via ACPX)
|SmolChat|----(vinculo)------>|Gestor   |  (orquestrador)
|Finder  |                   |SQL Agent|  (sem app, so API)
|PM2     |                   |Frontend |  (sem app ainda)
+--------+                   +---------+
```

### UI do Agent Registry

Cada app no dock tem um **badge de modelo** (ex: "Qwen 72B", "Opus 4.6"). Ao clicar no badge:
- Dropdown com modelos disponiveis
- Trocar modelo em tempo real
- Ver status do agente (online/offline)
- Ver historico de conversas

### Arvore de Agentes (Fleet Monitor)

```
Gestor (Llama 3.3 70B) [HF Free]
  |-- Coder (Claude Opus 4.6) [Anthropic API]
  |-- SQL (agent-os-1.5b) [Local CPU]
  |-- Frontend (a definir)
  |-- Texto (a definir)
  |
  Custom Agents:
  |-- Meu Agent (Qwen 14B) [Local]
  |-- Reviewer (GPT-4o) [OpenAI]
```

## 3. Tipos de Agentes

### SmolAgent (mais controle)
- Roda via orquestrador local
- System prompt customizavel
- Ferramentas configuraveis
- Modelo trocavel via dropdown
- Historico salvo no SQLite

### Claude CLI Agent (via ACPX)
- Usa `acpx claude exec` ou `acpx claude -s session`
- Auth: OAuth via `claude login` ou API key via env `ANTHROPIC_AUTH_TOKEN`
- Full access ao filesystem e terminal
- Sessoes persistentes opcionais

### Gemini CLI Agent (via ACPX)
- Usa `acpx gemini exec`
- Auth: OAuth via `gemini auth` ou API key
- Comando ACPX: `gemini --acp`

### Custom API Agent
- Qualquer modelo via API REST
- Config: endpoint + api_key + model_id
- Ex: OpenRouter, Together, Groq, local llama-server

## 4. Autenticacao e ACPX

### Como funciona no ACPX

O ACPX suporta 3 metodos de auth:

1. **Terminal Auth (CLI Login)**
   - Claude: `claude login` (abre browser, OAuth)
   - Gemini: `gemini auth login`
   - Salva token em `~/.claude.json` ou `~/.gemini/`
   - ACPX detecta automaticamente

2. **Gateway Auth (API Key)**
   - Passa API key como gateway headers
   - Env vars: `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`
   - Funciona sem login OAuth

3. **Skip Auth**
   - Config ACPX: `"authPolicy": "skip"`
   - Usa credenciais ja salvas no sistema

### Pagina de Settings - Provedores

```
+------------------------------------------+
| Settings > Provedores de IA              |
+------------------------------------------+
|                                          |
| Anthropic (Claude)                       |
| [x] Autenticado via OAuth               |
| [ ] Usar API Key: [_______________]     |
| Status: Online                           |
|                                          |
| Google (Gemini)                          |
| [ ] Nao autenticado                     |
| [Autenticar via OAuth] [Usar API Key]   |
|                                          |
| HuggingFace                             |
| [x] Token: hf_VDz...MV (Pro)           |
| Modelos: Llama 3.3 70B, Llama 4 Scout  |
|                                          |
| OpenAI                                  |
| [ ] Nao configurado                     |
| [ ] API Key: [_______________]          |
|                                          |
| Local (llama-server)                     |
| [x] Online em localhost:8080            |
| Modelo: agent-os-1.5b (Q8)             |
|                                          |
| OpenRouter                              |
| [ ] API Key: [_______________]          |
|                                          |
+------------------------------------------+
```

### Fluxo de Auth pro ACPX

Quando o usuario seleciona um agente que precisa de auth:

1. **Check**: Provider ta autenticado? (query `providers` table)
2. **Se sim**: Usa credenciais salvas
3. **Se nao**:
   - **API Key**: Mostra campo pra colar a key, salva no SQLite
   - **OAuth (Claude/Gemini)**: Abre terminal com `claude login` ou `gemini auth`, detecta quando completou
   - **Local**: Verifica se llama-server esta rodando

### Env vars que o ACPX/adapters usam

| Provider | Auth Method | Env Var |
|----------|------------|---------|
| Anthropic | API Key | `ANTHROPIC_AUTH_TOKEN` |
| Anthropic | OAuth | `~/.claude.json` (auto) |
| Google | API Key | `GEMINI_API_KEY` |
| Google | OAuth | `~/.gemini/` (auto) |
| OpenAI | API Key | `OPENAI_API_KEY` |
| HuggingFace | Token | `HF_TOKEN` |
| Local | None | Endpoint URL |

## 5. Implementacao - Ordem

### Fase 1: Database + APIs (agora)
1. Criar SQLite com schema acima
2. API REST: `/api/db/providers`, `/api/db/agents`, `/api/db/models`, `/api/db/conversations`
3. Migrar agent registry hardcoded pra database
4. Migrar historico de conversas pra database

### Fase 2: Settings UI
1. Pagina de provedores (auth)
2. Pagina de agentes (CRUD)
3. Pagina de modelos (listar, ativar/desativar)
4. Vincular agente a app

### Fase 3: Agent Tree + Model Selector
1. Fleet Monitor com arvore de agentes
2. Badge de modelo em cada app
3. Dropdown pra trocar modelo
4. Status online/offline em tempo real

### Fase 4: Novos tipos de agente
1. Gemini CLI via ACPX
2. Custom API agents
3. Import/export de agentes
