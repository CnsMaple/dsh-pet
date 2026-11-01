/**
 * 远程显示模式下的桌面 Helper 组合根：宿主不再 spawn 本机 Electron，而是开 RPC 服务 + 拉起 Windows 显示层。
 *
 * 与本地 spawn 出来的 Helper 生命周期对齐：有桌面宠物才启动；配置变更由显示层自己轮询 /config 重建，
 * 因此 `stopHelperAndWait`（配置重启用）在这里是空操作，`stopHelper`（插件卸载）才真正收尾。
 * 不实现窗口与传输细节（归显示层 runtime 与 ./remote-display）。
 * @module dsh-pet/src/host/plugin/desktop/remote-helper
 */
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { PACKAGE_ROOT } from '../../paths.ts';
import type { DesktopHelperDeps } from './types.ts';
import { createDesktopPets, type DesktopPets } from './pets.ts';
import { startRemoteDisplayServer, type RemoteDisplayServer } from '../remote-display/server.ts';
import {
  killWindowsDisplayLayerByPidFile,
  launchWindowsDisplayLayer,
  stopWindowsDisplayLayer,
  writeConnectionFile,
  windowsDshPetBaseWsl,
} from '../remote-display/windows-electron.ts';

/** 远程显示 RPC 的默认端口（被占用时 server 会顺延）。 */
const DEFAULT_REMOTE_PORT = 7341;

/** 选一个显示层能访问到的主机地址：显式环境变量优先，否则取第一块非回环 IPv4（WSL 的 eth0）。 */
function pickAdvertiseHost(): string {
  const override = process.env.DSH_PET_REMOTE_HOST;
  if (override) return override;
  const interfaces = networkInterfaces();
  for (const list of Object.values(interfaces)) {
    for (const info of list ?? []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return '127.0.0.1';
}

/** 按扩展名取素材子目录（与 spawn.ts 同口径）。 */
function animSubdirFor(ext: string): string {
  return ext === '.mov' ? 'mov' : 'webm';
}

/**
 * 创建远程显示模式下的桌面 Helper。
 *
 * @param deps - 装配期依赖（与本地模式同一份）。
 * @returns 与本地模式同形的 startHelper/stopHelper/requestRestart/素材根等能力。
 */
export function createRemoteDesktopHelper(deps: DesktopHelperDeps) {
  const { log, getHandlePetRoute, thumbUserRoot } = deps;
  const pets: DesktopPets = createDesktopPets(deps);
  const launchEnabled = process.env.DSH_PET_REMOTE_LAUNCH !== '0';
  const port = Number.parseInt(process.env.DSH_PET_REMOTE_PORT ?? '', 10) || DEFAULT_REMOTE_PORT;

  let server: RemoteDisplayServer | undefined;
  let child: import('node:child_process').ChildProcess | undefined;
  let starting: Promise<void> | undefined;
  let desktopModeEverActive = false;
  let disposed = false; // 阻止后续 startHelper（卸载后不再拉起）
  let stopped = false; // stopHelper 幂等：与 disposed 分开，避免 markDisposed 先置位把真正收尾短路

  const assetRootFor = (ext: string): string => join(PACKAGE_ROOT, 'assets', animSubdirFor(ext));
  const userRootFor = (ext: string): string => join(thumbUserRoot, animSubdirFor(ext));

  /** 启动 RPC 服务并拉起显示层；重复调用返回同一件事。 */
  async function ensureStarted(): Promise<void> {
    if (disposed) return;
    if (!pets.getHasDesktopPet() && !(desktopModeEverActive && pets.getTrayOn())) return;
    if (!launchEnabled) {
      log.info('[dsh-pet] 远程显示已启用但 DSH_PET_REMOTE_LAUNCH=0：只开 RPC 服务，不拉起显示层');
    }
    if (!server) {
      server = await startRemoteDisplayServer({
        handlePetRoute: getHandlePetRoute(),
        log,
        port,
        advertiseHost: pickAdvertiseHost(),
      });
      desktopModeEverActive = true;
      // 连接文件先落地：即使随后自动拉起失败，用户也可按 REMOTE-DISPLAY.md 手动启动显示层。
      try {
        const winBase = windowsDshPetBaseWsl();
        if (winBase) {
          writeConnectionFile(join(winBase, 'display-runtime'), server.baseUrl, server.token);
        }
      } catch (e: unknown) {
        log.warn('[dsh-pet] 写连接文件失败：' + (e instanceof Error ? e.message : String(e)));
      }
    }
    if (!launchEnabled || child) return;
    const result = await launchWindowsDisplayLayer({
      packageRoot: PACKAGE_ROOT,
      rpcUrl: server.baseUrl,
      token: server.token,
      log,
    });
    if (result.ok) {
      child = result.child;
      child.once('exit', (code) => {
        log.warn('[dsh-pet] Windows 显示层已退出（code=' + String(code) + '）');
        if (child === result.child) child = undefined;
      });
    } else {
      log.warn('[dsh-pet] Windows 显示层未能自动拉起：' + result.reason);
      log.warn('[dsh-pet] 可在 Windows 手动运行显示层，RPC 基址：' + server.baseUrl);
    }
  }

  const startHelper = (): void => {
    if (disposed || starting) return;
    if (!pets.getHasDesktopPet() && !(desktopModeEverActive && pets.getTrayOn())) {
      log.info('[dsh-pet] 无桌面宠物，跳过远程显示');
      return;
    }
    starting = ensureStarted()
      .catch((e: unknown) => {
        log.warn('[dsh-pet] 远程显示启动失败：' + (e instanceof Error ? e.message : String(e)));
      })
      .finally(() => {
        starting = undefined;
      });
  };

  const stopHelper = (reason = 'plugin-disposed'): void => {
    if (stopped) return;
    stopped = true;
    disposed = true;
    log.info('[dsh-pet] 停止远程显示（' + reason + '）');
    stopWindowsDisplayLayer(child);
    // Linux 侧 kill 未必触及 Windows 进程树：再按显示层写下的 Windows PID 精确 taskkill。
    try {
      killWindowsDisplayLayerByPidFile(windowsDshPetBaseWsl());
    } catch {
      /* 收尾尽力而为 */
    }
    child = undefined;
    const s = server;
    server = undefined;
    if (s) void s.close();
  };

  const stopHelperAndWait = async (reason: string): Promise<void> => {
    // 配置变更：显示层每 2s 轮询 /config 自行重建窗口，不必重启进程，也不必等它。
    log.info('[dsh-pet] 远程显示配置变更（' + reason + '）：交给显示层自重建');
  };

  const markDisposed = (): void => {
    disposed = true;
  };

  return {
    startHelper,
    stopHelper,
    stopHelperAndWait,
    requestRestart: async (): Promise<void> => {
      await stopHelperAndWait('reload');
      startHelper();
    },
    assetRootFor,
    userRootFor,
    markDisposed,
  };
}
