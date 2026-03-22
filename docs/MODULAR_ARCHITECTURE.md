# Agent OS - Arquitetura Modular

## Principio Central

Tudo no Agent OS e um modulo plugavel. Apps, agentes, provedores, modelos - todos seguem interfaces padronizadas. Qualquer pessoa pode criar um novo app, registrar um novo agente, ou trocar um modelo sem mexer no core.

## Visao Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT OS CORE                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ App Registry │  │Agent Registry│  │  Provider Registry     │ │
│  │  (apps.json) │  │(agents.json) │  │  (providers.json)      │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬─────────────┘ │
│         │                │                      │               │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌──────────┴─────────────┐ │
│  │ Window Mgr  │  │ Orchestrator │  │  Auth Manager          │ │
│  │ (zustand)   │  │ (Llama 70B)  │  │  (keys, oauth, cli)    │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Memory Layer                           │   │
│  │  SQLite + Basic Memory MCP + Knowledge + Vault + Threads  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. App Registry

### O que e um App

Um App e qualquer componente visual que abre numa janela no desktop. Cada app tem um ID unico, pode ter um agente vinculado, e segue uma interface padronizada.

### Interface de um App

```typescript
interface AppDefinition {
  // Identidade
  id: string;              // 'browser', 'threads', 'meu-app'
  name: string;            // 'Browser', 'Threads', 'Meu App'
  description: string;     // 'Navegador web integrado'
  icon: string;            // nome do icone lucide OU emoji
  version?: string;        // '1.0.0'

  // Layout
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  allowMultiple?: boolean; // permite varias instancias
  dockPinned?: boolean;    // fixo no dock

  // Agente vinculado (opcional)
  agentId?: string;        // ID do agente que este app usa

  // Componente React
  component: React.LazyExoticComponent;

  // Sidebar
  sidebar?: {
    label: string;         // texto no menu lateral
    emoji: string;         // emoji do menu
    position?: number;     // ordem no menu (0 = primeiro)
    group?: string;        // grupo: 'core', 'tools', 'custom'
  };
}
```

### Ciclo de vida de um App

```
1. Registro
   - App definido em apps.json ou via API
   - Componente JS carregado lazy (import dinamico)
   - Aparece no sidebar e dock

2. Abertura
   - Usuario clica no sidebar/dock
   - WindowManager cria instancia
   - Componente renderiza dentro do WindowFrame

3. Comunicacao
   - App acessa APIs do backend via fetch
   - Se tem agente vinculado, pode chamar /api/smol/chat
   - Pode abrir brain chat (padrao: botao cerebro no canto)

4. Fechamento
   - Estado persistido no zustand (opcional)
   - Instancia removida do WindowManager
```

### Apps Core (built-in)

| App | ID | Agente | Grupo |
|-----|----|--------|-------|
| Agent OS | smol | gestor | core |
| Threads | threads | - | core |
| Knowledge | knowledge | gestor | core |
| Flows | flows | flow-agent | core |
| Fleet Monitor | agents | - | core |
| Neural Terminal | terminal | - | tools |
| Browser | browser | - | tools |
| File Explorer | finder | - | tools |
| PM2 Manager | pm2 | - | tools |
| Supabase | supabase | sql | tools |
| GitHub | github | - | tools |
| Settings | settings | - | system |

### Como criar um novo App

```javascript
// 1. Criar componente (meu-app.js)
function MeuApp() {
  return (
    <div className="flex flex-col h-full" style={{background:'#0a0e17'}}>
      <div>Meu App</div>
    </div>
  );
}
export { MeuApp as default };

// 2. Colocar em /dist/assets/MeuApp.js

// 3. Registrar via API
fetch('/api/db/apps', {
  method: 'POST',
  body: JSON.stringify({
    id: 'meu-app',
    name: 'Meu App',
    description: 'Faz algo legal',
    icon: 'star',
    agent_id: 'gestor',  // opcional
    config: JSON.stringify({ dockPinned: true })
  })
});

// 4. Ou registrar no index.js (build time)
// Lazy import + entrada no registry array
```

---

## 2. Agent Registry

### Tipos de Agente

O Agent OS suporta 4 tipos fundamentais de agente. Cada tipo tem uma forma diferente de comunicacao mas todos seguem a mesma interface.

