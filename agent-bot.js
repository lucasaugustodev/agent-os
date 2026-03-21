const http = require("http");
const net = require("net");
const pty = require("node-pty");
const { execSync } = require("child_process");

// === CONFIG ===
const RCON_HOST = "127.0.0.1";
const RCON_PORT = 3001;
const BOT_ID = 1;
const ROOM_ID = 201;
const BRIDGE_PORT = 9090;
const CLAUDE_WORK_DIR = "/home/claude/workspace";
const ANSI_STRIP = /\x1B\[[0-9;]*[a-zA-Z]|\x1B\].*?\x07|\x1B\[[\?0-9;]*[a-zA-Z]|\r|\x07/g;
const NON_ASCII = /[^\x20-\x7E\n]/g; // strip anything non-printable ASCII

// === HABBO CLIENT (raw TCP to Arcturus port 3000) ===
const netLib = require("net");
const habboClient = (() => {
  const HOST = "127.0.0.1";
  const PORT = 3000;
  const SSO_TICKET = "claude-sso-token";
  const TARGET_ROOM = 201;

  function encodePacket(header, ...parts) {
    let data = Buffer.alloc(0);
    for (const part of parts) {
      if (typeof part === "string") {
        const strBuf = Buffer.from(part, "utf8");
        const lenBuf = Buffer.alloc(2);
        lenBuf.writeUInt16BE(strBuf.length);
        data = Buffer.concat([data, lenBuf, strBuf]);
      } else if (typeof part === "number") {
        const numBuf = Buffer.alloc(4);
        numBuf.writeInt32BE(part);
        data = Buffer.concat([data, numBuf]);
      }
    }
    const packet = Buffer.alloc(6 + data.length);
    packet.writeInt32BE(2 + data.length, 0);
    packet.writeInt16BE(header, 4);
    data.copy(packet, 6);
    return packet;
  }

  let sock = null;
  let connected = false;
  let inRoom = false;

  function connect() {
    if (sock) try { sock.destroy(); } catch {}
    // Refresh SSO ticket
    try { execSync(`docker exec mysql mysql -u arcturus_user -parcturus_pw arcturus -N -e "UPDATE users SET auth_ticket='claude-sso-token' WHERE id=2"`, { timeout: 3000 }); } catch {}

    console.log("[HABBO] Connecting via TCP...");
    sock = new netLib.Socket();
    sock.connect(PORT, HOST, () => {
      console.log("[HABBO] TCP connected, sending login...");
      connected = true;
      // Release version
      sock.write(encodePacket(4000, "PRODUCTION-201611291003-338511768", "HTML5", 0, 0));
      setTimeout(() => {
        sock.write(encodePacket(2419, SSO_TICKET));
        console.log("[HABBO] SSO login sent");
      }, 500);
      setTimeout(() => {
        // Enter room sequence
        sock.write(encodePacket(2312, TARGET_ROOM, "", 0));
        console.log("[HABBO] Sent room enter");
      }, 2000);
      setTimeout(() => {
        // Request room data + heightmap (needed for avatar to appear)
        sock.write(encodePacket(2230, TARGET_ROOM));  // RequestRoomDataEvent
        sock.write(encodePacket(2300));                // RequestRoomHeightmapEvent
        inRoom = true;
        console.log("[HABBO] Sent room data requests - should be visible now");
      }, 3000);
    });
    // Respond to pings to stay alive
    sock.on("data", (d) => {
      if (d.length >= 6) {
        const header = d.readInt16BE(4);
        if (header === 3928) { // Ping
          sock.write(encodePacket(2596)); // Pong
        }
      }
    });
    sock.on("close", () => {
      console.log("[HABBO] Disconnected, reconnecting in 5s...");
      connected = false; inRoom = false;
      setTimeout(connect, 5000);
    });
    sock.on("error", (e) => console.log("[HABBO] Error:", e.message));
  }

  connect();

  return {
    isReady: () => connected && inRoom,
    shout: (msg) => {
      if (!connected || !sock) return false;
      sock.write(encodePacket(2085, msg.substring(0, 200), 0));
      console.log("[HABBO] Shouted:", msg.substring(0, 80));
      return true;
    },
    say: (msg) => {
      if (!connected || !sock) return false;
      sock.write(encodePacket(1314, msg.substring(0, 200), 0));
      return true;
    },
  };
})();

// === STATE ===
let claudeSession = null;  // active PTY session
let outputBuffer = "";
let lastSpoken = "";
let isProcessing = false;

// === SQL HELPER ===
function sql(query) {
  try {
    const escaped = query.replace(/"/g, '\\"');
    return execSync(
      `docker exec mysql mysql -u arcturus_user -parcturus_pw arcturus -N -e "${escaped}"`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();
  } catch (e) {
    console.error("SQL error:", e.message);
    return "";
  }
}

// === BOT CONTROL ===
function botSay(message) {
  if (!message || message === lastSpoken) return;
  // Clean to ASCII only and truncate to Habbo chat limit
  const msg = message.replace(NON_ASCII, "").replace(ANSI_STRIP, "").replace(/'/g, "''").replace(/\n/g, " ").replace(/\s+/g, " ").trim().substring(0, 200);
  if (!msg) return;
  // Use RCON from inside Docker container to make Claude user speak
  try {
    // Strip non-ASCII for safe transport, keep only printable
    const safeMsg = msg.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "'").replace(/\\/g, "");
    const rconPayload = `{"key":"talkuser","data":{"user_id":2,"type":"shout","message":"${safeMsg}"}}`;
    execSync(`docker exec arcturus sh -c 'printf '"'"'${rconPayload}'"'"' | nc -w2 127.0.0.1 3001'`, { timeout: 5000 });
    console.log("[RCON] Shouted:", safeMsg.substring(0, 60));
  } catch (e) {
    console.log("[RCON] Failed:", e.message?.substring(0, 80));
  }
  lastSpoken = msg;
  console.log(`[BOT SAYS] ${msg}`);
}

function botMotto(motto) {
  const m = motto.substring(0, 80).replace(/'/g, "''");
  sql(`UPDATE bots SET motto='${m}' WHERE id=${BOT_ID}`);
}

function botMove(x, y) {
  sql(`UPDATE bots SET x=${parseInt(x) || 0}, y=${parseInt(y) || 0} WHERE id=${BOT_ID}`);
}

// === CLAUDE CODE SESSION ===
function startClaudeSession() {
  if (claudeSession) {
    console.log("[CLAUDE] Session already running");
    return;
  }

  // Ensure workspace exists
  try { execSync(`mkdir -p ${CLAUDE_WORK_DIR}`); } catch {}

  console.log("[CLAUDE] Starting new session...");
  botMotto("Starting up...");
  botSay("Initializing Claude Code session...");

  // Spawn as non-root user 'claude' with OAuth token
  const OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN || "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";
  claudeSession = pty.spawn("su", ["-", "claude", "-c",
    `export CLAUDE_CODE_OAUTH_TOKEN='${OAUTH_TOKEN}' && cd ${CLAUDE_WORK_DIR} && claude --dangerously-skip-permissions`
  ], {
    name: "xterm-256color",
    cols: 120,
    rows: 40,
    cwd: CLAUDE_WORK_DIR,
    env: { ...process.env, TERM: "xterm-256color" },
  });

  outputBuffer = "";
  isProcessing = false;

  claudeSession.onData((data) => {
    const clean = data.replace(ANSI_STRIP, "").replace(NON_ASCII, "").trim();
    if (!clean) return;
    outputBuffer += clean + "\n";

    // Debounce: speak after 2s of no new output
    clearTimeout(claudeSession._speakTimer);
    claudeSession._speakTimer = setTimeout(() => {
      if (outputBuffer.trim()) {
        // Get last meaningful line(s) of output
        const lines = outputBuffer.trim().split("\n").filter(l => l.trim().length > 3);
        const lastLines = lines.slice(-3).join(" ").substring(0, 200);
        if (lastLines) {
          botSay(lastLines);
          botMotto("Working...");
        }
        outputBuffer = "";
        isProcessing = false;
      }
    }, 2000);
  });

  claudeSession.onExit(({ exitCode }) => {
    console.log(`[CLAUDE] Session exited with code ${exitCode}`);
    botSay("Session ended. Send me a new message to restart!");
    botMotto("Idle - waiting for task");
    claudeSession = null;
    isProcessing = false;
  });

  botMotto("Ready! Talk to me.");
  setTimeout(() => botSay("Claude Code ready! Send me a task."), 3000);
}

// === CLAUDE CODE via -p (print mode) with child_process.exec (lighter than PTY) ===
const OAUTH_TOKEN = "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";
const { exec } = require("child_process");

function sendToClaudeSession(message) {
  if (isProcessing) {
    botSay("Wait, still thinking...");
    return;
  }

  console.log(`[INPUT] ${message}`);
  isProcessing = true;
  botMotto("Thinking...");

  // Escape single quotes for shell
  const safeMsg = message.replace(/'/g, "'\\''").replace(/[^\x20-\x7E]/g, "");
  const cmd = `su - claude -c 'export CLAUDE_CODE_OAUTH_TOKEN="${OAUTH_TOKEN}" && cd ${CLAUDE_WORK_DIR} && claude -p --dangerously-skip-permissions --continue --model sonnet "Respond in 1-2 short sentences, under 150 chars. ${safeMsg}"'`;

  const child = exec(cmd, { timeout: 45000, maxBuffer: 1024 * 100 }, (err, stdout, stderr) => {
    const raw = (stdout || "").trim();
    const result = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/[^\x20-\x7E]/g, "").trim().substring(0, 200) || "Done.";
    console.log(`[CLAUDE] ${result.substring(0, 80)}`);
    botSay(result);
    botMotto("Ready");
    isProcessing = false;
  });
}

// === HTTP API ===
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  let body = "";
  for await (const chunk of req) body += chunk;
  let data = {};
  try { data = body ? JSON.parse(body) : {}; } catch { data = {}; }
  const url = req.url;

  try {
    // === Bot control ===
    if (url === "/api/bot/say" && req.method === "POST") {
      botSay(data.message || "...");
      res.end(JSON.stringify({ ok: true, action: "say" }));
    }
    else if (url === "/api/bot/move" && req.method === "POST") {
      botMove(data.x, data.y);
      res.end(JSON.stringify({ ok: true, action: "move" }));
    }
    else if (url === "/api/bot/motto" && req.method === "POST") {
      botMotto(data.motto || "");
      res.end(JSON.stringify({ ok: true, action: "motto" }));
    }

    // === Claude Code session ===
    else if (url === "/api/claude/start" && req.method === "POST") {
      startClaudeSession();
      res.end(JSON.stringify({ ok: true, action: "start" }));
    }
    else if (url === "/api/claude/send" && req.method === "POST") {
      sendToClaudeSession(data.message || "hello");
      res.end(JSON.stringify({ ok: true, action: "send", message: data.message }));
    }
    else if (url === "/api/claude/stop" && req.method === "POST") {
      if (claudeSession) {
        claudeSession.kill();
        claudeSession = null;
      }
      botSay("Session stopped.");
      botMotto("Idle");
      res.end(JSON.stringify({ ok: true, action: "stop" }));
    }
    else if (url === "/api/claude/status" && req.method === "GET") {
      res.end(JSON.stringify({
        ok: true,
        session_active: !!claudeSession,
        is_processing: isProcessing,
        bot_id: BOT_ID,
      }));
    }

    // === Chat webhook (Habbo chat → Claude) ===
    else if (url === "/api/chat" && req.method === "POST") {
      // This is called when someone talks in the Habbo room
      const msg = data.message || "";
      const user = data.username || "User";
      console.log(`[HABBO CHAT] ${user}: ${msg}`);
      sendToClaudeSession(msg);
      res.end(JSON.stringify({ ok: true, forwarded: true }));
    }

    else if (url === "/api/status" && req.method === "GET") {
      res.end(JSON.stringify({
        ok: true,
        bot_id: BOT_ID,
        session_active: !!claudeSession,
        is_processing: isProcessing,
        endpoints: [
          "POST /api/claude/start",
          "POST /api/claude/send {message}",
          "POST /api/claude/stop",
          "GET  /api/claude/status",
          "POST /api/chat {message, username}",
          "POST /api/bot/say {message}",
          "POST /api/bot/move {x, y}",
          "POST /api/bot/motto {motto}",
        ],
      }));
    }
    else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    }
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

// === CHAT POLLING (Habbo room chat → Claude) ===
// Use 0 initially to catch recent messages, then update
let lastChatTimestamp = Math.floor(Date.now() / 1000) - 10;

function pollRoomChat() {
  try {
    const rows = execSync(
      `docker exec mysql mysql -u arcturus_user -parcturus_pw arcturus -N -e "SELECT user_from_id, message, timestamp FROM chatlogs_room WHERE room_id=${ROOM_ID} AND timestamp > ${lastChatTimestamp} AND user_from_id != 0 ORDER BY timestamp ASC LIMIT 5"`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();

    if (!rows) return;

    for (const row of rows.split("\n")) {
      const parts = row.split("\t");
      if (parts.length < 3) continue;
      const [userId, message, ts] = parts;
      lastChatTimestamp = parseInt(ts) || lastChatTimestamp;

      // Skip bot's own messages (user_id 0 or Claude user id 2)
      if (userId === "0" || userId === "2") continue;

      console.log(`[HABBO CHAT] user=${userId}: ${message}`);

      // Forward to Claude
      sendToClaudeSession(message);
    }
  } catch (e) {
    // Silently ignore polling errors
  }
}

// Poll every 2 seconds
setInterval(pollRoomChat, 2000);

server.listen(BRIDGE_PORT, "0.0.0.0", () => {
  console.log(`Agent Bot Bridge on port ${BRIDGE_PORT}`);
  console.log(`Workspace: ${CLAUDE_WORK_DIR}`);
  console.log("Polling room chat every 2s for room_id=" + ROOM_ID);
  console.log("Ready! Talk to the bot in Habbo or use the API.");
  botSay("Claude Bot online!");
  botMotto("Ready");
});
