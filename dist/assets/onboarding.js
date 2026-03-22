/**
 * Onboarding overlay - shows on first visit.
 * Injects into index.html via script tag.
 */
(async function(){
  // Check if onboarded
  const resp = await fetch('/api/onboarding/status');
  const { onboarded, providers } = await resp.json();
  if (onboarded) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';

  let step = 1;
  let selected = new Set();
  let orchestratorChoice = 'huggingface';
  let installing = '';
  let authInput = '';

  function render() {
    overlay.innerHTML = `
      <div style="width:550px;max-height:90vh;overflow-y:auto;background:#0d1117;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:28px;">
        ${step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()}
      </div>
    `;
    // Bind events
    overlay.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => handleAction(el.dataset.action, el.dataset.value));
    });
    overlay.querySelectorAll('input[data-bind]').forEach(el => {
      el.addEventListener('input', (e) => { authInput = e.target.value; });
    });
  }

  function renderStep1() {
    return `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:32px;margin-bottom:8px;">🤖</div>
        <div style="font-size:18px;font-weight:600;color:#00e5cc;">Bem-vindo ao Agent OS</div>
        <div style="font-size:12px;color:#888;margin-top:4px;">Configure pelo menos um provider de IA para comecar</div>
      </div>
      <div style="font-size:10px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Selecione os providers que deseja usar</div>
      ${providers.map(p => `
        <div data-action="toggle" data-value="${p.id}" style="padding:12px;margin-bottom:6px;border-radius:8px;cursor:pointer;border:1px solid ${selected.has(p.id) ? '#00e5cc' : 'rgba(255,255,255,0.06)'};background:${selected.has(p.id) ? 'rgba(0,229,204,0.08)' : 'rgba(255,255,255,0.02)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-size:13px;font-weight:500;color:#e0e0e0;">${p.name}</span>
              ${p.recommended ? '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(0,229,204,0.15);color:#00e5cc;margin-left:6px;">Recomendado</span>' : ''}
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              ${p.status.installed ? '<span style="font-size:9px;color:#4ade80;">Instalado</span>' : p.requiresCli ? '<span style="font-size:9px;color:#888;">Nao instalado</span>' : ''}
              ${p.status.authenticated ? '<span style="font-size:9px;color:#4ade80;">✓ Auth</span>' : ''}
              <span style="width:16px;height:16px;border-radius:50%;border:2px solid ${selected.has(p.id) ? '#00e5cc' : 'rgba(255,255,255,0.15)'};display:flex;align-items:center;justify-content:center;">${selected.has(p.id) ? '<span style="width:8px;height:8px;border-radius:50%;background:#00e5cc;"></span>' : ''}</span>
            </div>
          </div>
          <div style="font-size:11px;color:#888;margin-top:3px;">${p.description}</div>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <button data-action="next1" style="padding:8px 20px;border-radius:8px;border:none;background:${selected.size > 0 ? '#00e5cc' : 'rgba(255,255,255,0.06)'};color:${selected.size > 0 ? '#0a0e17' : '#666'};font-size:12px;cursor:pointer;font-weight:500;">Continuar</button>
      </div>
    `;
  }

  function renderStep2() {
    const needsAuth = [...selected].filter(id => {
      const p = providers.find(x => x.id === id);
      return p && !p.status.authenticated && (p.authType === 'token' || p.authType === 'api_key');
    });
    const needsInstall = [...selected].filter(id => {
      const p = providers.find(x => x.id === id);
      return p && p.requiresCli && !p.status.installed;
    });

    if (needsInstall.length > 0 && installing) {
      return `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:14px;font-weight:500;color:#00e5cc;margin-bottom:8px;">Instalando ${installing}...</div>
          <div style="font-size:11px;color:#888;">Aguarde</div>
        </div>
      `;
    }

    return `
      <div style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;color:#00e5cc;">Configurar Autenticacao</div>
        <div style="font-size:11px;color:#888;margin-top:4px;">Configure os providers selecionados</div>
      </div>
      ${needsInstall.map(id => {
        const p = providers.find(x => x.id === id);
        return `
          <div style="padding:10px;margin-bottom:8px;border-radius:8px;background:rgba(255,184,77,0.08);border:1px solid rgba(255,184,77,0.2);">
            <div style="font-size:12px;font-weight:500;color:#ffb84d;">${p.name} - precisa instalar</div>
            <div style="font-size:10px;color:#888;margin:4px 0;">${p.installCommand}</div>
            <button data-action="install" data-value="${id}" style="padding:4px 12px;border-radius:4px;border:none;background:rgba(255,184,77,0.15);color:#ffb84d;font-size:10px;cursor:pointer;">Instalar agora</button>
          </div>
        `;
      }).join('')}
      ${needsAuth.map(id => {
        const p = providers.find(x => x.id === id);
        return `
          <div style="padding:10px;margin-bottom:8px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:12px;font-weight:500;color:#e0e0e0;">${p.name}</div>
            <div style="font-size:10px;color:#888;margin:4px 0;">${p.authType === 'token' ? 'Cole seu token:' : 'Cole sua API key:'}</div>
            <div style="display:flex;gap:4px;">
              <input data-bind="auth" placeholder="${p.authType === 'token' ? 'hf_...' : 'sk-...'}" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:6px 8px;color:#e0e0e0;font-size:11px;outline:none;font-family:monospace;">
              <button data-action="saveAuth" data-value="${id}" style="padding:4px 10px;border-radius:4px;border:none;background:#00e5cc;color:#0a0e17;font-size:10px;cursor:pointer;">Salvar</button>
            </div>
          </div>
        `;
      }).join('')}
      ${[...selected].filter(id => {
        const p = providers.find(x => x.id === id);
        return p && p.status.authenticated;
      }).map(id => {
        const p = providers.find(x => x.id === id);
        return `<div style="padding:8px 10px;margin-bottom:4px;border-radius:6px;background:rgba(74,222,128,0.08);font-size:11px;color:#4ade80;">✓ ${p.name} autenticado</div>`;
      }).join('')}
      ${[...selected].filter(id => {
        const p = providers.find(x => x.id === id);
        return p && (p.authType === 'oauth' || p.authType === 'cli_login') && !p.status.authenticated;
      }).map(id => {
        const p = providers.find(x => x.id === id);
        return `<div style="padding:8px 10px;margin-bottom:4px;border-radius:6px;background:rgba(147,130,255,0.08);font-size:11px;color:#9382ff;">⚡ ${p.name} - use o terminal pra fazer login: ${p.cliCommand} login</div>`;
      }).join('')}
      <div style="display:flex;justify-content:space-between;margin-top:16px;">
        <button data-action="back1" style="padding:6px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#888;font-size:11px;cursor:pointer;">Voltar</button>
        <button data-action="next2" style="padding:8px 20px;border-radius:8px;border:none;background:#00e5cc;color:#0a0e17;font-size:12px;cursor:pointer;font-weight:500;">Continuar</button>
      </div>
    `;
  }

  function renderStep3() {
    const availableModels = [];
    if (selected.has('huggingface')) availableModels.push({ id: 'llama-3.3-70b', name: 'Llama 3.3 70B (HF Free)', rec: true });
    if (selected.has('anthropic')) availableModels.push({ id: 'claude-opus-4-6', name: 'Claude Opus 4.6' });
    if (selected.has('google')) availableModels.push({ id: 'gemini-pro', name: 'Gemini Pro' });
    if (selected.has('local')) availableModels.push({ id: 'agent-os-1.5b', name: 'Local 1.5B (CPU)' });

    return `
      <div style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;color:#00e5cc;">Escolha o Orquestrador</div>
        <div style="font-size:11px;color:#888;margin-top:4px;">Este modelo vai ser o "cerebro" que decide qual agente usar pra cada tarefa</div>
      </div>
      ${availableModels.map(m => `
        <div data-action="selectOrch" data-value="${m.id}" style="padding:12px;margin-bottom:6px;border-radius:8px;cursor:pointer;border:1px solid ${orchestratorChoice === m.id ? '#00e5cc' : 'rgba(255,255,255,0.06)'};background:${orchestratorChoice === m.id ? 'rgba(0,229,204,0.08)' : 'rgba(255,255,255,0.02)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;font-weight:500;color:#e0e0e0;">${m.name}</span>
            ${m.rec ? '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(0,229,204,0.15);color:#00e5cc;">Recomendado</span>' : ''}
          </div>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;margin-top:20px;">
        <button data-action="back2" style="padding:6px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#888;font-size:11px;cursor:pointer;">Voltar</button>
        <button data-action="finish" style="padding:8px 24px;border-radius:8px;border:none;background:#00e5cc;color:#0a0e17;font-size:12px;cursor:pointer;font-weight:600;">Iniciar Agent OS</button>
      </div>
    `;
  }

  async function handleAction(action, value) {
    if (action === 'toggle') {
      if (selected.has(value)) selected.delete(value); else selected.add(value);
      render();
    }
    if (action === 'next1' && selected.size > 0) { step = 2; render(); }
    if (action === 'back1') { step = 1; render(); }
    if (action === 'next2') { step = 3; render(); }
    if (action === 'back2') { step = 2; render(); }
    if (action === 'selectOrch') { orchestratorChoice = value; render(); }
    if (action === 'install') {
      installing = value;
      render();
      await fetch('/api/onboarding/install', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: value }) });
      installing = '';
      // Refresh status
      const r = await fetch('/api/onboarding/status');
      const d = await r.json();
      providers.length = 0;
      providers.push(...d.providers);
      render();
    }
    if (action === 'saveAuth') {
      if (!authInput) return;
      await fetch('/api/onboarding/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: value, value: authInput }) });
      authInput = '';
      const r = await fetch('/api/onboarding/status');
      const d = await r.json();
      providers.length = 0;
      providers.push(...d.providers);
      render();
    }
    if (action === 'finish') {
      await fetch('/api/onboarding/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedProviders: [...selected], orchestratorModel: orchestratorChoice }) });
      overlay.remove();
    }
  }

  document.body.appendChild(overlay);
  render();
})();
