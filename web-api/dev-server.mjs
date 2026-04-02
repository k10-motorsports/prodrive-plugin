#!/usr/bin/env node
// ─── Local dev server for the mock telemetry API ───────────────────
// Wraps the Vercel serverless handler in a plain Node HTTP server.
// Usage:  node web-api/dev-server.mjs          (default port 3001)
//         PORT=4000 node web-api/dev-server.mjs

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic import of the handler (ESM default export)
const { default: handler } = await import(join(__dirname, 'api', 'racecor-io-pro-drive.js'));

const PORT = parseInt(process.env.PORT || '3001', 10);

const server = http.createServer((req, res) => {
  // Minimal shim: Vercel's `res.status(code).json(obj)` API
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.writeHead(204);
    res.end();
    return;
  }

  handler(req, res);
});

server.listen(PORT, () => {
  console.log(`\n  ⚡ K10 Mock Telemetry API running at http://localhost:${PORT}`);
  console.log(`     GET http://localhost:${PORT}/api/racecor-io-pro-drive\n`);
});
