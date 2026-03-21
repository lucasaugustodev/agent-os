#!/bin/bash
export PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin
exec basic-memory mcp --transport streamable-http --host 0.0.0.0 --port 8000 --project agent-os
