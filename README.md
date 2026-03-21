# Agent OS

Sistema operacional de agentes IA. Interface desktop (macOS-style) que orquestra multiplos modelos de IA especializados atraves de um modelo gestor central. Cada agente e um slot plugavel - facil de trocar, adicionar ou remover.

## Arquitetura

```
+--------------------------------------------------------------+
|                    AGENT OS (Frontend React)                  |
|  +--------+---------+--------+--------+--------+-----------+ |
|  |Browser |Terminal | Inbox  |Mission |Agents  |SmolChat   | |
|  |        |         |        |Control |        |(floating) | |
+--+--------+---------+--------+--------+--------+-----------+-+
|                    SERVER (Node.js + Express)                 |
|  +---------+--------+---------+--------+------------------+  |
|  |Browser  | PM2    |Supabase |GitHub  | Orchestrator API |  |
|  |Manager  | API    | API     | CLI    | (routing+agents) |  |
+--+---------+--------+---------+--------+------------------+--+
|                    CAMADA DE ORQUESTRACAO                     |
|  +----------------------------------------------------------+|
|  |           MODELO GESTOR (Llama 3.3 70B)                  ||
|  |   HF Inference API (gratis, Pro)                         ||
|  |   Recebe tarefa -> Classifica -> Roteia -> Retorna       ||
|  +----------+-----------+-----------+-----------+-----------+|
|             |           |           |           |            |
|  +----------+--+ +------+------+ +--+--------+ +----------+ |
|  |Claude Code  | |SQL Agent    | |Agent N    | |Direct    | |
|  |via ACPX     | |1.5B local   | |(plugavel) | |Gestor    | |
|  |ACP protocol | |llama-server | |           | |Llama 70B | |
+--+-------------+-+-------------+-+-----------+-+----------+-+
|                    MEMORIA CENTRAL                            |
|  +----------------------------------------------------------+|
|  |   Basic Memory (MCP) + Session Logger                    ||
|  |   Markdown + SQLite + Vector Embeddings                  ||
+--+----------------------------------------------------------++
```

## Stack

### Frontend
- React + TypeScript + Vite
- Desktop UI: janelas arrastáveis, dock, menu bar
- Window Manager: Zustand store com persist
- Apps: Registry plugavel (appRegistry.ts)
- SmolChat: Chat flutuante integrado ao orquestrador

### Backend
- Node.js + Express (porta 3000)
- APIs: Browser (Playwright), PM2, Supabase, GitHub, SmolAgent, Orchestrator
- WebSocket: Terminal, browser streaming, file watching

### Orquestrador
- Modelo gestor: Llama 3.3 70B via HF Inference API (Groq, gratis com Pro)
- Routing automatico: classifica intencao e roteia pro agente certo
- Endpoints: `/api/orchestrator/chat`, `/api/orchestrator/route`, `/api/orchestrator/agents`

### ACPX - Agent Client Protocol eXtension
- Protocolo padrao JSON-RPC 2.0 para comunicacao agent-to-agent
- Sem terminal scraping - comunicacao estruturada
- 15+ agentes built-in: Claude, Copilot, Gemini, Cursor, Codex, Qwen, etc
- Sessoes persistentes, crash-safe, com checkpoint
- Queue management: serializa requests, evita race conditions
- Permissoes granulares: approve-all, approve-reads, deny-all
- Repo: https://github.com/openclaw/acpx

