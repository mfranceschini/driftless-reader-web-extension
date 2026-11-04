// Tiny static server for e2e fixtures (no dependencies).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');
const port = Number(process.argv[2] ?? 4317);
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  try {
    const body = await readFile(join(root, path));
    const headers = { 'content-type': types[extname(path)] ?? 'application/octet-stream' };
    // *.csp.html fixtures simulate sites with a strict Content-Security-Policy.
    if (path.endsWith('.csp.html')) {
      headers['content-security-policy'] =
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'";
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`fixtures on http://localhost:${port}`));
