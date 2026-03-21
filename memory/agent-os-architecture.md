---
title: Agent OS Architecture
type: knowledge
tags:
- architecture
- system
- overview
permalink: agent-os/agent-os-architecture
---

## Observações
- [architecture] Agent OS é um orquestrador multi-agente com interface desktop macOS-style
- [stack] Frontend React + TypeScript, Backend Node.js + Express, SQLite local
- [routing] Gestor (Llama 3.3 70B via HF free) classifica e roteia tarefas
- [agents] Claude Code via ACPX, SQL Agent 1.5B local, Gestor direto
- [memory] SQLite auto-save + Basic Memory MCP + Llama organizador
- [server] Vultr 207.246.65.100, 4CPU 8GB RAM, Ubuntu

## Relações
- Depende de [[acpx-protocol]]
- Usa [[huggingface-inference-api]]
- Modelo local [[agent-os-1.5b]]