```
┌─────────────────────────────────────────────────────┐
│                  AGENT INTERFACE                     │
│  id, name, type, model, provider, capabilities      │
│  execute(prompt, context) -> result                  │
├─────────┬──────────┬─────────────┬──────────────────┤
│  SmolAI │ CLI Agent│  API Agent  │  Local Agent     │
│         │          │             │                   │
│ HF Inf. │ Claude   │ OpenAI      │ llama-server     │
│ OpenAI  │ Gemini   │ OpenRouter  │ Ollama           │
│ Groq    │ Codex    │ Anthropic   │ Custom GGUF      │
│ Custom  │ Cline    │ HF Endpoint │                   │
│         │ ACPX     │             │                   │
└─────────┴──────────┴─────────────┴──────────────────┘
```

### Interface de um Agente

```typescript
interface AgentDefinition {
  // Identidade
  id: string;                // 'coder', 'my-agent'
  name: string;              // 'Claude Code'
  description: string;       // 'Programacao e analise de codigo'
  icon: string;              // 'code', 'database', 'bot'
  version?: string;

  // Tipo e execucao
  type: 'smol' | 'cli' | 'api' | 'local';

  // Modelo
  modelId: string;           // ref para models registry

  // Configuracao por tipo
  config: SmolConfig | CliConfig | ApiConfig | LocalConfig;

  // Capacidades
  capabilities: string[];    // ['code','sql','text','vision']

  // Skills vinculadas
  skills?: string[];         // ['sql-safe', 'file-creation']

  // System prompt
  systemPrompt?: string;

  // Restricoes
  restrictions?: string;     // o que NAO fazer

  // Estado
  active: boolean;
}
```

### Tipo 1: SmolAI Agent

Agente que roda via API REST. Nao tem CLI, nao tem filesystem access. Ideal pra chat, analise, routing, e tarefas que nao precisam executar codigo.

```typescript
interface SmolConfig {
  type: 'smol';
  providerId: string;        // 'huggingface', 'openai', 'openrouter'
  endpoint: string;          // URL da API
  model: string;             // 'llama-3.3-70b-versatile'
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
}
```

**Exemplos:**
- Gestor (Llama 70B via HF/Groq free)
- SQL Agent (1.5B local via llama-server)
- Custom agent com modelo no OpenRouter
- Agent com modelo no HF Inference Endpoint

**Como funciona:**
```
User prompt → SmolAI Agent → API call (POST /v1/chat/completions) → Response
```

### Tipo 2: CLI Agent (via ACPX)

Agente que roda um CLI tool via protocolo ACP. Tem acesso ao filesystem, terminal, e pode executar codigo. Usa ACPX como bridge.

```typescript
interface CliConfig {
  type: 'cli';
  cliCommand: string;        // 'claude', 'gemini', 'codex', 'cline'
  acpxCommand: string;       // 'npx -y @zed-industries/claude-agent-acp'
  installCommand: string;    // 'npm install -g @anthropic-ai/claude-code'
  authType: 'oauth' | 'api_key' | 'cli_login';
  permissions: 'approve-all' | 'approve-reads' | 'deny-all';
  workingDirectory?: string; // '/home/claude'
  runAsUser?: string;        // 'claude'
}
```

**Exemplos:**
- Claude Code (via claude-agent-acp)
- Gemini CLI (via gemini --acp)
- Codex (via codex-acp)
- Cline (via cline --acp)

**Como funciona:**
```
User prompt → ACPX → ACP Adapter → CLI Tool → filesystem/terminal → Response
```

**Agentes CLI disponiveis (ACPX built-in):**

| Agent | CLI | ACP Adapter | Auth |
|-------|-----|-------------|------|
| Claude Code | claude | @zed-industries/claude-agent-acp | OAuth ou API key |
| Gemini | gemini | gemini --acp | OAuth ou API key |
| Codex | codex | @zed-industries/codex-acp | OAuth |
| Copilot | copilot | copilot --acp --stdio | OAuth |
| Cursor | cursor | cursor --acp --stdio | OAuth |
| Cline | cline | (custom) | API key |
| Qwen | qwen | qwen --acp | API key |
| Kimi | kimi | kimi-acp | API key |

### Tipo 3: API Agent

Agente que usa uma API REST diretamente (sem ACPX, sem CLI). Pra servicos como OpenAI, Anthropic API direta, ou qualquer endpoint compativel com OpenAI format.

```typescript
interface ApiConfig {
  type: 'api';
  endpoint: string;          // 'https://api.openai.com/v1'
  apiKeyEnvVar?: string;     // 'OPENAI_API_KEY'
  model: string;             // 'gpt-4o'
  format: 'openai' | 'anthropic' | 'custom';
  headers?: Record<string, string>;
  tools?: ToolDefinition[];  // function calling tools
}
```

