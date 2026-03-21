// Headless Habbo client - connects as "Claude" user via WebSocket
// Speaks in room when told to via exported function

const WebSocket = require("ws");

const WS_URL = "ws://127.0.0.1:2096";
const SSO_TICKET = "claude-sso-token";
const TARGET_ROOM = 201;

// Habbo protocol: [length:4bytes][header:2bytes][data...]
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
  packet.writeInt32BE(2 + data.length, 0); // length (header + data)
  packet.writeInt16BE(header, 4);           // header id
  data.copy(packet, 6);
  return packet;
}

let ws = null;
let connected = false;
let inRoom = false;
let reconnectTimer = null;

function connect() {
  if (ws) try { ws.close(); } catch {}

  console.log("[HABBO-CLIENT] Connecting to", WS_URL);
  ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("[HABBO-CLIENT] WebSocket connected");
    connected = true;

    // Step 1: Send SSO login (SecureLoginEvent = 2419)
    const loginPacket = encodePacket(2419, SSO_TICKET);
    ws.send(loginPacket);
    console.log("[HABBO-CLIENT] Sent SSO login");

    // Step 2: Navigate to room after a delay
    setTimeout(() => {
      // FlatOpc / GetGuestRoomEvent - navigate to room
      // OpenFlatConnectionEvent = 2312 (enter room)
      const roomPacket = encodePacket(2312, TARGET_ROOM, "", 0);
      ws.send(roomPacket);
      console.log("[HABBO-CLIENT] Sent room enter for room", TARGET_ROOM);
      inRoom = true;
    }, 3000);
  });

  ws.on("message", (data) => {
    // Parse incoming packets (for debugging)
    if (data.length >= 6) {
      const len = data.readInt32BE(0);
      const header = data.readInt16BE(4);
      // Log only important headers
      if (header === 3928 || header === 2402) { // Auth OK / error
        console.log("[HABBO-CLIENT] Received header:", header, "len:", len);
      }
    }
  });

  ws.on("close", () => {
    console.log("[HABBO-CLIENT] Disconnected");
    connected = false;
    inRoom = false;
    // Reconnect after 5s
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      // Refresh SSO ticket before reconnecting
      try {
        const { execSync } = require("child_process");
        execSync(`docker exec mysql mysql -u arcturus_user -parcturus_pw arcturus -N -e "UPDATE users SET auth_ticket='claude-sso-token' WHERE id=2"`, { timeout: 3000 });
      } catch {}
      connect();
    }, 5000);
  });

  ws.on("error", (err) => {
    console.log("[HABBO-CLIENT] WS Error:", err.message);
  });
}

// Send chat message in current room
function say(message) {
  if (!connected || !ws) {
    console.log("[HABBO-CLIENT] Not connected, can't speak");
    return false;
  }
  // RoomUserTalkEvent = 1314, RoomUserShoutEvent = 2085
  const msg = message.substring(0, 200);
  const packet = encodePacket(1314, msg, 0); // talk with bubble_id 0
  ws.send(packet);
  console.log("[HABBO-CLIENT] Said:", msg);
  return true;
}

function shout(message) {
  if (!connected || !ws) return false;
  const msg = message.substring(0, 200);
  const packet = encodePacket(2085, msg, 0);
  ws.send(packet);
  console.log("[HABBO-CLIENT] Shouted:", msg);
  return true;
}

function isReady() {
  return connected && inRoom;
}

// Auto-connect
connect();

module.exports = { say, shout, isReady, connect };
