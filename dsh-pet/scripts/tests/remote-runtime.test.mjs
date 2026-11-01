/**
 * 远程显示运行时的纯逻辑单测：连接文件解析（remote-config.js）与成品配置拍平（remote.js）。
 * 都不加载 Electron，直接 require 这两个 CJS 模块。
 * 跑法：node --test scripts/tests/remote-runtime.test.mjs（npm run test:ui 会带上）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readRemoteConfig } = require('../../runtime/electron-helper/main/remote-config.js');
const { petsFromMerged } = require('../../runtime/electron-helper/main/remote.js');

describe('readRemoteConfig —— 远程连接文件解析', () => {
  test('合法文件：补齐 configUrl 与 petRoute', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pet-rc-'));
    const file = join(dir, 'remote-display.json');
    writeFileSync(file, JSON.stringify({ rpcUrl: 'http://10.0.0.2:7341', token: 'tok' }));
    const cfg = readRemoteConfig(['electron', 'main.js', '--remote-config', file]);
    assert.equal(cfg.rpcUrl, 'http://10.0.0.2:7341');
    assert.equal(cfg.token, 'tok');
    assert.equal(cfg.configUrl, 'http://10.0.0.2:7341/dsh-pet-7340/config');
    assert.equal(cfg.petRoute, '/dsh-pet-7340');
    rmSync(dir, { recursive: true, force: true });
  });

  test('没有 --remote-config → null（走本地模式）', () => {
    assert.equal(readRemoteConfig(['electron', 'main.js']), null);
  });

  test('缺 token → null', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pet-rc-'));
    const file = join(dir, 'remote-display.json');
    writeFileSync(file, JSON.stringify({ rpcUrl: 'http://x:1' }));
    assert.equal(readRemoteConfig(['e', 'm', '--remote-config', file]), null);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('petsFromMerged —— 成品配置拍平', () => {
  test('只留 desktop/both，按条目与实例顺序编号', () => {
    const merged = {
      main: {
        pets: [
          { id: 'main', size: 462, display: 'both' },
          { id: 'webonly', display: 'web' },
        ],
      },
      pig: { pets: [{ id: 'pig1', size: 300, display: 'desktop' }] },
    };
    assert.deepEqual(petsFromMerged(merged), [
      { id: 'main', size: 462, index: 0 },
      { id: 'pig1', size: 300, index: 1 },
    ]);
  });

  test('非法/空输入 → 空数组', () => {
    assert.deepEqual(petsFromMerged(null), []);
    assert.deepEqual(petsFromMerged({}), []);
  });
});
