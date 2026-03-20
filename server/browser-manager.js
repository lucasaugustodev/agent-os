import { chromium } from 'playwright';
import { applyStealthScripts } from './browser-stealth.js';

/** @type {Map<string, any>} */
const sessions = new Map();

const VIEWPORT = { width: 1024, height: 576 };
const FRAME_QUALITY = 35;

export async function createBrowserSession(id, url = 'https://www.google.com') {
  if (sessions.has(id)) return sessions.get(id);

  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1024,576',
    ],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.110 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.55, longitude: -46.63 },
    permissions: ['geolocation'],
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  await applyStealthScripts(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

  const cdp = await page.context().newCDPSession(page);

  const session = { id, browser, page, cdp, clients: new Set(), url };

  // Start screencast - send every frame for max responsiveness
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: FRAME_QUALITY,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1,
  });

  cdp.on('Page.screencastFrame', async (params) => {
    const { data, sessionId } = params;
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});

    // Send as binary WebSocket frame: 1 byte type + 36 bytes browserId + raw JPEG
    const jpegBuf = Buffer.from(data, 'base64');
    const header = Buffer.alloc(37);
    header[0] = 0x01; // frame type marker
    header.write(id, 1, 36, 'ascii');
    const packet = Buffer.concat([header, jpegBuf]);

    for (const ws of session.clients) {
      if (ws.readyState === 1) {
        ws.send(packet);
      }
    }
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      session.url = frame.url();
      const msg = JSON.stringify({ type: 'browser:navigated', browserId: id, url: session.url });
      for (const ws of session.clients) {
        if (ws.readyState === 1) ws.send(msg);
      }
    }
  });

  sessions.set(id, session);
  console.log(`Browser ${id} → ${url}`);
  return session;
}

export function getSession(id) { return sessions.get(id); }

export function getAllSessions() {
  return [...sessions.entries()].map(([id, s]) => ({ id, url: s.url, clients: s.clients.size }));
}

export async function handleBrowserWsMessage(ws, msg) {
  const session = sessions.get(msg.browserId);
  if (!session) return;
  const { page } = session;

  switch (msg.type) {
    case 'browser:subscribe':
      session.clients.add(ws);
      ws.send(JSON.stringify({
        type: 'browser:info', browserId: session.id,
        url: session.url, viewport: VIEWPORT,
      }));
      break;

    case 'browser:unsubscribe':
      session.clients.delete(ws);
      break;

    case 'browser:navigate':
      page.goto(msg.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      break;

    case 'browser:click':
      page.mouse.click(msg.x | 0, msg.y | 0).catch(() => {});
      break;

    case 'browser:dblclick':
      page.mouse.dblclick(msg.x | 0, msg.y | 0).catch(() => {});
      break;

    case 'browser:mousedown':
      page.mouse.move(msg.x | 0, msg.y | 0).then(() => page.mouse.down()).catch(() => {});
      break;

    case 'browser:mouseup':
      page.mouse.up().catch(() => {});
      break;

    case 'browser:scroll':
      page.mouse.wheel(msg.deltaX || 0, msg.deltaY || 0).catch(() => {});
      break;

    case 'browser:keypress':
      if (msg.text) page.keyboard.type(msg.text).catch(() => {});
      else page.keyboard.press(msg.key).catch(() => {});
      break;

    case 'browser:keydown':
      page.keyboard.down(msg.key).catch(() => {});
      break;

    case 'browser:keyup':
      page.keyboard.up(msg.key).catch(() => {});
      break;

    case 'browser:back':
      page.goBack().catch(() => {});
      break;

    case 'browser:forward':
      page.goForward().catch(() => {});
      break;

    case 'browser:reload':
      page.reload().catch(() => {});
      break;
  }
}

export async function closeBrowserSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  await session.cdp.send('Page.stopScreencast').catch(() => {});
  await session.browser.close().catch(() => {});
  sessions.delete(id);
}
