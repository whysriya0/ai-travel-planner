import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadEnvFile} from 'node:process';
import {buildBackend} from './build-backend.mjs';
try {loadEnvFile('.env.local');} catch(error) {if(error.code !== 'ENOENT') throw error;}
await buildBackend();
const {handleApi} = await import('../work/local-api.mjs');
const root = path.resolve('out');
const port = Number(process.env.PORT || 5173);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
createServer(async(req,res) => {
  try {
    const host = req.headers.host;
    if (!['127.0.0.1:' + port, 'localhost:' + port].includes(host)) {res.writeHead(403);return res.end('Invalid host');}
    const url = new URL(req.url, 'http://' + host);
    if (url.pathname.startsWith('/api/')) {
      if (req.headers.origin && req.headers.origin !== url.origin) {res.writeHead(403);return res.end('Invalid origin');}
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 16384) {res.writeHead(413);res.end('Request too large');return;}
      }
      const response = await handleApi(new Request(url, {method:req.method, headers:{'Content-Type':'application/json'}, ...(body ? {body} : {})}));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(await response.text());
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) {res.writeHead(403);return res.end();}
    const data = await fs.readFile(file);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port, '127.0.0.1', () => console.log('Roam UI + API: http://127.0.0.1:' + port));
