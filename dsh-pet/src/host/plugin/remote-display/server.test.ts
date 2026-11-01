/**
 * 远程显示 RPC 服务的单测：令牌闸门、JSON 转发、素材 assetUrl 与 Range 流。
 * 用假的 handlePetRoute，不碰真实配置与素材。
 * @module dsh-pet/src/host/plugin/remote-display/server.test
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRemoteDisplayServer, type RemoteDisplayServer } from './server.ts';
import type { HttpRouteHandler } from '../http-route.ts';

const VIDEO_BYTES = Buffer.from('0123456789abcdef');

describe('远程显示 RPC 服务', () => {
  let dir = '';
  let videoFile = '';
  let server: RemoteDisplayServer;
  const log = { info: () => {}, warn: () => {} };

  const handlePetRoute: HttpRouteHandler = async (url, method, body) => {
    if (url.startsWith('/dsh-pet-7340/config')) {
      return { kind: 'json', status: 200, obj: { main: { pets: [{ id: 'main', size: 462, display: 'both' }] } } };
    }
    if (url.startsWith('/dsh-pet-7340/echo')) {
      return { kind: 'json', status: 200, obj: { method, got: body ?? null } };
    }
    if (url.startsWith('/dsh-pet-7340/thumb/main/a.webm')) {
      return { kind: 'file', file: videoFile, contentType: 'video/webm' };
    }
    return { kind: 'text', status: 404, body: 'nope' };
  };

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'dsh-pet-rpc-'));
    videoFile = join(dir, 'a.webm');
    writeFileSync(videoFile, VIDEO_BYTES);
    server = await startRemoteDisplayServer({
      handlePetRoute,
      log,
      port: 0,
      bindHost: '127.0.0.1',
      advertiseHost: '127.0.0.1',
    });
  });

  after(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('health 不需要令牌', async () => {
    const res = await fetch(server.baseUrl + '/health');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
  });

  test('/rpc 无令牌 → 403', async () => {
    const res = await fetch(server.baseUrl + '/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 1, method: 'GET', url: '/dsh-pet-7340/config' }),
    });
    assert.equal(res.status, 403);
  });

  test('/rpc 带令牌 GET config → 回 body JSON', async () => {
    const res = await fetch(server.baseUrl + '/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-pet-remote-token': server.token },
      body: JSON.stringify({ id: 7, method: 'GET', url: '/dsh-pet-7340/config' }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.id, 7);
    assert.equal(json.status, 200);
    assert.ok(json.body.includes('main'));
  });

  test('/rpc POST 透传请求体', async () => {
    const res = await fetch(server.baseUrl + '/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-pet-remote-token': server.token },
      body: JSON.stringify({ id: 8, method: 'POST', url: '/dsh-pet-7340/echo', body: '{"a":1}' }),
    });
    const json = await res.json();
    assert.ok(json.body.includes('POST'));
    assert.ok(json.body.includes('a'));
  });

  test('/rpc 素材返回 assetUrl，GET /asset 流式取回且支持 Range', async () => {
    const rpcRes = await fetch(server.baseUrl + '/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-pet-remote-token': server.token },
      body: JSON.stringify({ id: 9, method: 'GET', url: '/dsh-pet-7340/thumb/main/a.webm' }),
    });
    const rpcJson = await rpcRes.json();
    assert.equal(typeof rpcJson.assetUrl, 'string');
    const full = await fetch(rpcJson.assetUrl);
    assert.equal(full.status, 200);
    assert.equal(Buffer.from(await full.arrayBuffer()).toString(), VIDEO_BYTES.toString());
    const ranged = await fetch(rpcJson.assetUrl, { headers: { range: 'bytes=2-5' } });
    assert.equal(ranged.status, 206);
    assert.equal(await ranged.text(), '2345');
  });

  test('/asset 无令牌 → 403', async () => {
    const res = await fetch(server.baseUrl + '/asset?u=' + encodeURIComponent('/dsh-pet-7340/thumb/main/a.webm'));
    assert.equal(res.status, 403);
  });
});