### Modelos Custom (treinados por nos)
- **1.5B** (Qwen 2.5 1.5B): Adapter LoRA para SQL/Supabase queries
  - Rodando CPU no llama-server (1.6GB RAM, ~3s/query)
  - HF: [devsomosahub/agent-os-adapter-1.5b](https://huggingface.co/devsomosahub/agent-os-adapter-1.5b)
- **7B** (Qwen 2.5 7B): Mesmo proposito, mais preciso
  - HF: [devsomosahub/agent-os-adapter-7b](https://huggingface.co/devsomosahub/agent-os-adapter-7b)
- Guia de treino: [devsomosahub/agent-os-training-guide](https://huggingface.co/devsomosahub/agent-os-training-guide)

## Apps do Desktop

| App | Status | Descricao |
|-----|--------|-----------|
| Browser | Funcional | Web browser com Playwright |
| Terminal | Funcional | Terminal session via launcher |
| SmolChat | Funcional | Chat flutuante com orquestrador |
| Agents | Funcional | Org chart de agentes IA |
| Supabase | Funcional | Gerenciamento de projetos Supabase |
| GitHub CLI | Funcional | Repos, issues, PRs |
| PM2 Manager | Funcional | Process manager |
| File Explorer | Funcional | Explorador de arquivos |
| Inbox | Em dev | Task inbox com comments |
| Mission Control | Em dev | Kanban board |
| Settings | Em dev | Configuracoes |

## Agent Registry

Agentes especializados plugaveis via ACPX:

| Slot | Modelo | Provider | Funcao |
|------|--------|----------|--------|
| Gestor | Llama 3.3 70B | HF Inference API (gratis) | Roteia tarefas, classifica, coordena |
| Coding | Claude Code | ACPX/Anthropic | Escreve/refatora codigo |
| SQL/Data | agent-os-1.5b | Local llama-server CPU | Queries SQL, Supabase |
| Frontend | (a definir) | (a definir) | UI/UX, componentes React |
| Texto | (a definir) | (a definir) | Criacao de conteudo |

### Fluxo de orquestracao

```
1. Usuario digita mensagem no SmolChat
2. Gestor (Llama 70B) classifica a intencao:
   - "escreve uma funcao..." -> agent: claude
   - "quantas vms ativas..." -> agent: sql
   - "como funciona o sistema?" -> agent: direct (gestor responde)
3. Orquestrador envia pro agente via ACPX ou API local
4. Agente processa e retorna resultado
5. Memoria Central registra a interacao
6. Resultado exibido no SmolChat
```

### Trocar agentes
Cada agente e um slot na config. Trocar = mudar o endpoint/modelo:

```javascript
// server/orchestrator.js
const AGENT_REGISTRY = {
  claude: {
    name: 'Claude Code',
    command: 'claude',         // via ACPX
    capabilities: ['code', 'analysis', 'planning'],
  },
  sql: {
    name: 'SQL Agent',
    endpoint: 'http://localhost:8080',  // llama-server local
    capabilities: ['sql', 'database'],
  },
  // Adicionar novo agente:
  texto: {
    name: 'Text Agent',
    endpoint: 'https://api.openai.com/v1',
    capabilities: ['text', 'copywriting'],
  },
};
```

## Memoria Central

### Basic Memory (MCP Server)
- Markdown files com YAML frontmatter
- SQLite index com full-text search + vector embeddings
- Navegacao semantica via knowledge graph
- Todos os agentes leem/escrevem na mesma memoria
- Repo: https://github.com/basicmachines-co/basic-memory

### Session Logger
- Log automatico de sessoes Claude
- Registra prompts, tool calls, decisoes
- Hook-based integration
- Repo: https://github.com/lucasaugustodev/claude-session-logger

## Infraestrutura

### Server Agent OS
- **Vultr Sao Paulo**: 207.246.65.100, 4 CPU, 8GB RAM, Ubuntu
- **Portas**:
  - 3000: Agent OS (frontend + API + orchestrator)
  - 3002: Claude Launcher Web
  - 8080: llama-server (modelo 1.5B CPU)
  - 8082: SmolAgent daemon
  - 9090: Agent bot

### Outros servers
- **PentAGI**: 216.238.107.254:8443 (pentest AI autonomo, Vultr SP)
- **Cloud-Hub**: whufzsdchvoteocbggdu.supabase.co

## API Reference

### Orchestrator
```
POST /api/orchestrator/chat          # Chat completo (roteia + executa)
POST /api/orchestrator/chat/stream   # Chat com SSE streaming
POST /api/orchestrator/route         # So classifica (sem executar)
GET  /api/orchestrator/agents        # Lista agentes disponiveis
GET  /api/orchestrator/sessions      # Lista sessoes ativas
GET  /api/orchestrator/health        # Health check de todos agentes
```

### Browser
```
GET    /api/browsers                 # Lista sessoes de browser
POST   /api/browsers                 # Cria nova sessao
DELETE /api/browsers/:id             # Fecha sessao
POST   /api/browsers/:id/navigate   # Navegar pra URL
POST   /api/browsers/:id/click      # Clicar (selector ou x,y)
POST   /api/browsers/:id/type       # Digitar texto
GET    /api/browsers/:id/text       # Extrair texto da pagina
GET    /api/browsers/:id/screenshot # Screenshot JPEG
```

### PM2
```
GET  /api/pm2/list                  # Lista processos
POST /api/pm2/action                # restart/stop/start/delete
GET  /api/pm2/logs/:name            # Logs de um processo
```

### Supabase
```
GET  /api/supabase/projects         # Lista projetos
POST /api/supabase/sql/:id          # Executa SQL
GET  /api/supabase/tables/:id       # Lista tabelas
POST /api/supabase/login            # Autenticar com token
```

### GitHub
```
GET  /api/github/repos              # Lista repositorios
GET  /api/github/issues/:owner/:name # Issues de um repo
GET  /api/github/prs/:owner/:name    # Pull requests
GET  /api/github/notifications       # Notificacoes
```

## Roadmap

### Fase 1 - Foundation (atual)
- [x] Desktop UI (React, janelas, dock, menu bar)
- [x] Apps funcionais: Browser, Terminal, SmolChat, Agents, Supabase, GitHub, PM2, FileExplorer
- [x] Backend com APIs completas
- [x] Orquestrador com Llama 70B (HF gratis)
- [x] SQL Agent local (1.5B, CPU, llama-server)
- [x] ACPX instalado (v0.1.15)
- [x] Claude Code disponivel via ACPX

### Fase 2 - Integracao ACPX
- [ ] SmolChat conectado ao orquestrador (`/api/orchestrator/chat/stream`)
- [ ] Claude Code via ACPX com sessoes persistentes
- [ ] Permissoes por agente (approve-reads, approve-all)
- [ ] Status de agentes em tempo real no app Agents

### Fase 3 - Memoria Central
- [ ] Instalar Basic Memory (MCP Server)
- [ ] Integrar Session Logger
- [ ] Orquestrador documenta cada interacao na memoria
- [ ] Agentes consultam memoria antes de responder

### Fase 4 - Novos Agentes
- [ ] Agente de frontend (UI/UX, React)
- [ ] Agente de texto (copywriting, conteudo)
- [ ] Agente de pesquisa (web search, analise)
- [ ] Modelo guia/assistente treinado sobre o sistema

### Fase 5 - Polish
- [ ] App Settings funcional (config de agentes via UI)
- [ ] Mission Control (kanban de tarefas)
- [ ] Inbox (task inbox com threads)
- [ ] Dashboard de custos/tokens por agente
- [ ] Export/import de sessoes ACPX

## Setup

### Requisitos
- Node.js 20+
- llama.cpp (para modelo local)
- ACPX (`npm install -g acpx`)
- Claude Code (`npm install -g @anthropic-ai/claude-code`)

### Variaveis de ambiente
```bash
HF_TOKEN=hf_...           # HuggingFace Pro token (para Llama 70B gratis)
LAUNCHER_URL=http://localhost:3002
LAUNCHER_WS=ws://localhost:3002/ws
```

### Rodar
```bash
# Instalar dependencias
cd server && npm install && cd ..
npm install

# Build frontend
npm run build

# Iniciar llama-server (modelo SQL local)
llama-server -m models/agent-os-1b5-q8.gguf --host 0.0.0.0 --port 8080 -c 2048 -t 4

# Iniciar server
cd server && HF_TOKEN=seu_token node server.js
```

## Licenca

MIT

## Contribuicao

Hub Formaturas - https://somosahub.com.br
