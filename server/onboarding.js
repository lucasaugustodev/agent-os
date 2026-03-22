/**
 * Onboarding - First-time setup flow.
 * User picks at least 1 provider, system configures orchestrator.
 */

import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ONBOARDING_FILE = join(__dirname, '..', 'data', 'onboarding.json');

function isOnboarded() {
  try {
    if (!existsSync(ONBOARDING_FILE)) return false;
    const data = JSON.parse(readFileSync(ONBOARDING_FILE, 'utf8'));
    return data.completed === true;
  } catch { return false; }
}

function completeOnboarding(data) {
  writeFileSync(ONBOARDING_FILE, JSON.stringify({ ...data, completed: true, completedAt: new Date().toISOString() }));
}

// Check if a CLI tool is installed
function checkCli(cmd) {
  return new Promise((resolve) => {
    execFile(cmd, ['--version'], { timeout: 10000, shell: true }, (err, stdout) => {
      if (err) return resolve({ installed: false, version: null });
      resolve({ installed: true, version: (stdout || '').trim().match(/([\d.]+)/)?.[1] || stdout.trim() });
    });
  });
}

// Check auth status for known CLIs
function checkAuth(cmd) {
  return new Promise((resolve) => {
    if (cmd === 'claude') {
      execFile('sudo', ['-u', 'claude', 'claude', 'auth', 'status'], { timeout: 10000 }, (err, stdout, stderr) => {
        const out = ((stdout || '') + (stderr || '')).trim();
        try {
          const data = JSON.parse(out);
          resolve({ authenticated: !!data.loggedIn });
        } catch {
          resolve({ authenticated: out.includes('true') || out.includes('loggedIn') });
        }
      });
    } else if (cmd === 'gemini') {
      execFile('gemini', ['-p', 'hi'], { timeout: 10000, shell: true }, (err, stdout, stderr) => {
        const out = ((stdout || '') + (stderr || '')).trim();
        resolve({ authenticated: !out.includes('Please set an Auth') && !err });
      });
    } else {
      resolve({ authenticated: false });
    }
  });
}

export function createOnboardingAPI(app, db) {

  // Get onboarding status
  app.get('/api/onboarding/status', async (_req, res) => {
    const onboarded = isOnboarded();

    // Check available providers
    const providers = [
      {
        id: 'huggingface',
        name: 'HuggingFace Inference',
        description: 'Acesso gratuito a Llama 70B, Qwen e outros. Recomendado.',
        authType: 'token',
        recommended: true,
        requiresCli: false,
        status: { installed: true, authenticated: !!process.env.HF_TOKEN },
      },
      {
        id: 'anthropic',
        name: 'Claude Code (CLI)',
        description: 'Agente de codigo completo com acesso ao filesystem.',
        authType: 'oauth',
        requiresCli: true,
        cliCommand: 'claude',
        installCommand: 'npm install -g @anthropic-ai/claude-code',
        status: await (async () => {
          const cli = await checkCli('claude');
          if (!cli.installed) return { installed: false, authenticated: false, version: null };
          const auth = await checkAuth('claude');
          return { ...cli, ...auth };
        })(),
      },
      {
        id: 'google',
        name: 'Gemini (CLI)',
        description: 'Agente Google com visao e codigo.',
        authType: 'oauth',
        requiresCli: true,
        cliCommand: 'gemini',
        installCommand: 'npm install -g @google/gemini-cli',
        status: await (async () => {
          const cli = await checkCli('gemini');
          if (!cli.installed) return { installed: false, authenticated: false, version: null };
          const auth = await checkAuth('gemini');
          return { ...cli, ...auth };
        })(),
      },
      {
        id: 'cline',
        name: 'Cline (CLI)',
        description: 'Agente de codigo open-source.',
        authType: 'api_key',
        requiresCli: true,
        cliCommand: 'cline',
        installCommand: 'npm install -g cline',
        status: await checkCli('cline'),
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4o e outros modelos via API.',
        authType: 'api_key',
        requiresCli: false,
        status: { installed: true, authenticated: false },
      },
      {
        id: 'local',
        name: 'Local (llama-server)',
        description: 'Modelo local rodando na maquina. Sem custo.',
        authType: 'none',
        requiresCli: false,
        status: await (async () => {
          try {
            const r = await fetch('http://localhost:8080/health');
            return { installed: true, authenticated: true, healthy: r.ok };
          } catch {
            return { installed: false, authenticated: false };
          }
        })(),
      },
    ];

    res.json({ onboarded, providers });
  });

  // Install a CLI
  app.post('/api/onboarding/install', async (req, res) => {
    const { provider } = req.body;
    const commands = {
      anthropic: 'npm install -g @anthropic-ai/claude-code',
      google: 'npm install -g @google/gemini-cli',
      cline: 'npm install -g cline',
    };
    const cmd = commands[provider];
    if (!cmd) return res.status(400).json({ error: 'Unknown provider' });

    try {
      const { execSync } = await import('child_process');
      const out = execSync(cmd, { timeout: 120000 }).toString();
      res.json({ ok: true, output: out });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save auth (API key or token)
  app.post('/api/onboarding/auth', (req, res) => {
    const { provider, value } = req.body;
    if (!provider || !value) return res.status(400).json({ error: 'provider and value required' });

    // Save to providers table
    db.prepare('UPDATE providers SET auth_value = ?, auth_status = ? WHERE id = ?').run(value, 'authenticated', provider);

    // Also set env var for HuggingFace
    if (provider === 'huggingface') {
      process.env.HF_TOKEN = value;
    }

    res.json({ ok: true });
  });

  // Complete onboarding
  app.post('/api/onboarding/complete', (req, res) => {
    const { selectedProviders, orchestratorModel } = req.body;

    completeOnboarding({
      selectedProviders,
      orchestratorModel,
    });

    // Update provider statuses
    for (const p of selectedProviders || []) {
      db.prepare('UPDATE providers SET auth_status = ? WHERE id = ?').run('authenticated', p);
    }

    res.json({ ok: true });
  });

  console.log('[ONBOARDING] API loaded, onboarded:', isOnboarded());
}
