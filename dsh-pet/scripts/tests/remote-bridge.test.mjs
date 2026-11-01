/**
 * 显示层 bridge 的远程传输单测：createBridge(remote) 把请求 POST 到宿主 /rpc、素材走 assetUrl 带 Range 转发。
 * 用真实 http 服务当宿主，不加载 Electron（Node 26 自带 Request/Response）。
 * 跑法：node --test scripts/tests/remote-bridge.test.mjs（npm run test:ui 会带上）。
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';

const require = createRequire(import.meta.url);
const { createBridge } = require('../../runtime/electron-helper/main/bridge.js');

const VIDEO = Buffer.from('0123456789abcdef');
const TOKEN = 'test-token-abc';

describe('显示层 bridge 远程传输', () => {
  let server;
  let origin = '';
  let bridge;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/rpc') {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          if (req.headers['x-dsh-pet-remote-token'] !== TOKEN) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'forbidden' }));
            return;
          }
          const msg = JSON.parse(raw);
          res.writeHead(200, { 'content-type': 'application/json' });
          if (msg.url.includes('/thumb/')) {
            res.end(
              JSON.stringify({
                id: msg.id,
                status: 200,
                contentType: 'video/webm',
                assetUrl: origin + '/asset?u=' + encodeURIComponent(msg.url) + '&token=' + TOKEN,
              }),
            );
          } else {
            res.end(
              JSON.stringify({
                id: msg.id,
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({ main: { pets: [{ id: 'main', size: 462, display: 'both' }] } }),
              }),
            );
          }
        });
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/asset')) {
        const range = req.headers.range;
        if (range) {
          const m = /bytes=(\d+)-(\d+)/.exec(range);
          const start = Number(m[1]);
          const end = Number(m[2]);
          const slice = VIDEO.subarray(start, end + 1);
          res.writeHead(206, {
            'content-type': 'video/webm',
            'content-range': 'bytes ' + start + '-' + end + '/' + VIDEO.length,
          });
          res.end(slice);
          return;
        }
        res.writeHead(200, { 'content-type': 'video/webm' });
        res.end(VIDEO);
        return;
      }
      res.writeHead(404);
      res.end('no');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    bridge = createBridge({
      isBridge: true,
      prefix: 'dsh-pet-bridge:',
      origin: 'http://x',
      token: undefined,
      remote: { rpcUrl: origin, token: TOKEN },
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('hostRequest 走 /rpc 并回配置', async () => {
    const resp = await bridge.hostRequest('GET', '/dsh-pet-7340/config');
    assert.equal(resp.status, 200);
    assert.ok(resp.body.includes('main'));
  });

  test('handle 处理 scheme 请求：配置', async () => {
    const res = await bridge.handle(new Request('dsh-pet-bridge://dsh-pet/dsh-pet-7340/config'));
    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes('main'));
  });

  test('handle 处理素材：assetUrl 带 Range 转发，回 206 切片', async () => {
    const res = await bridge.handle(
      new Request('dsh-pet-bridge://dsh-pet/dsh-pet-7340/thumb/main/a.webm', { headers: { range: 'bytes=2-5' } }),
    );
    assert.equal(res.status, 206);
    assert.equal(await res.text(), '2345');
  });
});
