#!/usr/bin/env python3
"""Agent daemon - smolagents + local fine-tuned model via llama.cpp."""
import json, os, subprocess, time
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Lock
from smolagents import ToolCallingAgent, OpenAIServerModel, tool
import requests as req

lock = Lock()
extra_env = {}
conversations = {}  # session_id -> {"project_id": ..., "last_access": ...}

# Model config - easily swappable
LOCAL_MODEL_URL = os.environ.get("MODEL_URL", "http://127.0.0.1:8081/v1")
LOCAL_MODEL_NAME = os.environ.get("MODEL_NAME", "adapter")
OPENROUTER_KEY = os.environ.get("OPENROUTER_KEY", "")
USE_LOCAL = os.environ.get("USE_LOCAL", "true").lower() == "true"

def get_model():
    if USE_LOCAL:
        return OpenAIServerModel(
            model_id=LOCAL_MODEL_NAME,
            api_base=LOCAL_MODEL_URL,
            api_key="not-needed",
        )
    else:
        return OpenAIServerModel(
            model_id="arcee-ai/trinity-large-preview:free",
            api_base="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_KEY,
        )

# ─── Tools ───

@tool
def shell(command: str) -> str:
    """Executa um comando bash no servidor Linux. Tem sudo sem senha.
    Args:
        command: O comando bash para executar.
    """
    try:
        env = {**os.environ, **extra_env}
        r = subprocess.run(command, shell=True, capture_output=True, text=True,
                          timeout=30, cwd="/home/claude", env=env)
        return (r.stdout + r.stderr)[:3000]
    except Exception as e:
        return str(e)

@tool
def supabase_sql(project_id: str, sql: str) -> str:
    """Executa SQL no banco Supabase de um projeto. Use para queries SELECT, INSERT, UPDATE, CREATE TABLE etc.
    Args:
        project_id: O ref ID do projeto Supabase (ex: whufzsdchvoteocbggdu).
        sql: A query SQL para executar.
    """
    sb_token = extra_env.get("SUPABASE_ACCESS_TOKEN", "")
    if not sb_token:
        return "Erro: SUPABASE_ACCESS_TOKEN nao configurado"
    try:
        r = req.post(
            f"https://api.supabase.com/v1/projects/{project_id}/database/query",
            headers={"Authorization": f"Bearer {sb_token}", "Content-Type": "application/json"},
            json={"query": sql}, timeout=15
        )
        return r.text[:3000]
    except Exception as e:
        return str(e)

@tool
def supabase_projects() -> str:
    """Lista todos os projetos Supabase com seus IDs. Use primeiro para descobrir o project_id.
    Args: (nenhum)
    """
    sb_token = extra_env.get("SUPABASE_ACCESS_TOKEN", "")
    if not sb_token:
        return "Erro: SUPABASE_ACCESS_TOKEN nao configurado"
    try:
        r = req.get("https://api.supabase.com/v1/projects",
                    headers={"Authorization": f"Bearer {sb_token}"}, timeout=10)
        projects = r.json()
        return "\n".join(f"- {p['name']}: {p['id']} ({p.get('region','')})" for p in projects)
    except Exception as e:
        return str(e)

# ─── Agent ───

agent = None

def init_agent():
    global agent
    model = get_model()
    agent = ToolCallingAgent(
        tools=[shell, supabase_sql, supabase_projects],
        model=model,
        max_steps=5,
    )
    mode = "local" if USE_LOCAL else "openrouter"
    print(f"[DAEMON] Agent ready ({mode})", flush=True)

def cleanup_sessions():
    now = time.time()
    expired = [k for k, v in conversations.items() if now - v.get("last_access", 0) > 1800]
    for k in expired:
        del conversations[k]

def run_agent(message, session_id=None):
    cleanup_sessions()
    # Get project context from session
    ctx = ""
    if session_id and session_id in conversations:
        pid = conversations[session_id].get("project_id")
        if pid:
            ctx = f" (projeto Supabase selecionado: {pid})"

    prompt = f"Responda em portugues brasileiro, curto e direto.{ctx}\n\n{message}"

    try:
        result = str(agent.run(prompt))
        return result
    except Exception as e:
        return f"Erro: {e}"

# ─── HTTP Server ───

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/env?"):
            from urllib.parse import parse_qs, urlparse
            qs = parse_qs(urlparse(self.path).query)
            k = qs.get("key", [""])[0]
            v = qs.get("value", [""])[0]
            if k:
                extra_env[k] = v
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        mode = "local" if USE_LOCAL else "openrouter"
        self.wfile.write(json.dumps({"status": "ok", "mode": mode}).encode())

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        msg = body.get("message", "")
        project_id = body.get("project_id")
        session_id = body.get("session_id")

        # Store project in session
        if session_id and project_id:
            if session_id not in conversations:
                conversations[session_id] = {}
            conversations[session_id]["project_id"] = project_id
            conversations[session_id]["last_access"] = time.time()

        if not msg:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"message required"}')
            return

        if body.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            def sse(d):
                self.wfile.write(f"data: {json.dumps(d)}\n\n".encode())
                self.wfile.flush()

            sse({"event": "status", "text": "Processando..."})

            with lock:
                result = run_agent(msg, session_id)

            sse({"event": "done", "result": result})
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
        else:
            with lock:
                result = run_agent(msg, session_id)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"result": result}).encode())

if __name__ == "__main__":
    # Load tokens
    try:
        r = subprocess.run(["su", "-", "claude", "-c", "echo $SUPABASE_ACCESS_TOKEN"],
                          capture_output=True, text=True, timeout=5)
        tok = r.stdout.strip()
        if tok:
            extra_env["SUPABASE_ACCESS_TOKEN"] = tok
            print("[DAEMON] Supabase token loaded", flush=True)
    except:
        pass

    init_agent()
    HTTPServer(("127.0.0.1", 8082), Handler).serve_forever()
