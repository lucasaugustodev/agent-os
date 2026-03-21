# Agent OS - Documentacao Tecnica

## Visao Geral

Agent OS e um sistema operacional de agentes IA. Uma interface desktop-like (macOS-style) que orquestra multiplos modelos de IA especializados atraves de um modelo gestor central. Cada agente e um "slot" plugavel que pode ser trocado, adicionado ou removido facilmente.

## Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                    AGENT OS (Frontend React)                  │
│  ┌─────────┬──────────┬──────────┬────────┬────────┬───────┐ │
│  │ Browser │ Terminal │  Inbox   │Mission │ Agents │Finder │ │
│  │         │          │          │Control │        │       │ │
│  └─────────┴──────────┴──────────┴────────┴────────┴───────┘ │
├──────────────────────────────────────────────────────────────┤
│                    SERVER (Node.js + Express)                 │
│  ┌──────────┬──────────┬──────────┬──────────┬─────────────┐ │
│  │ Browser  │ PM2      │ Supabase │ GitHub   │ SmolAgent   │ │
│  │ Manager  │ API      │ API      │ CLI      │ Daemon      │ │
│  └──────────┴──────────┴──────────┴──────────┴─────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                    CAMADA DE ORQUESTRACAO                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              MODELO GESTOR (Orchestrator)                 │ │
│  │    Recebe tarefa → Classifica → Roteia → Retorna         │ │
│  │    Llama 3.3 70B via HF Inference API (gratis, Pro)      │ │
│  └─────────────┬────────────┬───────────────┬───────────────┘ │
│                │            │               │                 │
│  ┌─────────────┴┐  ┌───────┴──────┐  ┌─────┴──────────────┐ │
│  │ Agent Slot 1 │  │ Agent Slot 2 │  │ Agent Slot N       │ │
│  │ Coding       │  │ SQL/Data     │  │ (plugavel)         │ │
│  │ Opus 4.6 API │  │ 1.5B local   │  │ qualquer modelo    │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                    MEMORIA CENTRAL                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Basic Memory (MCP Server)                    │ │
│  │    Markdown files + SQLite + Vector Embeddings            │ │
│  │    Persistente entre sessoes e agentes                    │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Stack Atual

### Frontend (React + TypeScript + Vite)
- **Desktop**: Interface macOS-style com janelas arrastáveis, dock, menu bar
- **Window Manager**: Zustand store (`useAppStore`) com persist
- **Apps**: Registry plugavel (`appRegistry.ts`)
- **Componentes**: Desktop, Dock, MenuBar, WindowFrame

### Backend (Node.js + Express)
- **Porta**: 3000
- **APIs implementadas**:
  - `/api/browsers/*` - Browser automation via Playwright (criar, navegar, clicar, digitar, screenshot)
  - `/api/pm2/*` - Process manager (listar, restart, stop, logs)
  - `/api/supabase/*` - Supabase CLI proxy (auth, projetos, tabelas, SQL)
  - `/api/github/*` - GitHub CLI proxy (auth, repos, issues, PRs, notificacoes)
  - `/api/smol/chat` - SmolAgent daemon proxy (porta 8082)
  - `/api/launcher/*` - Proxy pro claude-launcher-web (porta 3002)
  - `/ws` - WebSocket para terminal, browser streaming, file watching

### Infra (Vultr - 207.246.65.100)
- **OS**: Ubuntu, 4 CPU, 8GB RAM, sem GPU
- **Processos ativos**:
  - `server.js` (porta 3000) - Frontend + API
  - `smol-daemon.py` (porta 8082) - SmolAgent backend
  - `llama-server` (porta 8080) - Modelo 1.5B local CPU
  - `launcher/server.js` (porta 3002) - Claude launcher
  - `agent-bot` (porta 9090) - Bot auxiliar

## App Registry

O sistema de apps e plugavel. Cada app registrado no `appRegistry.ts`:

| App | ID | Status | Descricao |
|-----|----|--------|-----------|
| Browser | `browser` | Funcional | Web browser com Playwright |
| Terminal | `terminal` | Funcional | Terminal session via launcher |
| Inbox | `inbox` | Placeholder | Task inbox com comments |
| Mission Control | `mission-control` | Placeholder | Kanban board de tarefas |
| Agents | `agents` | Placeholder | Org chart de agentes |
| Finder | `finder` | Placeholder | File browser de workspaces |
| Settings | `settings` | Placeholder | Configuracoes do sistema |

### Interface de um App
```typescript
interface AppRegistryEntry {
  id: string;           // ID unico
  name: string;         // Nome exibido
  icon: string;         // Icone do dock
  description: string;  // Descricao
  component: React.LazyExoticComponent;  // Componente React
  defaultSize: { width, height };
  minSize?: { width, height };
  allowMultiple?: boolean;    // Multiplas instancias
  dockPinned?: boolean;       // Fixado no dock
}
```

## Agent Registry (A IMPLEMENTAR)

Sistema de registro de agentes especializados. Cada agente e um slot plugavel:

```typescript
interface AgentSlot {
  id: string;                  // "coder", "sql", "text", "frontend"
  name: string;                // "Coding Agent"
  description: string;         // "Especializado em..."
  provider: "anthropic" | "openai" | "openrouter" | "huggingface" | "local";
  config: {
    model: string;             // "claude-opus-4-6" ou "agent-os-1b5"
    endpoint?: string;         // URL do endpoint (local ou API)
    apiKey?: string;           // Chave da API
    temperature?: number;
    maxTokens?: number;
  };
  capabilities: string[];     // ["code", "sql", "text", "reasoning"]
  active: boolean;             // Ativado/desativado
}
```