**Exemplos:**
- GPT-4o via OpenAI API
- Claude via Anthropic API (sem CLI)
- Modelo custom no OpenRouter
- Modelo no HF Inference Endpoint

### Tipo 4: Local Agent

Agente rodando localmente via llama-server, Ollama, ou similar. Zero custo, sem dependencia de API externa.

```typescript
interface LocalConfig {
  type: 'local';
  runtime: 'llama-server' | 'ollama' | 'custom';
  endpoint: string;          // 'http://localhost:8080'
  modelPath?: string;        // '/opt/models/agent-os-1b5-q8.gguf'
  contextSize?: number;      // 2048
  threads?: number;          // 4
}
```

**Exemplos:**
- SQL Agent (agent-os-1b5 via llama-server)
- Custom model via Ollama
- Fine-tuned model via llama.cpp

### Como criar um novo Agente

```javascript
// Via API
fetch('/api/db/agents', {
  method: 'POST',
  body: JSON.stringify({
    id: 'my-coder',
    name: 'My Coding Agent',
    description: 'Coding with GPT-4o',
    agent_type: 'api',
    model_id: 'gpt-4o',
    config: JSON.stringify({
      type: 'api',
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      format: 'openai',
    }),
    capabilities: JSON.stringify(['code', 'analysis']),
    system_prompt: 'You are a coding assistant.',
    icon: 'code',
  })
});

// Via CLI Agent (ACPX)
fetch('/api/db/agents', {
  method: 'POST',
  body: JSON.stringify({
    id: 'gemini-agent',
    name: 'Gemini',
    agent_type: 'cli',
    acpx_command: 'gemini --acp',
    config: JSON.stringify({
      type: 'cli',
      cliCommand: 'gemini',
      installCommand: 'npm install -g @google/gemini-cli',
      authType: 'oauth',
    }),
    capabilities: JSON.stringify(['code', 'analysis', 'vision']),
  })
});
```

---

## 3. Provider Registry

### O que e um Provider

Provider e o servico que fornece o modelo de IA. Gerencia autenticacao e endpoints.

```typescript
interface ProviderDefinition {
  id: string;              // 'anthropic', 'openai', 'huggingface'
  name: string;            // 'Anthropic (Claude)'

  // Auth
  authType: 'api_key' | 'oauth' | 'cli_login' | 'none';
  authStatus: 'authenticated' | 'pending' | 'expired' | 'error';

  // CLI (se aplicavel)
  cliCommand?: string;     // 'claude'
  installCommand?: string; // 'npm install -g @anthropic-ai/claude-code'

  // API
  baseUrl?: string;        // 'https://api.anthropic.com'

  // Modelos disponiveis
  models: ModelDefinition[];
}
```

### Providers suportados

| Provider | Auth | CLI | Modelos |
|----------|------|-----|---------|
| Anthropic | OAuth + API key | claude | Opus, Sonnet, Haiku |
| Google | OAuth + API key | gemini | Gemini Pro, Flash |
| OpenAI | API key | - | GPT-4o, o1 |
| HuggingFace | Token | - | Llama, Qwen, Mistral (free com Pro) |
| OpenRouter | API key | - | 100+ modelos |
| Groq | API key | - | Llama, Mixtral (fast) |
| Local | none | - | Qualquer GGUF via llama-server |
| Ollama | none | ollama | Qualquer modelo Ollama |

### Fluxo de autenticacao

```
1. Usuario abre Settings > Providers
2. Seleciona provider
3. Opcoes:
   a. API Key: cola no campo, salva no SQLite (encriptado)
   b. OAuth: clica "Login", abre terminal com 'claude login' ou 'gemini auth'
   c. CLI Login: roda o comando de login no terminal integrado
4. Sistema verifica: checkInstalled() + checkAuth()
5. Status atualizado: authenticated / pending / error
6. Agentes desse provider ficam disponiveis
```

---

## 4. Model Registry

```typescript
interface ModelDefinition {
  id: string;              // 'claude-opus-4-6'
  providerId: string;      // 'anthropic'
  name: string;            // 'Claude Opus 4.6'
  modelId: string;         // ID real na API
  type: 'cloud' | 'local' | 'inference_endpoint';
  endpoint?: string;       // URL especifica
  capabilities: string[];  // ['code', 'vision', 'text']
  pricing?: {
    inputPerMToken: number;
    outputPerMToken: number;
  };
  contextWindow?: number;  // 200000
  active: boolean;
}
```

### Trocar modelo de um agente

