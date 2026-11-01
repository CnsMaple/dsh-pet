#!/usr/bin/env node
/**
 * 手动启动 Windows 显示层（宿主自动拉起失败时的兜底）：读连接文件，用本机 Electron 跑 Helper 的远程模式。
 *
 * 用法：node scripts/remote-display.mjs --config <remote-display.json> [--electron <electron 可执行>]。
 * 连接文件由宿主在远程模式下写到 %LOCALAPPDATA%\\dsh-pet\\display-runtime\\remote-display.json。
 * 不下载 Electron、不改配置；找不到可执行文件即提示。
 * @module dsh-pet/scripts/remote-display
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const helperMain = resolve(here, '..', 'runtime', 'electron-helper', 'main.js');

/** 取 `--name value` 形式的参数。 */
function argOf(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : '';
}

const configPath = argOf('--config');
if (!configPath || !existsSync(configPath)) {
  console.error('[remote-display] 缺少有效的 --config <remote-display.json>');
  console.error('  连接文件由宿主在远程模式下写到 %LOCALAPPDATA%\\dsh-pet\\display-runtime\\remote-display.json');
  process.exit(2);
}

const PLAT = process.platform;
const electronRel =
  PLAT === 'win32'
    ? 'electron.exe'
    : PLAT === 'darwin'
      ? join('Electron.app', 'Contents', 'MacOS', 'Electron')
      : 'electron';
const electron =
  argOf('--electron') ||
  [
    process.env.DSH_PET_ELECTRON_PATH,
    join(
      process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || '', '.dsh'),
      'electron',
      electronRel,
    ),
  ].find((value) => value && existsSync(value));
if (!electron) {
  console.error('[remote-display] 找不到 Electron；用 --electron 指定，或设 DSH_PET_ELECTRON_PATH。');
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE; // 必须删键：带上会让 Electron 以纯 Node 模式启动、require('electron') 失败

console.log('[remote-display] electron: ' + electron);
console.log('[remote-display] config:   ' + configPath);
const child = spawn(electron, [helperMain, '--remote-config', configPath], {
  env,
  stdio: 'inherit',
  windowsHide: false,
});
child.on('exit', (code, signal) => {
  console.log('[remote-display] helper exited (code=' + String(code) + ', signal=' + String(signal) + ')');
});
