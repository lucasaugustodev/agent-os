# Agent OS - Flows

## O que sao Flows

Flows sao workflows pre-definidos que passam por uma sequencia de agentes automaticamente. Um "Flow Agent" (Llama 70B dedicado) monitora a execucao, valida cada etapa, e reporta na thread.

## Diferenca entre Thread e Flow

- **Thread**: conversa livre, usuario decide o que fazer
- **Flow**: pipeline automatizado, etapas pre-definidas, agentes ja atribuidos

Um Flow **cria threads** automaticamente pra cada etapa. A thread e o registro detalhado, o flow e a orquestracao.

## Exemplo

```
Flow: "Deploy Landing Page"
  Etapa 1: [Claude Code] Criar HTML/CSS/JS
  Etapa 2: [Claude Code] Testar responsividade
  Etapa 3: [Gestor] Revisar e resumir
  Etapa 4: [Claude Code] Deploy no server
  Status: ████████░░ 75% (etapa 3 de 4)
```

## Arquitetura

```
FLOW AGENT (Llama 70B dedicado)
  |
  |-- Monitora cada etapa
  |-- Valida resultado antes de avancar
  |-- Reporta na thread do flow
  |-- Detecta erros e decide: retry, skip, ou escalar
  |
  ├── Etapa 1 → Thread 1 → Agente X executa
  ├── Etapa 2 → Thread 2 → Agente Y executa
  ├── Etapa 3 → Thread 3 → Agente Z executa
  └── Etapa 4 → Thread 4 → Agente W executa
```

## Schema (SQLite)

```sql
-- Templates de flow (reutilizaveis)
CREATE TABLE IF NOT EXISTS flow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  steps TEXT NOT NULL,           -- JSON array de etapas
  created_by TEXT,
  tags TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Instancias de flow em execucao
CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES flow_templates(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'running',  -- running, paused, completed, failed
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER,
  input TEXT,                     -- input inicial do usuario
  output TEXT,                    -- resultado final
  thread_id TEXT,                 -- thread principal do flow
  monitor_log TEXT DEFAULT '[]',  -- log do flow agent
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Etapas de cada flow
CREATE TABLE IF NOT EXISTS flow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_id TEXT REFERENCES flows(id),
  step_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  agent_id TEXT,                  -- qual agente executa
  prompt_template TEXT,           -- prompt com {{input}} e {{previous_result}}
  status TEXT DEFAULT 'pending',  -- pending, running, completed, failed, skipped
  thread_id TEXT,                 -- thread desta etapa
  input TEXT,                     -- input desta etapa
  output TEXT,                    -- resultado desta etapa
  duration_ms INTEGER,
  error TEXT,
  started_at DATETIME,
  completed_at DATETIME
);
```

## Etapa de um Flow (JSON)

```json
{
  "steps": [
    {
      "name": "Criar codigo",
      "agent_id": "coder",
      "prompt": "Cria {{input}}",
      "validation": "Verificar se arquivos foram criados",
      "on_fail": "retry"
    },
    {
      "name": "Testar",
      "agent_id": "coder",
      "prompt": "Testa o que foi criado na etapa anterior: {{previous_result}}",
      "on_fail": "skip"
    },
    {
      "name": "Revisar",
      "agent_id": "gestor",
      "prompt": "Revisa o resultado: {{previous_result}}",
      "on_fail": "escalate"
    }
  ]
}
```

## Flow Agent

Agente dedicado (Llama 70B) que:

1. **Inicia** o flow: cria thread principal, registra no banco
2. **Executa** cada etapa em sequencia:
   - Cria thread pra etapa
   - Envia prompt pro agente da etapa
   - Espera resultado
   - Valida resultado (Llama decide se ta ok)
   - Se ok: avanca. Se falhou: retry/skip/escalate
3. **Monitora** em tempo real:
   - Reporta progresso na thread principal
   - Detecta stalls (etapa travada >5min)
   - Log de cada decisao
4. **Finaliza**: resume resultado na thread, marca flow como completo

## Templates Pre-definidos

| Flow | Etapas |
|------|--------|
| Landing Page | Criar HTML → Testar → Revisar → Deploy |
| Feature | Planejar → Codar → Testar → Code Review → Merge |
| Bug Fix | Diagnosticar → Corrigir → Testar → Verificar |
| SQL Migration | Analisar schema → Gerar migration → Testar → Aplicar |
| Deploy | Build → Test → Stage → Prod |

## Kanban UI

```
┌──────────────────────────────────────────────────────────┐
│ Flows                                    [+ Novo Flow]   │
├──────────┬───────────┬──────────┬───────────┬───────────┤
│ Backlog  │ Running   │ Testing  │ Review    │ Done      │
│          │           │          │           │           │
│ ┌──────┐ │ ┌──────┐  │          │           │ ┌──────┐  │
│ │Bug   │ │ │Landing│  │          │           │ │Snake │  │
│ │Fix   │ │ │Page  ●│  │          │           │ │Game  │  │
│ │      │ │ │3/4   │  │          │           │ │4/4 ✓ │  │
│ └──────┘ │ └──────┘  │          │           │ └──────┘  │
│          │           │          │           │           │
│          │ ┌──────┐  │          │           │           │
│          │ │API   │  │          │           │           │
│          │ │Users ●│  │          │           │           │
│          │ │1/5   │  │          │           │           │
│          │ └──────┘  │          │           │           │
└──────────┴───────────┴──────────┴───────────┴───────────┘
```

### Card do Flow
- Titulo
- Progress bar (etapas completadas / total)
- Agente atual (quem ta executando)
- Status dot (verde=ok, amarelo=running, vermelho=erro)
- Clique abre a thread do flow com timeline completa

## API

```
GET    /api/flows                      - Lista flows
POST   /api/flows                      - Criar flow (de template ou custom)
GET    /api/flows/:id                  - Flow com etapas
GET    /api/flows/:id/steps            - Etapas detalhadas
POST   /api/flows/:id/start            - Iniciar execucao
POST   /api/flows/:id/pause            - Pausar
POST   /api/flows/:id/resume           - Retomar
POST   /api/flows/:id/cancel           - Cancelar

GET    /api/flow-templates             - Lista templates
POST   /api/flow-templates             - Criar template
```

## Implementacao

### Fase 1: Schema + API + Templates
- Tabelas no SQLite
- CRUD de templates e flows
- Seeds com templates padrao

### Fase 2: Flow Engine
- Executor que roda etapas em sequencia
- Flow Agent (Llama 70B) monitora e valida
- Threads criadas automaticamente por etapa
- Contexto da etapa anterior injetado na proxima

### Fase 3: Kanban UI
- Board com colunas drag-and-drop
- Cards com progresso
- Clique abre thread do flow
- Real-time via polling

### Fase 4: Avancado
- Flows paralelos (convoy)
- Checkpointing pra crash recovery
- Cost tracking por flow
- Templates do marketplace
