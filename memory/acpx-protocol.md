---
title: ACPX Protocol Notes
type: knowledge
tags:
- acpx
- protocol
- acp
- agents
permalink: agent-os/acpx-protocol
---

## Observações
- [protocol] ACPX usa JSON-RPC 2.0 para comunicação agent-to-agent
- [session] Usar acpx exec em vez de sessions persistentes (sessions expiram)
- [auth] Claude Code autentica via ~/.claude.json (OAuth) ou ANTHROPIC_AUTH_TOKEN
- [error] Sessions expiram após TTL 600s, causando exit code 4
- [fix] stdbuf -oL para unbuffered output no streaming

## Relações
- Usado por [[agent-os-architecture]]