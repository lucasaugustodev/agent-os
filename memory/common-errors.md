---
title: Erros Comuns e Soluções
type: error-resolution
tags:
- errors
- fixes
- troubleshooting
permalink: agent-os/common-errors
---

## Observações
- [merge-error] Merge LoRA Q4 gera pesos corrompidos. SEMPRE mergear em FP16
- [hf-token] Nunca hardcodar HF tokens em scripts. HuggingFace bloqueia push
- [spinner] Spinner invisível em dark theme: rgba(255,255,255,0.04) é quase transparente
- [sse-buffer] SSE precisa res.flushHeaders() + X-Accel-Buffering:no para streaming real
- [acpx-session] Sessions ACPX expiram. Usar acpx exec para tasks pontuais

## Relações
- Relacionado a [[acpx-protocol]]
- Relacionado a [[agent-os-architecture]]