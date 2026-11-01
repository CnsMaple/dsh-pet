/**
 * Windows 显示层的宿主侧启动器：定位/下载 Windows 版 Electron、把 Helper 运行时铺到 Windows 可见目录、
 * 写连接文件并 spawn 它。
 *
 * 只在 WSL（能通过 /mnt 互操作执行 Windows 程序的 Linux）里工作；非互操作环境返回结构化失败，
 * 由调用方降级为「不自动拉起、打印手动启动说明」。不负责 RPC 服务本身（归 ./server）。
 * @module dsh-pet/src/host/plugin/remote-display/windows-electron
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** 远程显示层启动所需的日志出口。 */
export interface LauncherLog {
  info(message: string): void;
  warn(message: string): void;
}

/** 启动 Windows 显示层的输入。 */
export interface LaunchInput {
  /** 插件包根（runtime/electron-helper 与 assets/logo.png 的相对基准）。 */
  readonly packageRoot: string;
  /** 显示层要连的 RPC 基址，形如 `http://<ip>:<port>`。 */
  readonly rpcUrl: string;
  /** 远程令牌。 */
  readonly token: string;
  /** 日志出口。 */
  readonly log: LauncherLog;
}

/** 启动结果：成功给出子进程与路径，失败给出可读原因。 */
export type LaunchResult =
  | { readonly ok: true; readonly child: ChildProcess; readonly exeWsl: string }
  | { readonly ok: false; readonly reason: string };

/** Windows 系统目录下的 cmd.exe（WSL 互操作入口）。 */
const CMD_EXE = '/mnt/c/Windows/System32/cmd.exe';

/** Windows Electron 的默认落地子目录（相对 %LOCALAPPDATA%\\dsh-pet）。 */
const WIN_ELECTRON_DIR = 'electron-win';

/** 显示层运行时在 Windows 侧的落地子目录（相对 %LOCALAPPDATA%\\dsh-pet）。 */
const WIN_STAGE_DIR = 'display-runtime';

/** WSL 互操作是否可用：/mnt/c 与 cmd.exe 都在。 */
export function hasWindowsInterop(): boolean {
  return existsSync('/mnt/c') && existsSync(CMD_EXE);
}

/** 跑一次 cmd.exe 并返回去掉首尾空白的输出（cwd 固定在 /mnt/c，避开 UNC 当前目录告警）。 */
function runCmd(args: readonly string[]): string {
  return execFileSync(CMD_EXE, args, { cwd: '/mnt/c', encoding: 'utf8' }).trim();
}

