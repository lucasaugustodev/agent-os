// Stealth patches to avoid bot detection
// Applied to every new page before navigation

export async function applyStealthScripts(page) {
  // Remove Playwright/CDP traces via CDP
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        // Delete webdriver property completely
        delete Object.getPrototypeOf(navigator).webdriver;

        // Fake plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ];
            const arr = Object.create(PluginArray.prototype);
            plugins.forEach((p, i) => {
              const plugin = Object.create(Plugin.prototype);
              Object.defineProperties(plugin, {
                name: { value: p.name }, filename: { value: p.filename },
                description: { value: p.description }, length: { value: 0 },
              });
              Object.defineProperty(arr, i, { value: plugin });
            });
            Object.defineProperty(arr, 'length', { value: plugins.length });
            arr.namedItem = (name) => plugins.find(p => p.name === name) || null;
            arr.item = (i) => arr[i] || null;
            arr.refresh = () => {};
            return arr;
          },
        });

        // Languages
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'language', { get: () => 'pt-BR' });

        // Platform & hardware
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

        // Chrome object
        if (!window.chrome) {
          window.chrome = {};
        }
        window.chrome.runtime = {
          connect: () => {},
          sendMessage: () => {},
          onMessage: { addListener: () => {}, removeListener: () => {} },
          id: undefined,
          PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux' },
        };
        window.chrome.loadTimes = () => ({
          requestTime: Date.now() / 1000 - Math.random() * 100,
          startLoadTime: Date.now() / 1000 - Math.random() * 50,
          commitLoadTime: Date.now() / 1000 - Math.random() * 10,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2',
        });
        window.chrome.csi = () => ({
          onloadT: Date.now(),
          startE: Date.now() - Math.random() * 1000,
          pageT: Math.random() * 5000,
          tran: 15,
        });

        // Permissions
        const origQuery = window.Permissions?.prototype?.query;
        if (origQuery) {
          window.Permissions.prototype.query = function(params) {
            if (params?.name === 'notifications') return Promise.resolve({ state: 'default', onchange: null });
            return origQuery.call(this, params);
          };
        }

        // WebGL
        const getParam = WebGLRenderingContext?.prototype?.getParameter;
        if (getParam) {
          WebGLRenderingContext.prototype.getParameter = function(p) {
            if (p === 0x9245) return 'Google Inc. (Intel)';
            if (p === 0x9246) return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.5)';
            return getParam.call(this, p);
          };
        }
        const getParam2 = WebGL2RenderingContext?.prototype?.getParameter;
        if (getParam2) {
          WebGL2RenderingContext.prototype.getParameter = function(p) {
            if (p === 0x9245) return 'Google Inc. (Intel)';
            if (p === 0x9246) return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.5)';
            return getParam2.call(this, p);
          };
        }

        // Connection
        if (!navigator.connection) {
          Object.defineProperty(navigator, 'connection', {
            get: () => ({ rtt: 50, downlink: 10, effectiveType: '4g', saveData: false }),
          });
        }

        // Screen dimensions (consistent with viewport)
        Object.defineProperty(screen, 'width', { get: () => 1920 });
        Object.defineProperty(screen, 'height', { get: () => 1080 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
      `
    });
    await cdp.detach();
  } catch {
    // Fallback to addInitScript if CDP fails
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
  }
}
