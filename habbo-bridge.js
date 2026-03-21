const http = require("http");
const net = require("net");
const { execSync } = require("child_process");

const RCON_HOST = "127.0.0.1";
const RCON_PORT = 3001;
const BOT_ID = 1;
const BRIDGE_PORT = 9090;

function sql(query) {
  execSync(`docker exec mysql mysql -u arcturus_user -parcturus_pw arcturus -e "${query.replace(/"/g, '\\"')}"`);
}

function sendRcon(key, data) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const payload = JSON.stringify({ key, data });
    let response = "";
    client.connect(RCON_PORT, RCON_HOST, () => client.write(payload));
    client.on("data", (d) => { response += d.toString(); });
    client.on("end", () => resolve(response));
    client.on("error", () => resolve("error"));
    setTimeout(() => { client.destroy(); resolve(response || "timeout"); }, 3000);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  let body = "";
  for await (const chunk of req) body += chunk;
  const data = body ? JSON.parse(body) : {};
  const url = req.url;

  try {
    if (url === "/api/bot/say" && req.method === "POST") {
      const msg = (data.message || "...").replace(/'/g, "''");
      sql(`UPDATE bots SET chat_lines='${msg}', chat_auto='1', chat_delay=1 WHERE id=${BOT_ID}`);
      res.end(JSON.stringify({ ok: true, action: "say", message: data.message }));
    }
    else if (url === "/api/bot/move" && req.method === "POST") {
      sql(`UPDATE bots SET x=${parseInt(data.x)||0}, y=${parseInt(data.y)||0} WHERE id=${BOT_ID}`);
      res.end(JSON.stringify({ ok: true, action: "move", x: data.x, y: data.y }));
    }
    else if (url === "/api/bot/motto" && req.method === "POST") {
      const motto = (data.motto || "").replace(/'/g, "''");
      sql(`UPDATE bots SET motto='${motto}' WHERE id=${BOT_ID}`);
      res.end(JSON.stringify({ ok: true, action: "motto", motto: data.motto }));
    }
    else if (url === "/api/user/talk" && req.method === "POST") {
      const result = await sendRcon("talkuser", {
        user_id: data.user_id || 1,
        type: data.type || "shout",
        message: data.message || "Hello!",
        bubble_id: data.bubble_id || -1,
      });
      res.end(JSON.stringify({ ok: true, result }));
    }
    else if (url === "/api/rcon" && req.method === "POST") {
      const result = await sendRcon(data.key, data.data);
      res.end(JSON.stringify({ ok: true, result }));
    }
    else if (url === "/api/bot/status") {
      res.end(JSON.stringify({ ok: true, bot_id: BOT_ID, status: "online" }));
    }
    else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found", endpoints: [
        "POST /api/bot/say {message}",
        "POST /api/bot/move {x, y}",
        "POST /api/bot/motto {motto}",
        "POST /api/user/talk {user_id, message, type}",
        "POST /api/rcon {key, data}",
        "GET /api/bot/status",
      ]}));
    }
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(BRIDGE_PORT, "0.0.0.0", () => {
  console.log("Habbo Bridge API on port " + BRIDGE_PORT);
});