```javascript
// Via UI: dropdown no app ou settings
// Via API:
fetch('/api/db/agents/coder/model', {
  method: 'PATCH',
  body: JSON.stringify({ model_id: 'gpt-4o' })
});
```

---

## 5. Agent Manager (reformulado)

O Agent Manager e o app que gerencia todos os agentes. Substitui o Fleet Monitor atual.

### Funcionalidades

```
┌──────────────────────────────────────────────────────────┐
│ Agent Manager                                     🧠     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Agents (6)                          Details              │
│                                                          │
│ ┌─ SmolAI Agents ──────────────┐   ┌──────────────────┐ │
│ │ 🧠 Gestor        Llama 70B  │   │ Claude Code      │ │
│ │    HF/Groq · online         │   │ Type: CLI (ACPX) │ │
│ │ 📊 SQL Agent     1.5B local │   │ Provider: Anthr. │ │
│ │    llama-server · online    │   │ Model: Opus 4.6  │ │
│ └──────────────────────────────┘   │ Auth: OAuth ✓    │ │
│                                     │ Status: online   │ │
│ ┌─ CLI Agents ─────────────────┐   │                  │ │
│ │ 💻 Claude Code   Opus 4.6   │   │ Capabilities:    │ │
│ │    ACPX · authenticated     │   │ code, analysis,  │ │
│ │ 🔮 Gemini        Pro        │   │ planning, debug  │ │
│ │    ACPX · not installed     │   │                  │ │
│ └──────────────────────────────┘   │ Skills:          │ │
│                                     │ file-creation    │ │
│ ┌─ API Agents ─────────────────┐   │ git-conventions  │ │
│ │ (nenhum configurado)         │   │                  │ │
│ └──────────────────────────────┘   │ [Edit] [Test]    │ │
│                                     │ [Change Model]   │ │
│ ┌─ Local Agents ───────────────┐   └──────────────────┘ │
│ │ 📊 SQL Agent    1.5B Q8     │                          │
│ │    localhost:8080 · healthy  │   [+ New Agent]          │
│ └──────────────────────────────┘                          │
└──────────────────────────────────────────────────────────┘
```

### Arvore de Agentes (hierarquia)

```
Orchestrator (Gestor - Llama 70B)
├── SmolAI Agents
│   ├── 🧠 Gestor (routing + chat)
│   └── 📊 SQL Agent (database queries)
│
├── CLI Agents (via ACPX)
│   ├── 💻 Claude Code (coding)
│   ├── 🔮 Gemini (analysis + vision)
│   ├── 🔷 Codex (coding)
│   └── ⚡ Cline (coding)
│
├── API Agents
│   ├── (user-defined)
│   └── (user-defined)
│
└── Local Agents
    ├── 📊 SQL Agent 1.5B (llama-server)
    └── (user-defined custom models)
```

---

## 6. Como tudo se conecta

### Fluxo de uma mensagem

```
1. User digita no Agent OS (ou Thread, ou Flow)
   │
2. Orchestrator (Gestor) recebe
   │
3. Consulta memoria (Basic Memory + SQLite knowledge)
   │
4. Classifica intencao → decide qual agente
   │
5. Busca agente no Agent Registry
   │
6. Verifica provider auth no Provider Registry
   │
7. Executa baseado no tipo:
   │
   ├── SmolAI → fetch(endpoint, {model, messages})
   ├── CLI    → acpx exec → ACP adapter → CLI tool
   ├── API    → fetch(endpoint, {model, messages, tools})
   └── Local  → fetch(localhost:port, {prompt})
   │
8. Resultado volta pro Orchestrator
   │
9. Salva na Thread + Knowledge + Memory
   │
10. Retorna pro usuario
```

### Modularidade em cada camada

```
ADICIONAR NOVO APP:
  1. Criar JS component
  2. Registrar no App Registry (API ou build)
  3. Opcionalmente vincular agente
  → Aparece no sidebar e dock

ADICIONAR NOVO AGENTE:
  1. Definir tipo (smol/cli/api/local)
  2. Registrar no Agent Registry (API)
  3. Configurar provider/model
  4. Opcionalmente vincular a um app
  → Disponivel pra orquestrador e flows

ADICIONAR NOVO PROVIDER:
  1. Registrar no Provider Registry (API)
  2. Configurar auth (key, oauth, cli)
  3. Listar modelos disponiveis
  → Agentes podem usar

ADICIONAR NOVO MODELO:
  1. Registrar no Model Registry (API)
  2. Vincular ao provider
  3. Trocar em qualquer agente via dropdown
  → Agente usa o novo modelo
```

