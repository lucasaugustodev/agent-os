# Agent OS

A web-based operating system interface for managing AI agents, terminals, and cloud infrastructure — all from your browser.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)
![License](https://img.shields.io/badge/License-MIT-green)

## What is Agent OS?

Agent OS is a desktop-like environment that runs in the browser. It provides a familiar windowed interface (dock, menu bar, draggable/resizable windows) to manage AI agents, terminals, files, databases, and more — all in one place.

### Built-in Apps

| App | Description |
|-----|-------------|
| **Fleet Monitor** | Monitor active agents, install from marketplace, create custom agents, pin favorites to desktop |
| **Neural Terminal** | Full xterm.js terminal with PTY backend — run CLI tools, launch agent sessions |
| **Browser** | Embedded Chromium browser with stealth mode (Playwright-powered) |
| **Virtual Filesystem** | Browse agent workspaces and server files |
| **PM2 Manager** | Monitor and control PM2 processes |
| **Supabase** | Manage Supabase projects, tables, and run SQL |
| **GitHub** | Browse repos, issues, PRs, and notifications |
| **SmolAgent** | Local AI chat powered by small language models |
| **AgentRoom** | Isometric pixel-art room with animated avatar (PixiJS) |

### Key Features

- **Window Manager** — Drag, resize, minimize, maximize, cascade windows with z-order management
- **Dock & Menu Bar** — macOS-inspired dock with pinned apps and top menu bar
- **Agent Marketplace** — Browse, install, and manage AI agent packs
- **Desktop Pinning** — Pin favorite agents as desktop shortcuts
- **Persistent State** — Window positions and preferences saved via Zustand + localStorage
- **Animated Desktop** — Mesh gradient animated wallpaper

## Tech Stack

**Frontend:** React 19, TypeScript, Tailwind CSS 4, Zustand, Vite 8, Framer Motion, PixiJS, xterm.js

**Backend:** Node.js, Express, Playwright (headless browser), better-sqlite3

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install & Run

```bash
# Clone
git clone https://github.com/lucasaugustodev/agent-os.git
cd agent-os

# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173` by default.

### Production Build

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server, or use the included Express backend:

```bash
node server/server.js
```

## Project Structure

```
agent-os/
├── src/
│   ├── apps/            # Each app is a lazy-loaded React component
│   │   ├── Agents/      # Fleet Monitor + marketplace + agent creator
│   │   ├── AgentRoom/   # Isometric room with PixiJS engine
│   │   ├── Browser/     # Embedded Chromium viewer
│   │   ├── FileExplorer/
│   │   ├── GitHubCLI/
│   │   ├── PM2Manager/
│   │   ├── SmolChat/
│   │   ├── Supabase/
│   │   └── Terminal/    # xterm.js + PTY integration
│   ├── components/
│   │   └── layout/      # Desktop, Dock, MenuBar, WindowFrame, GestorChat
│   ├── config/
│   │   └── appRegistry.ts  # App definitions and metadata
│   ├── hooks/           # useWindowDrag, useWindowResize, useSmolChat
│   ├── stores/          # Zustand store (window state, pinned agents)
│   ├── styles/          # Tailwind globals + animated wallpaper
│   └── types/           # TypeScript type definitions
├── server/
│   ├── server.js        # Express API + WebSocket server
│   ├── browser-manager.js   # Playwright session management
│   └── browser-stealth.js   # Anti-detection patches
├── public/
└── smol-daemon.py       # Local LLM daemon (llama.cpp integration)
```

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

1. Fork the repo
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a PR

## License

MIT License. See [LICENSE](LICENSE) for details.