/** 把 Windows 绝对路径转成 WSL 路径（wslpath -u）；失败返回 undefined。 */
export function toWslPath(windowsPath: string): string | undefined {
  try {
    const out = execFileSync('wslpath', ['-u', windowsPath], { encoding: 'utf8' }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/** 把 WSL 路径转成 Windows 绝对路径（wslpath -w）；失败返回 undefined。 */
export function toWindowsPath(wslPath: string): string | undefined {
  try {
    const out = execFileSync('wslpath', ['-w', wslPath], { encoding: 'utf8' }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/** 解析 %LOCALAPPDATA% 行的尾部（cmd 可能带警告前缀，只取最后一行非空）。 */
export function parseLocalAppData(output: string): string | undefined {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1];
  return last && /^[A-Za-z]:\\/.test(last) ? last : undefined;
}

/** Windows 用户 %LOCALAPPDATA% 对应的 WSL 路径；取不到返回 undefined。 */
export function windowsLocalAppDataWsl(): string | undefined {
  try {
    const win = parseLocalAppData(runCmd(['/c', 'echo', '%LOCALAPPDATA%']));
    return win ? toWslPath(win) : undefined;
  } catch {
    return undefined;
  }
}

/** 本插件在 Windows 侧的落地根 %LOCALAPPDATA%\\dsh-pet 的 WSL 路径；取不到返回 undefined。 */
export function windowsDshPetBaseWsl(): string | undefined {
  const local = windowsLocalAppDataWsl();
  return local ? join(local, 'dsh-pet') : undefined;
}

/** 目标 Windows Electron 可执行文件的 WSL 路径（未校验存在性）。 */
function windowsElectronExeWsl(winBase: string): string {
  return join(winBase, WIN_ELECTRON_DIR, 'electron.exe');
}

/** Electron 版本：DSH_PET_ELECTRON_VERSION 优先，默认 43.3.0。 */
function electronVersion(): string {
  return process.env.DSH_PET_ELECTRON_VERSION || '43.3.0';
}

/**
 * 确保 Windows 版 Electron 就绪：已存在直接用；否则按 win32-x64 下载并解压到 %LOCALAPPDATA%\\dsh-pet\\electron-win。
 *
 * @param winBase - %LOCALAPPDATA%\\dsh-pet 的 WSL 路径。
 * @param log - 日志出口。
 * @returns 可执行文件的 WSL 路径；失败返回 undefined。
 */
export async function ensureWindowsElectron(winBase: string, log: LauncherLog): Promise<string | undefined> {
  // 显式指定优先（WSL 路径或 /mnt/c 路径均可）：已有可开窗 Electron 的用户不必再下载一份。
  const override = process.env.DSH_PET_WIN_ELECTRON_PATH;
  if (override && existsSync(override)) return override;
  const exe = windowsElectronExeWsl(winBase);
  if (existsSync(exe)) return exe;
  if (process.env.DSH_PET_ALLOW_WIN_ELECTRON_DOWNLOAD === '0') {
    log.warn('[dsh-pet] 未找到 Windows Electron 且已禁用自动下载（DSH_PET_ALLOW_WIN_ELECTRON_DOWNLOAD=0）');
    return undefined;
  }
  const version = electronVersion();
  const mirror = process.env.DSH_PET_ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
  log.info(`[dsh-pet] 正在下载 Windows Electron v${version}（win32-x64）到 ${exe} ...`);
  try {
    mkdirSync(dirname(exe), { recursive: true });
    const { downloadArtifact } = await import('@electron/get');
    const zipPath = await downloadArtifact({
      version: `v${version}`,
      artifactName: 'electron',
      platform: 'win32',
      arch: 'x64',
      mirrorOptions: { mirror: mirror.replace(/\/$/, '') + '/' },
    });
    const { default: extract } = await import('@electron-internal/extract-zip');
    await extract(zipPath, { dir: dirname(exe) });
    if (!existsSync(exe)) {
      log.warn('[dsh-pet] Windows Electron 解压后仍缺 electron.exe：' + exe);
      return undefined;
    }
    log.info('[dsh-pet] Windows Electron 就绪：' + exe);
    return exe;
  } catch (error) {
    log.warn('[dsh-pet] Windows Electron 下载失败：' + (error instanceof Error ? error.message : String(error)));
    return undefined;
  }
}

/** 把 Helper 运行时与图标铺到 Windows 可见目录，返回显示层入口的 WSL 路径。 */
function stageRuntime(packageRoot: string, winBase: string): string {
  const stageBase = join(winBase, WIN_STAGE_DIR);
  const destHelper = join(stageBase, 'runtime', 'electron-helper');
  cpSync(join(packageRoot, 'runtime', 'electron-helper'), destHelper, { recursive: true });
  const destAssets = join(stageBase, 'assets');
  mkdirSync(destAssets, { recursive: true });
  cpSync(join(packageRoot, 'assets', 'logo.png'), join(destAssets, 'logo.png'));
  return join(destHelper, 'main.js');
}

/**
 * 写连接文件（含令牌）到 Windows 可见目录，返回其 WSL 路径；令牌只落这个本机文件，不进日志。
 *
 * @param stageBaseDir - 显示层运行时落地目录的 WSL 路径（%LOCALAPPDATA%\\dsh-pet\\display-runtime）。
 * @param rpcUrl - 宿主 RPC 基址。
 * @param token - 远程令牌。
 * @returns 连接文件的 WSL 绝对路径。
 */
export function writeConnectionFile(stageBaseDir: string, rpcUrl: string, token: string): string {
  mkdirSync(stageBaseDir, { recursive: true });
  const configPath = join(stageBaseDir, 'remote-display.json');
  const payload = {
    rpcUrl,
    token,
    configUrl: `${rpcUrl}/dsh-pet-7340/config`,
    petRoute: '/dsh-pet-7340',
  };
  writeFileSync(configPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return configPath;
}

/**
 * 启动 Windows 显示层进程。
 *
 * @param input - 包根、RPC 基址、令牌与日志。
 * @returns 成功给出子进程；失败给出原因（互操作缺失 / 无 Windows Electron 等）。
 */
export async function launchWindowsDisplayLayer(input: LaunchInput): Promise<LaunchResult> {
  const { packageRoot, rpcUrl, token, log } = input;
  if (!hasWindowsInterop()) {
    return { ok: false, reason: '当前环境没有 Windows 互操作（/mnt/c 或 cmd.exe 不可用）' };
  }
  const winBase = windowsDshPetBaseWsl();
  if (!winBase) {
    return { ok: false, reason: '无法解析 Windows %LOCALAPPDATA%\\dsh-pet' };
  }
  const exeWsl = await ensureWindowsElectron(winBase, log);
  if (!exeWsl) return { ok: false, reason: 'Windows Electron 不可用' };
  const mainWsl = stageRuntime(packageRoot, winBase);
  const stageBase = join(winBase, WIN_STAGE_DIR);
  const configWsl = writeConnectionFile(stageBase, rpcUrl, token);
  const mainWin = toWindowsPath(mainWsl);
  const configWin = toWindowsPath(configWsl);
  if (!mainWin || !configWin) return { ok: false, reason: 'WSL→Windows 路径转换失败' };
  const child = spawn(exeWsl, [mainWin, '--remote-config', configWin], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false,
  });
  child.stdout?.on('data', (chunk) => log.info('[display-layer] ' + String(chunk).trim()));
  child.stderr?.on('data', (chunk) => log.warn('[display-layer] ' + String(chunk).trim()));
  log.info(`[dsh-pet] Windows 显示层已启动（pid=${String(child.pid)}），连接 ${rpcUrl}`);
  return { ok: true, child, exeWsl };
}

/** 尽力结束显示层进程（跨 WSL↔Windows 边界，Linux 侧 child.kill 未必触及 Windows 进程树）。 */
export function stopWindowsDisplayLayer(child: ChildProcess | undefined): void {
  if (!child) return;
  try {
    child.kill();
  } catch {
    /* 已退出 */
  }
}

/**
 * 用显示层启动时写下的 Windows PID 精确结束整棵进程树（taskkill /T /F）。
 *
 * Linux 侧对互操作子进程的 kill 不保证传到 Windows 进程，跨边界收尾必须靠这个；
 * 找不到 pid 文件或执行失败都静默（还有显示层自身的探活自退兜底）。
 *
 * @param winBase - %LOCALAPPDATA%\\dsh-pet 的 WSL 路径。
 */
export function killWindowsDisplayLayerByPidFile(winBase: string | undefined): void {
  if (!winBase) return;
  const pidFile = join(winBase, WIN_STAGE_DIR, 'display.pid');
  if (!existsSync(pidFile)) return;
  let pid: string;
  try {
    pid = readFileSync(pidFile, 'utf8').trim();
  } catch {
    return;
  }
  if (!/^\d+$/.test(pid)) return;
  try {
    execFileSync('/mnt/c/Windows/System32/taskkill.exe', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
  } catch {
    /* 进程已退出或 taskkill 不可用 */
  }
}