---

## 7. Estrutura de Diretorios

```
/opt/agent-os/
├── dist/                     # Frontend built
│   ├── assets/
│   │   ├── index-*.js        # Main bundle (app registry, window manager)
│   │   ├── Threads-*.js      # Threads app
│   │   ├── Knowledge-*.js    # Knowledge app
│   │   ├── Flows-*.js        # Flows app
│   │   ├── SmolChat-*.js     # Agent OS chat
│   │   ├── Browser-*.js      # Browser app
│   │   ├── Terminal-*.js     # Terminal app
│   │   └── [CustomApp].js    # Any custom app
│   └── index.html
│
├── server/
│   ├── server.js             # Express + API routes + WebSocket
│   ├── orchestrator.js       # Llama 70B routing + agent execution
│   ├── database.js           # SQLite schema + queries
│   ├── memory-organizer.js   # Auto-save + vault + knowledge + search
│   ├── flow-engine.js        # Flow execution + scheduling
│   ├── browser-manager.js    # Playwright browser sessions
│   └── browser-stealth.js    # Stealth mode
│
├── memory/                   # Basic Memory markdown files
│   ├── agent-os-architecture.md
│   ├── acpx-protocol.md
│   └── common-errors.md
│
├── data/
│   └── agent-os.db           # SQLite database
│
├── docs/
│   ├── TECHNICAL.md
│   ├── STRUCTURE.md
│   ├── MEMORY_SYSTEM.md
│   ├── THREADS.md
│   ├── FLOWS.md
│   └── MODULAR_ARCHITECTURE.md
│
├── start-memory.sh           # Basic Memory MCP startup
├── package.json
└── README.md
```

---

## 8. APIs - Referencia Completa

### Core
```
GET  /api/health                       Health check

# App Registry
GET  /api/db/apps                      Lista apps
PATCH /api/db/apps/:id/agent           Vincular agente ao app

# Agent Registry
GET  /api/db/agents                    Lista agentes (com model e provider)
POST /api/db/agents                    Criar agente
PUT  /api/db/agents/:id                Editar agente
PATCH /api/db/agents/:id/model         Trocar modelo
DELETE /api/db/agents/:id              Desativar agente

# Provider Registry
GET  /api/db/providers                 Lista providers
GET  /api/db/providers/:id/status      Check instalado + autenticado
POST /api/db/providers/:id/auth        Salvar API key
POST /api/db/providers/:id/install     Instalar CLI

# Model Registry
GET  /api/db/models                    Lista modelos
POST /api/db/models                    Adicionar modelo

# Orchestrator
POST /api/orchestrator/chat            Chat completo (roteia + executa)
POST /api/orchestrator/route           So classifica (sem executar)
GET  /api/orchestrator/agents          Lista agentes do orquestrador
GET  /api/orchestrator/health          Health de todos os servicos
```

### Memory
```
GET  /api/memory/knowledge             Lista conhecimento
GET  /api/memory/knowledge/:id         Detalhe
GET  /api/memory/search?q=             Busca (SQLite + files)
GET  /api/memory/vault                 Lista keys
POST /api/memory/vault                 Adicionar key manual
GET  /api/memory/files                 Lista markdown files
GET  /api/memory/errors                Lista erros
POST /api/memory/errors/:id/resolve    Resolver erro
GET  /api/memory/skills                Lista skills
POST /api/memory/skills                Criar skill
GET  /api/memory/agents/:id/skills     Skills do agente
```

### Threads
```
GET  /api/threads                      Lista threads
GET  /api/threads/:id                  Thread detalhada
GET  /api/threads/:id/events           Eventos da thread
POST /api/threads/:id/message          Continuar conversa
```

### Flows
```
GET  /api/flow-templates               Lista templates
POST /api/flow-templates               Criar template
GET  /api/flows                        Lista flows
POST /api/flows                        Criar flow
GET  /api/flows/:id                    Flow com etapas
POST /api/flows/:id/start              Iniciar
POST /api/flows/:id/pause              Pausar
POST /api/flows/:id/cancel             Cancelar
POST /api/flows/:id/schedule           Agendar recorrencia
DELETE /api/flows/:id/schedule         Cancelar agendamento
```

### Tools (apps especificos)
```
# Browser
GET/POST/DELETE /api/browsers/*
# PM2
GET/POST /api/pm2/*
# Supabase
GET/POST /api/supabase/*
# GitHub
GET/POST /api/github/*
# SmolAgent Chat
POST /api/smol/chat
```
