/**
 * 远程显示模式的连接配置：从 `--remote-config <file>` 读取 RPC 基址与令牌。
 *
 * 显示层由宿主在 Windows 侧拉起，Windows 进程拿不到 WSL 的环境变量，因此连接信息走命令行指向的
 * 本机 JSON 文件，而不是环境变量。只做读取与形状校验，不发起任何请求。
 * @module dsh-pet/runtime/electron-helper/main/remote-config
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** 从 argv 里找 `--remote-config` 后面那一段；没有返回空串。 */
function remoteConfigPath(argv) {
  const index = argv.indexOf('--remote-config');
  return index >= 0 && index + 1 < argv.length ? String(argv[index + 1]) : '';
}

/**
 * 读取并校验远程连接配置。
 *
 * @param argv - 进程参数（一般 process.argv）。
 * @returns `{ rpcUrl, token, configUrl, petRoute, configDir }`；未指定或非法时返回 null（走本地模式）。
 */
function readRemoteConfig(argv) {
  const file = remoteConfigPath(argv || []);
  if (!file) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error('[dsh-pet] 读取远程显示配置失败：' + String(error && error.message ? error.message : error));
    return null;
  }
  if (!raw || typeof raw.rpcUrl !== 'string' || !raw.rpcUrl || typeof raw.token !== 'string' || !raw.token) {
    console.error('[dsh-pet] 远程显示配置缺少 rpcUrl/token');
    return null;
  }
  return {
    rpcUrl: raw.rpcUrl,
    token: raw.token,
    configUrl: typeof raw.configUrl === 'string' && raw.configUrl ? raw.configUrl : raw.rpcUrl + '/dsh-pet-7340/config',
    petRoute: typeof raw.petRoute === 'string' && raw.petRoute ? raw.petRoute : '/dsh-pet-7340',
    // 连接文件所在目录：显示层把自身 Windows PID 写在这里，供宿主收尾时 taskkill。
    configDir: path.dirname(file),
  };
}

module.exports = { readRemoteConfig };