### Agentes Planejados

| Slot | Modelo | Provider | Funcao |
|------|--------|----------|--------|
| **Gestor/Orquestrador** | Llama 3.3 70B | HF Inference API (gratis Pro) | Roteia tarefas, classifica intencao, coordena agentes |
| **Coding** | Claude Opus 4.6 | Anthropic API | Escreve/refatora codigo |
| **SQL/Data** | agent-os-1b5 (custom) | Local llama-server | Queries SQL, Supabase, information_schema |
| **Frontend** | (a definir) | (a definir) | UI/UX, componentes React |
| **Texto** | (a definir) | (a definir) | Criacao de conteudo, copywriting |
| **Pesquisa** | (a definir) | (a definir) | Web search, analise de dados |

### Fluxo de Orquestracao

```
1. Usuario digita mensagem no chat
2. Gestor (Llama 70B) analisa a intencao:
   - "escreve uma funcao que..." → routing: coder
   - "quantas vms ativas..." → routing: sql
   - "cria um texto sobre..." → routing: text
3. Gestor envia pra o agente especializado
4. Agente processa e retorna resultado
5. Gestor formata e entrega ao usuario
6. Memoria Central registra a interacao
```

### Troca de Agentes
O usuario pode a qualquer momento:
- Trocar o modelo de um slot (ex: mudar coder de Opus pra GPT-4)
- Adicionar novo slot
- Desativar um slot
- Escolher manualmente qual agente usar

## Memoria Central: Basic Memory

### O que e
Sistema de memoria persistente baseado em Markdown + SQLite + Vector Embeddings. Opera como MCP Server.

### Arquitetura
```
┌──────────────────────────────────────┐
│          Markdown Files              │
│  - YAML frontmatter (metadata)      │
│  - [category] observations           │
│  - [[wiki-links]] relations          │
├──────────────────────────────────────┤
│          SQLite Index                │
│  - Full-text search                  │
│  - Vector embeddings (FastEmbed)     │
│  - Hybrid search                     │
├──────────────────────────────────────┤
│          MCP Server                  │
│  - memory:// URLs                    │
│  - CRUD de notas                     │
│  - Navegacao semantica               │
│  - Context building                  │
└──────────────────────────────────────┘
```

### Uso no Agent OS
- **Contexto entre sessoes**: Agentes mantem conhecimento entre conversas
- **Knowledge graph**: Relacoes entre entidades (projetos, decisoes, aprendizados)
- **Multi-agente**: Todos os agentes leem/escrevem na mesma memoria
- **Orquestrador documenta**: O gestor registra cada interacao e decisao
- **Humano edita**: Usuario pode editar arquivos Markdown diretamente

### Claude Session Logger
Complementa o Basic Memory registrando automaticamente:
- Sessoes de conversa com Claude
- Ferramentas utilizadas
- Decisoes tomadas
- Erros e solucoes

## Modelos Treinados (Custom)

### agent-os-adapter-1.5b
- **Base**: Qwen 2.5 1.5B Instruct
- **Treino**: LoRA (r=32, alpha=64), 7 epochs, 415 exemplos x4
- **Funcao**: Converter linguagem natural → JSON (SQL, CLI, shell)
- **Deploy**: GGUF Q8 no llama-server (CPU, 1.6GB RAM, ~3s/query)
- **Repos**:
  - Adapter: `devsomosahub/agent-os-adapter-1.5b`
  - Merged: `devsomosahub/agent-os-1b5-merged`

### agent-os-adapter-7b
- **Base**: Qwen 2.5 7B Instruct
- **Treino**: LoRA Q4, mesma config
- **Funcao**: Mesma, mas mais preciso
- **Repos**:
  - Adapter: `devsomosahub/agent-os-adapter-7b`
  - Merged: `devsomosahub/agent-os-7b-merged`

### Limitacao conhecida
Modelos custom inventam nomes de colunas baseados no dataset de treino quando fazem queries diretas. Solucao: fluxo de 2 passos (information_schema primeiro, depois query com colunas reais).

## APIs Externas Utilizadas

| Servico | Uso | Autenticacao |
|---------|-----|-------------|
| HuggingFace (Pro) | Inference API gratis (Llama 70B), treinamento, endpoints | Token HF |
| Anthropic | Claude Opus 4.6 para coding agent | API Key |
| OpenRouter | LLMs alternativos, fallback | API Key |
| Vultr | Servidores (VMs dos boards, server Agent OS) | API Key |
| Supabase | Banco de dados dos projetos (Cloud-Hub, Hubia) | Access Token |
| GitHub | Repos, issues, PRs | gh CLI token |

## Portas do Server (207.246.65.100)

| Porta | Servico | Acesso |
|-------|---------|--------|
| 3000 | Agent OS (frontend + API) | Publico |
| 3002 | Claude Launcher Web | Interno |
| 8080 | llama-server (modelo 1.5B) | Interno |
| 8082 | SmolAgent daemon | Interno |
| 9090 | Agent bot | Interno |

## Proximos Passos

1. **Implementar Agent Registry** - Config JSON de agentes plugaveis
2. **Implementar Orquestrador** - Gestor que roteia entre agentes
3. **Integrar Basic Memory** - MCP Server como memoria central
4. **Integrar Session Logger** - Log automatico de sessoes
5. **Implementar apps Placeholder** - Inbox, Mission Control, Agents, Finder, Settings
6. **Modelo guia/assistente** - Treinar modelo que explica o sistema ao usuario
7. **Dashboard de agentes** - UI para ver/trocar/configurar agentes em tempo real
